#!/usr/bin/env node
/**
 * scripts/sync-real-turns.mjs — T-003 phase 3. Syncs the real-transcribed sessions' turns
 * (T-003 phase 2) into the live Mongo `turns` collection, which still holds the original T-002
 * placeholder turns from the first seed. For each REAL (non-placeholder) local session: deletes
 * its existing Mongo turns, then inserts the current local set. PLACEHOLDER sessions are left
 * completely untouched. `--dry-run` (required to PASS the contract) never connects to Mongo.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { register } from "tsx/esm/api";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data", "toc-migrated");
const DRY_RUN = process.argv.includes("--dry-run");

register();

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function classify(sessionId) {
  const turnsPath = join(DATA_DIR, sessionId, "turns.json");
  if (!existsSync(turnsPath)) return null;
  const turns = loadJson(turnsPath);
  const isPlaceholder = turns.length > 0 && turns.every((t) => t.speakerRef === "unknown");
  return { turns, isPlaceholder };
}

async function main() {
  const sessionIds = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const realSessions = [];
  for (const sid of sessionIds) {
    const result = classify(sid);
    if (result && !result.isPlaceholder) realSessions.push({ sessionId: sid, turns: result.turns });
  }

  console.log(`${realSessions.length} real session(s) to sync:`);
  for (const s of realSessions) console.log(`  ${s.sessionId}: ${s.turns.length} local turns`);

  if (DRY_RUN) {
    console.log("No Mongo connection attempted (--dry-run).");
    return;
  }

  console.log("\nConnecting to Mongo for a live sync (no --dry-run flag given)...");
  const { connect, close } = await import("../packages/db/src/client.js");
  const { turns } = await import("../packages/db/src/collections/turns.js");

  const url = process.env.MONGODB_URL || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "lkb";
  await connect(url, dbName);
  try {
    const tenantId = "toc";
    for (const s of realSessions) {
      const before = await turns(tenantId).raw.countDocuments({ tenantId, sessionId: s.sessionId });
      const deleteResult = await turns(tenantId).raw.deleteMany({ tenantId, sessionId: s.sessionId });
      let inserted = 0;
      for (const doc of s.turns) {
        const { tenantId: _t, ...rest } = doc;
        await turns(tenantId).insertOne(rest);
        inserted++;
      }
      console.log(`${s.sessionId}: before=${before} deleted=${deleteResult.deletedCount} inserted=${inserted}`);
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
