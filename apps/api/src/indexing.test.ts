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
/** `existingSessionPage`, when set, is what `session_pages.findOne` returns — used to test the
 * ISS-059 guard (a degraded summarize run must not overwrite a real prior page). */
function fakeDb(opts: { existingSessionPage?: Record<string, unknown> | null } = {}): { db: Pick<Db, "collection">; calls: Call[] } {
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
        findOne: async (filter?: Record<string, unknown>) => {
          rec("findOne", { filter });
          return name === "session_pages" ? (opts.existingSessionPage ?? null) : null;
        },
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

/** `complete` is called for both summarize and claims; route by the job kind. Each path degrades
 * independently, matching the real degradation shapes (ISS-056/ISS-059) — a claims outage must
 * not take the summary down with it, and vice versa. */
function completeWith({ claimsFails = false, summarizeFails = false } = {}) {
  return async (job: { kind: string }) => {
    if (job.kind === "claims") {
      if (claimsFails) throw new Error("provider down");
      return { text: CLAIMS_JSON, json: undefined, usage: {}, provider: "fake", model: "fake" };
    }
    if (summarizeFails) throw new Error("provider down");
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
/**
 * Checks an `updateOne` call's UPDATE BODY, not just its filter — `updateOne`'s filter can carry
 * the right tenantId while the update itself moves the document to a different one. First found
 * (2026-09-07) as a single `$set`-only check; that missed `$unset` stripping `tenantId` entirely
 * (ISS-066) — the second instance of this project's own untested-guard pattern landing inside a
 * unit built specifically to close the first instance. Fixed generically this time: every
 * MongoDB update operator's sub-object (`$set`, `$unset`, `$rename`, `$currentDate`, …) and a raw
 * replacement document are all scanned the same way, so a THIRD operator doesn't need a THIRD
 * special case.
 */
function assertUpdateBodyConfined(call: Call, tenantId: string) {
  const update = call.update!;
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith("$")) {
      // A raw replacement document (no operators at all) — `key` is a field name directly.
      if (key === "tenantId") assert.equal(value, tenantId, `${call.coll}.${call.op}'s update body reassigns tenantId — it can move a document into another tenant`);
      continue;
    }
    const operand = value as Record<string, unknown>;
    if (operand === null || typeof operand !== "object" || !("tenantId" in operand)) continue;
    if (key === "$unset") {
      assert.fail(`${call.coll}.${call.op}'s ${key} strips tenantId — the document would carry no tenant at all (ISS-066)`);
    } else {
      assert.equal(operand.tenantId, tenantId, `${call.coll}.${call.op}'s ${key} reassigns tenantId — it can move a document into another tenant`);
    }
  }
}

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
    if (call.update) assertUpdateBodyConfined(call, tenantId);
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

const pageOps = (calls: Call[]) => calls.filter((c) => c.coll === "session_pages").map((c) => c.op);

// indexSession always ends with `sessionPagesColl(tenantId).find({}).toArray()` (feeding the
// tree_index rebuild), so every op sequence below ends in a trailing "find" regardless of branch.

test("a DEGRADED summarize run with NO existing page still writes the labelled fallback (ISS-059)", async () => {
  // The fallback is a legitimate FIRST summary — this is the case criterion 1 still requires.
  const { db, calls } = fakeDb({ existingSessionPage: null });
  await indexSession("t", "s1", { complete: completeWith({ summarizeFails: true }) as never, db });
  assert.deepEqual(pageOps(calls), ["findOne", "deleteMany", "insertOne", "find"], "no existing page -> the fallback is written as normal");
});

test("a DEGRADED summarize run with a REAL existing page must NOT touch it (ISS-059, criterion 1a)", async () => {
  // The exact bug this unit fixes: before the fix, a transient outage during a re-index silently
  // replaced a good summary with a 500-char transcript slice, and status.index still flipped to
  // "done" as if nothing had gone wrong.
  const existing = { _id: "p1", tenantId: "t", sessionId: "s1", summary: "A real, previously-written summary." };
  const { db, calls } = fakeDb({ existingSessionPage: existing });
  await indexSession("t", "s1", { complete: completeWith({ summarizeFails: true }) as never, db });
  assert.deepEqual(pageOps(calls), ["findOne", "find"], "a degraded run with a real page on file must issue NO WRITE of any kind to session_pages");
});

test("a SUCCESSFUL summarize run always replaces the page, even when one already exists", async () => {
  // The other half — a guard that refuses to replace ANY existing page would be just as broken,
  // because a genuinely fresh, correct summary could never supersede an older one.
  const existing = { _id: "p1", tenantId: "t", sessionId: "s1", summary: "An older summary." };
  const { db, calls } = fakeDb({ existingSessionPage: existing });
  await indexSession("t", "s1", { complete: completeWith() as never, db });
  // A non-degraded run never calls findOne on session_pages (only the degraded branch does).
  assert.deepEqual(pageOps(calls), ["deleteMany", "insertOne", "find"]);
});

test("a DEGRADED SUMMARIZE run does not take the claims write down with it — the two paths are independent", async () => {
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith({ summarizeFails: true }) as never, db });
  const claimOps = calls.filter((c) => c.coll === "claims").map((c) => c.op);
  assert.deepEqual(claimOps, ["deleteMany", "insertMany"], "a summarize outage must not affect the claims write");
});
