#!/usr/bin/env node
/**
 * scripts/tracker-audit.mjs — three integrity gates on the project's own trackers (plan §10 U0.6).
 *
 * These exist because the trackers drifted in ways nobody noticed for weeks, and every one of them
 * flattered the project:
 *   G1  `.goal/goal.json` covered 29 tasks while `TASKS.md` had 34 — five rows existed in one
 *       tracker only, so the percentage was computed over a denominator that quietly excluded work.
 *   G2  20 ledger issues sat `fixed` with `verified_date: null` — a fix nobody checked reads
 *       exactly like a fix that worked.
 *   G3  `.last-sweep` was two days older than HEAD, so the safety net had not seen the code it
 *       was vouching for.
 *
 * Lives in the repo rather than in the global /checker skill so the sweep can invoke it, anyone can
 * run it, and it is versioned with the trackers it audits.
 *
 * Usage: node scripts/tracker-audit.mjs [--json]
 * Exit:  0 all gates pass · 1 one or more gates fail
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** TASKS.md and goal.json use different words for the same thing; compare meaning, not spelling. */
const NORMALISE = { open: "not-done", pending: "not-done", blocked: "not-done", in_progress: "not-done", done: "done" };

export function audit(root = ROOT) {
  const findings = [];
  const goal = JSON.parse(readFileSync(join(root, ".goal", "goal.json"), "utf8"));
  const md = readFileSync(join(root, "TASKS.md"), "utf8");

  // ---- G1: the two trackers must describe the same set of tasks, with the same meanings.
  const mdRows = new Map();
  for (const m of md.matchAll(/^\|\s*(T-[0-9]+[a-z]?)\s*\|\s*([a-z_]+)\s*\|/gim)) mdRows.set(m[1], m[2]);
  const goalRows = new Map(goal.tasks.map((t) => [t.id, t.status]));

  const onlyMd = [...mdRows.keys()].filter((id) => !goalRows.has(id));
  const onlyGoal = [...goalRows.keys()].filter((id) => !mdRows.has(id));
  if (onlyMd.length) findings.push(`G1 row-set: in TASKS.md but not goal.json — ${onlyMd.join(", ")}`);
  if (onlyGoal.length) findings.push(`G1 row-set: in goal.json but not TASKS.md — ${onlyGoal.join(", ")}`);
  for (const [id, mdStatus] of mdRows) {
    const g = goalRows.get(id);
    if (g === undefined) continue;
    if (NORMALISE[mdStatus] !== NORMALISE[g]) {
      findings.push(`G1 status: ${id} is "${g}" in goal.json but "${mdStatus}" in TASKS.md`);
    }
  }
  // The headline must be arithmetic on the rows, never a typed-in number.
  const done = goal.tasks.filter((t) => t.status === "done").length;
  const pct = Math.round((done / goal.tasks.length) * 100);
  if (goal.progress?.total !== goal.tasks.length) findings.push(`G1 progress.total says ${goal.progress?.total}, there are ${goal.tasks.length} tasks`);
  if (goal.progress?.done !== done) findings.push(`G1 progress.done says ${goal.progress?.done}, ${done} tasks are done`);
  if (goal.progress?.percent !== pct) findings.push(`G1 progress.percent says ${goal.progress?.percent}%, the rows give ${pct}%`);

  // ---- G2: a fix nobody verified is not a fix.
  const ledger = join(root, "qa", "issues.jsonl");
  if (existsSync(ledger)) {
    const unverified = [];
    let unparseable = 0;
    for (const line of readFileSync(ledger, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let r;
      try { r = JSON.parse(line); } catch { unparseable++; continue; }
      if (r.status === "fixed" && !r.verified_date) unverified.push(r.id);
    }
    if (unparseable > 0) findings.push(`G2 ledger: ${unparseable} unparseable line(s) — a line-by-line consumer skips or crashes on them`);
    if (unverified.length > 0) {
      findings.push(`G2 unverified: ${unverified.length} issue(s) are "fixed" with no verified_date — ${unverified.slice(0, 8).join(", ")}${unverified.length > 8 ? ", …" : ""}`);
    }
  }

  // ---- G3: a sweep older than the code it vouches for has not seen that code.
  const stamp = join(root, "qa", ".last-sweep");
  if (existsSync(stamp)) {
    const swept = Date.parse((readFileSync(stamp, "utf8").trim().split("\n").pop() ?? "").slice(0, 20));
    let headAt = NaN;
    try {
      headAt = Date.parse(execFileSync("git", ["log", "-1", "--format=%cI"], { cwd: root, encoding: "utf8" }).trim());
    } catch { /* not a git checkout */ }
    if (!Number.isNaN(swept) && !Number.isNaN(headAt) && swept < headAt) {
      const days = ((headAt - swept) / 86_400_000).toFixed(1);
      findings.push(`G3 stale sweep: qa/.last-sweep predates HEAD by ${days} day(s) — the safety net has not seen the current code`);
    }
  }

  return findings;
}

function main(argv) {
  const findings = audit();
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  } else if (findings.length === 0) {
    console.log("tracker-audit: OK (G1 trackers agree · G2 no unverified fixes · G3 sweep not stale)");
  } else {
    console.error(`tracker-audit: ${findings.length} finding(s)`);
    for (const f of findings) console.error(`  ${f}`);
  }
  process.exit(findings.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
