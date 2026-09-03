/**
 * packages/meeting-bot/src/live-monitor.test.ts — T-011 C3 (live-monitor half).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Turn } from "@lkb/ingest";
import { excludePrivateSegments } from "./live-monitor.js";

function turn(tStart: number, tEnd: number, text = "t"): Turn {
  return { speakerRef: "spk:0", tStart, tEnd, text };
}

test("a turn fully inside a private window is dropped", () => {
  const turns = [turn(10, 20)];
  const result = excludePrivateSegments(turns, [{ tStart: 0, tEnd: 30 }]);
  assert.deepEqual(result, []);
});

test("a turn fully outside every window survives", () => {
  const t = turn(100, 110);
  const result = excludePrivateSegments([t], [{ tStart: 0, tEnd: 30 }]);
  assert.deepEqual(result, [t]);
});

test("a turn partially overlapping a window's edge is dropped, not truncated", () => {
  const t = turn(25, 35); // straddles the window's end at 30
  const result = excludePrivateSegments([t], [{ tStart: 0, tEnd: 30 }]);
  assert.deepEqual(result, [], "must be fully excluded, never returned with adjusted tStart/tEnd");
});

test("an empty privateWindows array is a no-op", () => {
  const turns = [turn(0, 10), turn(20, 30)];
  const result = excludePrivateSegments(turns, []);
  assert.deepEqual(result, turns);
});

test("multiple non-overlapping private windows each correctly exclude their own turns", () => {
  const survivor = turn(50, 60);
  const excluded1 = turn(0, 10);
  const excluded2 = turn(100, 110);
  const result = excludePrivateSegments(
    [excluded1, survivor, excluded2],
    [{ tStart: 0, tEnd: 10 }, { tStart: 100, tEnd: 110 }],
  );
  assert.deepEqual(result, [survivor]);
});

test("does not mutate the input array", () => {
  const turns = [turn(10, 20)];
  const copy = [...turns];
  excludePrivateSegments(turns, [{ tStart: 0, tEnd: 30 }]);
  assert.deepEqual(turns, copy);
});
