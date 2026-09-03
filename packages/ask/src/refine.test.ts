/**
 * packages/ask/src/refine.test.ts — T-005b C5. `refine` drops a strip a fake `complete` marks
 * irrelevant and keeps one it marks relevant (mirrors T-005's CRAG worked example): decompose ->
 * per-strip filter -> recompose.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { fakeComplete } from "./testUtils.js";
import { refine, decompose, parseKeep } from "./refine.js";

test("decompose splits on sentence boundaries and drops blanks", () => {
  assert.deepEqual(decompose("Apples are red. Bananas are yellow.  "), [
    "Apples are red.",
    "Bananas are yellow.",
  ]);
  assert.deepEqual(decompose(""), []);
});

test("refine keeps a strip marked relevant and drops one marked irrelevant", async () => {
  // doc has two strips: the first is relevant to the query, the second is not.
  const complete = fakeComplete(
    { json: { keep: true } },
    { json: { keep: false } },
  );
  const result = await refine(
    [{ text: "Apples are red. The weather today is cloudy." }],
    "what color are apples?",
    complete,
  );
  assert.equal(result, "Apples are red.");
  assert.equal(complete.calls.length, 2);
});

test("refine recomposes kept strips across multiple docs in order", async () => {
  const complete = fakeComplete(() => ({ json: { keep: true } }));
  const result = await refine(
    [{ text: "First doc sentence one." }, { text: "Second doc sentence one." }],
    "q",
    complete,
  );
  assert.equal(result, "First doc sentence one. Second doc sentence one.");
});

test("refine returns empty string when every strip is dropped", async () => {
  const complete = fakeComplete(() => ({ json: { keep: false } }));
  const result = await refine([{ text: "Irrelevant sentence." }], "q", complete);
  assert.equal(result, "");
});

test("parseKeep falls back to scanning completion text when json is absent", () => {
  assert.equal(parseKeep({ text: "true", usage: { inputTokens: 0, outputTokens: 0 }, provider: "p", model: "m", costUsd: 0 }), true);
  assert.equal(parseKeep({ text: "false", usage: { inputTokens: 0, outputTokens: 0 }, provider: "p", model: "m", costUsd: 0 }), false);
});
