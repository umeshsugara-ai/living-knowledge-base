/**
 * apps/api/src/indexing.ts — the "make ingested content searchable" step. `config/
 * ai-routing.yaml` has always declared `summarize`/`claims` job kinds, but nothing ever called
 * them for a live-ingested session — T-002's TOC `session_pages`/`claims` were a one-time
 * backfill from pre-written files (`scripts/seed-toc.mjs` only loads JSON, never calls an LLM),
 * confirmed by reading that script. Every source adapter (URL, WhatsApp, and any future one)
 * already stamps a fresh session `status.index: "pending"` — this file is what turns that into
 * `"done"`: real summary + real evidence-checked claims (`@lkb/index`'s `summarizeSession`/
 * `extractClaims`) + a real, incremental `tree_index` update (`@lkb/index`'s `regenerate`, or a
 * fresh `buildTree` the first time a tenant gets one), so newly ingested content shows up in the
 * Brain graph and becomes answerable via `/ask` — not just visible on its own session-detail page.
 *
 * Re-indexing a session (ingest re-run, or a future re-index trigger) is a clean replace, never
 * an accumulate: this session's prior `session_pages`/`claims` rows are deleted before the new
 * ones are written, so re-running never duplicates.
 */
import { randomUUID } from "node:crypto";
import { getDb, sessions as sessionsColl, sessionPages as sessionPagesColl, turns as turnsColl } from "@lkb/db";
import type { SessionPages, Claims, Sessions, TreeIndexNode } from "@lkb/core";
import { summarizeSession, extractClaims, buildTree, regenerate, type SummarizeCompleteFn } from "@lkb/index";

/** `schema/{session_pages,claims}.schema.json` both declare `evidence.minItems: 1`, which the
 * generated types express as a non-empty tuple. Both callers below only ever build this from an
 * array already known non-empty (real turns for a page; `extractClaims` already drops any claim
 * whose evidence list would be empty) — this just satisfies the tuple type honestly instead of
 * casting past it. */
function toEvidenceTuple<T>(items: T[]): [T, ...T[]] {
  if (items.length === 0) throw new Error("toEvidenceTuple: evidence must be non-empty");
  return items as [T, ...T[]];
}

export interface IndexSessionDeps {
  complete: SummarizeCompleteFn;
}

async function loadTreeRoot(tenantId: string): Promise<TreeIndexNode | null> {
  return getDb().collection<TreeIndexNode>("tree_index").findOne({ node_id: `tenant:${tenantId}`, level: "tenant" });
}

/** Real summary + real evidence-checked claims + a real tree_index update for one already-
 * ingested session. Never throws out of the caller's control on an LLM failure — `summarizeSession`/
 * `extractClaims` already degrade honestly on their own (a labeled fallback summary, an empty
 * claims list) rather than blocking the pipeline. */
export async function indexSession(tenantId: string, sessionId: string, deps: IndexSessionDeps): Promise<void> {
  const turns = await turnsColl(tenantId).find({ sessionId }).toArray();

  const [summary, extractedClaims] = await Promise.all([
    summarizeSession(turns, deps.complete),
    extractClaims(turns, deps.complete),
  ]);

  // schema/session_pages.schema.json requires evidence.minItems: 1 -- a session with zero turns
  // (nothing was actually ingested) has nothing real to cite, so it gets no session_page rather
  // than one with fabricated/empty evidence. tree_index/status update below still run, so the
  // session isn't stuck "pending" forever over an edge case that shouldn't occur for a real
  // ingest in the first place.
  await getDb().collection<SessionPages>("session_pages").deleteMany({ tenantId, sessionId });
  if (turns.length > 0) {
    const page: SessionPages = {
      _id: randomUUID(),
      tenantId,
      sessionId,
      summary: summary.summary,
      keyInsights: summary.keyInsights,
      decisions: summary.decisions,
      actionItems: summary.actionItems,
      evidence: toEvidenceTuple(turns.map((t) => ({ turnId: t._id, sessionId }))),
    };
    await getDb().collection<SessionPages>("session_pages").insertOne(page);
  }

  await getDb().collection<Claims>("claims").deleteMany({ tenantId, "evidence.sessionId": sessionId });
  if (extractedClaims.length > 0) {
    const claimDocs: Claims[] = extractedClaims.map((c) => ({
      _id: randomUUID(),
      tenantId,
      text: c.text,
      // Freshly extracted, never auto-reviewed -- schema's status enum's honest default until a
      // human (or a future review pipeline) confirms it, same "needs-review" status T-002's
      // pre-written claims already used for anything not hand-verified.
      status: "needs-review",
      evidence: toEvidenceTuple(c.evidenceTurnIds.map((turnId) => ({ turnId, sessionId }))),
    }));
    await getDb().collection<Claims>("claims").insertMany(claimDocs);
  }

  const [allSessions, allPages, existingRoot] = await Promise.all([
    sessionsColl(tenantId).find({}).toArray() as Promise<Sessions[]>,
    sessionPagesColl(tenantId).find({}).toArray() as Promise<SessionPages[]>,
    loadTreeRoot(tenantId),
  ]);
  const newRoot = existingRoot
    ? regenerate(existingRoot, [sessionId], allSessions, allPages)
    : buildTree(allSessions, allPages)[tenantId];
  if (newRoot) {
    await getDb().collection<TreeIndexNode>("tree_index")
      .replaceOne({ node_id: `tenant:${tenantId}`, level: "tenant" }, newRoot, { upsert: true });
  }

  await sessionsColl(tenantId).raw.updateOne({ _id: sessionId, tenantId }, { $set: { "status.index": "done" } });
}

export type IndexSessionFn = typeof indexSession;
/** The composition-root-bound shape every ingest deps builder actually takes — `complete`
 * (and its per-request `tenantId` routing) already closed over, so a caller only ever supplies
 * `(tenantId, sessionId)`. */
export type BoundIndexer = (tenantId: string, sessionId: string) => Promise<void>;
