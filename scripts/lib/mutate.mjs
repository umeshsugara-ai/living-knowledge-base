#!/usr/bin/env node
/**
 * scripts/lib/mutate.mjs -- the missing control around mutation testing.
 *
 * WHY THIS EXISTS. The maker-checker loop proves a test is real by deliberately breaking a source
 * file, confirming the test reddens, then restoring it. On 2026-09-08 that procedure left
 * `score: 0.5` applied to PRODUCTION source (apps/api/src/search-store.ts) *after* its checker had
 * already verified the restore as byte-identical. It was caught by eye at close-out; nothing in
 * the repo would have caught it. `git log --all -S` confirmed nothing shipped -- by timing, not by
 * a control. Authorized by D-014.
 *
 * THE DESIGN, in one idea: **a file must be `committed` (bytes identical to HEAD) before it may be
 * mutated.** That single precondition buys two guarantees at once:
 *
 *   1. RESTORE IS EXACT. Because HEAD is known-good, `git checkout -- <path>` is an authoritative
 *      restore. No backup file to lose, no SHA to compare by hand, no "restored SHA256-identical"
 *      claim that has to be believed.
 *   2. IT CANNOT CLOBBER A CONCURRENT SESSION. Two maker loops share this working tree (Umesh,
 *      2026-09-08: both run and coordinate through commits). A file another session is mid-edit on
 *      reads `modified`, not `committed`, so `apply` refuses it. The lane rule is enforced by the
 *      same check rather than by remembering to look.
 *
 * All git reasoning is delegated to scripts/lib/evidence.mjs (`trustOf`), which already implements
 * `git diff --quiet HEAD -- <path>` and is tested. This file adds no git logic of its own.
 *
 * Usage:
 *   node scripts/lib/mutate.mjs apply   <file> [<file>...]   record intent; refuse unless committed
 *   node scripts/lib/mutate.mjs restore <file> [<file>...]   git-checkout back to HEAD, verify, clear
 *   node scripts/lib/mutate.mjs assert-clean                 exit 1 if any mutation is outstanding
 *   node scripts/lib/mutate.mjs list                         show outstanding mutations
 *
 * Exit codes: 0 ok . 1 refused / outstanding mutation . 2 usage error.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { trustOf } from "./evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LEDGER = resolve(ROOT, "qa/.mutations-active");

/** Repo-relative, forward-slashed -- the shape evidence.mjs and git both expect. */
function rel(p) {
  return relative(ROOT, resolve(process.cwd(), p)).split("\\").join("/");
}

function readLedger() {
  if (!existsSync(LEDGER)) return [];
  return readFileSync(LEDGER, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function writeLedger(rows) {
  if (rows.length === 0) {
    if (existsSync(LEDGER)) unlinkSync(LEDGER);
    return;
  }
  // mkdir first: the ledger's directory is not guaranteed to exist (it does not in a fresh
  // checkout, nor in the test sandbox), and a guard that throws on arming is a guard that gets
  // switched off.
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

function fail(msg) {
  console.error(`MUTATE REFUSED: ${msg}`);
  process.exit(1);
}

function apply(paths) {
  const rows = readLedger();
  for (const p of paths) {
    const r = rel(p);
    const trust = trustOf(ROOT, r);
    // The whole safety property lives in this branch. An untracked file has no HEAD to restore
    // from; a modified one is either someone else's in-flight work or an earlier mutation that
    // was never restored -- and in both cases `git checkout` would destroy real work.
    if (trust !== "committed") {
      fail(
        `${r} is '${trust}', not 'committed'. Only a file identical to HEAD may be mutated, ` +
          `because restore is 'git checkout -- <path>' and would otherwise destroy uncommitted ` +
          `work (possibly a concurrent session's). Commit or revert it first.`,
      );
    }
    if (rows.some((x) => x.path === r)) fail(`${r} is already recorded as mutated`);
    rows.push({ path: r, at: new Date().toISOString(), pid: process.pid });
  }
  writeLedger(rows);
  for (const p of paths) console.log(`MUTATION ARMED: ${rel(p)} (restore with: mutate.mjs restore)`);
}

function restore(paths) {
  let rows = readLedger();
  for (const p of paths) {
    const r = rel(p);
    // REFUSE to restore a file this tool never armed. `restore` runs `git checkout --`, which
    // silently discards uncommitted work; without this check the command is an unguarded
    // destructive operation wearing a safety tool's name.
    //
    // Found the hard way on 2026-09-08: an `apply` was correctly refused (the file was dirty with
    // real edits), the operator continued the sequence anyway, and the trailing `restore` threw
    // away ~40 lines of uncommitted work — the exact loss the `apply` precondition had just
    // prevented. A guard that only protects the entry to a paired operation protects nothing.
    if (!rows.some((x) => x.path === r)) {
      fail(
        `${r} is not armed. 'restore' runs 'git checkout -- <path>' and would DISCARD any ` +
          `uncommitted changes. Arm it first with 'mutate.mjs apply ${r}', or if you meant to ` +
          `throw the changes away, run git checkout yourself so the intent is explicit.`,
      );
    }
    execFileSync("git", ["checkout", "--", r], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    const trust = trustOf(ROOT, r);
    // Verify AFTER restoring rather than trusting the checkout's exit code -- the 2026-09-08
    // incident was precisely a restore that reported success and did not hold.
    if (trust !== "committed") fail(`${r} is still '${trust}' after restore -- do not proceed`);
    rows = rows.filter((x) => x.path !== r);
    console.log(`RESTORED: ${r} (verified identical to HEAD)`);
  }
  writeLedger(rows);
}

/**
 * The close-out gate, and the same check the commit guard calls. Re-verifies every recorded path
 * rather than trusting that `restore` ran: a ledger row can be removed while the file on disk is
 * still mutated, which is the exact failure this file exists to prevent.
 */
function assertClean() {
  const rows = readLedger();
  const dirty = rows.filter((r) => trustOf(ROOT, r.path) !== "committed");
  if (rows.length === 0) {
    console.log("MUTATIONS CLEAN: none outstanding");
    return;
  }
  console.error(`MUTATIONS OUTSTANDING: ${rows.length} armed, ${dirty.length} still differ from HEAD`);
  for (const r of rows) console.error(`  ${r.path} -- ${trustOf(ROOT, r.path)} (armed ${r.at})`);
  console.error("Restore them (node scripts/lib/mutate.mjs restore <file>) before committing.");
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "apply" && args.length) apply(args);
else if (cmd === "restore" && args.length) restore(args);
else if (cmd === "assert-clean") assertClean();
else if (cmd === "list") {
  const rows = readLedger();
  if (!rows.length) console.log("no outstanding mutations");
  for (const r of rows) console.log(`${r.path}\t${trustOf(ROOT, r.path)}\tarmed ${r.at}`);
} else {
  console.error("usage: mutate.mjs apply|restore <file>... | assert-clean | list");
  process.exit(2);
}
