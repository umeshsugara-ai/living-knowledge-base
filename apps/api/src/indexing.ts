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
import type { Db } from "mongodb";
import { getDb, scopedCollection } from "@lkb/db";
import type { SessionPages, Claims, Sessions, TreeIndexNode, Turns } from "@lkb/core";
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
  /** Injectable so this function's WRITE decisions are testable without a live Mongo. Added for
   * ISS-056: the fix (don't delete a session's claims when extraction degraded) sat behind a
   * module-singleton `getDb()`, so reverting it left every test green — the same untested-guard
   * failure this project has now hit four times. Defaults to the real db; callers pass nothing. */
  db?: Pick<Db, "collection">;
}

/** The one collection here that CANNOT go through `scopedCollection`: `schema/
 * tree_index.schema.json` declares no `tenantId` property at all, so the type does not satisfy
 * `T extends {tenantId: string}` and a `{tenantId}` filter would match nothing. A tenant's tree
 * is separated only by the `tenant:<id>` prefix inside `node_id` — a string convention, not a
 * field, and therefore not something the compiler can enforce. Both callers below are pinned by
 * `indexing.test.ts` instead. Raised in the ISS-060 manifest for the checker to rule on. */
function treeIndexRootFilter(tenantId: string) {
  return { node_id: `tenant:${tenantId}`, level: "tenant" as const };
}

async function loadTreeRoot(tenantId: string, db: Pick<Db, "collection">): Promise<TreeIndexNode | null> {
  return db.collection<TreeIndexNode>("tree_index").findOne(treeIndexRootFilter(tenantId));
}

/** Real summary + real evidence-checked claims + a real tree_index update for one already-
 * ingested session. Never throws out of the caller's control on an LLM failure — `summarizeSession`/
 * `extractClaims` already degrade honestly on their own (a labeled fallback summary, an empty
 * claims list) rather than blocking the pipeline. */
export async function indexSession(tenantId: string, sessionId: string, deps: IndexSessionDeps): Promise<void> {
  const db = deps.db ?? getDb();
  // Tenant-scoped through the SAME injected handle: `scopedCollection` still forces a tenantId at
  // every call site (its whole purpose), it just no longer reaches past the injection to getDb().
  const turnsColl = scopedCollection<Turns>(db as never, "turns");
  const sessionsColl = scopedCollection<Sessions>(db as never, "sessions");
  const sessionPagesColl = scopedCollection<SessionPages>(db as never, "session_pages");
  const claimsColl = scopedCollection<Claims>(db as never, "claims");

  const turns = await turnsColl(tenantId).find({ sessionId }).toArray();

  const [summarizeResult, claimsResult] = await Promise.all([
    summarizeSession(turns, deps.complete),
    extractClaims(turns, deps.complete),
  ]);
  const { page: summary, degraded: summaryDegraded } = summarizeResult;
  const { claims: extractedClaims, degraded: claimsDegraded } = claimsResult;

  // schema/session_pages.schema.json requires evidence.minItems: 1 -- a session with zero turns
  // (nothing was actually ingested) has nothing real to cite, so it gets no session_page rather
  // than one with fabricated/empty evidence. tree_index/status update below still run, so the
  // session isn't stuck "pending" forever over an edge case that shouldn't occur for a real
  // ingest in the first place.
  //
  // The labelled fallback ("(fallback, LLM summary unavailable) ...") is a legitimate FIRST
  // summary for a session that has none yet, but it must never REPLACE a real one a prior
  // successful run already wrote (ISS-059, contract criterion 1a — the same shape as ISS-056's
  // claims defect, one file over). So on a degraded run we check whether a real page already
  // exists before touching anything; a non-degraded run keeps the unconditional replace, since a
  // genuinely fresh summary is always allowed to supersede an older one, fallback or not.
  const existingPage = summaryDegraded ? await sessionPagesColl(tenantId).findOne({ sessionId }) : null;
  if (summaryDegraded && existingPage) {
    console.warn(`indexSession(${tenantId}/${sessionId}): summary degraded — existing session_pages left unchanged: ${summaryDegraded.reason}`);
  } else {
    await sessionPagesColl(tenantId).deleteMany({ sessionId });
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
      await sessionPagesColl(tenantId).insertOne(page);
    }
  }

  // Replace the session's claims ONLY when extraction actually ran. The delete used to be
  // unconditional, so a failed provider call -- which returned an empty array indistinguishable
  // from "no claims found" -- deleted every previously-extracted real claim for this session and
  // inserted nothing back. A transient outage during a re-index silently destroyed good data
  // (ISS-056). On degradation the prior claims are left exactly as they were.
  if (claimsDegraded) {
    console.warn(`indexSession(${tenantId}/${sessionId}): claims left unchanged — ${claimsDegraded.reason}`);
  } else {
    await claimsColl(tenantId).deleteMany({ "evidence.sessionId": sessionId } as never);
  }
  if (!claimsDegraded && extractedClaims.length > 0) {
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
    await claimsColl(tenantId).insertMany(claimDocs);
  }

  const [allSessions, allPages, existingRoot] = await Promise.all([
    sessionsColl(tenantId).find({}).toArray() as Promise<Sessions[]>,
    sessionPagesColl(tenantId).find({}).toArray() as Promise<SessionPages[]>,
    loadTreeRoot(tenantId, db),
  ]);
  const newRoot = existingRoot
    ? regenerate(existingRoot, [sessionId], allSessions, allPages)
    : buildTree(allSessions, allPages)[tenantId];
  if (newRoot) {
    await db.collection<TreeIndexNode>("tree_index")
      .replaceOne(treeIndexRootFilter(tenantId), newRoot, { upsert: true });
  }

  await sessionsColl(tenantId).raw.updateOne({ _id: sessionId, tenantId }, { $set: { "status.index": "done" } });
}

export type IndexSessionFn = typeof indexSession;
/** The composition-root-bound shape every ingest deps builder actually takes — `complete`
 * (and its per-request `tenantId` routing) already closed over, so a caller only ever supplies
 * `(tenantId, sessionId)`. */
export type BoundIndexer = (tenantId: string, sessionId: string) => Promise<void>;
