/**
 * packages/ai/src/providers.test.ts — T-019 C2/C3. Per-adapter behaviour not already covered
 * by provider.test.ts's parity test: openai, ollama (incl. its real-transport-call listModels),
 * anthropic's two modes (api-key, and oauth delegating to claude-code), and claude-code's static
 * manifest. Every call goes through a fake transport (C2) — no real network/process call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Job } from "./provider.js";
import { OpenAiProvider } from "./providers/openai.js";
import { OllamaProvider } from "./providers/ollama.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { ClaudeCodeProvider, CLAUDE_CODE_MODELS } from "./providers/claude-code.js";
import { fakeTransport } from "./testUtils.js";

const FIXTURE_JOB: Job = { kind: "test", messages: [{ role: "user", content: "hi" }] };

test("openai adapter completes via its injected transport", async () => {
  const transport = fakeTransport({
    status: 200,
    body: { choices: [{ message: { content: "hi from openai" } }], usage: { prompt_tokens: 4, completion_tokens: 2 } },
  });
  const provider = new OpenAiProvider(transport, { apiKey: "k" });
  const result = await provider.complete(FIXTURE_JOB);
  assert.equal(result.text, "hi from openai");
  assert.equal(result.usage.inputTokens, 4);
  assert.equal(result.provider, "openai");
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0]!.kind, "http");
});

test("openai adapter throws on a non-2xx transport response, never swallows it", async () => {
  const provider = new OpenAiProvider(fakeTransport({ status: 500, body: { error: "down" } }), { apiKey: "k" });
  await assert.rejects(() => provider.complete(FIXTURE_JOB));
});

test("ollama adapter completes via its local /api/chat transport", async () => {
  const transport = fakeTransport({
    status: 200,
    body: { message: { content: "hi from ollama" }, prompt_eval_count: 3, eval_count: 1 },
  });
  const provider = new OllamaProvider(transport);
  const result = await provider.complete(FIXTURE_JOB);
  assert.equal(result.text, "hi from ollama");
  assert.equal(result.provider, "ollama");
});

test("ollama listModels() is a real call to a /api/tags-shaped transport (C3)", async () => {
  const transport = fakeTransport({
    status: 200,
    body: { models: [{ name: "llama3.1" }, { name: "mistral" }] },
  });
  const provider = new OllamaProvider(transport);
  const models = await provider.listModels();
  assert.deepEqual(models, [
    { id: "llama3.1", label: "llama3.1" },
    { id: "mistral", label: "mistral" },
  ]);
  assert.equal(transport.calls[0]!.url?.endsWith("/api/tags"), true);
});

test("anthropic adapter (api-key mode) completes via the Messages API shape", async () => {
  const transport = fakeTransport({
    status: 200,
    body: { content: [{ type: "text", text: "hi from anthropic" }], usage: { input_tokens: 6, output_tokens: 2 } },
  });
  const provider = new AnthropicProvider(transport, { mode: "api-key", apiKey: "sk-test" });
  const result = await provider.complete(FIXTURE_JOB);
  assert.equal(result.text, "hi from anthropic");
  assert.equal(result.provider, "anthropic");
  assert.equal((await provider.listModels()).length > 0, true);
});

test("anthropic adapter (api-key mode) requires an apiKey", () => {
  assert.throws(() => new AnthropicProvider(fakeTransport({ status: 200, body: {} }), { mode: "api-key" }));
});

test("anthropic adapter (oauth mode) delegates to the claude-code CLI transport shape — one implementation, not two", async () => {
  const transport = fakeTransport({
    status: 0,
    body: { result: "hi via oauth", usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0 },
  });
  const provider = new AnthropicProvider(transport, { mode: "oauth" });
  const result = await provider.complete(FIXTURE_JOB);
  assert.equal(result.text, "hi via oauth");
  assert.equal(result.provider, "anthropic");
  assert.equal(transport.calls[0]!.kind, "cli", "oauth mode must go through the CLI transport, not HTTP");
  assert.deepEqual(await provider.listModels(), CLAUDE_CODE_MODELS);
});

test("claude-code adapter returns its static model-alias manifest", async () => {
  const provider = new ClaudeCodeProvider(fakeTransport({ status: 0, body: { result: "x" } }));
  const models = await provider.listModels();
  assert.ok(models.length > 0);
  assert.ok(models.every((m) => typeof m.id === "string" && typeof m.label === "string"));
});

test("claude-code adapter throws on a non-zero CLI exit code", async () => {
  const provider = new ClaudeCodeProvider(fakeTransport({ status: 1, body: {}, text: "auth expired" }));
  await assert.rejects(() => provider.complete(FIXTURE_JOB));
});
