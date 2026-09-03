/**
 * packages/ask/src/router.test.ts — port of ask_router/test_router.py (T-005 → T-016).
 * Same six cases, same fixtures and thresholds. Runner: `node --test --import tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TreeIndexNode } from "@lkb/core";
import { evaluate, type ScoreFn } from "./evaluator.js";
import { ask, type TreeSearchFn, type WebFallbackFn } from "./router.js";

const NODE_A: TreeIndexNode = { node_id: "toc/.../session:sess1", title: "A", level: "session",
  summary: "s", children: [], evidence: { sessionRef: "sess1" } };
const NODE_B: TreeIndexNode = { node_id: "toc/.../session:sess2", title: "B", level: "session",
  summary: "s", children: [], evidence: { sessionRef: "sess2" } };

const fakeTreeSearchReturns = (nodes: TreeIndexNode[]): TreeSearchFn => () => nodes;

// Deliberately NOT typed `: ScoreFn` (T-009b) — a sync-only return type here is what makes
// evaluate()/ask()'s sync overload apply, so every pre-existing call site below keeps its old
// (non-Promise) return type and needs no `await`. `ScoreFn` itself still allows an async fn; see
// the T-009b tests further down for that path.
const fakeScoreFn = (scoresByNodeId: Record<string, number>) =>
  (_query: string, node: TreeIndexNode): number => scoresByNodeId[node.node_id]!;

test("correct verdict never calls web even if supplied", () => {
  const calls: string[] = [];
  const webFallback: WebFallbackFn = (query) => {
    calls.push(query);
    return [{ title: "should not be called" }];
  };
  const result = ask("what did A say", {}, fakeTreeSearchReturns([NODE_A]),
    fakeScoreFn({ [NODE_A.node_id]: 0.9 }), webFallback);
  assert.equal(result.verdict, "correct");
  assert.equal(result.web_used, false);
  assert.deepEqual(calls, [], "web_fallback_fn must NOT be called on a correct verdict");
  assert.deepEqual(result.sources.web, []);
  assert.equal(result.sources.internal.length, 1);
  assert.equal(result.sources.internal[0]!.node_id, NODE_A.node_id);
  assert.equal(result.insufficient_coverage, false);
});

test("incorrect verdict uses web fallback, sources kept separate", () => {
  const webFallback: WebFallbackFn = () => [{ title: "Web result", url: "https://example.com" }];
  const result = ask("off-corpus question", {}, fakeTreeSearchReturns([NODE_A, NODE_B]),
    fakeScoreFn({ [NODE_A.node_id]: 0.1, [NODE_B.node_id]: 0.15 }), webFallback);
  assert.equal(result.verdict, "incorrect");
  assert.equal(result.web_used, true);
  assert.deepEqual(result.sources.internal, [], "no doc scored >= 0.3, good_docs must be empty");
  assert.deepEqual(result.sources.web, [{ title: "Web result", url: "https://example.com" }]);
  assert.equal(result.insufficient_coverage, false);
});

test("ambiguous verdict merges good docs and web but keeps them separate", () => {
  const webFallback: WebFallbackFn = () => [{ title: "Web result" }];
  const result = ask("partial coverage question", {}, fakeTreeSearchReturns([NODE_A, NODE_B]),
    fakeScoreFn({ [NODE_A.node_id]: 0.5, [NODE_B.node_id]: 0.1 }), webFallback);
  assert.equal(result.verdict, "ambiguous");
  assert.equal(result.web_used, true);
  assert.equal(result.sources.internal.length, 1, "only NODE_A scored >= 0.3");
  assert.equal(result.sources.internal[0]!.node_id, NODE_A.node_id);
  assert.deepEqual(result.sources.web, [{ title: "Web result" }]);
});

test("no web fallback provided sets insufficient_coverage", () => {
  const result = ask("off-corpus, no web configured", {}, fakeTreeSearchReturns([NODE_A]),
    fakeScoreFn({ [NODE_A.node_id]: 0.1 }), undefined);
  assert.equal(result.verdict, "incorrect");
  assert.equal(result.web_used, false);
  assert.equal(result.insufficient_coverage, true);
  assert.deepEqual(result.sources.web, []);
});

test("reason returned on every call including correct", () => {
  const scoringWithReason = (): [number, string] => [0.85, "chunk answers the query directly"];
  const result = ask("q", {}, fakeTreeSearchReturns([NODE_A]), scoringWithReason);
  assert.equal(result.verdict, "correct");
  assert.ok(typeof result.reason === "string" && result.reason, "top-level reason required");
  assert.equal(result.scored[0]!.reason, "chunk answers the query directly");

  // bare-float score_fn still yields a (possibly empty) per-candidate reason + a verdict reason
  const bare = evaluate("q", [NODE_A], () => 0.1);
  assert.equal(bare.verdict, "incorrect");
  assert.ok("reason" in bare.scored[0]! && bare.reason);
});

test("thresholds are tunable parameters", () => {
  const scores = fakeScoreFn({ [NODE_A.node_id]: 0.5 });
  assert.equal(evaluate("q", [NODE_A], scores).verdict, "ambiguous");

  const stricter = evaluate("q", [NODE_A], scores, 0.9, 0.6);
  assert.equal(stricter.verdict, "incorrect", "0.5 < lower=0.6 must be incorrect");
  assert.deepEqual(stricter.good_docs, []);

  const looser = evaluate("q", [NODE_A], scores, 0.4, 0.2);
  assert.equal(looser.verdict, "correct", "0.5 >= upper=0.4 must be correct");

  const viaAsk = ask("q", {}, fakeTreeSearchReturns([NODE_A]), scores, undefined, 0.4, 0.2);
  assert.equal(viaAsk.verdict, "correct", "ask() must pass thresholds through");

  assert.throws(() => evaluate("q", [NODE_A], scores, 0.2, 0.6), RangeError,
    "expected RangeError for lower > upper");
});

test("T-009b: sync score_fn keeps evaluate()/ask() synchronous (no Promise wrapping)", () => {
  // Guards the backward-compat bar: a sync fake must NOT come back wrapped in a Promise, or every
  // existing sync test above (reading `.verdict` with no `await`) would silently break.
  const syncResult = evaluate("q", [NODE_A], () => 0.9);
  assert.ok(!(syncResult instanceof Promise), "evaluate() must stay sync for a sync scoreFn");
  assert.equal(syncResult.verdict, "correct");

  const askSyncResult = ask("q", {}, fakeTreeSearchReturns([NODE_A]), () => 0.9);
  assert.ok(!(askSyncResult instanceof Promise), "ask() must stay sync for a sync scoreFn");
  assert.equal(askSyncResult.verdict, "correct");
});

test("T-009b: async score_fn makes evaluate()/ask() return a Promise, verdict unchanged", async () => {
  const asyncScoreFn: ScoreFn = async (_query, node) =>
    node.node_id === NODE_A.node_id ? [0.9, "llm: strong match"] : [0.1, "llm: weak match"];

  const evalResultOrPromise = evaluate("q", [NODE_A, NODE_B], asyncScoreFn);
  assert.ok(evalResultOrPromise instanceof Promise, "evaluate() must return a Promise for an async scoreFn");
  const evalResult = await evalResultOrPromise;
  assert.equal(evalResult.verdict, "correct");
  assert.equal(evalResult.scored[0]!.reason, "llm: strong match");

  const askResultOrPromise = ask("q", {}, fakeTreeSearchReturns([NODE_A, NODE_B]), asyncScoreFn);
  assert.ok(askResultOrPromise instanceof Promise, "ask() must return a Promise for an async scoreFn");
  const askResult = await askResultOrPromise;
  assert.equal(askResult.verdict, "correct");
  assert.equal(askResult.sources.internal.length, 1);
});

test("T-009b: async score_fn rejection propagates, does not silently resolve", async () => {
  const failingScoreFn: ScoreFn = async () => { throw new Error("judge unavailable"); };
  await assert.rejects(
    async () => evaluate("q", [NODE_A], failingScoreFn),
    /judge unavailable/,
  );
});
