/**
 * apps/api/src/ask-arms.test.ts — U1.5 part 2, hybrid-retrieval C5/C6.
 *
 * C6 is the reason this module is a FACTORY rather than a bound function, so the tests are about
 * the SHAPE as much as the behaviour: it must be impossible to serve one tenant's vectors to
 * another tenant's question, and impossible to bind the arms before a tenant is known.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { createAskArmsFor } from "./ask-arms.js";
import type { TreeIndexNode } from "@lkb/core";

const TREE: TreeIndexNode = {
  node_id: "tenant:t1", title: "t1", level: "tenant", summary: "", children: [
    { node_id: "tenant:t1/year:2026", title: "2026", level: "year", summary: "", children: [
      { node_id: "tenant:t1/year:2026/month:06/session:s1", title: "S1", level: "session", summary: "Visas.", children: [] },
      { node_id: "tenant:t1/year:2026/month:06/session:s2", title: "S2", level: "session", summary: "Funding.", children: [] },
    ] },
  ],
};

/** Records every tenantId the arms actually queried with. */
function fakeDb(rows: { chunks?: unknown[]; turns?: unknown[] } = {}) {
  const queriedTenants: string[] = [];
  const db = {
    collection(name: string) {
      return {
        find: (filter?: Record<string, unknown>) => ({
          toArray: async () => {
            if (filter && typeof filter.tenantId === "string") queriedTenants.push(`${name}:${filter.tenantId}`);
            return (name === "chunks" ? rows.chunks : rows.turns) ?? [];
          },
        }),
      };
    },
  } as unknown as Pick<Db, "collection">;
  return { db, queriedTenants };
}

const embedOk = async () => ({ vectors: [[1, 0, 0]], dims: 3, provider: "fake", model: "fake" });

test("C6: the arms are a FACTORY — they cannot be bound before a tenant is known", () => {
  const factory = createAskArmsFor({});
  assert.equal(typeof factory, "function", "createAskArmsFor returns a factory, not the arms");
  assert.equal(typeof factory("t1"), "function", "and the factory must be given a tenant to yield arms");
});

test("C6: every collection read carries the tenant the factory was called with", async () => {
  const { db, queriedTenants } = fakeDb();
  await createAskArmsFor({ embed: embedOk as never, db })("tenant-a")("visas?", TREE);
  assert.ok(queriedTenants.length > 0, "the arms must actually query");
  for (const q of queriedTenants) {
    assert.match(q, /:tenant-a$/, `a read escaped its tenant: ${q}`);
  }
});

test("C6: two tenants' arms query different corpora — no shared binding", async () => {
  const a = fakeDb(); const b = fakeDb();
  const factory = createAskArmsFor({ embed: embedOk as never, db: a.db });
  await factory("tenant-a")("q", TREE);
  await createAskArmsFor({ embed: embedOk as never, db: b.db })("tenant-b")("q", TREE);
  assert.ok(a.queriedTenants.every((q) => q.endsWith(":tenant-a")));
  assert.ok(b.queriedTenants.every((q) => q.endsWith(":tenant-b")));
});

test("C5: a FAILING vector arm still yields the lexical arm, and says why", async () => {
  const { db } = fakeDb({ turns: [{ _id: "t1", sessionId: "s1", text: "visas and permits" }] });
  const res = await createAskArmsFor({
    embed: async () => { throw new Error("all providers failed"); },
    db,
  })("t1")("visas?", TREE);
  assert.match(res.degraded ?? "", /vector: all providers failed/, "the failure must name the arm and reason");
  assert.equal(res.arms.length, 1, "the lexical arm must still be produced");
});

test("C5: a healthy run reports NO degradation — the field must mean something", async () => {
  const { db } = fakeDb({
    chunks: [{ _id: "c1", sourceRef: "s1", vector: [1, 0, 0] }],
    turns: [{ _id: "t1", sessionId: "s1", text: "visas" }],
  });
  const res = await createAskArmsFor({ embed: embedOk as never, db })("t1")("visas?", TREE);
  assert.equal(res.degraded, null);
  assert.equal(res.arms.length, 2, "both arms present");
});

test("arms return real TREE NODES, mapped from their own id vocabulary without re-deriving the path", async () => {
  const { db } = fakeDb({
    chunks: [{ _id: "c1", sourceRef: "s2", vector: [1, 0, 0] }],
    turns: [{ _id: "t1", sessionId: "s2", text: "funding" }],
  });
  const res = await createAskArmsFor({ embed: embedOk as never, db })("t1")("funding?", TREE);
  const ids = res.arms.flat().map((n) => n.node_id);
  assert.ok(ids.includes("tenant:t1/year:2026/month:06/session:s2"),
    `a vector/lexical hit must resolve to the real tree node: ${JSON.stringify(ids)}`);
});

test("a hit for a session NOT in this tree is dropped rather than invented", async () => {
  const { db } = fakeDb({
    chunks: [{ _id: "c1", sourceRef: "ghost-session", vector: [1, 0, 0] }],
    turns: [{ _id: "t1", sessionId: "ghost-session", text: "visas" }],
  });
  const res = await createAskArmsFor({ embed: embedOk as never, db })("t1")("visas?", TREE);
  assert.deepEqual(res.arms.flat(), [], "an unmapped session must not become a fabricated node");
});

test("no embedder configured = no vector arm, and that is NOT a degradation", async () => {
  const { db } = fakeDb({ turns: [{ _id: "t1", sessionId: "s1", text: "visas" }] });
  const res = await createAskArmsFor({ db })("t1")("visas?", TREE);
  assert.equal(res.degraded, null, "an install without embeddings is not broken");
  assert.equal(res.arms.length, 1);
});
