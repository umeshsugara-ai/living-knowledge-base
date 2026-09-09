/**
 * apps/api/src/search-store.test.ts — asserts what `createMongoSearchDeps` actually sends to and
 * does with Mongo, captured through an injected db handle.
 *
 * History, because it explains the shape: an earlier version captured the filter and then threw
 * most of it away. A checker executed six original mutations against it and FIVE went undetected
 * with 102/102 green —
 *   5A  `scopedCollection` removed from the turns handle  -> EVERY tenant's turns returned
 *   5B  `k` ignored                                        -> contract [I2]'s MAX_K guard inert
 *   5C  every hit given the wrong session
 *   5D  every hit given the wrong turn
 *   5F  session dedup removed                              -> the N+1 [I3] forbids
 * Only 5E (duplicated results) was caught. 5A is a cross-tenant read disclosure of verbatim
 * transcript text, and `packages/db/src/lib/tenantScope.test.ts` calls the tenant boundary "the one
 * invariant in this codebase whose failure is unrecoverable".
 *
 * Two root causes, both fixed here rather than patched around:
 *   1. The old fake had semantics real Mongo does not: `findOne` returned the same session for
 *      every `_id`, and `find` returned the whole corpus regardless of filter — so id-keyed and
 *      tenant-keyed resolution were unfalsifiable by construction. The fake below applies filters.
 *   2. The old assertion narrowed the captured object to `$or` and discarded `tenantId`. The repo
 *      already had the answer — `indexing.test.ts`'s `assertAllCallsConfined` — for the very
 *      function this store copied its injectable shape from. The shape was copied; the tenant
 *      assertion that came with it was not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lexicalSearchTurns } from "@lkb/index";
import { createMongoSearchDeps } from "./search-store.js";
import { prefilterMatches, type TurnPrefilter } from "./search-prefilter.js";

const SESSIONS = [
  { _id: "s1", tenantId: "toc", sourceId: "src1", title: "New Zealand Visas", date: "2026-01-01", status: { transcribe: "done", index: "done" } },
  { _id: "s2", tenantId: "toc", sourceId: "src2", title: "Funding and Forex", date: "2026-01-02", status: { transcribe: "done", index: "done" } },
  { _id: "s3", tenantId: "toc", sourceId: "src3", title: "AI in Counselling", date: "2026-01-03", status: { transcribe: "done", index: "done" } },
  // A different tenant's row, present so an unscoped query is DETECTABLE rather than merely wrong.
  { _id: "s9", tenantId: "other", sourceId: "src9", title: "Other Tenant Session", date: "2026-01-04", status: { transcribe: "done", index: "done" } },
];

const CORPUS = [
  { _id: "t1", tenantId: "toc", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "New Zealand student visa approval rates for the 2026 intake." },
  { _id: "t2", tenantId: "toc", sessionId: "s2", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Education loan interest rates and forex markups of 2.5% at banks." },
  { _id: "t3", tenantId: "toc", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Completely unrelated small talk about the weather today." },
  { _id: "t4", tenantId: "toc", sessionId: "s3", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "AI is reshaping counselling workflows in 2026." },
  { _id: "t5", tenantId: "toc", sessionId: "s3", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Is it ok to go without a bank statement?" },
  // Second 2026 turn in s1: makes "2026" a 3-hit / 2-session query, so session dedup is testable.
  { _id: "t6", tenantId: "toc", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Deadlines for the 2026 September cohort close in March." },
  // Another tenant's turn — an unscoped turns query would score and return this.
  { _id: "t9", tenantId: "other", sessionId: "s9", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Another tenant private 2026 visa transcript." },
];

interface Call { coll: string; op: "find" | "findOne"; filter: Record<string, unknown> }

/** Applies a filter the way Mongo would, so id-keyed and tenant-keyed resolution are falsifiable.
 * The old fake ignored the filter entirely, which is why 5A/5C/5D could not be caught. */
function matches(filter: Record<string, unknown>, doc: Record<string, unknown>): boolean {
  if (filter.tenantId !== undefined && doc.tenantId !== filter.tenantId) return false;
  if (filter._id !== undefined && doc._id !== filter._id) return false;
  const or = filter.$or as TurnPrefilter["$or"] | undefined;
  if (Array.isArray(or)) return prefilterMatches({ $or: or }, String(doc.text ?? ""));
  return true;
}

