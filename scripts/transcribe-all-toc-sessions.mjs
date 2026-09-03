#!/usr/bin/env node
/**
 * scripts/transcribe-all-toc-sessions.mjs — T-003 scale-up. Runs
 * scripts/transcribe-toc-session.mjs for every real session under data/toc-migrated/ that still
 * carries T-002's placeholder speakerRef:"unknown" turns, one at a time (each as a fresh child
 * process, so one session's crash/timeout never blocks the rest). Real cost, real network calls.
 * Writes a summary report to data/eval/transcribe-all-report.json at the end.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data", "toc-migrated");
const REPORT_PATH = join(ROOT, "data", "eval", "transcribe-all-report.json");

function isPlaceholder(sessionId) {
  const turnsPath = join(DATA_DIR, sessionId, "turns.json");
  if (!existsSync(turnsPath)) return false;
  const turns = JSON.parse(readFileSync(turnsPath, "utf8"));
  return turns.length > 0 && turns.every((t) => t.speakerRef === "unknown");
}

function main() {
  const sessionIds = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter(isPlaceholder)
    .sort();

  console.log(`${sessionIds.length} session(s) still have placeholder turns:`);
  for (const sid of sessionIds) console.log(`  - ${sid}`);
  console.log("");

  const results = [];
  for (const [i, sid] of sessionIds.entries()) {
    console.log(`\n=== [${i + 1}/${sessionIds.length}] ${sid} ===`);
    const start = Date.now();
    const res = spawnSync("node", ["scripts/transcribe-toc-session.mjs", sid], {
      cwd: ROOT, stdio: "inherit",
    });
    const durationSec = ((Date.now() - start) / 1000).toFixed(1);
    const ok = res.status === 0;
    console.log(`--- ${sid}: ${ok ? "OK" : "FAILED"} (${durationSec}s) ---`);
    results.push({ sessionId: sid, ok, durationSec: Number(durationSec) });
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n=== done: ${okCount}/${results.length} succeeded ===`);
  for (const r of results.filter((r) => !r.ok)) console.log(`  FAILED: ${r.sessionId}`);

  writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + "\n", "utf8");
  console.log(`wrote ${REPORT_PATH}`);
}

main();
