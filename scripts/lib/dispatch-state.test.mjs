/**
 * scripts/lib/dispatch-state.test.mjs -- ISS-178.
 *
 * The failure this module exists to prevent is a WRONG STATE that looks like a normal one, so the
 * tests are about the distinctions, not the happy path. Every case below is a state pair that the
 * old two-state handshake collapsed into "no verdict yet".
 *
 * Clock is injected everywhere; nothing here sleeps or reads the wall clock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { record, clear, stateOf, sweep, manifestCycle, isReadyForCheck, verdictCycle, STALE_MS } from "./dispatch-state.mjs";

const T0 = Date.parse("2026-09-09T12:00:00.000Z");

function repo() {
  const root = mkdtempSync(join(tmpdir(), "dispatch-state-"));
  mkdirSync(join(root, "qa", "manifests"), { recursive: true });
  mkdirSync(join(root, "qa", "verdicts"), { recursive: true });
  return root;
}
const manifest = (root, slug, body) => writeFileSync(join(root, "qa", "manifests", `${slug}.md`), body, "utf8");
const verdict = (root, slug, body) => writeFileSync(join(root, "qa", "verdicts", `${slug}.md`), body, "utf8");
const OPEN2 = "**Fix cycle:** 2 of max 3\n\n## Status: ready-for-check\n";

test("THE CORE DISTINCTION: never-dispatched and died-mid-check are different states", () => {
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    assert.equal(stateOf(root, "u", { now: T0 }).state, "not-dispatched", "no marker = nobody ran it");

    record(root, "u", 2, "sess-1", T0);
    assert.equal(stateOf(root, "u", { now: T0 + 60_000 }).state, "in-flight");

    const died = stateOf(root, "u", { now: T0 + STALE_MS + 1 });
    assert.equal(died.state, "checker-died", "a marker older than the bound means the process is gone");
    assert.equal(died.session_id, "sess-1", "the dead check names the session, so a human can find its transcript");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a landed verdict WINS over the marker — the checker need not delete anything", () => {
  // This is the load-bearing design choice. If `complete` required the checker to clean up, this
  // module would depend on another actor changing its protocol first, and would report
  // `checker-died` forever against a checker that simply does not know about markers.
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    record(root, "u", 2, "sess-1", T0);
    verdict(root, "u", "**Cycle checked:** 2\nVERDICT: PASS\n");
    const s = stateOf(root, "u", { now: T0 + STALE_MS * 10 });
    assert.equal(s.state, "complete", "an ancient marker must not outvote a real verdict");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a marker from an EARLIER cycle does not make the current cycle look dispatched", () => {
  // The re-aging bug in its most likely disguise: cycle 2 is a fresh request, and cycle 1's
  // leftover marker must not absorb it. Without this, a FAIL->fix->re-dispatch loop reports
  // in-flight against a checker that was never asked.
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    record(root, "u", 1, "sess-1", T0);
    const s = stateOf(root, "u", { now: T0 + 1000 });
    assert.equal(s.state, "not-dispatched");
    assert.equal(s.staleMarker, 1, "and it reports WHICH stale cycle it ignored, so the skip is auditable");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an OLDER verdict does not close a NEWER cycle", () => {
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    verdict(root, "u", "**Cycle checked:** 1\nVERDICT: FAIL\n");
    assert.equal(stateOf(root, "u", { now: T0 }).state, "not-dispatched", "cycle 1's FAIL says nothing about cycle 2");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("verdictCycle takes the HIGHEST stamp — a verdict file accumulates one section per cycle", () => {
  // Taking the first match returns cycle 1 forever, so a landed cycle-3 check reads as pending.
  assert.equal(verdictCycle("**Cycle checked:** 1\n...\n**Cycle checked:** 3\n...\n**Cycle checked:** 2\n"), 3);
  assert.equal(verdictCycle("no stamp here"), -1);
});

test("verdictCycle reads all FIVE stamp forms that exist in the real corpus", () => {
  // Counted over all 114 files in qa/verdicts/. An anchor that accepts only the field form loses
  // five real verdicts; a parser blind to a real form is the same defect as one that counts prose,
  // pointed the other way.
  for (const [form, want] of [
    ["**Cycle checked:** 2", 2],                              // field
    ["# Verdict — slug · Cycle checked: 3", 3],                // heading
    ["- **Cycle checked:** 1 (matches Fix cycle: 1)", 1],      // bullet
    ["**PASS** — Cycle checked: 1", 1],                        // after a status prefix
    ["**Status: PASS** (Cycle checked: 1)", 1],                // parenthesised
  ]) {
    assert.equal(verdictCycle(form), want, `unread stamp form: ${form}`);
  }
});

test("verdictCycle IGNORES prose — both false positives found on the live corpus", () => {
  // Neither of these is hypothetical. Running the first draft of this parser over the real
  // qa/verdicts/ read delivery-gate-manifest-blindness as cycle 3 when its highest real stamp is
  // 2, and both offending lines came from passages DISCUSSING this class of bug.

  // (a) an example stamp quoted inside a fenced code block. Not indented, opens no table, so no
  //     line-shape rule can exclude it — the fence has to be stripped.
  const fenced = "**Cycle checked:** 2\n\n```\nverdicts with heading form: 3 (e.g. \"# V · Cycle checked: 3\")\n```\n";
  assert.equal(verdictCycle(fenced), 2, "a stamp quoted inside a fence must not count");

  // (b) a WRAPPED prose line whose number sits on the next line. `\s*` matches newlines, so the
  //     naive pattern swallows it; `[ \t]*` is what rejects it. This is calendar-auto-join.md:78.
  const wrapped = "manifest flipped to `checked-PASS` (`Cycle checked:\n3`) after the close-out\n";
  assert.equal(verdictCycle(wrapped), -1, "a number on the NEXT line is not this line's stamp");

  // (c) the shapes that were already excluded, kept as a guard against a future loosening.
  assert.equal(verdictCycle("| write-guard | 3 | 2 | Cycle checked: 3 |"), -1, "table cell");
  assert.equal(verdictCycle("> quoted: Cycle checked: 9"), -1, "blockquote");
  assert.equal(verdictCycle("      Cycle checked: 9"), -1, "indented continuation line");
});

test("ISS-196: the four quoting shapes the cycle-1 checker found, all of which OVERCOUNTED", () => {
  // Every one of these is a recorded reproduction from ISS-196, not an invented case. All four
  // failed in the UNSAFE direction — counting a quoted number as a real stamp — against this
  // module's own documented claim that undercounting is the safe failure.
  assert.equal(verdictCycle("~~~\nCycle checked: 9\n~~~\n"), -1, "(a) only ``` was stripped, not ~~~");
  assert.equal(verdictCycle("<!-- Cycle checked: 9 -->\n"), -1, "(b) HTML comment");
  assert.equal(verdictCycle("see `Cycle checked: 9` here\n"), -1,
    "(c) a MID-LINE code span — the backtick guard was a column-0 lookahead only. Live prose in 10 verdict files.");
  assert.equal(verdictCycle("```\nCycle checked: 9\n"), -1,
    "(d1) an UNCLOSED opener stripped nothing under the old non-greedy pair; it must suppress to EOF");
  assert.equal(verdictCycle("````\n```\nCycle checked: 7\n```\n````\n"), -1, "(d2) nested fences mispaired");

  // And the fix must not have bought silence: a real stamp still reads through all of that noise.
  const mixed = "**Cycle checked:** 2\n\n~~~\nCycle checked: 9\n~~~\n<!-- Cycle checked: 8 -->\nsee `Cycle checked: 7`\n";
  assert.equal(verdictCycle(mixed), 2, "over-suppression would be the opposite failure");
});

test("manifest parsing survives every Status/Fix-cycle form this repo actually uses", () => {
  // 114 manifests, three forms: `## Status:` (45), `**Status:**` (16), bare (29). A parser blind
  // to any one of them is ISS-176 all over again.
  for (const form of ["## Status: ready-for-check", "**Status:** ready-for-check (cycle 2)", "Status: ready-for-check"]) {
    assert.ok(isReadyForCheck(form), `unmatched Status form: ${form}`);
  }
  assert.ok(!isReadyForCheck("the manifest sat at Status: ready-for-check for hours"),
    "PROSE quoting the phrase must not count — that is the over-match direction");
  assert.equal(manifestCycle("**Fix cycle:** 3 of max 3"), 3);
  assert.equal(manifestCycle("no cycle line"), 0);
});

test("a CORRUPT marker degrades to not-dispatched, never to a thrown reconcile", () => {
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    mkdirSync(join(root, "qa", "dispatch"), { recursive: true });
    writeFileSync(join(root, "qa", "dispatch", "u.json"), "{not json", "utf8");
    assert.equal(stateOf(root, "u", { now: T0 }).state, "not-dispatched");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an UNPARSEABLE timestamp reads as died, not as in-flight", () => {
  // `NaN > staleMs` is false, so the naive comparison silently reports a dead check as running.
  // Erring toward "died" costs one duplicate dispatch; erring toward "in-flight" loses the check.
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    mkdirSync(join(root, "qa", "dispatch"), { recursive: true });
    writeFileSync(join(root, "qa", "dispatch", "u.json"),
      JSON.stringify({ slug: "u", cycle: 2, dispatched_at: "not-a-date", session_id: "s" }), "utf8");
    const s = stateOf(root, "u", { now: T0 });
    assert.equal(s.state, "checker-died");
    assert.equal(s.ageMs, null, "and it does not report a bogus age");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a manifest that is NOT ready-for-check is not-pending, marker or no marker", () => {
  const root = repo();
  try {
    manifest(root, "u", "**Fix cycle:** 2 of max 3\n\n## Status: checked-PASS\n");
    record(root, "u", 2, "sess-1", T0);
    assert.equal(stateOf(root, "u", { now: T0 }).state, "not-pending");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("clear() is idempotent — the caller cannot know if the checker already deleted it", () => {
  const root = repo();
  try {
    manifest(root, "u", OPEN2);
    record(root, "u", 2, "s", T0);
    clear(root, "u");
    assert.ok(!existsSync(join(root, "qa", "dispatch", "u.json")));
    clear(root, "u"); // must not throw
    assert.equal(stateOf(root, "u", { now: T0 }).state, "not-dispatched");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("sweep orders worst-first and omits not-pending", () => {
  const root = repo();
  try {
    manifest(root, "dead", OPEN2); record(root, "dead", 2, "s", T0 - STALE_MS - 1);
    manifest(root, "live", OPEN2); record(root, "live", 2, "s", T0);
    manifest(root, "never", OPEN2);
    manifest(root, "closed", "**Fix cycle:** 1 of max 3\n\n## Status: checked-PASS\n");
    const rows = sweep(root, { now: T0 });
    assert.deepEqual(rows.map((r) => `${r.slug}:${r.state}`),
      ["dead:checker-died", "never:not-dispatched", "live:in-flight"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a missing qa/ directory is empty, not a crash", () => {
  const root = mkdtempSync(join(tmpdir(), "dispatch-state-bare-"));
  try {
    assert.deepEqual(sweep(root, { now: T0 }), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ISS-197: a NON-ENOENT readdir fault THROWS — it is not swallowed into a healthy-looking sweep", () => {
  // The test this replaces was NAMED "a real fault is NOT swallowed" and asserted only the ENOENT
  // path, so mutating `if (err?.code !== "ENOENT") throw err` to `if (false) throw err` survived
  // the whole suite. That is the third test-names-a-property-it-does-not-exercise defect I shipped
  // in one day, and it is the same class as mocking the component under test.
  //
  // qa/manifests exists as a FILE, so readdirSync fails with something that is not ENOENT
  // (ENOTDIR on POSIX; Windows reports it differently). The code is deliberately not asserted —
  // the contract is "anything other than 'no directory' propagates", not a specific errno.
  const root = mkdtempSync(join(tmpdir(), "dispatch-state-notdir-"));
  try {
    mkdirSync(join(root, "qa"), { recursive: true });
    writeFileSync(join(root, "qa", "manifests"), "I am a file, not a directory", "utf8");
    assert.throws(() => sweep(root, { now: T0 }), (err) => {
      assert.notEqual(err?.code, "ENOENT", "an ENOTDIR must not be mistaken for a missing directory");
      return true;
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
