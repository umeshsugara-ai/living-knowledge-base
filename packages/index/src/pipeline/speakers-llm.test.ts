/**
 * packages/index/src/pipeline/speakers-llm.test.ts — U2.4, the LLM half.
 *
 * The deterministic pass reaches 78/494 turns (15.8%). This is the path to the other ~84%, and the
 * whole risk of it is that a model will happily invent a plausible human name. So the tests below
 * are mostly about REFUSAL: what the extractor throws away.
 *
 * The rule it exists to enforce (plan §10): "zero speaker name that does not appear verbatim in a
 * cited turn". A model that returns a correctly-spelled name the transcript never says is exactly
 * the Juben/Jubin defect that motivated this unit, arriving by a different route.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";

import { extractSpeakers, type SpeakersCompleteFn } from "./speakers-llm.js";

function turn(id: string, speakerRef: string, text: string): Turns {
  return { _id: id, tenantId: "t1", sessionId: "s1", speakerRef, tStart: 0, tEnd: 0, text };
}
function completion(text: string, json?: unknown): CompleteResult {
  return { text, json, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0 };
}
const replies = (json: unknown): SpeakersCompleteFn => async () => completion("", json);

test("keeps a speaker whose name is verbatim in a real cited turn", async () => {
  const turns = [turn("t1", "spk:0", "Good morning, this side Nilesh Gotecha from CEPT.")];
  const { resolved, degraded } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Nilesh Gotecha", turnIds: ["t1"] },
  ]));
  assert.equal(degraded, null);
  assert.equal(resolved.length, 1);
  const s = resolved[0];
  assert.ok(s);
  assert.equal(s.displayName, "Nilesh Gotecha");
  assert.equal(s.personId, "person:nilesh-gotecha");
  assert.deepEqual(s.evidence, [{ turnId: "t1", sessionId: "s1" }]);
});

test("DROPS a name the cited turn does not contain verbatim -- the Juben/Jubin defect", async () => {
  // The model returns the summarizer's normalised spelling; the transcript says something else.
  const turns = [turn("t1", "spk:0", "My name is Jubin Thakkar.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Juben Thakur", turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, [], "a plausible but unspoken spelling must never ship");
});

test("drops a fabricated turnId, and drops the speaker entirely if none survive", async () => {
  const turns = [turn("t1", "spk:0", "My name is Ruby.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Ruby", turnIds: ["t99-does-not-exist"] },
  ]));
  assert.deepEqual(resolved, [], "no speaker ships on invented evidence");
});

test("keeps only the surviving subset when some cited turns are real and some are not", async () => {
  const turns = [turn("t1", "spk:0", "My name is Ruby."), turn("t2", "spk:0", "Ruby again here.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Ruby", turnIds: ["t1", "t404", "t2"] },
  ]));
  assert.equal(resolved.length, 1);
  assert.deepEqual(resolved[0]?.evidence, [
    { turnId: "t1", sessionId: "s1" },
    { turnId: "t2", sessionId: "s1" },
  ]);
});

test("refuses to rename a turn that already carries a real name", async () => {
  const turns = [turn("t1", "Sapna Goyal", "My name is Sapna Goyal.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "Sapna Goyal", displayName: "Sapna Goyal", turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, [], "only positional spk:N labels are in scope");
});

test("drops a speakerRef that does not exist in the transcript at all", async () => {
  const turns = [turn("t1", "spk:0", "My name is Ruby.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:7", displayName: "Ruby", turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, [], "cannot name a speaker who never spoke");
});

test("one label claiming two different names is left unresolved, not coin-flipped", async () => {
  const turns = [turn("t1", "spk:0", "Anita Desai here."), turn("t2", "spk:0", "Actually Rahul Mehta.")];
  const { resolved, unresolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Anita Desai", turnIds: ["t1"] },
    { speakerRef: "spk:0", displayName: "Rahul Mehta", turnIds: ["t2"] },
  ]));
  assert.deepEqual(resolved, []);
  assert.deepEqual(unresolved, ["spk:0"]);
});

test("a provider failure DEGRADES to the deterministic pass, never to a silent empty result", async () => {
  const turns = [turn("t1", "spk:0", "My name is Jubin Thakkar."), turn("t2", "spk:1", "Sure.")];
  const boom: SpeakersCompleteFn = async () => { throw new Error("429 rate limited"); };
  const { resolved, degraded } = await extractSpeakers(turns, boom);
  assert.ok(degraded, "the caller must be able to tell 'unknown' from 'none found'");
  assert.match(degraded.reason, /429/);
  assert.equal(resolved.length, 1, "the regex fallback still resolves what it can");
  assert.equal(resolved[0]?.displayName, "Jubin Thakkar");
});

test("an unparseable response degrades rather than throwing", async () => {
  const turns = [turn("t1", "spk:0", "Hello there.")];
  const junk: SpeakersCompleteFn = async () => completion("not json at all");
  const { resolved, degraded } = await extractSpeakers(turns, junk);
  assert.ok(degraded);
  assert.deepEqual(resolved, []);
});

test("sends the citable transcript and the speakers jobKind", async () => {
  const turns = [turn("t1", "spk:0", "My name is Ruby.")];
  const seen: Job[] = [];
  const spy: SpeakersCompleteFn = async (job) => { seen.push(job); return completion("", []); };
  await extractSpeakers(turns, spy);
  const job = seen[0];
  assert.ok(job, "the provider must actually be called");
  assert.equal(job.kind, "speakers");
  const userMessage = job.messages.at(-1);
  assert.ok(userMessage);
  assert.match(userMessage.content, /\[id:t1\]/);
  assert.match(userMessage.content, /\[spk:0\]/);
});

/**
 * C2 hardening. The cycle-1 checker got two attacks past the verbatim rule, which was a bare
 * substring test with no token boundary and no name-shape constraint:
 *
 *   "Ruby"         against "My name is Rubykumar Shah."  -> shipped as person:ruby
 *   "Good morning" against "Good morning everyone."      -> shipped as person:good-morning
 *
 * Both are anti-fabrication failures: a model supplies the string, so "it appeared in the text"
 * is not enough -- it has to have appeared AS A NAME. These pin the fix.
 */
