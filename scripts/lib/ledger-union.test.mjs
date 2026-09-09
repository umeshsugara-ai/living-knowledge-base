/**
 * scripts/lib/ledger-union.test.mjs — the ledger UNION readers (ISS-129).
 *
 * Split from tracker-audit.test.mjs when that file crossed its 300-line budget. The seam is real:
 * `ledgerFiles`/`readLedgerRows` answer "what IS the ledger", while the rest of that file tests
 * the G1/G2/G3 gates that read it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ledgerFiles, readLedgerRows, auditIssueRefs, G4_FROZEN, ROOT } from "./tracker-audit.mjs";

// ---------------------------------------------------------------------------
// ISS-129 — the ledger UNION declared by D-019.
//
// D-019 said "every reader treats the union of qa/issues.jsonl and qa/issues.*.jsonl as the
// ledger", and then no reader did: both opened the single file by name, so a lane shard whose id
// is CITED BY D-020 was counted by nothing and surfaced by nothing.
//
// Root cause worth keeping: D-019's own `Changes-authorized` named only `.claude/CLAUDE.md`, so
// the mechanism the rule required was never scoped to a file it was allowed to touch. A governance
// rule whose mechanism sits outside its own authorization cannot be implemented.
//
// These live HERE, beside the module they test, not in lint.test.mjs. Cycle 1 put them there on a
// rationale that was false twice (ISS-140): scripts/ was 30 against a budget of 32, and this file
// already existed. The budget pressure was invented.
// ---------------------------------------------------------------------------

function ledgerRoot(files) {
  const root = mkdtempSync(join(tmpdir(), "lkb-ledger-"));
  mkdirSync(join(root, "qa"), { recursive: true });
  for (const [name, rows] of Object.entries(files)) {
    writeFileSync(join(root, "qa", name), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  return root;
}

test("ledger: reads the canonical file when there are no shards", () => {
  const root = ledgerRoot({ "issues.jsonl": [{ id: "ISS-1", status: "open" }] });
  try {
    assert.deepEqual(ledgerFiles(root).map((f) => basename(f)), ["issues.jsonl"]);
    assert.equal(readLedgerRows(root).rows.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ledger: reads the UNION of the canonical file and every lane shard", () => {
  const root = ledgerRoot({
    "issues.jsonl": [{ id: "ISS-1", status: "open" }],
    "issues.c-unrun-writers.jsonl": [{ id: "ISS-C-UNRUN-WRITERS-005", status: "open" }],
    "issues.a-speakers.jsonl": [{ id: "ISS-A-SPEAKERS-001", status: "fixed" }],
  });
  try {
    assert.deepEqual(readLedgerRows(root).rows.map((r) => r.id).sort(),
      ["ISS-1", "ISS-A-SPEAKERS-001", "ISS-C-UNRUN-WRITERS-005"],
      "a shard nobody reads is worse than no shard");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ledger: G2 sees a shard's unverified rows, not just the canonical file's", () => {
  const root = ledgerRoot({
    "issues.jsonl": [{ id: "ISS-1", status: "open" }],
    "issues.lane.jsonl": [{ id: "ISS-LANE-001", status: "fixed" }],
  });
  try {
    assert.deepEqual(readLedgerRows(root).rows
      .filter((r) => r.status === "fixed" && !r.verified_date).map((r) => r.id), ["ISS-LANE-001"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ledger: an unparseable line in a SHARD is reported, not swallowed", () => {
  const root = ledgerRoot({ "issues.jsonl": [{ id: "ISS-1", status: "open" }] });
  writeFileSync(join(root, "qa", "issues.broken.jsonl"), "{not json\n");
  try {
    assert.equal(readLedgerRows(root).unparseable, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * ISS-138. The cycle-1 "stable order" test was vacuous — readdirSync already returns names in
 * order here, so deleting `.sort()` killed nothing. This one discriminates: it asserts the
 * canonical file comes FIRST even though "issues.jsonl" sorts after "issues.alpha.jsonl", which
 * only holds because the canonical path is prepended rather than sorted in with the shards.
 */
