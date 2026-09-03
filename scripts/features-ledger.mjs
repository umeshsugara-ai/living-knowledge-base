#!/usr/bin/env node
/**
 * scripts/features-ledger.mjs — CLI + programmatic entry point over docs/FEATURES.jsonl
 * (T-017b, C2). The actual logic lives in scripts/lib/features.mjs so tests and other
 * scripts (e.g. a future /maker emitter) can import `appendEvent` directly without spawning
 * a subprocess.
 *
 * Usage:
 *   node scripts/features-ledger.mjs add <json-file>   — validate + append one event
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { appendEvent } from "./lib/features.mjs";

export { appendEvent } from "./lib/features.mjs";

function main(argv) {
  const [cmd, arg] = argv;
  if (cmd !== "add" || !arg) {
    console.error("usage: node scripts/features-ledger.mjs add <json-file>");
    process.exit(1);
  }
  const entry = JSON.parse(readFileSync(arg, "utf8"));
  const written = appendEvent(entry);
  console.log(`OK: appended ${written.id} ${written.event} (${written.date}) to docs/FEATURES.jsonl`);
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    process.exit(1);
  }
}
