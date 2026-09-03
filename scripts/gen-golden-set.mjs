#!/usr/bin/env node
/**
 * scripts/gen-golden-set.mjs — T-021 C1. Reads every real `data/toc-migrated/<sessionId>/
 * session_page.json` and turns its `keyInsights` into golden-set questions (verbatim excerpts,
 * not paraphrased or invented) mapped to the real `sessionId` they came from. Idempotent —
 * re-running against the same `data/toc-migrated/` produces byte-identical output.
 *
 * Up to 2 keyInsights per session (first two, deterministic order) keep the set's size
 * reasonable while covering most/all of the 23 real sessions (contract C1: >= 30 questions,
 * >= 15 distinct sessions).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data", "toc-migrated");
const OUT_DIR = join(ROOT, "data", "eval");
const OUT_PATH = join(OUT_DIR, "golden-set.json");
const MAX_PER_SESSION = 2;

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const sessionDirs = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const questions = [];
  for (const sessionId of sessionDirs) {
    const pagePath = join(DATA_DIR, sessionId, "session_page.json");
    if (!existsSync(pagePath)) continue;
    const page = loadJson(pagePath);
    const insights = (page.keyInsights ?? []).slice(0, MAX_PER_SESSION);
    insights.forEach((insight, i) => {
      questions.push({
        id: `${sessionId}-gq${String(i + 1).padStart(2, "0")}`,
        question: insight,
        expectedSessionId: sessionId,
      });
    });
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(questions, null, 2) + "\n", "utf8");

  const distinctSessions = new Set(questions.map((q) => q.expectedSessionId)).size;
  console.log(`wrote ${questions.length} golden questions spanning ${distinctSessions} sessions -> ${OUT_PATH}`);
}

main();
