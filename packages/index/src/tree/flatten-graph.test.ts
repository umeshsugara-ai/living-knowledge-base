import { test } from "node:test";
import assert from "node:assert/strict";
import type { TreeIndexNode } from "@lkb/core";
import { flattenTreeToGraph } from "./flatten-graph.js";

function node(nodeId: string, title: string, level: TreeIndexNode["level"], children: TreeIndexNode[] = [], evidence?: TreeIndexNode["evidence"]): TreeIndexNode {
  const n: TreeIndexNode = { node_id: nodeId, title, level, summary: "", children };
  if (evidence) n.evidence = evidence;
  return n;
}

test("flattens a real-shaped tree into session/topic/org nodes only, excluding tenant/year/month", () => {
  const tree = node("tenant:toc", "toc", "tenant", [
    node("toc/year:2026", "2026", "year", [
      node("toc/year:2026/month:04", "04", "month", [
        node("toc/year:2026/month:04/session:s1", "Session One", "session", [
          node("toc/year:2026/month:04/session:s1/topic:visas", "Visas", "topic"),
          node("toc/year:2026/month:04/session:s1/org:toc-org", "TOC", "org"),
        ], { sessionRef: "s1" }),
      ]),
    ]),
  ]);

  const graph = flattenTreeToGraph(tree);
  const kinds = graph.nodes.map((n) => n.kind).sort();
  assert.deepEqual(kinds, ["org", "session", "topic"]);
  assert.ok(graph.nodes.some((n) => n.id === "s1" && n.kind === "session"));
  assert.ok(graph.nodes.some((n) => n.id === "visas" && n.kind === "topic"));
  assert.ok(graph.nodes.some((n) => n.id === "toc-org" && n.kind === "org"));
});

test("session-topic and session-org edges are real (inferred: false)", () => {
  const tree = node("tenant:t", "t", "tenant", [
    node("t/session:s1", "S1", "session", [
      node("t/session:s1/topic:visas", "Visas", "topic"),
      node("t/session:s1/org:o1", "O1", "org"),
    ], { sessionRef: "s1" }),
  ]);
  const graph = flattenTreeToGraph(tree);
  const topicEdge = graph.edges.find((e) => e.kind === "session-topic");
  const orgEdge = graph.edges.find((e) => e.kind === "session-org");
  assert.deepEqual(topicEdge, { source: "s1", target: "visas", kind: "session-topic", inferred: false });
  assert.deepEqual(orgEdge, { source: "s1", target: "o1", kind: "session-org", inferred: false });
});

test("two topics sharing a session get a topic-cooccurrence edge flagged inferred: true", () => {
  const tree = node("tenant:t", "t", "tenant", [
    node("t/session:s1", "S1", "session", [
      node("t/session:s1/topic:visas", "Visas", "topic"),
      node("t/session:s1/topic:scholarships", "Scholarships", "topic"),
    ], { sessionRef: "s1" }),
  ]);
  const graph = flattenTreeToGraph(tree);
  const cooc = graph.edges.find((e) => e.kind === "topic-cooccurrence");
  assert.ok(cooc, "expected a topic-cooccurrence edge");
  assert.equal(cooc!.inferred, true);
  assert.deepEqual([cooc!.source, cooc!.target].sort(), ["scholarships", "visas"]);
});

test("a single topic in a session produces no cooccurrence edge", () => {
  const tree = node("tenant:t", "t", "tenant", [
    node("t/session:s1", "S1", "session", [
      node("t/session:s1/topic:visas", "Visas", "topic"),
    ], { sessionRef: "s1" }),
  ]);
  const graph = flattenTreeToGraph(tree);
  assert.equal(graph.edges.filter((e) => e.kind === "topic-cooccurrence").length, 0);
});

test("the same topic slug shared across two sessions is one node with two session-topic edges", () => {
  const tree = node("tenant:t", "t", "tenant", [
    node("t/session:s1", "S1", "session", [node("t/session:s1/topic:visas", "Visas", "topic")], { sessionRef: "s1" }),
    node("t/session:s2", "S2", "session", [node("t/session:s2/topic:visas", "Visas", "topic")], { sessionRef: "s2" }),
  ]);
  const graph = flattenTreeToGraph(tree);
  assert.equal(graph.nodes.filter((n) => n.id === "visas").length, 1);
  assert.equal(graph.edges.filter((e) => e.kind === "session-topic" && e.target === "visas").length, 2);
});

test("a tenant root with no sessions returns an empty graph, not an error", () => {
  const tree = node("tenant:empty", "empty", "tenant", []);
  const graph = flattenTreeToGraph(tree);
  assert.deepEqual(graph, { nodes: [], edges: [] });
});
