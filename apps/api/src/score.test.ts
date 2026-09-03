/**
 * apps/api/src/score.test.ts — T-009b. `createLlmScorer` with a fake `complete`: valid response
 * parses correctly; a malformed response, and a rejected `complete`, both fall back to
 * `heuristicScore` rather than throwing into the caller (never crash `/ask` on a bad judge call).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TreeIndexNode } from "@lkb/core";
import { createLlmScorer, heuristicScore, type CompleteFn } from "./score.js";

const NODE: TreeIndexNode = {
  node_id: "toc/.../session:sess1", title: "NZ visas", level: "session",
  summary: "post-study work visa rules for New Zealand", children: [], evidence: { sessionRef: "sess1" },
};

function fakeComplete(text: string): CompleteFn {
  return async () => ({
    text, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0,
  });
}

test("createLlmScorer parses a valid judge response", async () => {
  const scorer = createLlmScorer(fakeComplete(JSON.stringify({ score: 0.85, reason: "directly answers" })));
  const [score, reason] = await scorer("NZ post-study work visa?", NODE);
  assert.equal(score, 0.85);
  assert.equal(reason, "directly answers");
});

test("createLlmScorer clamps an out-of-range score into [0,1]", async () => {
  const scorer = createLlmScorer(fakeComplete(JSON.stringify({ score: 1.4, reason: "over" })));
  const [score] = await scorer("q", NODE);
  assert.equal(score, 1);
});

test("createLlmScorer falls back to heuristicScore on unparseable response, never throws", async () => {
  const scorer = createLlmScorer(fakeComplete("not json at all"));
  const [score, reason] = await scorer("NZ post-study work visa", NODE);
  const [expectedScore] = heuristicScore("NZ post-study work visa", NODE);
  assert.equal(score, expectedScore);
  assert.match(reason, /fell back/);
});

test("createLlmScorer falls back to heuristicScore when complete() rejects, never throws", async () => {
  const failing: CompleteFn = async () => { throw new Error("all providers failed"); };
  const scorer = createLlmScorer(failing);
  const [score, reason] = await scorer("NZ post-study work visa", NODE);
  const [expectedScore] = heuristicScore("NZ post-study work visa", NODE);
  assert.equal(score, expectedScore);
  assert.match(reason, /judge call failed/);
});
