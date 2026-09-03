/**
 * packages/ask/src/eval/heuristic-scorer.test.ts — T-022 C5 (scorer half). A query overlapping
 * the node's summary scores higher than a non-overlapping query.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TreeIndexNode } from "@lkb/core";
import { heuristicScorer } from "./heuristic-scorer.js";

const NODE: TreeIndexNode = { node_id: "toc/.../session:sess1", title: "NZ Visas", level: "session",
  summary: "New Zealand student visa approval rate and proof-of-funds rules.", children: [],
  evidence: { sessionRef: "sess1" } };

test("a matching query scores higher than a non-matching query", () => {
  const [matching] = heuristicScorer("New Zealand student visa", NODE) as [number, string];
  const [nonMatching] = heuristicScorer("forex remittance markup rates", NODE) as [number, string];
  assert.ok(matching > nonMatching);
});

test("an empty query returns score 0 with a reason", () => {
  const [score, reason] = heuristicScorer("", NODE) as [number, string];
  assert.equal(score, 0);
  assert.match(reason, /empty query/);
});

test("a fully-matching query scores 1", () => {
  const [score] = heuristicScorer("New Zealand", NODE) as [number, string];
  assert.equal(score, 1);
});
