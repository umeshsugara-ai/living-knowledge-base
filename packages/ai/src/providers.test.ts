/**
 * packages/ai/src/providers.test.ts — T-019 C2/C3. Per-adapter behaviour not already covered
 * by provider.test.ts's parity test: openai, ollama (incl. its real-transport-call listModels),
 * anthropic's two modes (api-key, and oauth delegating to claude-code), and claude-code's static
 * manifest. Every call goes through a fake transport (C2) — no real network/process call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Job } from "./provider.js";
import { canEmbed } from "./provider.js";
import { GeminiProvider } from "./providers/gemini.js";
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

/**
 * U1.1 — `embed()` on the provider seam. Every case is an ATTACK on the contract that makes a
 * vector index trustworthy: one vector per text, in order, all the same length. A short or ragged
 * response corrupts similarity search silently, which is the failure that would be hardest to
 * trace back here, so the adapters refuse rather than return something plausible.
 */
const vec = (n: number, fill: number) => Array.from({ length: n }, () => fill);


test("embed: gemini batches all texts into ONE call and pairs vectors by index", async () => {
  const t = fakeTransport({
    status: 200,
    body: { embeddings: [{ values: vec(768, 0.1) }, { values: vec(768, 0.2) }] },
  });
  const p = new GeminiProvider(t, { apiKey: "k" });
  const r = await p.embed!({ kind: "embedding", texts: ["alpha", "beta"] });

  assert.equal(t.calls.length, 1, "two texts must cost one call, not two");
  assert.match(t.calls[0]!.url!, /batchEmbedContents/);
  assert.equal(r.vectors.length, 2);
  assert.equal(r.dims, 768);
  assert.equal(r.vectors[0]![0], 0.1, "order must be preserved — the caller pairs by index");
  assert.equal(r.vectors[1]![0], 0.2);
  });


test("embed: gemini sends RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT so a query is not embedded as a document", async () => {
  const t = fakeTransport({ status: 200, body: { embeddings: [{ values: vec(4, 1) }] } });
  const p = new GeminiProvider(t, { apiKey: "k" });
  await p.embed!({ kind: "embedding", texts: ["q"], purpose: "query" });
  const body = t.calls[0]!.body as { requests: { taskType: string }[] };
  assert.equal(body.requests[0]!.taskType, "RETRIEVAL_QUERY");
  });


test("embed: REFUSES a short response rather than pairing the wrong vector to the wrong text", async () => {
  // The dangerous case: two texts, one vector. Silently zipping these would attach chunk B's
  // meaning to chunk A's id, and every later search would be subtly wrong with nothing to show.
  const t = fakeTransport({ status: 200, body: { embeddings: [{ values: vec(768, 0.1) }] } });
  const p = new GeminiProvider(t, { apiKey: "k" });
  await assert.rejects(
    p.embed!({ kind: "embedding", texts: ["alpha", "beta"] }),
    /returned 1 vector\(s\) for 2 text\(s\)/,
  );
  });


test("embed: REFUSES a ragged response — differing lengths cannot be compared by cosine", async () => {
  const t = fakeTransport({
    status: 200,
    body: { embeddings: [{ values: vec(768, 0.1) }, { values: vec(512, 0.2) }] },
  });
  const p = new GeminiProvider(t, { apiKey: "k" });
  await assert.rejects(p.embed!({ kind: "embedding", texts: ["a", "b"] }), /ragged set/);
  });


test("embed: ollama embeds locally through the same seam, so the corpus need never leave", async () => {
  const t = fakeTransport({ status: 200, body: { embeddings: [vec(384, 0.5), vec(384, 0.6)] } });
  const p = new OllamaProvider(t, {});
  const r = await p.embed!({ kind: "embedding", texts: ["a", "b"] });
  assert.equal(t.calls.length, 1);
  assert.match(t.calls[0]!.url!, /\/api\/embed$/);
  assert.equal(r.dims, 384);
  assert.equal(r.provider, "ollama");
  });


test("embed: ollama applies the same short-response refusal", async () => {
  const t = fakeTransport({ status: 200, body: { embeddings: [vec(384, 0.5)] } });
  const p = new OllamaProvider(t, {});
  await assert.rejects(p.embed!({ kind: "embedding", texts: ["a", "b"] }), /refusing to pair/);
  });


test("embed: an empty batch costs no call at all", async () => {
  const t = fakeTransport({ status: 200, body: {} });
  const p = new GeminiProvider(t, { apiKey: "k" });
  const r = await p.embed!({ kind: "embedding", texts: [] });
  assert.equal(t.calls.length, 0, "an empty batch must not hit a paid endpoint");
  assert.deepEqual(r.vectors, []);
  });


test("embed: canEmbed() distinguishes providers that support embeddings from those that cannot", async () => {
  // claude-code runs a CLI and Anthropic ships no embedding API. The router uses this to SKIP
  // them rather than fail the chain at the first member without an embed().
  assert.equal(canEmbed(new GeminiProvider(fakeTransport(), { apiKey: "k" })), true);
  assert.equal(canEmbed(new OllamaProvider(fakeTransport(), {})), true);
  assert.equal(canEmbed(new AnthropicProvider(fakeTransport(), { mode: "oauth" })), false);
  });
