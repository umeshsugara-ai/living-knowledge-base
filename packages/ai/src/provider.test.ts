/**
 * packages/ai/src/provider.test.ts — T-019 C7 (parity half): runs the same fixture job through
 * two adapters that use different transport kinds (gemini = http, claude-code = cli) with fake
 * transports, and asserts both `complete()` results share the exact `Provider` return shape
 * (same keys, same types) — proving the interface is uniform, not just declared uniform.
 * Router/jobs-ledger behaviour lives in router.test.ts; per-adapter details in providers.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { CompleteResult, Job } from "./provider.js";
import { GeminiProvider } from "./providers/gemini.js";
import { ClaudeCodeProvider } from "./providers/claude-code.js";
import { fakeTransport } from "./testUtils.js";

const FIXTURE_JOB: Job = { kind: "test", messages: [{ role: "user", content: "hi" }] };

function shapeKeys(result: CompleteResult): string[] {
  return Object.keys(result).sort();
}

test("parity: gemini and claude-code adapters produce the same CompleteResult shape", async () => {
  const gemini = new GeminiProvider(
    fakeTransport({
      status: 200,
      body: {
        candidates: [{ content: { parts: [{ text: "hello from gemini" }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      },
    }),
    { apiKey: "test-key" },
  );

  const claudeCode = new ClaudeCodeProvider(
    fakeTransport({
      status: 0,
      body: {
        result: "hello from claude",
        usage: { input_tokens: 5, output_tokens: 3 },
        total_cost_usd: 0.001,
      },
    }),
  );

  const geminiResult = await gemini.complete(FIXTURE_JOB);
  const claudeResult = await claudeCode.complete(FIXTURE_JOB);

  assert.deepEqual(shapeKeys(geminiResult), shapeKeys(claudeResult), "same top-level keys");
  assert.deepEqual(Object.keys(geminiResult.usage).sort(), Object.keys(claudeResult.usage).sort());

  for (const result of [geminiResult, claudeResult]) {
    assert.equal(typeof result.text, "string");
    assert.equal(typeof result.usage.inputTokens, "number");
    assert.equal(typeof result.usage.outputTokens, "number");
    assert.equal(typeof result.provider, "string");
    assert.equal(typeof result.model, "string");
    assert.equal(typeof result.costUsd, "number");
  }

  assert.equal(geminiResult.text, "hello from gemini");
  assert.equal(geminiResult.provider, "gemini");
  assert.equal(claudeResult.text, "hello from claude");
  assert.equal(claudeResult.provider, "claude-code");
});
