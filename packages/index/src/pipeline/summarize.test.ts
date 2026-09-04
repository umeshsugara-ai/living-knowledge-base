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

test("summarizeSession returns (no content) for an empty turn list, never calls complete", async () => {
  const complete: SummarizeCompleteFn = async () => { throw new Error("must not be called"); };
  const result = await summarizeSession([], complete);
  assert.equal(result.summary, "(no content to summarize)");
});

test("summarizeSession parses a real JSON completion into a full result", async () => {
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
  const result = await summarizeSession(turns, complete);
  assert.equal(result.summary, "Discussion about visas and an early-application decision.");
  assert.deepEqual(result.keyInsights, ["Visas take time"]);
  assert.deepEqual(result.decisions, ["Apply early"]);
  assert.deepEqual(result.actionItems, []);
});

test("summarizeSession falls back to a labeled transcript slice on an unparseable response, never throws", async () => {
  const turns = [turn("t1", "spk:0", "Real transcript content.")];
  const complete: SummarizeCompleteFn = async () => completion("not json at all");
  const result = await summarizeSession(turns, complete);
  assert.match(result.summary, /^\(fallback, LLM summary unavailable\)/);
  assert.match(result.summary, /Real transcript content\./);
});

test("summarizeSession falls back honestly when complete() rejects, never throws into the caller", async () => {
  const turns = [turn("t1", "spk:0", "Some content.")];
  const complete: SummarizeCompleteFn = async () => { throw new Error("provider down"); };
  const result = await summarizeSession(turns, complete);
  assert.match(result.summary, /^\(fallback, LLM summary unavailable\)/);
});

test("summarizeSession rejects a response with a missing/empty summary field, falls back instead", async () => {
  const turns = [turn("t1", "spk:0", "Content here.")];
  const complete: SummarizeCompleteFn = async () => completion(JSON.stringify({ summary: "" }));
  const result = await summarizeSession(turns, complete);
  assert.match(result.summary, /^\(fallback, LLM summary unavailable\)/);
});
