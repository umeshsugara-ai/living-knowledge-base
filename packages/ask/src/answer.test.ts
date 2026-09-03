/**
 * packages/ask/src/answer.test.ts — T-005b C5. `answer` generates from refined context via the
 * injected `complete` and passes `sources` through unchanged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { fakeComplete } from "./testUtils.js";
import { answer } from "./answer.js";

test("answer generates from refined context and passes sources through unchanged", async () => {
  const complete = fakeComplete({ text: "Apples are red." });
  const sources = { internal: [{ node_id: "n1" }], web: [] };
  const result = await answer("what color are apples?", "Apples are red.", sources, complete);

  assert.equal(result.text, "Apples are red.");
  assert.equal(result.sources, sources, "sources object identity must pass through unchanged");
  assert.equal(complete.calls.length, 1);
  assert.match(complete.calls[0]!.messages[0]!.content, /Apples are red\./);
  assert.match(complete.calls[0]!.messages[0]!.content, /what color are apples\?/);
});
