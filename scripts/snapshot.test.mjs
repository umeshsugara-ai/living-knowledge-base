/**
 * scripts/snapshot.test.mjs — T-017b, C8. Covers:
 * (a) appendEvent rejects a `removed` event with no `reason`
 * (b) appendEvent is append-only (two calls -> two lines, first line unchanged after the second)
 * (c) `snapshot.mjs --check` exits 0 fresh, non-zero after a hand-edit
 * (d) the generated file is <= 200 lines for the current repo state
 * Run: node --test scripts/snapshot.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendEvent } from "./lib/features.mjs";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPTS, "..");

function tmpLedger() {
  const dir = mkdtempSync(join(tmpdir(), "lkb-ledger-"));
  return join(dir, "FEATURES.jsonl");
}

// (a) reject a `removed` event with no reason
test("appendEvent: rejects a removed event with no reason", () => {
  const ledgerPath = tmpLedger();
  assert.throws(
    () =>
      appendEvent(
        { id: "T-900", feature: "x", event: "removed", date: "2026-09-03", unit: "u", links: [] },
        { ledgerPath },
      ),
    /reason/,
  );
});

// (b) append-only: two calls -> two lines, first line byte-identical after the second call
test("appendEvent: is append-only", () => {
  const ledgerPath = tmpLedger();
  appendEvent({ id: "T-901", feature: "a", event: "shipped", date: "2026-09-03", unit: "u", reason: null, links: [] }, { ledgerPath });
  const afterFirst = readFileSync(ledgerPath, "utf8").split(/\r?\n/)[0];
  appendEvent({ id: "T-902", feature: "b", event: "shipped", date: "2026-09-03", unit: "u", reason: null, links: [] }, { ledgerPath });
  const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], afterFirst);
});

function runSnapshot(args, root) {
  return spawnSync(process.execPath, [join(SCRIPTS, "snapshot.mjs"), ...args, "--root", root], { encoding: "utf8" });
}

function fixtureRoot() {
  const dir = mkdtempSync(join(tmpdir(), "lkb-snap-"));
  for (const rel of ["structure.config.json", "ARCHITECTURE.md"]) {
    cpSync(join(ROOT, rel), join(dir, rel));
  }
  mkdirSync(join(dir, "schema"), { recursive: true });
  cpSync(join(ROOT, "schema"), join(dir, "schema"), { recursive: true });
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "FEATURES.jsonl"), "");
  return dir;
}

// (c) --check exits 0 fresh, non-zero after a hand-edit
test("snapshot.mjs --check: 0 fresh, non-zero after a hand-edit", () => {
  const root = fixtureRoot();
  try {
    const write = spawnSync(process.execPath, [join(SCRIPTS, "snapshot.mjs"), "--root", root], { encoding: "utf8" });
    assert.equal(write.status, 0, write.stdout + write.stderr);

    const fresh = runSnapshot(["--check"], root);
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);

    const outPath = join(root, "docs", "SNAPSHOT.md");
    writeFileSync(outPath, readFileSync(outPath, "utf8") + "hand-edited line\n");
    const stale = runSnapshot(["--check"], root);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout + stale.stderr, /stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// (d) the generated file is <= 200 lines for the CURRENT repo state
test("snapshot.mjs: current repo's docs/SNAPSHOT.md is <= 200 lines", () => {
  const check = spawnSync(process.execPath, [join(SCRIPTS, "snapshot.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const lineCount = readFileSync(join(ROOT, "docs", "SNAPSHOT.md"), "utf8").split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === "")).length;
  assert.ok(lineCount <= 200, `expected <= 200 lines, got ${lineCount}`);
});
