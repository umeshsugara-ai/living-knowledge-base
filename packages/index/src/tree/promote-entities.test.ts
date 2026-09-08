/**
 * packages/index/src/tree/promote-entities.test.ts — U2.1.
 *
 * The failure this promotion is most likely to have is a row that looks right and points nowhere:
 * a topic whose `sessionRefs` lost a session, or an id that drifted from the tree's own slug rule.
 * These pin the derivation, not just the shape.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promoteTreeEntities, topicRefsForSession } from "./promote-entities.js";
import { buildTree } from "./build.js";
import type { TreeIndexNode } from "@lkb/core";

const node = (id: string, title: string, level: string, evidence?: unknown): TreeIndexNode =>
  ({ node_id: id, title, level, summary: "", children: [], ...(evidence ? { evidence } : {}) }) as never;

test("promotes topic and org nodes from anywhere in the tree, ignoring year/month/session levels", () => {
  const root = node("tenant:t", "t", "root");
  const year = node("tenant:t/2026", "2026", "year");
  const session = node("tenant:t/2026/06/session:s1", "S1", "session", { sessionRef: "s1" });
  session.children.push(node("tenant:t/2026/06/session:s1/topic:visa-rules", "Visa Rules", "topic",
    { sessionRef: "s1", sessionRefs: ["s1", "s2"] }));
  session.children.push(node("tenant:t/2026/06/session:s1/org:acme-university", "Acme University", "org",
    { sessionRef: "s1" }));
  year.children.push(session);
  root.children.push(year);

  const { topics, orgs } = promoteTreeEntities(root);
  assert.deepEqual(topics, [{ _id: "visa-rules", name: "Visa Rules", sessionRefs: ["s1", "s2"] }]);
  assert.deepEqual(orgs, [{ _id: "acme-university", name: "Acme University" }]);
});

test("one topic across TWO sessions becomes ONE row whose sessionRefs is the union", () => {
  // The cross-session signal is the whole reason a topic is worth promoting to an entity; a topic
  // that appears in one session is barely more than a tag.
  const root = node("tenant:t", "t", "root");
  for (const [s, refs] of [["s1", ["s1"]], ["s2", ["s2"]]] as const) {
    const sess = node(`tenant:t/2026/06/session:${s}`, s, "session", { sessionRef: s });
    sess.children.push(node(`tenant:t/2026/06/session:${s}/topic:funding`, "Funding", "topic",
      { sessionRef: s, sessionRefs: [...refs] }));
    root.children.push(sess);
  }
  const { topics } = promoteTreeEntities(root);
  assert.equal(topics.length, 1, "one topic slug must yield one row, not one per session");
  assert.deepEqual(topics[0]!.sessionRefs, ["s1", "s2"], "refs must be unioned across nodes, not overwritten");
});

test("the parent sessionRef is included even when the node's own sessionRefs omits it", () => {
  // A node's sessionRefs is only as complete as the build that produced it; its own parent session
  // is a real occurrence regardless, and adding it can only make coverage more complete.
  const root = node("tenant:t", "t", "root");
  root.children.push(node("tenant:t/2026/06/session:s9/topic:visas", "Visas", "topic",
    { sessionRef: "s9", sessionRefs: [] }));
  const { topics } = promoteTreeEntities(root);
  assert.deepEqual(topics[0]!.sessionRefs, ["s9"]);
});

test("ids come from the node_id, so they cannot drift from buildTree's own slug rule", () => {
  // Re-slugifying the TITLE would be a second definition of the slug rule, agreeing with the first
  // only until someone edits one of them. This asserts the id is read, not recomputed.
  const root = node("tenant:t", "t", "root");
  root.children.push(node("tenant:t/2026/06/session:s1/topic:new-zealand", "New Zealand!! (2026)", "topic",
    { sessionRef: "s1" }));
  const { topics } = promoteTreeEntities(root);
  assert.equal(topics[0]!._id, "new-zealand", "the id must be the tree's slug, not a re-derived one");
  assert.equal(topics[0]!.name, "New Zealand!! (2026)", "the display name is preserved verbatim");
});

test("a malformed node id yields no row rather than a row with an empty id", () => {
  const root = node("tenant:t", "t", "root");
  root.children.push(node("no-marker-here", "Broken", "topic", { sessionRef: "s1" }));
  assert.deepEqual(promoteTreeEntities(root).topics, []);
});

test("an empty tree promotes nothing and does not throw", () => {
  assert.deepEqual(promoteTreeEntities(node("tenant:t", "t", "root")), { topics: [], orgs: [] });
});

test("output is deterministic in id order — a re-run must not reshuffle rows", () => {
  const root = node("tenant:t", "t", "root");
  for (const slug of ["zeta", "alpha", "mid"]) {
    root.children.push(node(`tenant:t/2026/06/session:s1/topic:${slug}`, slug, "topic", { sessionRef: "s1" }));
  }
  assert.deepEqual(promoteTreeEntities(root).topics.map((t) => t._id), ["alpha", "mid", "zeta"]);
});

test("END TO END against the REAL buildTree — promotion must survive the actual node shape", () => {
  // The unit tests above build nodes by hand, which means they would still pass if buildTree's
  // node_id or evidence shape changed underneath. This one drives the real builder, so a change
  // there fails here instead of silently producing zero rows in production.
  const sessions = [
    { _id: "s1", tenantId: "t", title: "Visa session", date: "2026-06-03", org: "Acme University", status: {} },
    { _id: "s2", tenantId: "t", title: "Funding session", date: "2026-07-03", org: "Acme University", status: {} },
  ];
  const pages = [
    { _id: "p1", tenantId: "t", sessionRef: "s1", summary: "About visas", keyInsights: [], decisions: [], actionItems: [], evidence: [{ turnId: "t1", sessionId: "s1" }] },
    { _id: "p2", tenantId: "t", sessionRef: "s2", summary: "About visas and funding", keyInsights: [], decisions: [], actionItems: [], evidence: [{ turnId: "t2", sessionId: "s2" }] },
  ];
  const root = buildTree(sessions as never, pages as never)["t"];
  assert.ok(root, "buildTree must produce a root for the tenant");
  const { topics, orgs } = promoteTreeEntities(root!);

  assert.ok(orgs.some((o) => o.name === "Acme University"), "the org must be promoted from session.org");
  assert.equal(orgs.length, 1, "one org across two sessions must dedupe to one row");
  for (const t of topics) {
    assert.ok(t._id.length > 0 && t.sessionRefs.length > 0,
      `topic ${t._id} must carry at least one sessionRef — a topic pointing at nothing is not usable`);
    for (const ref of t.sessionRefs) {
      assert.ok(["s1", "s2"].includes(ref), `topic ${t._id} cites unknown session ${ref}`);
    }
  }
});

test("topicRefsForSession links a claim's session to every topic that session surfaced", () => {
  const topics = [
    { _id: "visas", name: "Visas", sessionRefs: ["s1", "s2"] },
    { _id: "funding", name: "Funding", sessionRefs: ["s2"] },
  ];
  assert.deepEqual(topicRefsForSession("s1", topics), ["visas"]);
  assert.deepEqual(topicRefsForSession("s2", topics), ["funding", "visas"]);
  assert.deepEqual(topicRefsForSession("unknown", topics), [], "an unknown session links to nothing, never to everything");
});
