/**
 * apps/api/src/indexing.test.ts — the WRITE decisions of `indexSession`, with an injected fake db.
 *
 * Exists because of ISS-056 and, more pointedly, because the first attempt at fixing it was
 * untestable: the guard sat behind a module-singleton `getDb()`, so reverting it left every test
 * green. That is the fourth time in this project a guard has shipped with nothing pinning it, so
 * the db became injectable rather than the gap being disclosed again.
 *
 * The bug being pinned: the claims `deleteMany` was UNCONDITIONAL while the `insertMany` was
 * conditional, and a failed provider call returned an empty array indistinguishable from "this
 * transcript has no claims". So a transient outage during a re-index deleted every previously
 * extracted real claim for that session and wrote nothing back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { indexSession } from "./indexing.js";

interface Call { coll: string; op: string }

/**
 * Records every collection operation. `turns` MUST return a real row: with zero turns
 * `extractClaims` short-circuits to a non-degraded empty result (correctly — there is nothing to
 * extract), so an empty fixture silently tests the wrong branch. The first version of this fake
 * returned nothing anywhere and the degraded-run test failed for that reason, not a code fault.
 */
function fakeDb(): { db: Pick<Db, "collection">; calls: Call[] } {
  const calls: Call[] = [];
  const TURN = { _id: "t1", tenantId: "t", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "A real sentence." };
  const db = {
    collection(name: string) {
      const rec = (op: string) => { calls.push({ coll: name, op }); };
      return {
        deleteMany: async () => { rec("deleteMany"); return { deletedCount: 0 }; },
        insertOne: async () => { rec("insertOne"); return {}; },
        insertMany: async () => { rec("insertMany"); return {}; },
        replaceOne: async () => { rec("replaceOne"); return {}; },
        findOne: async () => { rec("findOne"); return null; },
        find: () => ({ toArray: async () => { rec("find"); return name === "turns" ? [TURN] : []; } }),
        updateOne: async () => { rec("updateOne"); return {}; },
      };
    },
  } as unknown as Pick<Db, "collection">;
  return { db, calls };
}

const CLAIMS_JSON = JSON.stringify([{ text: "A real claim.", turnIds: ["t1"] }]);

/** `complete` is called for both summarize and claims; route by the job kind. */
function completeWith({ claimsFails = false } = {}) {
  return async (job: { kind: string }) => {
    if (job.kind === "claims") {
      if (claimsFails) throw new Error("provider down");
      return { text: CLAIMS_JSON, json: undefined, usage: {}, provider: "fake", model: "fake" };
    }
    return {
      text: JSON.stringify({ summary: "s", keyInsights: [], decisions: [], actionItems: [] }),
      json: undefined, usage: {}, provider: "fake", model: "fake",
    };
  };
}

const claimOps = (calls: Call[]) => calls.filter((c) => c.coll === "claims").map((c) => c.op);

test("a DEGRADED claims extraction must NOT delete the session's existing claims", async () => {
  // The regression that matters: before the fix this deleted everything and inserted nothing.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith({ claimsFails: true }) as never, db });
  assert.deepEqual(claimOps(calls), [], "no claims write of any kind may happen on a degraded run");
});

test("a SUCCESSFUL extraction still replaces the session's claims (delete then insert)", async () => {
  // The other half — a guard that never lets claims be replaced would be just as broken, because
  // stale claims would then live forever.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith() as never, db });
  const ops = claimOps(calls);
  assert.ok(ops.includes("deleteMany"), "a real extraction must replace the prior claims");
  assert.equal(ops[0], "deleteMany", "delete must precede insert so re-indexing never duplicates");
});

test("session_pages are still written on a degraded CLAIMS run — the two paths are independent", async () => {
  // summarize degrades to its own labelled fallback, so the page must still be produced; a claims
  // failure must not silently take the summary down with it.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith({ claimsFails: true }) as never, db });
  const pageOps = calls.filter((c) => c.coll === "session_pages").map((c) => c.op);
  assert.ok(pageOps.includes("deleteMany"), "session_pages should still be replaced");
});
