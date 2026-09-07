/**
 * packages/index/src/pipeline/summarize.test.ts — real JSON parsing + honest-fallback behavior,
 * fake `complete` (never a real LLM call in tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";

import { summarizeSession, type SummarizeCompleteFn } from "./summarize.js";

function turn(id: string, speakerRef: string, text: string): Turns {
  return { _id: id, tenantId: "t1", sessionId: "s1", speakerRef, tStart: 0, tEnd: 0, text };
}

function completion(text: string): CompleteResult {
  return { text, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0 };
}

test("summarizeSession returns (no content) for an empty turn list, never calls complete, NOT degraded", async () => {
  const complete: SummarizeCompleteFn = async () => { throw new Error("must not be called"); };
  const { page, degraded } = await summarizeSession([], complete);
  assert.equal(page.summary, "(no content to summarize)");
  assert.equal(degraded, null, "an empty session is an honest empty result, not a failure");
});

test("summarizeSession parses a real JSON completion into a full result, NOT degraded", async () => {
  const turns = [turn("t1", "spk:0", "We discussed visas."), turn("t2", "spk:1", "Decided to apply early.")];
  const complete: SummarizeCompleteFn = async (job: Job) => {
    assert.equal(job.kind, "summarize");
    assert.match(job.messages[1]!.content, /We discussed visas\./);
    return completion(JSON.stringify({
      summary: "Discussion about visas and an early-application decision.",
      keyInsights: ["Visas take time"],
      decisions: ["Apply early"],
      actionItems: [],
    }));
  };
  const { page, degraded } = await summarizeSession(turns, complete);
  assert.equal(page.summary, "Discussion about visas and an early-application decision.");
  assert.deepEqual(page.keyInsights, ["Visas take time"]);
  assert.deepEqual(page.decisions, ["Apply early"]);
  assert.deepEqual(page.actionItems, []);
  assert.equal(degraded, null);
});

test("summarizeSession falls back to a labeled transcript slice on an unparseable response, never throws — and says it DEGRADED", async () => {
  const turns = [turn("t1", "spk:0", "Real transcript content.")];
  const complete: SummarizeCompleteFn = async () => completion("not json at all");
  const { page, degraded } = await summarizeSession(turns, complete);
  assert.match(page.summary, /^\(fallback, LLM summary unavailable\)/);
  assert.match(page.summary, /Real transcript content\./);
  assert.ok(degraded, "an unparseable response must be reported as degraded");
});

test("summarizeSession falls back honestly when complete() rejects, never throws into the caller — DEGRADED", async () => {
  const turns = [turn("t1", "spk:0", "Some content.")];
  const complete: SummarizeCompleteFn = async () => { throw new Error("provider down"); };
  const { page, degraded } = await summarizeSession(turns, complete);
  assert.match(page.summary, /^\(fallback, LLM summary unavailable\)/);
  assert.ok(degraded, "a failed provider call must be reported as degraded, not as a silent fallback");
  assert.match(degraded.reason, /provider down/);
});

test("summarizeSession rejects a response with a missing/empty summary field, falls back instead — DEGRADED", async () => {
  const turns = [turn("t1", "spk:0", "Content here.")];
  const complete: SummarizeCompleteFn = async () => completion(JSON.stringify({ summary: "" }));
  const { page, degraded } = await summarizeSession(turns, complete);
  assert.match(page.summary, /^\(fallback, LLM summary unavailable\)/);
  assert.ok(degraded, "an unusable response must be reported as degraded");
});
