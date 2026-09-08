/**
 * packages/index/src/eval/baseline.test.ts — covers the two sanity conditions a recall score must
 * be read against: a question-blind control (chance floor) and a ceiling/saturation check.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNullRetriever, assessBaseline } from "./baseline.js";
import { computeRecallAtK, type GoldenQuestion, type RecallResult } from "./recall.js";

const SESSIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];

function recall(hits: number, total: number, k = 5): RecallResult {
  const misses = Array.from({ length: total - hits }, (_, i) => ({
    id: `q${i}`, question: "q", expectedSessionId: "sX", got: [],
  }));
  return { k, total, hits, recallAtK: total === 0 ? 0 : hits / total, misses };
}

test("the null retriever ignores the question entirely and is deterministic", () => {
  // The questions below deliberately NAME session ids ("s9", "s10"). A control that peeked at the
  // question — even slightly, e.g. by ranking a named id higher — would reorder here and be
  // caught. An earlier version of this test used questions containing no session ids at all, and
  // a mutation that made the control question-AWARE still passed it: a control whose blindness is
  // only tested on inputs it could not react to anyway is not tested at all.
  const retrieve = createNullRetriever(SESSIONS);
  const a = retrieve("tell me about s9 and s10 specifically", 5);
  const b = retrieve("a completely different question about forex markups", 5);
  assert.deepEqual(a, b, "a question-blind control must return the same ids for any question");
  assert.deepEqual(a, ["s1", "s2", "s3", "s4", "s5"], "naming s9/s10 must not pull them into the top-5");
});

test("the null retriever respects k", () => {
  assert.equal(createNullRetriever(SESSIONS)("anything", 3).length, 3);
});

test("the null retriever scores the real chance floor on a real golden set", () => {
  // 10 sessions, k=5, one question per session -> a blind top-5 covers exactly 5 of them.
  const questions: GoldenQuestion[] = SESSIONS.map((s, i) => ({
    id: `q${i}`, question: `question about ${s}`, expectedSessionId: s,
  }));
  const result = computeRecallAtK(questions, createNullRetriever(SESSIONS), 5);
  assert.equal(result.recallAtK, 0.5, "5 of 10 expected sessions are inside a blind top-5");
});

test("a perfect score with zero misses is reported SATURATED, not as success", () => {
  const a = assessBaseline(recall(46, 46), recall(10, 46), 23);
  assert.equal(a.saturated, true);
  assert.equal(a.verdict, "saturated");
  assert.match(a.reason, /can never demonstrate an improvement/);
});

test("a retriever that does not beat the question-blind control is AT-CHANCE, and that outranks saturation", () => {
  // Even at a perfect 1.000, if the control also scores 1.000 the question contributed nothing.
  const a = assessBaseline(recall(46, 46), recall(46, 46), 23);
  assert.equal(a.verdict, "at-chance", "at-chance must take precedence over saturated");
  assert.equal(a.liftOverControl, 0);
});

test("a real score with real misses and real lift is INFORMATIVE", () => {
  const a = assessBaseline(recall(38, 46), recall(10, 46), 23);
  assert.equal(a.verdict, "informative");
  assert.equal(a.saturated, false);
  assert.ok(a.liftOverControl > 0);
});

test("chanceFloor is k/sessionCount and never exceeds 1", () => {
  assert.equal(assessBaseline(recall(1, 1), recall(0, 1), 20).chanceFloor, 0.25);
  assert.equal(assessBaseline(recall(1, 1), recall(0, 1), 3).chanceFloor, 1, "k > sessionCount clamps to 1");
});
