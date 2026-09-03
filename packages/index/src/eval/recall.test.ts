/**
 * packages/index/src/eval/recall.test.ts — T-021 C5 (recall half). `computeRecallAtK` with a
 * fake `retrieveFn`: all-hit, all-miss, and mixed cases, checking `misses` is correctly populated.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeRecallAtK, type GoldenQuestion, type RetrieveFn } from "./recall.js";

const QUESTIONS: GoldenQuestion[] = [
  { id: "q1", question: "NZ visa approval rate", expectedSessionId: "sess1" },
  { id: "q2", question: "France APS permit", expectedSessionId: "sess2" },
  { id: "q3", question: "Italy document legalization", expectedSessionId: "sess3" },
];

test("all-hit: every expected session lands in top-k, recall is 1.0, no misses", () => {
  const retrieve: RetrieveFn = (_q, k) => ["sess1", "sess2", "sess3"].slice(0, k);
  const result = computeRecallAtK(QUESTIONS, retrieve, 5);
  assert.equal(result.recallAtK, 1);
  assert.equal(result.hits, 3);
  assert.deepEqual(result.misses, []);
});

test("all-miss: none land in top-k, recall is 0, every question named in misses", () => {
  const retrieve: RetrieveFn = () => ["other-session"];
  const result = computeRecallAtK(QUESTIONS, retrieve, 5);
  assert.equal(result.recallAtK, 0);
  assert.equal(result.hits, 0);
  assert.equal(result.misses.length, 3);
  assert.deepEqual(result.misses[0], {
    id: "q1", question: "NZ visa approval rate", expectedSessionId: "sess1", got: ["other-session"],
  });
});

test("mixed: recall reflects hit fraction, only the missed ones are named", () => {
  const retrieve: RetrieveFn = (_q, k) => {
    if (_q.includes("NZ")) return ["sess1"].slice(0, k);
    return ["wrong"];
  };
  const result = computeRecallAtK(QUESTIONS, retrieve, 5);
  assert.equal(result.hits, 1);
  assert.equal(result.recallAtK, 1 / 3);
  assert.equal(result.misses.length, 2);
  assert.deepEqual(result.misses.map((m) => m.id), ["q2", "q3"]);
});

test("k truncates the retrieved list before checking membership", () => {
  // retrieve() returns more than k — computeRecallAtK must slice to k itself, never trust the
  // retriever to have already truncated.
  const retrieve: RetrieveFn = () => ["wrong1", "wrong2", "sess1"];
  const result = computeRecallAtK([QUESTIONS[0]!], retrieve, 2);
  assert.equal(result.hits, 0, "sess1 is at index 2, outside k=2, must count as a miss");
  assert.deepEqual(result.misses[0]!.got, ["wrong1", "wrong2"]);
});

test("empty question set: recall is 0 (not NaN), no misses", () => {
  const result = computeRecallAtK([], () => [], 5);
  assert.equal(result.recallAtK, 0);
  assert.equal(result.total, 0);
  assert.deepEqual(result.misses, []);
});