test("ledger: the canonical file is first even when a shard sorts before it", () => {
  const root = ledgerRoot({
    "issues.jsonl": [{ id: "ISS-1", status: "open" }],
    "issues.alpha.jsonl": [{ id: "A", status: "open" }],
    "issues.zeta.jsonl": [{ id: "Z", status: "open" }],
  });
  try {
    const names = ledgerFiles(root).map((f) => basename(f));
    assert.equal(names[0], "issues.jsonl", "canonical first, not alphabetical across the whole set");
    assert.deepEqual(names.slice(1), ["issues.alpha.jsonl", "issues.zeta.jsonl"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * ISS-137. The narrowed catch was the thing cycle 1 was proudest of and NOTHING TESTED IT —
 * deleting the rethrow left every suite green. That is the same failure the unit exists to fix:
 * a rule declared and not enforced.
 *
 * `qa` as a regular FILE makes readdirSync throw ENOTDIR, which is not ENOENT, so a correct
 * implementation rethrows and a swallowing one silently returns zero shards.
 */
test("ledger: a non-ENOENT readdir failure is RETHROWN, never swallowed as 'no shards'", () => {
  const root = mkdtempSync(join(tmpdir(), "lkb-ledger-"));
  writeFileSync(join(root, "qa"), "not a directory\n");
  try {
    assert.throws(() => ledgerFiles(root), (err) => err.code !== "ENOENT",
      "a bare catch here once hid a missing import and returned zero shards");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ledger: a genuinely missing qa/ directory is still the quiet, expected case", () => {
  const root = mkdtempSync(join(tmpdir(), "lkb-ledger-"));
  try {
    assert.deepEqual(ledgerFiles(root), [], "ENOENT means 'no ledger here', not an error");
  } finally { rmSync(root, { recursive: true, force: true }); }
});


/**
 * G4 — ISS-142. A bare `ISS-NNN` that a lane shard also numbers resolves to two different findings
 * depending on which ledger the reader opens. Merging one lane brought 96 such references onto
 * master: docs saying "fix ISS-021 and ISS-022" meant the lane's rows while canonical ISS-021/022
 * are unrelated findings that exist.
 *
 * The first two tests below are the ones that matter, because the naive version of this gate fired
 * on 58 files — almost all historical documents whose bare refs correctly mean the canonical row.
 */
function g4Root(files, ledgerIds) {
  const root = mkdtempSync(join(tmpdir(), "lkb-g4-"));
  mkdirSync(join(root, "qa", "manifests"), { recursive: true });
  writeFileSync(join(root, "qa", "issues.jsonl"), "");
  writeFileSync(join(root, "qa", "issues.lane.jsonl"),
    ledgerIds.map((id) => JSON.stringify({ id, title: "t" })).join("\n") + "\n");
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, "qa", "manifests", name), text);
  return root;
}

test("G4: a historical doc that never uses the qualified form is LEFT ALONE", () => {
  // The whole reason the gate is scoped this way. This doc predates lane ids; its ISS-007 means
  // the canonical row and always did. A gate that fires here teaches people to ignore it.
  const root = g4Root({ "old.md": "fixed in ISS-007 and ISS-008\n" }, ["ISS-LANE-007", "ISS-LANE-008"]);
  try { assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-LANE-007" }, { id: "ISS-LANE-008" }]), []); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: a doc that MIXES the qualified and bare forms is flagged", () => {
  const root = g4Root({ "mixed.md": "closes ISS-LANE-017; see also ISS-018\n" }, ["ISS-LANE-017", "ISS-LANE-018"]);
  try {
    const f = auditIssueRefs(root, [{ id: "ISS-LANE-017" }, { id: "ISS-LANE-018" }]);
    assert.equal(f.length, 1);
    assert.match(f[0], /mixed\.md cites ISS-018 bare/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: a bare ref OUTSIDE the lane's numbering is not flagged", () => {
  // ISS-136/ISS-137 are genuine canonical citations inside a lane manifest; qualifying them would
  // break them. The gate must distinguish "ambiguous" from "merely bare".
  const root = g4Root({ "m.md": "ISS-LANE-017 fixed; ISS-136 stands\n" }, ["ISS-LANE-017"]);
  try { assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-LANE-017" }]), []); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: with no lane shard at all the gate is inert, not noisy", () => {
  const root = g4Root({ "m.md": "ISS-LANE-017 and ISS-017\n" }, []);
  try { assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-017" }]), []); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: the frozen list covers checker-owned verdicts, and can only shrink", () => {
  // Verdicts are checker-owned; a maker rewriting one is the self-certification this pair exists
  // to prevent. The debt is named rather than tolerated -- and a NEW ambiguous ref still fails.
  assert.ok(G4_FROZEN.size > 0);
  for (const p of G4_FROZEN) assert.match(p, /^qa\/verdicts\//, "only checker-owned files may be frozen");
});

test("G4: master's manifests and verdicts are clean under this gate", () => {
  // Scoped to the corpus THIS unit repaired. `qa/contracts/` is deliberately excluded from the
  // ASSERTION -- not from the gate, which still judges it -- because a concurrent lane adds
  // contracts continuously, and a test that goes red on another session's in-flight file is a
  // test people delete. Observed at cycle 3: `qa/contracts/entity-promotion.md` landed mid-check
  // and reddened this assertion for reasons no change in this unit could fix.
  const flagged = auditIssueRefs(ROOT, readLedgerRows(ROOT).rows)
    .filter((f) => /qa\/(manifests|verdicts)\//.test(f));
  assert.deepEqual(flagged, []);
});

test("G4: a bare ref marked (canonical) is a stated judgement, and is accepted", () => {
  // A document explaining the ambiguity must quote the ambiguous numbers -- a true positive by the
  // rule and a false positive in meaning. The escape makes the author state the call the gate
  // cannot make, since the gate sees numbers and never meanings.
  const root = g4Root({ "m.md": "closes ISS-LANE-017; contrast ISS-017 (canonical)" + String.fromCharCode(10) }, ["ISS-LANE-017"]);
  try { assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-LANE-017" }]), []); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: the (canonical) escape is not a blanket mute for the rest of the file", () => {
  const root = g4Root(
    { "m.md": "ISS-LANE-017 done. ISS-017 (canonical) is unrelated. But ISS-018 is still bare." },
    ["ISS-LANE-017", "ISS-LANE-018"],
  );
  try {
    const f = auditIssueRefs(root, [{ id: "ISS-LANE-017" }, { id: "ISS-LANE-018" }]);
    assert.equal(f.length, 1);
    assert.match(f[0], /cites ISS-018 bare/);
    assert.doesNotMatch(f[0], /ISS-017/, "the marked reference must not be reported");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: a range ENDPOINT is a boundary, not a citation", () => {
  // Found live at cycle 1: G4 fired on a checker's own verdict for `ISS-001..022`, and
  // `(canonical)` is the wrong word for a range bound, so the checker had to rephrase its prose.
  const root = g4Root(
    { "m.md": "ISS-LANE-017 done. Canonical ids ISS-001..022 exist. Also ISS-001..ISS-022." },
    ["ISS-LANE-001", "ISS-LANE-017", "ISS-LANE-022"],
  );
  try {
    assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-LANE-001" }, { id: "ISS-LANE-017" }, { id: "ISS-LANE-022" }]), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: the range rule does not excuse an ordinary citation on the same line", () => {
  const root = g4Root(
    { "m.md": "ISS-LANE-017 done; ISS-001..022 exist; but ISS-018 is a bare citation." },
    ["ISS-LANE-001", "ISS-LANE-017", "ISS-LANE-018", "ISS-LANE-022"],
  );
  try {
    const f = auditIssueRefs(root, [{ id: "ISS-LANE-001" }, { id: "ISS-LANE-017" }, { id: "ISS-LANE-018" }, { id: "ISS-LANE-022" }]);
    assert.equal(f.length, 1);
    assert.match(f[0], /cites ISS-018 bare/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * ISS-151 — the two cases that were SILENT under the cycle-2 range rule.
 *
 * That rule skipped any bare id adjacent to `..`, `--` or a dash. Dashes are this repo's house
 * punctuation around citations, so it muted 152 of 2,031 bare references in `qa/*.md`. These are
 * the shapes the checker probed; both must be flagged.
 */
test("G4: an em-dash aside is a citation, not a range -- it is still flagged", () => {
  const root = g4Root({ "m.md": "ISS-LANE-017 done — ISS-018 is the follow-on." }, ["ISS-LANE-017", "ISS-LANE-018"]);
  try {
    const f = auditIssueRefs(root, [{ id: "ISS-LANE-017" }, { id: "ISS-LANE-018" }]);
    assert.equal(f.length, 1, "an em dash before a citation must not mute it");
    assert.match(f[0], /cites ISS-018 bare/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: a list item `- ISS-0NN -- title` is a citation, not a range", () => {
  const root = g4Root({ "m.md": ["ISS-LANE-017 done.", "- ISS-018 -- the follow-on finding", ""].join(String.fromCharCode(10)) }, ["ISS-LANE-017", "ISS-LANE-018"]);
  try {
    const f = auditIssueRefs(root, [{ id: "ISS-LANE-017" }, { id: "ISS-LANE-018" }]);
    assert.equal(f.length, 1, "dashes on BOTH sides still do not make it a range");
    assert.match(f[0], /cites ISS-018 bare/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("G4: a range needs a three-digit id on BOTH sides, in every spelling", () => {
  const root = g4Root(
    { "m.md": "ISS-LANE-017 done. Ranges ISS-001..022, ISS-001..ISS-022 and ISS-001–022 are bounds." },
    ["ISS-LANE-001", "ISS-LANE-017", "ISS-LANE-022"],
  );
  try {
    assert.deepEqual(auditIssueRefs(root, [{ id: "ISS-LANE-001" }, { id: "ISS-LANE-017" }, { id: "ISS-LANE-022" }]), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
