/**
 * packages/index/src/pipeline/claims.test.ts — the provenance guarantee is the whole point:
 * a claim only survives if its cited turn ids are real, and a fully-fabricated claim is dropped
 * entirely, never shipped with empty evidence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";

import { extractClaims, type ClaimsCompleteFn } from "./claims.js";

function turn(id: string, speakerRef: string, text: string): Turns {
  return { _id: id, tenantId: "t1", sessionId: "s1", speakerRef, tStart: 0, tEnd: 0, text };
}

function completion(text: string, json?: unknown): CompleteResult {
  return { text, json, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0 };
}

test("extractClaims returns [] for an empty turn list, never calls complete", async () => {
  const complete: ClaimsCompleteFn = async () => { throw new Error("must not be called"); };
  const { claims: result, degraded } = await extractClaims([], complete);
  assert.deepEqual(result, []);
});

test("extractClaims keeps a claim whose cited turnId is real", async () => {
  const turns = [turn("t1", "spk:0", "NZ requires 8 IELTS bands.")];
  const complete: ClaimsCompleteFn = async (job: Job) => {
    assert.equal(job.kind, "claims");
    assert.match(job.messages[1]!.content, /\[id:t1\]/);
    return completion("", [{ text: "NZ requires 8 IELTS bands.", turnIds: ["t1"] }]);
  };
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, "NZ requires 8 IELTS bands.");
  assert.deepEqual(result[0]!.evidenceTurnIds, ["t1"]);
});

test("extractClaims drops a claim whose ONLY cited turnId is fabricated (not in the real transcript)", async () => {
  const turns = [turn("t1", "spk:0", "Real content.")];
  const complete: ClaimsCompleteFn = async () => completion("", [{ text: "Invented fact.", turnIds: ["t999-does-not-exist"] }]);
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.deepEqual(result, []);
});

test("extractClaims keeps only the real turnIds out of a mixed real+fabricated set", async () => {
  const turns = [turn("t1", "spk:0", "Real content one."), turn("t2", "spk:1", "Real content two.")];
  const complete: ClaimsCompleteFn = async () => completion("", [{ text: "Mixed claim.", turnIds: ["t1", "t999-fake"] }]);
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]!.evidenceTurnIds, ["t1"]);
});

test("extractClaims drops a claim with no text, and one with a non-array turnIds field", async () => {
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => completion("", [
    { turnIds: ["t1"] }, // no text
    { text: "claim", turnIds: "t1" }, // turnIds not an array
    { text: "good claim", turnIds: ["t1"] },
  ]);
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, "good claim");
});

test("extractClaims returns [] when complete() rejects, never throws into the caller — and says it DEGRADED", async () => {
  // ISS-056: an empty array meant both "no claims in this transcript" and "the provider fell
  // over", and the caller deletes a session's claims before re-inserting — so a transient outage
  // silently destroyed real claims. The reason must survive to the caller.
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => { throw new Error("provider down"); };
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.deepEqual(result, []);
  assert.ok(degraded, "a failed provider call must be reported as degraded, not as 'no claims'");
  assert.match(degraded.reason, /provider down/);
});

test("extractClaims returns [] when the response is not a JSON array — also DEGRADED", async () => {
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => completion("not an array");
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.deepEqual(result, []);
  assert.ok(degraded, "an unparseable response is an unknown, not an empty result");
});

test("a transcript with genuinely nothing citable is NOT degraded — empty means empty", async () => {
  // The other half: if degradation were reported for every empty result, the caller could never
  // replace a session's claims with a legitimately empty set, and stale claims would live forever.
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => completion("[]");
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.deepEqual(result, []);
  assert.equal(degraded, null, "an honest empty extraction must not look like a failure");
});

test("claims dropped for fabricated evidence leave a NON-degraded empty result", async () => {
  // Every claim being dropped by the evidence check is a real, successful extraction that found
  // nothing citable — not a provider failure. Conflating them would block legitimate replacement.
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => completion(JSON.stringify([{ text: "Made up.", turnIds: ["nope"] }]));
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.deepEqual(result, []);
  assert.equal(degraded, null);
});

test("extractClaims prefers completion.json over re-parsing completion.text", async () => {
  const turns = [turn("t1", "spk:0", "Content.")];
  const complete: ClaimsCompleteFn = async () => completion("garbage text ignored", [{ text: "from json", turnIds: ["t1"] }]);
  const { claims: result, degraded } = await extractClaims(turns, complete);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, "from json");
});