function capturingDb() {
  const calls: Call[] = [];
  const rows = (name: string) => (name === "turns" ? CORPUS : SESSIONS) as unknown as Record<string, unknown>[];
  const db = {
    collection: (name: string) => ({
      find: (filter: Record<string, unknown>) => {
        calls.push({ coll: name, op: "find", filter });
        return { toArray: async () => rows(name).filter((d) => matches(filter, d)) };
      },
      findOne: async (filter: Record<string, unknown>) => {
        calls.push({ coll: name, op: "findOne", filter });
        return rows(name).find((d) => matches(filter, d)) ?? null;
      },
    }),
  };
  return { db: db as never, calls };
}

/** ISS-078. Mirrors `indexing.test.ts`'s `assertAllCallsConfined`: EVERY query must carry the
 * tenantId, not only the ones a given test happened to look at. */
function assertAllCallsConfined(calls: Call[], tenantId: string) {
  assert.ok(calls.length > 0, "expected at least one db call to assert on");
  for (const c of calls) {
    assert.equal(
      c.filter.tenantId, tenantId,
      `${c.coll}.${c.op} issued a query with no tenantId — it can reach another tenant's rows`,
    );
  }
}

function derivedQueries(): string[] {
  const words = [...new Set(CORPUS.filter((t) => t.tenantId === "toc")
    .flatMap((t) => t.text.toLowerCase().split(/\W+/).filter(Boolean)))];
  const pairs = words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`);
  return [...words, ...pairs];
}

const OWN = CORPUS.filter((t) => t.tenantId === "toc");

test("EVERY query is tenant-confined — the filter's tenantId, not just its $or (ISS-078)", async () => {
  for (const q of ["2026", "visa", "rates", "counselling"]) {
    const { db, calls } = capturingDb();
    await createMongoSearchDeps({ db }).search("toc", q, 10);
    assertAllCallsConfined(calls, "toc");
  }
});

test("no other tenant's turn or session can ever be returned", async () => {
  const { db } = capturingDb();
  // "2026" matches another tenant's turn t9 too; only tenant-scoping keeps it out.
  const hits = await createMongoSearchDeps({ db }).search("toc", "2026", 10);
  assert.ok(hits.length > 0, "precondition: this query must hit something");
  for (const h of hits) {
    assert.notEqual(h.turnId, "t9", "another tenant's turn leaked into the results");
    assert.equal(h.turn?.tenantId, "toc");
    assert.notEqual(h.session?._id, "s9", "another tenant's session leaked into the results");
  }
});

test("the filter sent to Mongo is a superset of what the scorer can score — over DERIVED queries", async () => {
  const queries = derivedQueries();
  assert.ok(queries.length > 40, `expected a real generated query set, got ${queries.length}`);
  assert.ok(queries.some((q) => /\d/.test(q)), "the corpus must contribute numeric tokens");

  for (const q of queries) {
    const { db, calls } = capturingDb();
    await createMongoSearchDeps({ db }).search("toc", q, 50);
    const scored = lexicalSearchTurns(q, OWN, OWN.length);
    if (scored.length === 0) continue;
    const turnsFind = calls.find((c) => c.coll === "turns" && c.op === "find");
    assert.ok(turnsFind, `"${q}" issued no turns query`);
    for (const hit of scored) {
      const turn = OWN.find((t) => t._id === hit.turnId)!;
      assert.ok(
        matches(turnsFind!.filter, turn as unknown as Record<string, unknown>),
        `"${q}" scores turn ${hit.turnId} at ${hit.score}, but the filter SENT TO MONGO excludes it — silently lost`,
      );
    }
  }
});

test("k is honoured — the store must not return more than asked (ISS-079, contract [I2])", async () => {
  const { db } = capturingDb();
  const all = await createMongoSearchDeps({ db }).search("toc", "2026", 10);
  assert.ok(all.length >= 3, `precondition: "2026" must hit >=3 turns, got ${all.length}`);
  for (const k of [1, 2]) {
    const { db: db2 } = capturingDb();
    const hits = await createMongoSearchDeps({ db: db2 }).search("toc", "2026", k);
    assert.equal(hits.length, k, `k=${k} must cap the result count — ignoring k makes MAX_K inert`);
  }
});

test("each hit carries ITS OWN turn and session, not another hit's (ISS-080)", async () => {
  // "2026" spans s1 and s3, whose titles differ — the old single-session fixture made a broken
  // Map lookup indistinguishable from a correct one.
  const { db } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "2026", 10);
  const bySession = new Set(hits.map((h) => h.sessionId));
  assert.ok(bySession.size >= 2, `precondition: query must span >=2 sessions, got ${bySession.size}`);
  for (const h of hits) {
    assert.equal(h.turn?._id, h.turnId, "hit carries a different turn than the one it scored");
    assert.equal(h.turn?.sessionId, h.sessionId, "hit's turn belongs to a different session");
    assert.equal(h.session?._id, h.sessionId, "hit carries a different session than its own");
    const expected = SESSIONS.find((s) => s._id === h.sessionId)!;
    assert.equal(h.session?.title, expected.title, "hit carries the wrong session's title");
  }
});

test("hit.score matches what the scorer independently computes for that turn (ISS-083)", async () => {
  // A sixth-bypass hunt found this uncaught: `score: 0.5` hardcoded on every hit left 107/107
  // green, because no test read the field. Cross-checks against a SEPARATE lexicalSearchTurns
  // call over the same corpus, so the store cannot pass a value it merely copied from itself.
  for (const q of ["visa", "2026", "counselling"]) {
    const { db } = capturingDb();
    const hits = await createMongoSearchDeps({ db }).search("toc", q, 10);
    const independent = new Map(lexicalSearchTurns(q, OWN, OWN.length).map((h) => [h.turnId, h.score]));
    for (const h of hits) {
      assert.equal(h.score, independent.get(h.turnId), `"${q}" hit ${h.turnId} carries score ${h.score}, scorer independently computed ${independent.get(h.turnId)}`);
    }
  }
});

test("each hit's (turnId, sessionId) pair matches what the scorer actually ranked at that position (ISS-084)", async () => {
  // A sixth-bypass hunt found this uncaught too: rotating turnId/sessionId/turn/session together
  // across hits (each internally self-consistent) left 107/107 green, because prior assertions
  // only checked a hit against ITSELF, never against the scorer's own independent ranking.
  for (const q of ["visa", "2026", "counselling"]) {
    const { db } = capturingDb();
    const hits = await createMongoSearchDeps({ db }).search("toc", q, 10);
    const independent = lexicalSearchTurns(q, OWN, OWN.length);
    const bySessionId = new Map(OWN.map((t) => [t._id, t.sessionId]));
    assert.equal(hits.length, independent.length, `"${q}" returned ${hits.length} hits, scorer independently ranked ${independent.length}`);
    for (let i = 0; i < hits.length; i++) {
      assert.equal(hits[i]!.turnId, independent[i]!.turnId, `"${q}" position ${i}: turnId does not match the scorer's own rank order`);
      assert.equal(hits[i]!.sessionId, bySessionId.get(independent[i]!.turnId), `"${q}" position ${i}: sessionId does not match this turn's real session`);
    }
  }
});

