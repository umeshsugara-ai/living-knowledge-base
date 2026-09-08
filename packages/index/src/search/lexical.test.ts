/**
 * packages/index/src/search/lexical.test.ts — pure-function coverage for `lexicalSearchTurns`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lexicalSearchTurns } from "./lexical.js";

const TURNS = [
  { _id: "t1", sessionId: "s1", text: "New Zealand student visa approval rates and processing times." },
  { _id: "t2", sessionId: "s2", text: "Education loan interest rates and forex remittance markups." },
  { _id: "t3", sessionId: "s1", text: "Completely unrelated small talk about the weather today." },
];

test("ranks a matching turn above a non-matching one", () => {
  const hits = lexicalSearchTurns("visa approval rates", TURNS, 10);
  assert.equal(hits[0]?.turnId, "t1");
  assert.ok(hits[0]!.score > 0);
});

test("a turn with zero query-term overlap is excluded, not scored 0", () => {
  const hits = lexicalSearchTurns("visa approval rates", TURNS, 10);
  assert.ok(!hits.some((h) => h.turnId === "t3"), "an unrelated turn must not appear at all");
});

test("k limits the result count", () => {
  const hits = lexicalSearchTurns("rates", TURNS, 1);
  assert.equal(hits.length, 1);
});

test("an empty query returns no hits, never a match-all", () => {
  assert.deepEqual(lexicalSearchTurns("", TURNS, 10), []);
  assert.deepEqual(lexicalSearchTurns("   ", TURNS, 10), []);
});

test("scores are in [0, 1], the same scale as every other heuristic scorer in this repo", () => {
  const hits = lexicalSearchTurns("visa", TURNS, 10);
  for (const h of hits) {
    assert.ok(h.score > 0 && h.score <= 1);
  }
});

test("results are sorted descending by score", () => {
  const hits = lexicalSearchTurns("rates", TURNS, 10);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1]!.score >= hits[i]!.score);
  }
});
