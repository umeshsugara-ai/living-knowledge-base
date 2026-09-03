// packages/db/src/collections/eval-runs.ts — T-012 C2. `coll(tenantId)` accessor matching the
// existing gaps.ts/claims.ts pattern (scopedCollection: a tenant-less call is a TS compile
// error — see tenantScope.typecheck-test.ts), plus the three operations the compete-screen
// route (apps/api/src/routes/compete.ts) needs: create, recordScore, listByCredibility.
import type { EvalRuns } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function evalRuns(tenantId: string) {
  return scopedCollection<EvalRuns>(getDb(), "eval_runs")(tenantId);
}

/** Inserts a new eval-run row (`/compete/start` — no counsellorAnswer/score yet). Named
 * `createEvalRun` (not `create`) — `packages/db/src/collections/gaps.ts` already owns the bare
 * `create` export name and both are re-exported from the same `@lkb/db` index (lint:structure's
 * dupe check). */
export async function createEvalRun(tenantId: string, doc: Omit<EvalRuns, "tenantId">): Promise<void> {
  await evalRuns(tenantId).insertOne(doc);
}

/** `/compete/:id/score` — fills in the counsellor's own answer + both scores on the existing row. */
export async function recordScore(
  tenantId: string,
  id: string,
  update: { counsellorAnswer: EvalRuns["counsellorAnswer"]; score: EvalRuns["score"] },
): Promise<boolean> {
  const result = await evalRuns(tenantId).raw.updateOne(
    { _id: id, tenantId },
    { $set: { counsellorAnswer: update.counsellorAnswer, score: update.score } },
  );
  return result.matchedCount > 0;
}

/** All eval runs at a given credibility tier (e.g. `'internal'`, this unit's only producer). */
export async function listByCredibility(tenantId: string, credibility: EvalRuns["credibility"]): Promise<EvalRuns[]> {
  return evalRuns(tenantId)
    .find({ credibility })
    .toArray();
}
