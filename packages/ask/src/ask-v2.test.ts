/**
 * packages/ask/src/ask-v2.test.ts — T-005b C5. `askV2` end-to-end on a fixture tree + fake
 * providers: sources.internal/sources.web stay separated (unchanged from T-005) with a
 * non-empty audit-log array, and a verdict-`correct` fixture case skips `refine`/web entirely
 * (T-005's internal-first guarantee still holds through `askV2`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TreeIndexNode } from "@lkb/core";
import type { ScoreFn } from "./evaluator.js";
import type { WebFallbackFn } from "./router.js";
import { fakeComplete, fakeWrite, fakeTreeSearch } from "./testUtils.js";
import { askV2 } from "./ask-v2.js";

const TREE: TreeIndexNode = {
  node_id: "tenant:t1",
  title: "t1",
  level: "tenant",
  summary: "",
  children: [
    { node_id: "tenant:t1/session:a", title: "A", level: "session", summary: "Apples are red.", children: [] },
    { node_id: "tenant:t1/session:b", title: "B", level: "session", summary: "Oranges are orange.", children: [] },
  ],
};

const fakeScoreFn = (scoresByNodeId: Record<string, number>): ScoreFn =>
  (_query, node) => scoresByNodeId[node.node_id]!;

test("correct verdict: skips refine and web, still logs an audit trail and answers", async () => {
  const complete = fakeComplete(
    { json: { node_ids: ["tenant:t1/session:a"] } }, // selectNodes
    { text: "Final answer" }, // answer
  );
  const write = fakeWrite();
  const webFallback: WebFallbackFn = () => {
    throw new Error("web must not be called on a correct verdict");
  };

  const result = await askV2("what color are apples?", TREE, {
    complete,
    scoreFn: fakeScoreFn({ "tenant:t1/session:a": 0.9 }),
    treeSearchFn: fakeTreeSearch,
    webFallbackFn: webFallback,
    write,
    tenantId: "t1",
  });

  assert.equal(result.verdict, "correct");
  assert.equal(result.web_used, false);
  assert.deepEqual(result.sources.web, []);
  assert.equal(result.sources.internal.length, 1);
  assert.equal(result.answer, "Final answer");

  assert.ok(result.auditLog.length > 0, "audit log must be non-empty");
  assert.ok(result.auditLog.every((e) => e.step !== "refine"), "correct verdict must skip refine");
  assert.ok(result.auditLog.some((e) => e.step === "select_nodes"));
  assert.ok(result.auditLog.some((e) => e.step === "answer"));
  assert.ok(result.auditLog.some((e) => e.step === "score"));
  assert.equal(complete.calls.length, 2, "only selectNodes + answer should call complete");
  assert.ok(write.writes.length > 0, "every audit entry must also hit recordJob's injected write");
});

test("ambiguous verdict: refines both good_docs and web docs, keeps sources separated", async () => {
  const complete = fakeComplete(
    { json: { node_ids: ["tenant:t1/session:a", "tenant:t1/session:b"] } }, // selectNodes
    { json: { keep: true } }, // refine: "Apples are red." -> kept
    { json: { keep: false } }, // refine: web doc -> dropped
    { text: "Final answer" }, // answer
  );
  const write = fakeWrite();
  const webFallback: WebFallbackFn = () => [{ content: "Bananas are yellow." }];

  const result = await askV2("what color are apples?", TREE, {
    complete,
    scoreFn: fakeScoreFn({ "tenant:t1/session:a": 0.5, "tenant:t1/session:b": 0.1 }),
    treeSearchFn: fakeTreeSearch,
    webFallbackFn: webFallback,
    write,
    tenantId: "t1",
  });

  assert.equal(result.verdict, "ambiguous");
  assert.equal(result.web_used, true);
  assert.equal(result.sources.internal.length, 1, "only node A scored >= lower threshold");
  assert.deepEqual(result.sources.web, [{ content: "Bananas are yellow." }]);

  assert.equal(complete.calls.length, 4, "selectNodes + 2 refine strips + answer");
  const answerPrompt = complete.calls[3]!.messages[0]!.content;
  assert.match(answerPrompt, /Apples are red\./, "kept strip must reach the answer context");
  assert.doesNotMatch(answerPrompt, /Bananas are yellow\./, "dropped strip must not reach the answer context");

  const steps = result.auditLog.map((e) => e.step);
  assert.ok(steps.includes("select_nodes"));
  assert.ok(steps.filter((s) => s === "refine").length === 2);
  assert.ok(steps.filter((s) => s === "score").length === 2);
  assert.ok(steps.includes("answer"));
});
