/**
 * packages/index/src/pipeline/speakers.test.ts — U2.4 (B3/B10), deterministic half.
 *
 * The binding rule from plan §10 is the whole point of these tests: "zero speaker name that does
 * not appear verbatim in a cited turn", and "leave low-confidence speakers unresolved rather than
 * guessing". Measured on the real TOC corpus, this deterministic pass resolves 78 of 494
 * positional turns (15.8%); the tests below pin WHY the other 84% is deliberately left alone.
 *
 * The case that motivated the verbatim rule is real: for 2026-08-24-uniaccess-leeds-arts-
 * university the generated session summary says "Juben Thakur" while the transcript says
 * "Jubin Thakkar". Seeding speakers from the summary -- the obvious shortcut -- would have written
 * a wrong human name into the knowledge base and cited it as evidence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Turns } from "@lkb/core";

import { resolveSpeakers } from "./speakers.js";

function turn(id: string, speakerRef: string, text: string): Turns {
  return { _id: id, tenantId: "t1", sessionId: "s1", speakerRef, tStart: 0, tEnd: 0, text };
}

test("binds a positional label to the name that label explicitly self-declares", () => {
  const { resolved } = resolveSpeakers([
    turn("t1", "spk:0", "My name is Jubin Thakkar."),
    turn("t2", "spk:0", "Let me share my screen."),
    turn("t3", "spk:1", "Go ahead."),
  ]);
  assert.equal(resolved.length, 1);
  const s = resolved[0];
  assert.ok(s);
  assert.equal(s.speakerRef, "spk:0");
  assert.equal(s.displayName, "Jubin Thakkar");
  assert.equal(s.personId, "person:jubin-thakkar", "personId is a stable id, never a bare display name (schema H4)");
  assert.deepEqual(s.evidence, [{ turnId: "t1", sessionId: "s1" }], "cites the exact turn that says the name");
});

test("the cited turn really contains the name verbatim", () => {
  const { resolved } = resolveSpeakers([turn("t1", "spk:0", "My name is Jubin Thakkar.")]);
  const turns = [turn("t1", "spk:0", "My name is Jubin Thakkar.")];
  for (const s of resolved) {
    for (const e of s.evidence) {
      const cited = turns.find((t) => t._id === e.turnId);
      assert.ok(cited, "evidence must cite a turn that exists");
      assert.ok(cited.text.includes(s.displayName), "name must appear VERBATIM in its cited turn");
    }
  }
});

test("does NOT treat 'I'm going to ...' as a self-introduction", () => {
  const { resolved } = resolveSpeakers([
    turn("t1", "spk:0", "I'm going to quickly play a small video over here."),
    turn("t2", "spk:0", "This is our Blenheim Walk Campus."),
    turn("t3", "spk:0", "I am really excited about Leeds."),
  ]);
  assert.deepEqual(resolved, [], "verb phrases and place descriptions are not names");
});

test("leaves a label unresolved rather than guessing from a third-party mention", () => {
  // Someone else's name being spoken does not tell us who is SPEAKING.
  const { resolved, unresolved } = resolveSpeakers([
    turn("t1", "spk:0", "Prasanti, what comes to your mind when a student says that?"),
    turn("t2", "spk:1", "Honestly, quite a few things."),
  ]);
  assert.deepEqual(resolved, []);
  assert.deepEqual(unresolved.sort(), ["spk:0", "spk:1"]);
});

test("a label that contradicts itself is left unresolved, not arbitrarily picked", () => {
  const { resolved, unresolved } = resolveSpeakers([
    turn("t1", "spk:0", "My name is Anita Desai."),
    turn("t2", "spk:0", "My name is Rahul Mehta."),
  ]);
  assert.deepEqual(resolved, [], "conflicting self-declarations are not a coin flip");
  assert.deepEqual(unresolved, ["spk:0"]);
});

test("already-named turns are left completely alone", () => {
  const { resolved, unresolved } = resolveSpeakers([
    turn("t1", "Sapna Goyal", "My name is Sapna Goyal."),
    turn("t2", "Sapna Goyal", "Welcome everyone."),
  ]);
  assert.deepEqual(resolved, [], "only positional spk:N labels are in scope");
  assert.deepEqual(unresolved, []);
});

test("collects every turn the speaker self-names in as evidence, deduped and ordered", () => {
  const { resolved } = resolveSpeakers([
    turn("t1", "spk:2", "Hi, my name is Ruby."),
    turn("t2", "spk:2", "As I said, my name is Ruby."),
    turn("t3", "spk:2", "Anyway, moving on."),
  ]);
  assert.equal(resolved.length, 1);
  const ruby = resolved[0];
  assert.ok(ruby);
  assert.deepEqual(ruby.evidence, [
    { turnId: "t1", sessionId: "s1" },
    { turnId: "t2", sessionId: "s1" },
  ]);
});

test("empty input resolves nothing and reports nothing unresolved", () => {
  assert.deepEqual(resolveSpeakers([]), { resolved: [], unresolved: [] });
});
