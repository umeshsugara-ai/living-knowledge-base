/**
 * packages/index/src/pipeline/speaker-name-rules.test.ts — the LEDGER REGRESSION CORPORA.
 *
 * Split out of `speakers-llm.test.ts` when that file crossed the 400-line budget, along the same
 * seam as the source split: these are the recorded attack and recall sets for the name rules, and
 * they exist because of D-015 — a fix must be measured against its issue's OWN recorded cases, not
 * a corpus its author chose.
 *
 * Both directions are pinned here on purpose. Cycle 2 of this seam measured refusal against the
 * ledger and recall against 14 self-chosen probes, claimed "zero recall loss", and had in fact
 * dropped ten recorded introductions. Refusal and recall are asserted together so tightening one
 * at the other's cost fails loudly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Turns } from "@lkb/core";
import type { CompleteResult } from "@lkb/ai";

import { extractSpeakers, type SpeakersCompleteFn } from "./speakers-llm.js";

function turn(id: string, speakerRef: string, text: string): Turns {
  return { _id: id, tenantId: "t1", sessionId: "s1", speakerRef, tStart: 0, tEnd: 0, text };
}
function completion(text: string, json?: unknown): CompleteResult {
  return { text, json, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0 };
}
const replies = (json: unknown): SpeakersCompleteFn => async () => completion("", json);

/**
 * ISS-093's OWN recorded corpus, transcribed verbatim from its `qa/issues.jsonl` evidence field.
 *
 * Required by D-015. Cycle 3 of this seam added the discourse denylist, measured 12/12 against a
 * corpus the maker authored that same cycle, and reported it -- while ISS-093's own 20 cases gave
 * 15/20 and still shipped `person:not` from "I am Not sure about that.". `not` was named by that
 * exact word in the issue's fix_direction. A fix measured against a corpus its own author chose is
 * marking homework with an easier exam.
 *
 * Four cases are deliberately NOT closed and are asserted as still-shipping so the number stays
 * honest: India, Mumbai, Google, English are proper nouns, not discourse words. No pattern
 * separates a city or a company from a person -- that needs a gazetteer, and the model, not this
 * module, is the layer that should decline to propose them. They are carried to the apply unit.
 *
 * Current standing: ISS-093: 17/20 refused, 3 open (all gazetteer-class).
 *
 * "English" was in that residue set until the cycle-1 checker showed it was NOT gazetteer-bound:
 * in "English speaking students may apply." the `speaking` cue is a participial modifier, not the
 * self-identification idiom, and the distinction is candidate-independent ("Prasanti speaking
 * students may apply." is not a naming construction either). ISS-097. Writing it off as
 * unreachable was my error, and pinning it as expected-shipping entrenched it.
 */
const ISS_093_CORPUS: [string, string][] = [
  ["Hello Everyone, thanks for joining.", "Everyone"],
  ["Welcome Everyone to the session.", "Everyone"],
  ["Hey Everyone welcome aboard.", "Everyone"],
  ["Thanks All for being here.", "All"],
  ["Hi Guys, let us start.", "Guys"],
  ["Hi There, can you hear me?", "There"],
  ["Welcome Back to the second session.", "Back"],
  ["Welcome To the annual conference.", "To"],
  ["Thank you So much everyone.", "So"],
  ["I'm Sorry about the delay.", "Sorry"],
  ["I am Not sure about that.", "Not"],
  ["That's Great news for us.", "Great"],
  ["This is Important for all of you.", "Important"],
  ["Thank you Monday for the slot.", "Monday"],
  ["Monday with us marks the deadline.", "Monday"],
  ["Welcome Diwali celebrations this week.", "Diwali"],
  ["This is India speaking on the panel.", "India"],
  ["Coming up next, Mumbai from the west zone.", "Mumbai"],
  ["Google here has an announcement.", "Google"],
  ["English speaking students may apply.", "English"],
];

/** The four ISS-093 cases that remain open by design -- proper nouns, not discourse words. */
const ISS_093_GAZETTEER = new Set(["India", "Mumbai", "Google"]);

for (const [text, name] of ISS_093_CORPUS) {
  const expectedRefusal = !ISS_093_GAZETTEER.has(name);
  test(`ISS-093 corpus: ${JSON.stringify(name)} in ${JSON.stringify(text)} is ${expectedRefusal ? "refused" : "a known gazetteer residue"}`, async () => {
    const { resolved } = await extractSpeakers([turn("t1", "spk:0", text)], replies([
      { speakerRef: "spk:0", displayName: name, turnIds: ["t1"] },
    ]));
    if (expectedRefusal) {
      assert.deepEqual(resolved, [], `${JSON.stringify(name)} is a discourse word, not a person`);
    } else {
      // Asserted as still-shipping ON PURPOSE. If a later unit closes it, this test fails and
      // forces the count in the manifest to be corrected upward -- the number cannot silently rot.
      assert.equal(resolved.length, 1, `${JSON.stringify(name)} is a documented open residue; if it now refuses, update the ISS-093 count`);
    }
  });
}

/**
 * ISS-098's ten recorded recall regressions, verbatim from its `qa/issues.jsonl` evidence field.
 *
 * The cycle-2 `speaking` gate refused all ten. They are the self-identification idiom the cue
 * exists to admit, and the suite could not see the loss: reverting the whole gate reddened exactly
 * ONE test, so the gate was fully measured on refusal and completely unmeasured on recall.
 *
 * The manifest claimed "zero recall loss: all 14 probes correct". That was false, and the 14 probes
 * were ones I chose -- the same self-selected-denominator habit D-015 exists to stop, pointed at
 * recall instead of refusal. These cases are the checker's, not mine, which is the point.
 */
for (const text of [
  "Ruby speaking here.",
  "Ruby speaking and I lead admissions.",
  "Ruby speaking today from Pune.",
  "Ruby speaking again.",
  "Ruby speaking now.",
  "Ruby speaking -- good to be here.",
  "Ruby speaking as the panel chair.",
  "Ruby speaking (admissions).",
  "Ruby speaking\u2026 thanks all.",
  "Ruby speaking over Zoom.",
]) {
  test(`ISS-098 recall: still resolves ${JSON.stringify(text)}`, async () => {
    const { resolved } = await extractSpeakers([turn("t1", "spk:0", text)], replies([
      { speakerRef: "spk:0", displayName: "Ruby", turnIds: ["t1"] },
    ]));
    assert.equal(resolved.length, 1, "the `speaking` idiom must keep resolving");
    assert.equal(resolved[0]?.personId, "person:ruby");
  });
}

test("ISS-098: a bare noun after `speaking` declines the cue WITHOUT vetoing later branches", async () => {
  // The cycle-2 bug was an unconditional early return: the speaking branch refused the whole
  // predicate, so no later cue could fire. Here the participle declines but the address comma
  // still supplies a cue, which only works if the branch falls through.
  const { resolved } = await extractSpeakers(
    [turn("t1", "spk:0", "Prasanti, what do you think of English speaking students?")],
    replies([{ speakerRef: "spk:0", displayName: "Prasanti", turnIds: ["t1"] }]),
  );
  assert.equal(resolved.length, 1, "a declining speaking branch must not veto the address cue");
});
