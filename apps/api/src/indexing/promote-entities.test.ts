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

/* ── ISS-126 item (4): the tagClaims:TRUE path was unreachable in all 137 tests ────────────────
 * Cycle 2's writer tests asserted `tagClaims: false` writes nothing, and stopped there. But
 * `fakeDb.find` returned `[]` for `claims`, so the branch that actually WRITES topicRefs never
 * executed — mutating `{ $set: { topicRefs: refs } }` to `{ $set: { topicRefs: [] } }` left the
 * suite fully green. ISS-126's own fix_direction had warned in advance: "extend fakeDb rather than
 * assuming an untested op is unreachable." I asserted the negative case and mistook it for
 * covering both.
 */
test("ISS-126(4): tagClaims writes the session's REAL topicRefs onto each of its claims", async () => {
  const { db, calls } = fakeDb({
    claims: [
      { _id: "c1", tenantId: "t", text: "a", evidence: [{ turnId: "t1", sessionId: "s1" }] },
      { _id: "c2", tenantId: "t", text: "b", evidence: [{ turnId: "t2", sessionId: "s1" }] },
    ],
  });
  const res = await promoteAndPersistEntities("t", "s1", treeRoot(), db);

  const claimWrites = calls.filter((c) => c.coll === "claims" && c.op === "updateOne");
  assert.equal(claimWrites.length, 2, "every claim of this session must be tagged");
  assert.equal(res.claimsTagged, 2);
  for (const w of claimWrites) {
    const set = (w.update as Record<string, Record<string, unknown>>).$set!;
    assert.deepEqual(set.topicRefs, ["visa-rules"],
      "the REAL topic slugs must be written — an empty array here is the mutation that stayed green");
  }
});

test("ISS-126(4): a session whose tree surfaced NO topics clears topicRefs rather than leaving them stale", async () => {
  // Writing [] is correct here and is a different case from the bug above: it removes a tagging
  // from a previous build whose topic no longer exists in the tree.
  // The claim is seeded on s1 — the session being indexed. The first version of this test seeded
  // it on "other" and still expected it visited, which ENCODED UNSCOPED BEHAVIOUR AS EXPECTED
  // (ISS-C-CLAIMS-TARGETING-001): it would have passed just as happily against a `.find({})`.
  const { db, calls } = fakeDb({ claims: [{ _id: "c1", tenantId: "t", evidence: [{ turnId: "t1", sessionId: "s1" }] }] });
  const root = node("tenant:t", "t", "root"); // no topic nodes at all
  await promoteAndPersistEntities("t", "s1", root, db);
  const w = calls.find((c) => c.coll === "claims" && c.op === "updateOne");
  assert.ok(w, "the claim is still visited");
  assert.deepEqual((w!.update as Record<string, Record<string, unknown>>).$set!.topicRefs, []);
});

/* ── ISS-C-CLAIMS-TARGETING-001: assert what the writes are AIMED AT, not just what they carry ──
 * Nine writer tests asserted the update BODY and the call COUNT and never the FILTER, so both
 * `.find({"evidence.sessionId": id})` -> `.find({})` and `.updateOne({_id})` -> `.updateOne({})`
 * survived at 139/139. `fakeDb` had recorded the filters all along; nothing read them.
 *
 * This is the third guard in this unit that looked like a guard and defended nothing. The pattern
 * is consistent enough to name: I assert the value a write CARRIES and forget the predicate that
 * decides WHICH ROWS it reaches — and the second one is where tenancy and scoping live.
 */
test("ISS-C-TARGETING: the claims read is scoped to THIS session, not the whole collection", async () => {
  const { db, calls } = fakeDb({
    claims: [
      { _id: "mine", tenantId: "t", evidence: [{ turnId: "t1", sessionId: "s1" }] },
      { _id: "other-session", tenantId: "t", evidence: [{ turnId: "t9", sessionId: "s-other" }] },
    ],
  });
  const res = await promoteAndPersistEntities("t", "s1", treeRoot(), db);

  const find = calls.find((c) => c.coll === "claims" && c.op === "find");
  assert.ok(find, "a claims read must happen");
  assert.deepEqual(find!.filter?.["evidence.sessionId"], "s1",
    "widening this to {} would re-tag every session's claims on every single-session index");
  assert.equal(res.claimsTagged, 1, "only this session's claim may be tagged");
  const writes = calls.filter((c) => c.coll === "claims" && c.op === "updateOne");
  assert.deepEqual(writes.map((w) => w.filter?._id), ["mine"], "the other session's claim must be untouched");
});

test("ISS-C-TARGETING: each claim update targets ONE claim by _id, never an open filter", async () => {
  const { db, calls } = fakeDb({
    claims: [
      { _id: "c1", tenantId: "t", evidence: [{ turnId: "t1", sessionId: "s1" }] },
      { _id: "c2", tenantId: "t", evidence: [{ turnId: "t2", sessionId: "s1" }] },
    ],
  });
  await promoteAndPersistEntities("t", "s1", treeRoot(), db);
  const writes = calls.filter((c) => c.coll === "claims" && c.op === "updateOne");
  assert.equal(writes.length, 2);
  for (const w of writes) {
    assert.ok(w.filter && typeof w.filter._id === "string" && w.filter._id.length > 0,
      "updateOne({}) would overwrite an arbitrary claim's topicRefs instead of the intended one");
  }
  assert.deepEqual(writes.map((w) => w.filter!._id).sort(), ["c1", "c2"]);
});

test("ISS-C-TARGETING: topic and org upserts target their own _id, not an open filter", async () => {
  const { db, calls } = fakeDb();
  await promoteAndPersistEntities("t", "s1", treeRoot(), db);
  assert.equal((writes(calls, "topics")[0]!.filter as Record<string, unknown>)._id, "visa-rules");
  assert.equal((writes(calls, "orgs")[0]!.filter as Record<string, unknown>)._id, "acme");
});
