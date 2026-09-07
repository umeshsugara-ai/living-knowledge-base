// scripts/tracker-audit.test.mjs — covers the `--gate` filter added for ISS-053: G1 is fully
// author-controlled and wired into `pnpm lint:structure`, but a commit gate must never fire on
// G2/G3 findings, which depend on someone else's later action (a re-check, a sweep run).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, parseGateArg, filterByGate } from "./tracker-audit.mjs";

test("parseGateArg reads both --gate g1 and --gate=g1, and is null when absent", () => {
  assert.equal(parseGateArg(["--gate", "g1"]), "G1");
  assert.equal(parseGateArg(["--gate=g1"]), "G1");
  assert.equal(parseGateArg(["--json"]), null);
  assert.equal(parseGateArg([]), null);
});

/** A fixture project that fails BOTH G1 (row-set mismatch) and G2 (an unverified fix). */
function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "lkb-audit-"));
  mkdirSync(join(root, ".goal"), { recursive: true });
  mkdirSync(join(root, "qa"), { recursive: true });
  writeFileSync(
    join(root, ".goal", "goal.json"),
    JSON.stringify({
      tasks: [{ id: "T-001", status: "done" }],
      progress: { total: 1, done: 1, percent: 100 },
    }),
  );
  // TASKS.md carries an extra row goal.json doesn't know about — a real G1 row-set mismatch.
  writeFileSync(
    join(root, "TASKS.md"),
    "| id | status | title |\n|---|---|---|\n| T-001 | done | thing |\n| T-002 | open | untracked in goal.json |\n",
  );
  writeFileSync(
    join(root, "qa", "issues.jsonl"),
    `${JSON.stringify({ id: "ISS-001", status: "fixed", verified_date: null })}\n`,
  );
  return root;
}

test("audit() reports both G1 and G2 findings on a fixture with both defects", () => {
  const root = fixtureRoot();
  try {
    const findings = audit(root);
    assert.ok(findings.some((f) => f.startsWith("G1")), "expected a G1 finding");
    assert.ok(findings.some((f) => f.startsWith("G2")), "expected a G2 finding");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--gate g1 filters out G2/G3 findings — a commit gate must not block on someone else's later action (ISS-053)", () => {
  const root = fixtureRoot();
  try {
    const all = audit(root);
    const gate = parseGateArg(["--gate", "g1"]);
    const filtered = filterByGate(all, gate);
    assert.ok(filtered.length > 0, "the G1 defect in this fixture must still be caught");
    assert.ok(filtered.every((f) => f.startsWith("G1")), "no G2/G3 finding may leak through the g1 gate filter");
    assert.ok(all.some((f) => f.startsWith("G2")), "sanity: the unfiltered set does contain a G2 finding");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("filterByGate with no gate returns findings unchanged", () => {
  const findings = ["G1 x", "G2 y", "G3 z"];
  assert.deepEqual(filterByGate(findings, null), findings);
});

test("a clean fixture passes both the full audit and the g1 gate", () => {
  const root = mkdtempSync(join(tmpdir(), "lkb-audit-"));
  mkdirSync(join(root, ".goal"), { recursive: true });
  mkdirSync(join(root, "qa"), { recursive: true });
  writeFileSync(
    join(root, ".goal", "goal.json"),
    JSON.stringify({ tasks: [{ id: "T-001", status: "done" }], progress: { total: 1, done: 1, percent: 100 } }),
  );
  writeFileSync(join(root, "TASKS.md"), "| id | status | title |\n|---|---|---|\n| T-001 | done | thing |\n");
  writeFileSync(join(root, "qa", "issues.jsonl"), `${JSON.stringify({ id: "ISS-001", status: "verified", verified_date: "2026-01-01" })}\n`);
  try {
    assert.deepEqual(audit(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
