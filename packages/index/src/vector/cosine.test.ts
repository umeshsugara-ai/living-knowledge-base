/**
 * packages/index/src/vector/cosine.test.ts — U1.4.
 *
 * The failure this layer is most likely to have is NOT a crash: it is a ranking that looks
 * plausible and is wrong. So these tests pin the mathematical properties (a vector is most similar
 * to itself; orientation beats magnitude; an orthogonal vector scores 0) rather than only checking
 * that some number comes back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity, rankByCosine, rankSessionsByCosine, type ScorableChunk } from "./cosine.js";

const chunk = (id: string, session: string, vector: number[]): ScorableChunk => ({ _id: id, sourceRef: session, vector });

test("a vector is maximally similar to itself (1.0) and opposite to its negation (-1.0)", () => {
  const v = [0.3, -0.7, 0.1, 0.9];
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-12);
  assert.ok(Math.abs(cosineSimilarity(v, v.map((x) => -x)) + 1) < 1e-12);
});

test("cosine measures ORIENTATION, not magnitude — a scaled vector is identical", () => {
  // This is the property that makes cosine the right metric for embeddings: a longer document's
  // vector must not outrank a shorter one just for being longer.
  const a = [1, 2, 3];
  const scaled = a.map((x) => x * 17.3);
  assert.ok(Math.abs(cosineSimilarity(a, scaled) - 1) < 1e-12);
});

test("orthogonal vectors score 0", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("a ZERO vector scores 0, never NaN — 0/0 would poison every comparison and sort unpredictably", () => {
  const s = cosineSimilarity([0, 0, 0], [1, 2, 3]);
  assert.equal(s, 0);
  assert.ok(!Number.isNaN(s), "NaN sorts unpredictably and silently corrupts a ranking");
});

test("a DIMENSION MISMATCH throws rather than truncating to a plausible, meaningless score", () => {
  // Reachable in practice: a re-embed under a changed model leaves old and new rows side by side.
  assert.throws(() => cosineSimilarity([1, 2, 3], [1, 2]), /dimension mismatch/);
});

test("rankByCosine returns best-first and respects k", () => {
  const q = [1, 0];
  const chunks = [chunk("c1", "s1", [0, 1]), chunk("c2", "s2", [1, 0]), chunk("c3", "s3", [0.7, 0.7])];
  const out = rankByCosine(q, chunks, 2);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.chunkId, "c2", "the exact match must rank first");
  assert.equal(out[1]!.chunkId, "c3");
});

test("ranking is DETERMINISTIC across identical scores — otherwise a recall delta is not trustworthy", () => {
  // Two chunks with the same score must always order the same way, or the same corpus measured
  // twice can yield different recall numbers — which would make the delta U1.4 exists to enable
  // meaningless.
  const q = [1, 0];
  const a = [chunk("zzz", "s1", [1, 0]), chunk("aaa", "s2", [1, 0])];
  const b = [chunk("aaa", "s2", [1, 0]), chunk("zzz", "s1", [1, 0])];
  assert.deepEqual(rankByCosine(q, a, 2).map((s) => s.chunkId), ["aaa", "zzz"]);
  assert.deepEqual(rankByCosine(q, b, 2).map((s) => s.chunkId), ["aaa", "zzz"], "input order must not change the ranking");
});

test("rankByCosine throws on a mixed-dimension corpus by default, and skips only when asked", () => {
  const q = [1, 0];
  const chunks = [chunk("ok", "s1", [1, 0]), chunk("bad", "s2", [1, 0, 0])];
  assert.throws(() => rankByCosine(q, chunks, 5), /has 3 dims, query has 2/);
  const skipped = rankByCosine(q, chunks, 5, { skipMismatched: true });
  assert.deepEqual(skipped.map((s) => s.chunkId), ["ok"]);
});

test("k <= 0 returns nothing rather than everything", () => {
  assert.deepEqual(rankByCosine([1, 0], [chunk("c", "s", [1, 0])], 0), []);
});

test("rankSessionsByCosine keeps each session's BEST chunk and never repeats a session", () => {
  const q = [1, 0];
  const chunks = [
    chunk("a1", "sA", [0.9, 0.1]),
    chunk("a2", "sA", [1, 0]), // better, same session
    chunk("b1", "sB", [0.5, 0.5]),
  ];
  const out = rankSessionsByCosine(q, chunks, 5);
  assert.deepEqual(out.map((s) => s.sessionId), ["sA", "sB"]);
  assert.equal(out[0]!.chunkId, "a2", "the session must be represented by its strongest chunk");
});

test("ONE long session cannot crowd the correct answer out of top-k (the overlap-chunker hazard)", () => {
  // The chunker deliberately overlaps turns, so adjacent chunks are near-duplicates. Ranking
  // chunks and truncating to k would let one session fill every slot. Dedupe must happen BEFORE
  // the truncation, which is the whole reason this function is not just `rankByCosine(...).map()`.
  const q = [1, 0];
  const noisy: ScorableChunk[] = Array.from({ length: 10 }, (_, i) => chunk(`long${i}`, "sLong", [0.99, 0.01]));
  const target = chunk("target", "sTarget", [0.98, 0.02]);
  const out = rankSessionsByCosine(q, [...noisy, target], 2);
  assert.deepEqual(out.map((s) => s.sessionId), ["sLong", "sTarget"], "the second slot must go to a DIFFERENT session");
});
