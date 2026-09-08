/**
 * packages/index/src/vector/retriever.test.ts — U1.4. The `RetrieveFn` adapter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVectorRetriever } from "./retriever.js";
import type { ScorableChunk } from "./cosine.js";
import { computeRecallAtK } from "../eval/recall.js";

const chunk = (id: string, session: string, vector: number[]): ScorableChunk => ({ _id: id, sourceRef: session, vector });

const CHUNKS = [
  chunk("c1", "session-visa", [1, 0, 0]),
  chunk("c2", "session-funding", [0, 1, 0]),
  chunk("c3", "session-creative", [0, 0, 1]),
];

test("the retriever satisfies RetrieveFn and drops straight into the recall harness", () => {
  // The point of the whole adapter: the existing harness must be able to score a vector retriever
  // with no change to the harness itself.
  const vectors = new Map([
    ["visa question", [1, 0, 0]],
    ["funding question", [0, 1, 0]],
  ]);
  const retrieve = createVectorRetriever(vectors, CHUNKS);
  const result = computeRecallAtK(
    [
      { id: "q1", question: "visa question", expectedSessionId: "session-visa" },
      { id: "q2", question: "funding question", expectedSessionId: "session-funding" },
    ] as never,
    retrieve,
    1,
  );
  assert.equal(result.misses.length, 0);
});

test("a MISSING question embedding throws — it must never be scored as a retrieval miss", () => {
  // Returning [] here would be indistinguishable, to the harness, from "the retriever ran and
  // found nothing". A plumbing failure would silently depress the recall number and be read as a
  // quality regression. That is the single most misleading thing this adapter could do.
  const retrieve = createVectorRetriever(new Map(), CHUNKS);
  assert.throws(() => retrieve("never embedded", 5), /would be scored as a retrieval MISS/);
});

test("onMissingEmbedding: 'empty' is available but must be opted into explicitly", () => {
  const retrieve = createVectorRetriever(new Map(), CHUNKS, { onMissingEmbedding: "empty" });
  assert.deepEqual(retrieve("never embedded", 5), []);
});

test("returns session ids, best first, capped at k", () => {
  const vectors = new Map([["q", [0.9, 0.1, 0]]]);
  const retrieve = createVectorRetriever(vectors, CHUNKS);
  assert.deepEqual(retrieve("q", 2), ["session-visa", "session-funding"]);
  assert.deepEqual(retrieve("q", 1), ["session-visa"]);
});

test("an empty corpus returns nothing rather than throwing — a fresh tenant is not an error", () => {
  const retrieve = createVectorRetriever(new Map([["q", [1, 0, 0]]]), []);
  assert.deepEqual(retrieve("q", 5), []);
});
