/**
 * apps/api/src/indexing/promote-entities.test.ts — ISS-126.
 *
 * WHY THIS FILE EXISTS: cycle 1 shipped a 102-line writer with **no test at all**. The checker
 * mutated `{ upsert: true }` to `{ upsert: false }` at both write sites — turning the entire
 * promotion into a no-op — and `apps/api` still reported 130/130 green. Combined with the
 * deliberate decision not to run a live backfill, that meant the persistence half of U2.1 had
 * never executed against anything, real or fake.
 *
 * I tested the PURE promotion thoroughly (10 cases in packages/index) and then left the part that
 * actually touches the database unasserted — which is the same shape as this project's own
 * repeated untested-guard failures (ISS-056's first fix, ISS-060, ISS-118).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promoteAndPersistEntities } from "./promote-entities.js";
import { fakeDb, type Call } from "./testutils.js";
import type { TreeIndexNode } from "@lkb/core";

const node = (id: string, title: string, level: string, evidence?: unknown): TreeIndexNode =>
  ({ node_id: id, title, level, summary: "", children: [], ...(evidence ? { evidence } : {}) }) as never;

/** A root carrying one topic across two sessions, plus one org. */
function treeRoot(): TreeIndexNode {
  const root = node("tenant:t", "t", "root");
  root.children.push(node("tenant:t/2026/06/session:s1/topic:visa-rules", "Visa Rules", "topic",
    { sessionRef: "s1", sessionRefs: ["s1", "s2"] }));
  root.children.push(node("tenant:t/2026/06/session:s1/org:acme", "Acme", "org", { sessionRef: "s1" }));
  return root;
}

const writes = (calls: Call[], coll: string) => calls.filter((c) => c.coll === coll && c.op === "updateOne");

test("ISS-126: topics and orgs are UPSERTED — a mutation to upsert:false must not pass unnoticed", async () => {
  // The exact mutation that survived cycle 1. Without `upsert`, nothing exists to match, so every
  // write silently does nothing and the collections stay empty forever.
  const { db, calls } = fakeDb();
  const res = await promoteAndPersistEntities("t", "s1", treeRoot(), db);

  const t = writes(calls, "topics");
  const o = writes(calls, "orgs");
  assert.equal(t.length, 1, "one topic row");
  assert.equal(o.length, 1, "one org row");
  assert.deepEqual(t[0]!.options, { upsert: true }, "without upsert the write is a permanent no-op");
  assert.deepEqual(o[0]!.options, { upsert: true });
  assert.equal(res.topics, 1);
  assert.equal(res.orgs, 1);
  assert.equal(res.skipped, null);
});

test("ISS-126: promotion NEVER deletes — a topic row spans sessions, so delete-then-insert would drop other sessions' evidence", async () => {
  // The ISS-056 shape one level up: chunks can clean-replace because a chunk belongs to one
  // session; a topic row does not.
  const { db, calls } = fakeDb();
  await promoteAndPersistEntities("t", "s1", treeRoot(), db);
  for (const coll of ["topics", "orgs"]) {
    assert.equal(calls.filter((c) => c.coll === coll && c.op === "deleteMany").length, 0,
      `${coll} must never be deleted — its rows carry cross-session evidence`);
  }
});

test("ISS-126: the written topic carries the UNIONED sessionRefs, not just the indexed session", async () => {
  // If this regressed to `[sessionId]`, every topic would look single-session and the one signal
  // that makes a topic worth being an entity would be gone.
  const { db, calls } = fakeDb();
  await promoteAndPersistEntities("t", "s1", treeRoot(), db);
  const set = (writes(calls, "topics")[0]!.update as Record<string, Record<string, unknown>>).$set!;
  assert.deepEqual(set.sessionRefs, ["s1", "s2"]);
  assert.equal(set.name, "Visa Rules");
  assert.equal(set.tenantId, "t");
});

test("ISS-126: every write is tenant-scoped on filter and body", async () => {
  const { db, calls } = fakeDb();
  await promoteAndPersistEntities("tenant-a", "s1", treeRoot(), db);
  for (const c of calls.filter((x) => ["topics", "orgs", "claims"].includes(x.coll))) {
    const body = (c.update as Record<string, Record<string, unknown>> | undefined)?.$set;
    if (body && "tenantId" in body) {
      assert.equal(body.tenantId, "tenant-a", `${c.coll}.${c.op} must not write another tenant's id`);
    }
  }
});

test("ISS-126: promotion NEVER THROWS — a write failure must not strand the session (ISS-121's lesson)", async () => {
  const exploding = {
    collection(name: string) {
      const real = (fakeDb().db as unknown as { collection: (n: string) => Record<string, unknown> }).collection(name);
      if (name !== "topics") return real;
      return { ...real, updateOne: async () => { throw new Error("boom"); } };
    },
  } as never;
  const res = await promoteAndPersistEntities("t", "s1", treeRoot(), exploding);
  assert.equal(res.skipped, "promotion-failed", "the failure must be reported, not thrown");
  assert.equal(res.topics, 0);
});

test("ISS-126: tagClaims:false issues NO claims operation at all (the ISS-056 invariant)", async () => {
  const { db, calls } = fakeDb();
  await promoteAndPersistEntities("t", "s1", treeRoot(), db, { tagClaims: false });
  assert.deepEqual(calls.filter((c) => c.coll === "claims"), [],
    "a degraded claims run must see no claims read OR write from promotion");
});

test("ISS-126: an empty tree writes nothing rather than writing empty rows", async () => {
  const { db, calls } = fakeDb();
  const res = await promoteAndPersistEntities("t", "s1", node("tenant:t", "t", "root"), db);
  assert.equal(writes(calls, "topics").length, 0);
  assert.equal(writes(calls, "orgs").length, 0);
  assert.equal(res.skipped, null, "nothing to promote is a success, not a failure");
});
