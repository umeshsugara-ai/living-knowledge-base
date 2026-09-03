#!/usr/bin/env node
/**
 * scripts/snapshot.mjs — generates docs/SNAPSHOT.md from ARCHITECTURE.md §1/§4/§6,
 * schema/*.schema.json, and docs/FEATURES.jsonl (T-017b, C3/C4).
 *
 * Usage:
 *   node scripts/snapshot.mjs           — write docs/SNAPSHOT.md
 *   node scripts/snapshot.mjs --check   — exit 1 (with a line-diff) if the committed file
 *                                          would differ from a fresh regeneration
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "./lib/snapshot-lib.mjs";
import { loadConfig, rootFromArgv, countLines } from "./lib/walk.mjs";
import { LEDGER_PATH } from "./lib/features.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "docs", "SNAPSHOT.md");
const MAX_LINES = 200;

export function generate(root = rootFromArgv()) {
  const cfg = loadConfig(root);
  const architectureText = readFileSync(join(root, "ARCHITECTURE.md"), "utf8");
  return buildSnapshot({
    root,
    architectureText,
    schemaDir: join(root, "schema"),
    ledgerPath: root === ROOT ? LEDGER_PATH : join(root, "docs", "FEATURES.jsonl"),
    ignoreDirs: cfg.ignoreDirs,
  });
}

function diffLines(expected, actual) {
  const a = expected.split(/\r?\n/);
  const b = actual.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) out.push(`  line ${i + 1}: committed=${JSON.stringify(b[i] ?? "")} fresh=${JSON.stringify(a[i] ?? "")}`);
  }
  return out;
}

function main(argv) {
  const root = rootFromArgv(argv);
  const outPath = root === ROOT ? OUT_PATH : join(root, "docs", "SNAPSHOT.md");
  const fresh = generate(root);
  const check = argv.includes("--check");

  if (!check) {
    writeFileSync(outPath, fresh, "utf8");
    console.log(`wrote ${outPath} (${countLinesOf(fresh)} lines)`);
    return;
  }

  if (!existsSync(outPath)) {
    console.error(`FAIL: ${outPath} does not exist — run node scripts/snapshot.mjs`);
    process.exit(1);
  }
  const committed = readFileSync(outPath, "utf8");
  const lineCount = countLinesOf(committed);
  const diffs = diffLines(fresh, committed);
  if (diffs.length) {
    console.error(`FAIL: docs/SNAPSHOT.md is stale (${diffs.length} line(s) differ from a fresh regeneration):`);
    for (const d of diffs.slice(0, 20)) console.error(d);
    process.exit(1);
  }
  if (lineCount > MAX_LINES) {
    console.error(`FAIL: docs/SNAPSHOT.md is ${lineCount} lines, budget is ${MAX_LINES}`);
    process.exit(1);
  }
  console.log(`OK: docs/SNAPSHOT.md matches a fresh regeneration (${lineCount} lines, budget ${MAX_LINES})`);
}

function countLinesOf(text) {
  return text.split(/\r?\n/).filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === "")).length;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main(process.argv.slice(2));
}
