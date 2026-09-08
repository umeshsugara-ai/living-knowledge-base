/**
 * apps/api/src/vector-gap.test.ts — ISS-118. The DURABLE record that a session has no vectors.
 *
 * These tests exist because a `console.warn` was NOT a guarantee: the U1.0b checker disabled the
 * warn on BOTH ingest paths simultaneously and the entire 124-test suite stayed green. A surface
 * nothing asserts is one careless edit away from the silence that let three whole sessions sit
 * outside the vector index while every status field read "done".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { indexSession } from "./session.js";
import { fakeDb, completeWith, embedOk, assertUpdateBodyConfined, type Call } from "./testutils.js";

/* ── ISS-118: the DURABLE record of a missing vector index ────────────────────────────────────
 * U1.0b surfaced the skip in a return value and a console.warn. The checker then disabled BOTH
 * ingest paths' warns at once and the whole suite stayed green — so the operator-facing half was
 * unguarded. These tests pin the `gaps` row, which is the surface that actually survives the
 * process and is queryable via GET /gaps.
 */
const gapCalls = (calls: Call[]) => calls.filter((c) => c.coll === "gaps");

test("ISS-118: a session that gets NO vectors writes an OPEN vector-pending gap row", async () => {
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", {
    complete: completeWith() as never,
    embed: async () => { throw new Error("all providers failed"); },
    db,
  });
  const g = gapCalls(calls);
  assert.equal(g.length, 1, "exactly one gap write");
  const set = (g[0]!.update as Record<string, Record<string, unknown>>).$set!;
  assert.equal(set.kind, "vector-pending");
  assert.equal(set.status, "open");
  assert.equal(set.sourceRef, "s1");
  assert.equal(set.tenantId, "t");
  assert.match(String(set.description), /no embedding vectors/);
});

test("ISS-118: the gap row is UPSERTED on a derived id, so a re-index cannot accumulate duplicates", async () => {
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", {
    complete: completeWith() as never,
    embed: async () => { throw new Error("down"); },
    db,
  });
  const g = gapCalls(calls)[0]!;
  assert.equal(g.op, "updateOne", "must be an upsert, never an insert that can duplicate");
  assert.equal((g.filter as Record<string, unknown>)._id, "vector-pending:s1", "id derived from the session");
  assert.deepEqual(g.options, { upsert: true });
});

test("ISS-118: a SUCCESSFUL run resolves a previous gap instead of leaving a stale open one", async () => {
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", { complete: completeWith() as never, embed: embedOk as never, db });
  const g = gapCalls(calls);
  assert.equal(g.length, 1);
  const set = (g[0]!.update as Record<string, Record<string, unknown>>).$set!;
  assert.equal(set.status, "received", "the gap must be closed when vectors actually land");
  // and it must NOT upsert — a session that never failed must not gain a gap row at all.
  // (`scopedCollection.updateOne` normalises absent options to `{}`, so assert on the FLAG, which
  // is the actual guarantee, rather than on the options object being undefined.)
  assert.notEqual((g[0]!.options as Record<string, unknown> | undefined)?.upsert, true,
    "resolving must not create a gap row for a session that never failed");
  assert.equal((g[0]!.filter as Record<string, unknown>).status, "open", "only an OPEN gap is resolved");
});

test("ISS-118: the gap write is tenant-confined on both filter and body", async () => {
  const { db, calls } = fakeDb();
  await indexSession("t", "s1", {
    complete: completeWith() as never,
    embed: async () => { throw new Error("down"); },
    db,
  });
  const g = gapCalls(calls)[0]!;
  assertUpdateBodyConfined(g, "t");
});
