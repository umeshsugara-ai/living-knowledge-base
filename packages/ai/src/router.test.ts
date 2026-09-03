/**
 * packages/ai/src/router.test.ts — T-019 C7 (router half). `route()` resolves an ordered
 * chain; `complete()` tries providers in order and stops at first success; throws
 * `AllProvidersFailedError` when every provider in the chain fails; `recordJob` fires exactly
 * once per attempt via the injectable `write`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { CompleteResult, Job, Provider } from "./provider.js";
import { AllProvidersFailedError, complete, route, type RoutingConfig } from "./router.js";
import type { JobEntry } from "./jobs.js";

const FIXTURE_JOB: Job = { kind: "test", messages: [{ role: "user", content: "hi" }] };

function okResult(provider: string): CompleteResult {
  return { text: "ok", usage: { inputTokens: 1, outputTokens: 1 }, provider, model: "m", costUsd: 0 };
}

function succeedingProvider(name: string): Provider {
  return { name, complete: async () => okResult(name), listModels: async () => [] };
}

function failingProvider(name: string, message = "boom"): Provider {
  return {
    name,
    complete: async () => {
      throw new Error(message);
    },
    listModels: async () => [],
  };
}

function recordingWrite(): { write: RoutingConfig["write"]; calls: JobEntry[] } {
  const calls: JobEntry[] = [];
  return {
    write: async (entry) => {
      calls.push(entry);
    },
    calls,
  };
}

test("route() resolves the ordered chain to Provider instances", () => {
  const gemini = succeedingProvider("gemini");
  const claudeCode = succeedingProvider("claude-code");
  const providers = route("transcribe", {
    chains: { transcribe: ["gemini", "claude-code"] },
    providers: { gemini, "claude-code": claudeCode },
  });
  assert.deepEqual(providers, [gemini, claudeCode]);
});

test("route() throws on an unknown jobKind or unknown provider name", () => {
  assert.throws(() => route("missing", { chains: {}, providers: {} }));
  assert.throws(() =>
    route("x", { chains: { x: ["nope"] }, providers: {} }),
  );
});

test("complete() tries providers in order and stops at first success", async () => {
  const first = failingProvider("first");
  const second = succeedingProvider("second");
  const { write, calls } = recordingWrite();

  const result = await complete("test-kind", FIXTURE_JOB, {
    chains: { "test-kind": ["first", "second"] },
    providers: { first, second },
    write,
    tenantId: "tenant-1",
  });

  assert.equal(result.provider, "second", "result must come from the first SUCCEEDING provider");
  assert.equal(calls.length, 2, "one jobs-ledger write per attempt (failed first, done second)");
  assert.equal(calls[0]!.status, "failed");
  assert.equal(calls[0]!.provider, "first");
  assert.equal(calls[1]!.status, "done");
  assert.equal(calls[1]!.provider, "second");
});

test("complete() throws AllProvidersFailedError when every provider fails, never a silent empty result", async () => {
  const first = failingProvider("first", "err-1");
  const second = failingProvider("second", "err-2");
  const { write, calls } = recordingWrite();

  await assert.rejects(
    () =>
      complete("test-kind", FIXTURE_JOB, {
        chains: { "test-kind": ["first", "second"] },
        providers: { first, second },
        write,
        tenantId: "tenant-1",
      }),
    (err: unknown) => {
      assert.ok(err instanceof AllProvidersFailedError);
      assert.equal(err.jobKind, "test-kind");
      assert.deepEqual(
        err.attempts.map((a) => a.provider),
        ["first", "second"],
      );
      return true;
    },
  );

  assert.equal(calls.length, 2, "recordJob called exactly once per attempt, even on total failure");
  assert.ok(calls.every((c) => c.status === "failed"));
});

test("complete() records exactly one jobs entry for a single-provider chain success", async () => {
  const only = succeedingProvider("only");
  const { write, calls } = recordingWrite();

  await complete("k", FIXTURE_JOB, {
    chains: { k: ["only"] },
    providers: { only },
    write,
    tenantId: "t",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.status, "done");
});
