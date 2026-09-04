/**
 * packages/ai/src/stt/chunk-audio.test.ts — T-003 long-audio-chunking. `computeChunkBoundaries`
 * and `mergeChunkedTurns` against synthetic data — no I/O.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeChunkBoundaries, mergeChunkedTurns, findTimeGaps } from "./chunk-audio.js";
import type { Turn } from "./transcribe.js";

test("computeChunkBoundaries: exact division produces evenly-sized chunks", () => {
  const boundaries = computeChunkBoundaries(4800, 2400);
  assert.deepEqual(boundaries, [{ start: 0, end: 2400 }, { start: 2400, end: 4800 }]);
});

test("computeChunkBoundaries: a remainder produces a shorter final chunk", () => {
  const boundaries = computeChunkBoundaries(6069, 2400);
  assert.deepEqual(boundaries, [
    { start: 0, end: 2400 },
    { start: 2400, end: 4800 },
    { start: 4800, end: 6069 },
  ]);
});

test("computeChunkBoundaries: a duration shorter than one chunk produces a single chunk", () => {
  const boundaries = computeChunkBoundaries(600, 2400);
  assert.deepEqual(boundaries, [{ start: 0, end: 600 }]);
});

test("computeChunkBoundaries: zero or negative duration returns no chunks", () => {
  assert.deepEqual(computeChunkBoundaries(0, 2400), []);
  assert.deepEqual(computeChunkBoundaries(-5, 2400), []);
});

test("computeChunkBoundaries: throws on a non-positive chunkSeconds", () => {
  assert.throws(() => computeChunkBoundaries(1000, 0), /chunkSeconds must be > 0/);
});

function turn(tStart: number, tEnd: number, speakerRef = "spk:0"): Turn {
  return { speakerRef, tStart, tEnd, text: `turn at ${tStart}` };
}

test("mergeChunkedTurns: applies each chunk's offset to its own turns' tStart/tEnd", () => {
  const merged = mergeChunkedTurns([
    { offsetSeconds: 0, turns: [turn(0, 10), turn(10, 20)] },
    { offsetSeconds: 2400, turns: [turn(0, 15)] },
  ]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged[0], { speakerRef: "spk:0", tStart: 0, tEnd: 10, text: "turn at 0" });
  assert.deepEqual(merged[1], { speakerRef: "spk:0", tStart: 10, tEnd: 20, text: "turn at 10" });
  assert.deepEqual(merged[2], { speakerRef: "spk:0", tStart: 2400, tEnd: 2415, text: "turn at 0" });
});

test("mergeChunkedTurns: preserves chunk order even if offsets aren't sorted", () => {
  const merged = mergeChunkedTurns([
    { offsetSeconds: 2400, turns: [turn(0, 5)] },
    { offsetSeconds: 0, turns: [turn(0, 5)] },
  ]);
  assert.equal(merged[0]!.tStart, 2400, "first chunk in the input array comes first in the output, regardless of offset value");
  assert.equal(merged[1]!.tStart, 0);
});

test("mergeChunkedTurns: an empty chunk's turns contribute nothing", () => {
  const merged = mergeChunkedTurns([
    { offsetSeconds: 0, turns: [turn(0, 10)] },
    { offsetSeconds: 2400, turns: [] },
  ]);
  assert.equal(merged.length, 1);
});

test("mergeChunkedTurns: an empty chunks array returns an empty array", () => {
  assert.deepEqual(mergeChunkedTurns([]), []);
});

test("findTimeGaps: no gap when turns cover the timeline continuously", () => {
  const turns = [turn(0, 100), turn(100, 200), turn(200, 300)];
  assert.deepEqual(findTimeGaps(turns, 30), []);
});

test("findTimeGaps: real bug repro -- a chunk that stops early leaves a detectable gap at the seam", () => {
  // Reproduces the exact real shape: chunk 1 (offset 0) covers most of its span then stops at
  // 2086s instead of the full 2400s; chunk 2 (offset 2400) starts fresh. The overall last-turn/
  // duration ratio would read as ~100% (chunk 2 covers the tail of the timeline) while this real
  // 314s gap sits silently in the middle -- this is the check that "coverage" alone missed.
  const turns = [turn(0, 50), turn(50, 2086), turn(2400, 2465)];
  const gaps = findTimeGaps(turns, 30);
  assert.equal(gaps.length, 1, "only the real internal gap, not a leading gap from time 0");
  assert.deepEqual(gaps[0], { gapStart: 2086, gapEnd: 2400, gapSeconds: 314 });
});

test("findTimeGaps: a gap at or under the threshold is not reported", () => {
  const turns = [turn(0, 100), turn(120, 200)]; // 20s gap
  assert.deepEqual(findTimeGaps(turns, 30), []);
});

test("findTimeGaps: overlapping turns produce no negative-duration gap", () => {
  const turns = [turn(0, 100), turn(50, 150)];
  assert.deepEqual(findTimeGaps(turns, 30), []);
});

test("findTimeGaps: finds multiple gaps across the whole timeline, not just the first", () => {
  const turns = [turn(0, 10), turn(100, 110), turn(300, 310)];
  const gaps = findTimeGaps(turns, 30);
  assert.equal(gaps.length, 2);
  assert.deepEqual(gaps[0], { gapStart: 10, gapEnd: 100, gapSeconds: 90 });
  assert.deepEqual(gaps[1], { gapStart: 110, gapEnd: 300, gapSeconds: 190 });
});

test("findTimeGaps: an empty turns array has no gaps", () => {
  assert.deepEqual(findTimeGaps([], 30), []);
});
