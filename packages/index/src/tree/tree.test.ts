/**
 * packages/index/src/tree/tree.test.ts — port of tree_index/test_build_tree.py (T-004 → T-016).
 * Same four cases, same fixtures. Runner: `node --test --import tsx` (no new framework).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionPages, Sessions } from "@lkb/core";
import { buildTree } from "./build.js";
import { treeSearch } from "./search.js";

const SESSIONS: Sessions[] = [
  { _id: "sess1", tenantId: "toc", sourceId: "src1", title: "21st-April-Visa-Blueprint",
    date: "2026-04-21", status: { transcribe: "done", index: "done" } },
  { _id: "sess2", tenantId: "toc", sourceId: "src2", title: "8th-May-Funding-Dreams",
    date: "2026-05-08", status: { transcribe: "done", index: "done" } },
  { _id: "sess3", tenantId: "toc", sourceId: "src3", title: "27th-August-In-Focus",
    date: "2026-08-27", status: { transcribe: "done", index: "done" } },
];

const SESSION_PAGES: SessionPages[] = [
  { _id: "pg1", tenantId: "toc", sessionId: "sess1",
    summary: "NZ visa blueprint: 8 universities, FTA pending.",
    evidence: [{ turnId: "t1", sessionId: "sess1" }] },
  { _id: "pg2", tenantId: "toc", sessionId: "sess2",
    summary: "Funding: FRR Forex markup ~1%, LRS cap $250k/yr.",
    evidence: [{ turnId: "t2", sessionId: "sess2" }] },
  // sess3 deliberately has NO session_page yet — tests the "" fallback
];

const SESSION_IDS = [
  "toc/year:2026/month:04/session:sess1",
  "toc/year:2026/month:05/session:sess2",
  "toc/year:2026/month:08/session:sess3",
];

test("grouping and nesting", () => {
  const tree = buildTree(SESSIONS, SESSION_PAGES);
  assert.ok("toc" in tree, "expected a root node for tenant 'toc'");
  const root = tree["toc"]!;
  assert.equal(root.level, "tenant");

  const yearIds = new Set(root.children.map((c) => c.node_id));
  assert.deepEqual(yearIds, new Set(["toc/year:2026"]), "expected single 2026 year node");

  const yearNode = root.children[0]!;
  const monthIds = new Set(yearNode.children.map((c) => c.node_id));
  assert.deepEqual(monthIds, new Set([
    "toc/year:2026/month:04",
    "toc/year:2026/month:05",
    "toc/year:2026/month:08",
  ]), "expected 3 distinct months");

  // every session leaf reachable by walking children from tenant root
  const allNodes = treeSearch(root, SESSION_IDS);
  assert.equal(allNodes.length, 3, "expected all 3 session leaves reachable");
});

test("evidence on every session node", () => {
  const root = buildTree(SESSIONS, SESSION_PAGES)["toc"]!;
  const sessionNodes = treeSearch(root, SESSION_IDS);
  assert.equal(sessionNodes.length, 3);
  for (const node of sessionNodes) {
    assert.ok("evidence" in node, `session node ${node.node_id} missing evidence`);
    assert.ok(["sess1", "sess2", "sess3"].includes(node.evidence!.sessionRef!));
  }
});

test("tree_search known and unknown", () => {
  const root = buildTree(SESSIONS, SESSION_PAGES)["toc"]!;
  const found = treeSearch(root, ["toc/year:2026/month:04/session:sess1"]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.title, "21st-April-Visa-Blueprint");

  const missing = treeSearch(root, ["does-not-exist"]);
  assert.deepEqual(missing, [], "expected empty result for unknown id");
});

test("summarize injection and fallback", () => {
  const root = buildTree(SESSIONS, SESSION_PAGES)["toc"]!;
  const sess1 = treeSearch(root, ["toc/year:2026/month:04/session:sess1"])[0]!;
  assert.equal(sess1.summary, "NZ visa blueprint: 8 universities, FTA pending.",
    "expected fallback to session_page.summary when no summarize callable is passed");

  const sess3 = treeSearch(root, ["toc/year:2026/month:08/session:sess3"])[0]!;
  assert.equal(sess3.summary, "",
    "expected empty-string fallback when no session_page exists for the session");

  const fakeSummarize = (session: Sessions) => `MOCK SUMMARY for ${session.title}`;
  const withLlm = buildTree(SESSIONS, SESSION_PAGES, fakeSummarize);
  const sess1Llm = treeSearch(withLlm["toc"]!, ["toc/year:2026/month:04/session:sess1"])[0]!;
  assert.equal(sess1Llm.summary, "MOCK SUMMARY for 21st-April-Visa-Blueprint",
    "expected injected summarize() callable to override the fallback");
});