test("refuses a name that only appears INSIDE a longer word", async () => {
  const turns = [turn("t1", "spk:0", "My name is Rubykumar Shah.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Ruby", turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, [], "'Ruby' inside 'Rubykumar' is not a verbatim mention of Ruby");
});

test("refuses a lowercase phrase that happens to be in the transcript", async () => {
  const turns = [turn("t1", "spk:0", "Good morning everyone.")];
  const { resolved } = await extractSpeakers(turns, replies([
    { speakerRef: "spk:0", displayName: "Good morning", turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, [], "a greeting is not a name");
});

test("still accepts the legitimate names the hardening must not break", async () => {
  for (const [text, name, expected] of [
    ["My name is Ruby.", "Ruby", "person:ruby"],
    ["My name is Jubin Thakkar.", "Jubin Thakkar", "person:jubin-thakkar"],
    ["I am Amrita Mhapankar, and welcome.", "Amrita Mhapankar", "person:amrita-mhapankar"],
    ["This is Makrand Rajadhyaksha speaking.", "Makrand Rajadhyaksha", "person:makrand-rajadhyaksha"],
    ["Hello, D'Souza here.", "D'Souza", "person:d-souza"],
  ] as [string, string, string][]) {
    const { resolved } = await extractSpeakers([turn("t1", "spk:0", text)], replies([
      { speakerRef: "spk:0", displayName: name, turnIds: ["t1"] },
    ]));
    assert.equal(resolved.length, 1, `${name} must still resolve`);
    assert.equal(resolved[0]?.personId, expected);
  }
});

test("accepts a name at the very start and very end of a turn", async () => {
  for (const text of ["Ruby speaking.", "That would be Ruby"]) {
    const { resolved } = await extractSpeakers([turn("t1", "spk:0", text)], replies([
      { speakerRef: "spk:0", displayName: "Ruby", turnIds: ["t1"] },
    ]));
    assert.equal(resolved.length, 1, `boundary case failed for: ${text}`);
  }
});

test("refuses an absurdly long 'name' -- a sentence is not an identity", async () => {
  const text = "Thank You All For Joining Us Today In This Session";
  const { resolved } = await extractSpeakers([turn("t1", "spk:0", text)], replies([
    { speakerRef: "spk:0", displayName: text, turnIds: ["t1"] },
  ]));
  assert.deepEqual(resolved, []);
});

test("empty input never calls the provider", async () => {
  const boom: SpeakersCompleteFn = async () => { throw new Error("must not be called"); };
  const r = await extractSpeakers([], boom);
  assert.deepEqual(r, { resolved: [], unresolved: [], degraded: null });
});
