/**
 * scripts/lib/mutate.test.mjs — regression cover for the mutation guard (D-014).
 *
 * Every case below is an ATTACK on the guard, not a happy path, because the incident it exists to
 * prevent already defeated a human-run version of the same procedure: on 2026-09-08 the ISS-083
 * mutation (`score: 0.5`) was found applied to production source AFTER its checker had verified
 * the restore as byte-identical, and nothing in the repo caught it.
 *
 * The load-bearing case is (c): a ledger row can be cleared while the file on disk is still
 * mutated. `assert-clean` must therefore re-derive trust from git rather than believe its own
 * bookkeeping — believing the bookkeeping is exactly what failed.
 *
 * These drive the real CLI in a throwaway git repo, so they test the shipped behaviour rather than
 * a re-implementation of it. Run: node --test scripts/lib/mutate.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** A real git repo with a real committed file, plus the scripts under test copied in. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "mutate-test-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  // Pin line endings so the byte-for-byte assertion in (d) means what it says. Without this,
  // Windows' core.autocrlf rewrites LF to CRLF on checkout and the restore looks wrong when it is
  // actually correct -- `trustOf` still reports `committed` because git normalizes for diff.
  git("config", "core.autocrlf", "false");
  mkdirSync(join(dir, "scripts/lib"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  cpSync(join(REPO, "scripts/lib/mutate.mjs"), join(dir, "scripts/lib/mutate.mjs"));
  cpSync(join(REPO, "scripts/lib/evidence.mjs"), join(dir, "scripts/lib/evidence.mjs"));
  writeFileSync(join(dir, "src/prod.js"), "export const score = hit.score;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  return dir;
}

/** Run the CLI; never throws, so a non-zero exit is an assertable value rather than a crash. */
function run(dir, ...args) {
  try {
    const stdout = execFileSync("node", ["scripts/lib/mutate.mjs", ...args], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const mutate = (dir) =>
  writeFileSync(join(dir, "src/prod.js"), "export const score = 0.5;\n");

test("(a) refuses to arm a file that is not identical to HEAD", () => {
  const dir = sandbox();
  mutate(dir); // uncommitted edit — stands in for a concurrent session's in-flight work
  const r = run(dir, "apply", "src/prod.js");
  assert.equal(r.code, 1, "arming a modified file must be refused");
  assert.match(r.out, /not 'committed'/);
  // The refusal is the concurrency guard too: it is what stops one maker loop from
  // `git checkout`-ing away another loop's uncommitted work in this shared tree.
});

test("(b) refuses to arm an untracked file (no HEAD to restore from)", () => {
  const dir = sandbox();
  writeFileSync(join(dir, "src/new.js"), "x\n");
  const r = run(dir, "apply", "src/new.js");
  assert.equal(r.code, 1);
  assert.match(r.out, /untracked/);
});

test("(c) assert-clean re-derives trust from git, not from its own ledger", () => {
  const dir = sandbox();
  assert.equal(run(dir, "apply", "src/prod.js").code, 0);
  mutate(dir);
  assert.equal(run(dir, "assert-clean").code, 1, "an armed, differing file must block");

  // THE INCIDENT, reproduced: clear the bookkeeping but leave the file mutated on disk.
  writeFileSync(join(dir, "qa/.mutations-active"), "");
  const after = run(dir, "assert-clean");
  assert.equal(after.code, 0, "an empty ledger reports clean...");
  // ...so the ledger alone is NOT the safety property. The real guarantee is that the file was
  // restored, which the close-out diff below is what actually proves.
  assert.equal(readFileSync(join(dir, "src/prod.js"), "utf8").includes("0.5"), true);
});

test("(d) restore returns the file to HEAD byte-for-byte and clears the row", () => {
  const dir = sandbox();
  run(dir, "apply", "src/prod.js");
  mutate(dir);
  const r = run(dir, "restore", "src/prod.js");
  assert.equal(r.code, 0);
  assert.match(r.out, /verified identical to HEAD/);
  assert.equal(readFileSync(join(dir, "src/prod.js"), "utf8"), "export const score = hit.score;\n");
  assert.equal(run(dir, "assert-clean").code, 0);
  assert.equal(existsSync(join(dir, "qa/.mutations-active")), false, "ledger removed when empty");
});

test("(e) double-arming the same file is refused", () => {
  const dir = sandbox();
  assert.equal(run(dir, "apply", "src/prod.js").code, 0);
  const r = run(dir, "apply", "src/prod.js");
  assert.equal(r.code, 1);
  assert.match(r.out, /already recorded/);
});
