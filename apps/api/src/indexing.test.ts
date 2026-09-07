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

interface Call { coll: string; op: string; filter?: Record<string, unknown>; docs?: Record<string, unknown>[]; update?: Record<string, unknown> }

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
      const rec = (op: string, extra?: { filter?: Record<string, unknown>; docs?: Record<string, unknown>[]; update?: Record<string, unknown> }) => {
        calls.push({ coll: name, op, filter: extra?.filter, docs: extra?.docs, update: extra?.update });
      };
      return {
        deleteMany: async (filter?: Record<string, unknown>) => { rec("deleteMany", { filter }); return { deletedCount: 0 }; },
        insertOne: async (doc?: Record<string, unknown>) => { rec("insertOne", { docs: doc ? [doc] : [] }); return {}; },
        insertMany: async (docs?: Record<string, unknown>[]) => { rec("insertMany", { docs: docs ?? [] }); return {}; },
        replaceOne: async (filter?: Record<string, unknown>) => { rec("replaceOne", { filter }); return {}; },
        findOne: async (filter?: Record<string, unknown>) => { rec("findOne", { filter }); return null; },
        find: (filter?: Record<string, unknown>) => ({
          toArray: async () => { rec("find", { filter }); return name === "turns" ? [TURN] : []; },
        }),
        updateOne: async (filter?: Record<string, unknown>, update?: Record<string, unknown>) => { rec("updateOne", { filter, update }); return {}; },
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

/**
 * Asserts EVERY call `indexSession` issued is confined to `tenantId` — both the read/delete side
 * (the filter) and the write side (the inserted documents). ISS-061: the first version of this
 * check only looked at `call.filter` and skipped every call with none, which is exactly how
 * inserts are shaped — `insertOne`/`insertMany` carry documents, not a filter. A raw, untenanted
 * `insertOne` added anywhere inside `indexSession` passed the whole suite and typechecked clean
 * under that version. Checking documents closes the exact gap the checker demonstrated live.
 */
function assertAllCallsConfined(calls: Call[], tenantId: string) {
  for (const call of calls) {
    if (call.coll === "tree_index") {
      // schema/tree_index.schema.json has no tenantId property — its rows are separated only by
      // the `tenant:<id>` prefix inside node_id (contract criterion 3a). Asserted here precisely
      // BECAUSE the compiler cannot assert it. tree_index never inserts (replaceOne/findOne only).
      if (call.filter) assert.equal(call.filter.node_id, `tenant:${tenantId}`, `${call.coll}.${call.op} must target this tenant's root node`);
      continue;
    }
    if (call.filter) {
      assert.equal(call.filter.tenantId, tenantId, `${call.coll}.${call.op} issued a query with no tenantId — it can reach another tenant's rows`);
    }
    for (const doc of call.docs ?? []) {
      assert.equal(doc.tenantId, tenantId, `${call.coll}.${call.op} wrote a document with no tenantId — it can be written into another tenant's data (ISS-061)`);
    }
    if (call.update) {
      // A checker-reported gap (2026-09-07, cycle 1 dispatch that terminated on an API error
      // before writing a verdict): `updateOne`'s FILTER can carry the right tenantId while its
      // UPDATE body reassigns the document to a different one — a cross-tenant takeover this
      // check did not previously look for at all. Both the `$set` shape and a raw replacement
      // document are covered; a call with neither present is not reassigning anything.
      const setBlock = (call.update.$set ?? {}) as Record<string, unknown>;
      if ("tenantId" in setBlock) {
        assert.equal(setBlock.tenantId, tenantId, `${call.coll}.${call.op}'s $set reassigns tenantId — it can move a document into another tenant`);
      }
      if ("tenantId" in call.update) {
        assert.equal(call.update.tenantId, tenantId, `${call.coll}.${call.op}'s update body reassigns tenantId — it can move a document into another tenant`);
      }
    }
  }
}

test("EVERY query AND every write indexSession issues is confined to its own tenant (ISS-060, ISS-061)", async () => {
  // The checker's unlisted mutation: drop `tenantId` from the claims deleteMany. It survived the
  // whole suite and typecheck, and live it took TWO scratch tenants from 1 -> 0 — one of them a
  // tenant that had nothing to do with the re-index. Op names alone could never catch it.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith() as never, db });

  const writes = calls.filter((c) => ["deleteMany", "insertMany", "insertOne", "replaceOne", "updateOne"].includes(c.op));
  assert.ok(writes.length >= 4, `expected the real write set, got ${writes.length}`);
  const inserts = calls.filter((c) => c.op === "insertOne" || c.op === "insertMany");
  assert.ok(inserts.some((c) => (c.docs?.length ?? 0) > 0), "a healthy run must actually insert at least one document — otherwise this test checks nothing on the write side");

  assertAllCallsConfined(calls, "t");
});

test("a DEGRADED run's writes are tenant-scoped too — the guard must not be a bypass", async () => {
  // The degraded path takes a different branch through the same function; scoping it only on the
  // healthy path would leave the exact conditions of the ISS-056 outage unprotected.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith({ claimsFails: true }) as never, db });
  assertAllCallsConfined(calls, "t");
});

test("session_pages are still written on a degraded CLAIMS run — the two paths are independent", async () => {
  // summarize degrades to its own labelled fallback, so the page must still be produced; a claims
  // failure must not silently take the summary down with it.
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith({ claimsFails: true }) as never, db });
  const pageOps = calls.filter((c) => c.coll === "session_pages").map((c) => c.op);
  assert.ok(pageOps.includes("deleteMany"), "session_pages should still be replaced");
});