test("turns load once and sessions are fetched once each, never once per hit (ISS-080/085, contract [I3] N+1)", async () => {
  const { db, calls } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "2026", 10);
  const distinct = new Set(hits.map((h) => h.sessionId)).size;
  const turnsFinds = calls.filter((c) => c.coll === "turns" && c.op === "find").length;
  const turnsFindOnes = calls.filter((c) => c.coll === "turns" && c.op === "findOne").length;
  const lookups = calls.filter((c) => c.coll === "sessions" && c.op === "findOne").length;
  assert.ok(hits.length > distinct, `precondition: need a repeated session (${hits.length} hits over ${distinct})`);
  assert.equal(turnsFinds, 1, `${turnsFinds} turns.find calls — turns must load exactly once per request`);
  assert.equal(turnsFindOnes, 0, `${turnsFindOnes} turns.findOne calls — per-hit turn lookup reintroduces N+1`);
  assert.equal(lookups, distinct, `${lookups} session lookups for ${distinct} distinct sessions — dedup was dropped`);
});

test("a query with no usable tokens issues no database query at all", async () => {
  const { db, calls } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "!!! ???", 10);
  assert.deepEqual(hits, []);
  assert.equal(calls.length, 0, "an unmatchable query must not scan the collection");
});

test("results still resolve through the injected handle end to end", async () => {
  const { db } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "visa", 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.turnId, "t1");
  assert.equal(hits[0]?.turn?.text, CORPUS[0]!.text);
  assert.equal(hits[0]?.session?.title, "New Zealand Visas");
});
