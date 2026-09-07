/**
 * packages/db/src/lib/tenantScope.test.ts — the tenant boundary is the one invariant in this
 * codebase whose failure is unrecoverable: a cross-tenant delete destroys data belonging to
 * someone who never touched the system.
 *
 * It had ZERO runtime tests until ISS-060. `packages/db` did not even declare a `test` script,
 * so `pnpm -r test` skipped the package silently — the accessor whose entire purpose is to make
 * a tenant-less query impossible was the least-tested file in the workspace. The sibling
 * `collections/tenantScope.typecheck-test.ts` pins only that OMITTING the argument fails to
 * compile; nothing pinned that the argument is actually APPLIED to the query.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { scopedCollection, withTenant } from "./tenantScope.js";

interface Row { _id: string; tenantId: string; sessionId?: string }

interface Call { op: string; filter?: unknown; docs?: unknown }

/** Records what actually reaches the driver — the filter, not just the method name. */
function fakeDb(): { db: Db; calls: Call[] } {
  const calls: Call[] = [];
  const db = {
    collection: () => ({
      find: (filter: unknown) => { calls.push({ op: "find", filter }); return { toArray: async () => [] }; },
      findOne: async (filter: unknown) => { calls.push({ op: "findOne", filter }); return null; },
      insertOne: async (doc: unknown) => { calls.push({ op: "insertOne", docs: [doc] }); return {}; },
      insertMany: async (docs: unknown) => { calls.push({ op: "insertMany", docs }); return {}; },
      deleteMany: async (filter: unknown) => { calls.push({ op: "deleteMany", filter }); return { deletedCount: 0 }; },
    }),
  } as unknown as Db;
  return { db, calls };
}

const coll = (db: Db) => scopedCollection<Row>(db, "rows");

test("every read merges the tenantId into the filter", async () => {
  const { db, calls } = fakeDb();
  coll(db)("t1").find({ sessionId: "s1" });
  await coll(db)("t1").findOne({ sessionId: "s1" });
  assert.deepEqual(calls[0]!.filter, { sessionId: "s1", tenantId: "t1" });
  assert.deepEqual(calls[1]!.filter, { sessionId: "s1", tenantId: "t1" });
});

test("an EMPTY filter still carries the tenantId — the dangerous default", async () => {
  // `find()` / `deleteMany()` with no argument is exactly the call that would otherwise span
  // every tenant in the collection.
  const { db, calls } = fakeDb();
  coll(db)("t1").find();
  await coll(db)("t1").deleteMany();
  assert.deepEqual(calls[0]!.filter, { tenantId: "t1" });
  assert.deepEqual(calls[1]!.filter, { tenantId: "t1" });
});

test("deleteMany is tenant-scoped — ISS-060, the mutation that survived the whole suite", async () => {
  const { db, calls } = fakeDb();
  await coll(db)("t1").deleteMany({ sessionId: "s1" });
  assert.deepEqual(calls[0], { op: "deleteMany", filter: { sessionId: "s1", tenantId: "t1" } });
});

test("a caller CANNOT override the tenantId by putting a different one in the filter", async () => {
  // The scoping would be decorative if a caller-supplied tenantId won: any code path that
  // forwards a user-controlled filter would become a cross-tenant read/delete.
  const { db, calls } = fakeDb();
  await coll(db)("t1").deleteMany({ tenantId: "t2-victim" } as never);
  assert.deepEqual(calls[0]!.filter, { tenantId: "t1" }, "the accessor's own tenantId must win");
});

test("insertOne and insertMany stamp the tenantId onto every document", async () => {
  const { db, calls } = fakeDb();
  await coll(db)("t1").insertOne({ _id: "a" });
  await coll(db)("t1").insertMany([{ _id: "b" }, { _id: "c" }]);
  assert.deepEqual(calls[0]!.docs, [{ _id: "a", tenantId: "t1" }]);
  assert.deepEqual(calls[1]!.docs, [{ _id: "b", tenantId: "t1" }, { _id: "c", tenantId: "t1" }]);
});

test("insertMany of an empty list does not silently become an untenanted call", async () => {
  const { db, calls } = fakeDb();
  await coll(db)("t1").insertMany([]);
  assert.deepEqual(calls[0]!.docs, []);
});

test("an empty tenantId is refused at the accessor, not passed to Mongo as a match-all", async () => {
  const { db, calls } = fakeDb();
  assert.throws(() => coll(db)(""), /tenantId is required/);
  assert.equal(calls.length, 0, "nothing may reach the driver on a refused tenantId");
});

test("withTenant is pure — it does not mutate the caller's filter object", async () => {
  const original = { sessionId: "s1" };
  const merged = withTenant<Row>("t1", original);
  assert.deepEqual(original, { sessionId: "s1" }, "the input filter must be left alone");
  assert.deepEqual(merged, { sessionId: "s1", tenantId: "t1" });
});
