/**
 * apps/api/src/search-store.ts — the real `SearchDeps` for `routes/search.ts`. Extracted from
 * `store.ts` when that file crossed its 300-LOC budget; the same separate-store-module convention
 * `ingest-store.ts` and `whatsapp-store.ts` already follow, so this is the established shape
 * rather than a new one.
 */
import type { Db } from "mongodb";
import type { Sessions, Turns } from "@lkb/core";
import { getDb, scopedCollection } from "@lkb/db";
import { lexicalSearchTurns } from "@lkb/index";
import { buildTurnPrefilter } from "./search-prefilter.js";
import type { SearchDeps, SearchHit } from "./routes/search.js";

/**
 * Pre-filters candidates in Mongo, scores them with `@lkb/index`'s pure `lexicalSearchTurns`,
 * then resolves each hit's own turn doc (already in hand from the fetch — no second turn query)
 * plus its session (deduped: multiple hits can share a session, fetched once each via a Set of
 * distinct ids, not once per hit).
 *
 * The pre-filter replaces an unbounded `find({})`. Measured against real data 2026-09-08
 * (2118 turns, tenant `toc`): fetching every turn cost a median **1064ms** while scoring them
 * cost **38ms** — i.e. ~75% of a 1.4s search was shipping 1.7MB of transcript text over the
 * wire, and computation was never the bottleneck. A projection was measured first and rejected:
 * limiting to `_id`/`sessionId`/`text` shrank the payload only **8%**, because `text` IS the
 * payload. Filtering server-side moved the fetch to **663ms** on the same query.
 *
 * **Why this is answer-preserving by construction rather than by luck:** the tokens come from
 * `lexicalQueryTokens`, the scorer's OWN tokenizer, and `lexicalSearchTurns` scores a turn above
 * zero only when one of those tokens matches as a whole token. A substring match is strictly more
 * permissive, so this filter returns a superset of everything that could score; the extras score
 * 0 and are dropped. Deriving a separate token list here would silently break that — verified
 * against real data that a plausible `length > 2` token filter turned a 10-hit result for
 * "AI in counselling" into 2, and reduced "is it ok to go" to zero tokens (an empty `$or`, which
 * Mongo rejects outright). `lexical.test.ts` pins the superset property mechanically.
 *
 * Honest ceiling: this is still an unindexed scan (`turns` carries only `_id_`, `tenantId_1`,
 * `tenantId_1_sessionId_1` — no text index), so it is a constant-factor win, not a change in
 * complexity. Plan §10's Phase-1 retrieval layer is where that gets fixed properly; this keeps
 * U1.5 from inheriting a silent 1.4s.
 */
export interface SearchStoreDeps {
  /** Injectable so the FILTER OBJECT this function actually sends to Mongo is testable without a
   * live database. Added for ISS-076: three separate bypasses (mutating the filter after building
   * it, laundering it through a wrapper module, or breaking the builder itself) each kept every
   * source-text assertion satisfied and left all 99 tests green — one of them measurably losing 6
   * of 20 real hits against production. A source pin can only ever pin the previous attack's
   * syntax; asserting on the object that reaches `find()` closes the class instead of the
   * instance. Same shape `indexSession` gained for ISS-056, for the same reason. Defaults to the
   * real db; production callers pass nothing. */
  db?: Pick<Db, "collection">;
}

export function createMongoSearchDeps(deps: SearchStoreDeps = {}): SearchDeps {
  return {
    async search(tenantId, query, k): Promise<SearchHit[]> {
      // Resolved per call, not at construction: production builds these deps at boot, before
      // connect(). Tenant-scoping still runs through scopedCollection on the injected handle.
      const db = deps.db ?? getDb();
      const turnsColl = scopedCollection<Turns>(db as never, "turns");
      const sessionsColl = scopedCollection<Sessions>(db as never, "sessions");
      // buildTurnPrefilter owns the superset invariant and is pinned by search-prefilter.test.ts
      // (ISS-072: this construction previously lived inline here, where no test could fail on it).
      const prefilter = buildTurnPrefilter(query);
      if (prefilter === null) return [];
      const turns = await turnsColl(tenantId).find(prefilter as never).toArray();
      const scored = lexicalSearchTurns(
        query,
        turns.map((t) => ({ _id: t._id, sessionId: t.sessionId, text: t.text })),
        k,
      );
      const turnById = new Map(turns.map((t) => [t._id, t]));
      const sessionIds = [...new Set(scored.map((s) => s.sessionId))];
      const sessions = await Promise.all(sessionIds.map((id) => sessionsColl(tenantId).findOne({ _id: id })));
      const sessionById = new Map(sessionIds.map((id, i) => [id, sessions[i] ?? null]));
      return scored.map((hit) => ({
        turnId: hit.turnId,
        sessionId: hit.sessionId,
        score: hit.score,
        turn: turnById.get(hit.turnId) ?? null,
        session: sessionById.get(hit.sessionId) ?? null,
      }));
    },
  };
}
