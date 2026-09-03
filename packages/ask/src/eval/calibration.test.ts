/**
 * packages/ask/src/eval/calibration.test.ts — T-022 C5 (calibration half). `computeMAE` with a
 * fake sync `ScoreFn` (perfect predictions -> mae 0; a known offset -> mae equals that offset)
 * and a fake ASYNC `ScoreFn` (proving the async-scorer seam works unmodified).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TreeIndexNode } from "@lkb/core";
import { computeMAE, type CalibrationPair } from "./calibration.js";

const NODE: TreeIndexNode = { node_id: "toc/.../session:sess1", title: "A", level: "session",
  summary: "s", children: [], evidence: { sessionRef: "sess1" } };

const PAIRS: CalibrationPair[] = [
  { id: "p1", query: "q1", node: NODE, referenceScore: 1.0 },
  { id: "p2", query: "q2", node: NODE, referenceScore: 0.0 },
];

test("perfect predictions yield mae 0", async () => {
  const scoreFn = (_q: string, _n: TreeIndexNode) => (_q === "q1" ? 1.0 : 0.0);
  const result = await computeMAE(PAIRS, scoreFn);
  assert.equal(result.mae, 0);
  assert.equal(result.n, 2);
  assert.deepEqual(result.details.map((d) => d.absError), [0, 0]);
});

test("a known constant offset yields mae equal to that offset", async () => {
  const OFFSET = 0.2;
  const scoreFn = (_q: string, _n: TreeIndexNode) => (_q === "q1" ? 1.0 - OFFSET : 0.0 + OFFSET);
  const result = await computeMAE(PAIRS, scoreFn);
  assert.ok(Math.abs(result.mae - OFFSET) < 1e-9);
});

test("an async scoreFn works unmodified (the seam's whole point)", async () => {
  const asyncScoreFn = async (_q: string, _n: TreeIndexNode): Promise<number> =>
    _q === "q1" ? 1.0 : 0.0;
  const result = await computeMAE(PAIRS, asyncScoreFn);
  assert.equal(result.mae, 0);
});

test("names every pair's individual error, not just the aggregate", async () => {
  const scoreFn = () => 0.5;
  const result = await computeMAE(PAIRS, scoreFn);
  assert.equal(result.details.length, 2);
  assert.equal(result.details[0]!.id, "p1");
  assert.equal(result.details[0]!.predicted, 0.5);
  assert.equal(result.details[0]!.reference, 1.0);
  assert.ok(Math.abs(result.details[0]!.absError - 0.5) < 1e-9);
});

test("empty pair set: mae is 0 (not NaN)", async () => {
  const result = await computeMAE([], () => 1);
  assert.equal(result.mae, 0);
  assert.equal(result.n, 0);
});

test("handles a [score, reason] tuple ScoreResult, same as evaluator.ts", async () => {
  const scoreFn = (): [number, string] => [0.7, "some reason"];
  const result = await computeMAE([PAIRS[0]!], scoreFn);
  assert.equal(result.details[0]!.predicted, 0.7);
});
