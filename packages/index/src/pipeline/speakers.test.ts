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

/**
 * Pins the module's single most important guarantee, which the original suite did not cover:
 * deleting the `(t.text ?? "").includes(name)` guard in speakers.ts reddened NOTHING (found by the
 * cycle-1 checker via mutation testing).
 *
 * The hole is subtle. `SELF_NAMING` separates its two capture groups with `\s+` -- any whitespace
 * run -- while the name is reassembled with `join(" ")`, a single space. So an introduction whose
 * name tokens are split by a newline, tab or double space would yield a `displayName` that is
 * ABSENT VERBATIM from the very turn cited as its evidence: a direct C2 violation, and entirely
 * plausible in real diarization output where a turn wraps across lines. Refusing to resolve is the
 * correct outcome -- "leave low-confidence speakers unresolved rather than guessing".
 */
for (const [label, text] of [
  ["a double space", "My name is Jubin  Thakkar."],
  ["a newline", "My name is Jubin\nThakkar."],
  ["a tab", "My name is Jubin\tThakkar."],
] as [string, string][]) {
  test(`refuses to resolve when the name is split by ${label}`, () => {
    const { resolved, unresolved } = resolveSpeakers([turn("t1", "spk:0", text)]);
    assert.deepEqual(resolved, [], "a name it cannot cite verbatim must not be emitted");
    assert.deepEqual(unresolved, ["spk:0"], "and the label stays honestly unresolved");
  });
}

test("every emitted name is verbatim in EVERY turn it cites, across whitespace variants", () => {
  const turns = [
    turn("t1", "spk:0", "My name is Jubin Thakkar."),
    turn("t2", "spk:1", "My name is Jubin  Thakkar."),
    turn("t3", "spk:2", "My name is Ruby."),
  ];
  const { resolved } = resolveSpeakers(turns);
  for (const s of resolved) {
    for (const e of s.evidence) {
      const cited = turns.find((t) => t._id === e.turnId);
      assert.ok(cited, "evidence must cite a real turn");
      assert.ok(
        cited.text.includes(s.displayName),
        `C2 violated: ${JSON.stringify(s.displayName)} is not verbatim in ${JSON.stringify(cited.text)}`,
      );
    }
  }
  assert.deepEqual(resolved.map((r) => r.speakerRef).sort(), ["spk:0", "spk:2"]);
});

test("empty input resolves nothing and reports nothing unresolved", () => {
  assert.deepEqual(resolveSpeakers([]), { resolved: [], unresolved: [] });
});

/**
 * Segment-aware scope tests (speaker-segment-identity gate, Option A, phase 1).
 *
 * The gate's measured evidence: 494 positional turns form 240 contiguous blocks but only 29
 * session/label pairs — one label CAN cover multiple people, so identity evidence must be scoped
 * to the block(s) containing its verbatim self-naming, never to the label session-wide.
 */
test("resolved identity carries the turn-index block window of its citing turns", () => {
  // spk:0 speaks as one contiguous block: indexes 0-2 (t1-t3).
  const turns = [
    turn("t1", "spk:0", "My name is Jubin Thakkar."),
    turn("t2", "spk:0", "Let me share my screen."),
    turn("t3", "spk:0", "That is the campus."),
    turn("t4", "Sapna Goyal", "Thank you, Jubin."),
    turn("t5", "spk:1", "Great."),
  ];
  const { resolved } = resolveSpeakers(turns);
  assert.equal(resolved.length, 1);
  const s = resolved[0];
  assert.ok(s);
  assert.deepEqual(
    s.blocks,
    [{ startTurnIndex: 0, endTurnIndex: 2 }],
    "identity is scoped to the contiguous block that self-declared, not the whole label",
  );
});

test("a RECURRING label is NOT one person: each block window is claimed separately", () => {
  // spk:0 speaks at indexes 0-1, a named turn breaks contiguity, then spk:0 recurs at 3-5.
  // Session-wide mapping would treat both blocks as one person — the gate's measured failure.
  const turns = [
    turn("t1", "spk:0", "My name is Kanchan."),
    turn("t2", "spk:0", "Happy to be here."),
    turn("t3", "Shagun", "Welcome, Kanchan."),
    turn("t4", "spk:0", "Let us begin the session."),
    turn("t5", "spk:0", "First topic is visas."),
  ];
  const { resolved } = resolveSpeakers(turns);
  const s = resolved.find((r) => r.speakerRef === "spk:0");
  assert.ok(s, "the self-naming block is still resolved");
  assert.deepEqual(
    s.blocks,
    [{ startTurnIndex: 0, endTurnIndex: 1 }],
    "only the block containing the evidence is claimed; the later same-label block is NOT claimed",
  );
  assert.ok(!s.blocks.some((b) => b.endTurnIndex >= 3), "the label recurrence must not be absorbed into one identity");
});

test("a resolved identity never spans a block interrupted by a named turn", () => {
  const turns = [
    turn("t1", "spk:0", "My name is Ruby."),
    turn("t2", "Bhakti", "Hello Ruby."),
    turn("t3", "spk:0", "Thanks."),
  ];
  const { resolved } = resolveSpeakers(turns);
  const s = resolved[0];
  assert.ok(s);
  assert.deepEqual(s.blocks, [{ startTurnIndex: 0, endTurnIndex: 0 }], "the later same-label turn is a separate block");
  // The citing turn sits inside the claimed block.
  const citingIndex = 0;
  const claimed = s.blocks[0];
  assert.ok(claimed, "at least one block is claimed");
  assert.ok(citingIndex >= (claimed?.startTurnIndex ?? -1) && citingIndex <= (claimed?.endTurnIndex ?? -1));
});

test("two separate self-naming blocks of the same label+name claim BOTH their blocks", () => {
  // The person re-introduces themselves after an interruption; both evidence turns are inside
  // their own blocks, and both blocks belong to the same verified identity.
  const turns = [
    turn("t1", "spk:0", "My name is Ruby."),
    turn("t2", "Anchor", "Welcome."),
    turn("t3", "spk:0", "As I said, my name is Ruby."),
  ];
  const { resolved } = resolveSpeakers(turns);
  const s = resolved[0];
  assert.ok(s);
  assert.equal(s.evidence.length, 2, "both self-namings are evidence");
  assert.equal(s.blocks.length, 2, "each citing turn lives in its own block, both claimed");
});
