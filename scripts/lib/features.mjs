/**
 * scripts/lib/features.mjs — shared logic for docs/FEATURES.jsonl (T-017b, C1/C2).
 * `appendEvent` is the only writer this repo should use: it validates against
 * schema/features_event.schema.json (via mini-schema.mjs) and appends one line — it never
 * rewrites prior lines, so the ledger is append-only by construction.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDoc } from "./mini-schema.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER_PATH = join(ROOT, "docs", "FEATURES.jsonl");
export const SCHEMA_PATH = join(ROOT, "schema", "features_event.schema.json");

export function loadSchema(schemaPath = SCHEMA_PATH) {
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

/** Reads every event currently in the ledger (empty array if the file does not exist yet). */
export function readEvents(ledgerPath = LEDGER_PATH) {
  if (!existsSync(ledgerPath)) return [];
  return readFileSync(ledgerPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}

/**
 * Validates `entry` against schema/features_event.schema.json and appends it as one line to
 * docs/FEATURES.jsonl. Throws on an invalid entry (including the "reason required for
 * updated/removed" rule) — nothing is ever written on failure, and prior lines are untouched
 * on success (fs.appendFileSync only ever grows the file).
 */
export function appendEvent(entry, { ledgerPath = LEDGER_PATH, schemaPath = SCHEMA_PATH } = {}) {
  const schema = loadSchema(schemaPath);
  const { valid, errors } = validateDoc(schema, entry);
  if (!valid) {
    throw new Error(`invalid features_event: ${errors.join("; ")}`);
  }
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}
