#!/usr/bin/env node
// qa/probes/golden-set-sibling-semantic.mjs — T-021 condition-4 semantic sibling pass.
// The lexical probe (golden-set-ambiguity.mjs) explicitly failed the gate's own known-positive and
// named the next step: a question-to-session EMBEDDING pass. The egress gate was answered A
// (2026-09-09 preflight: 92 questions, 9,920 bytes, SHA-256 0e00f2...), so the bounded run is
// authorized. This probe embeds all 92 questions ONCE (purpose=query), scores each against the
// real work-DB chunk vectors per session, takes each session's BEST chunk score, and reports the
// margin between the expected session and the best rival. Small margin = genuinely ambiguous.
// READ-ONLY toward Mongo (work DB), no jobs writer, no writes outside data/eval.
// Run: pnpm exec tsx qa/probes/golden-set-sibling-semantic.mjs [--write]
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SET_PATH = join(ROOT, "data", "eval", "golden-set.json");
const OUT_PATH = join(ROOT, "data", "eval", "golden-set-sibling-semantic.json");
register();

const questions = JSON.parse(readFileSync(SET_PATH, "utf8"));
const { connect, close, getDb, scopedCollection } = await import("../../packages/db/src/index.ts");
const { embed: routeEmbed } = await import("../../packages/ai/src/index.ts");
const { buildRouting } = await import("../../apps/api/src/production.ts");

const DB = process.env.MONGO_WORK_DB || "lkb_codex_work_20260909";
await connect(process.env.MONGODB_URL || "mongodb://localhost:27017", DB);
const chunksCol = scopedCollection(getDb(), "chunks");
// tenant: read one chunk to learn tenantId
const anyChunk = await getDb().collection("chunks").findOne({}, { projection: { tenantId: 1 } });
const tenant = anyChunk.tenantId;
const chunks = await chunksCol(tenant).find({}).toArray();

const { chains, providers } = buildRouting();
const texts = questions.map((q) => q.question);
const embedded = await routeEmbed("embedding", { kind: "embedding", texts, purpose: "query" },
  { chains, providers, write: async () => {}, tenantId: tenant });
const qv = new Map(texts.map((t, i) => [t, embedded.vectors[i]]));

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
// group chunks by session
const bySession = new Map();
for (const c of chunks) {
  const sid = c.sourceRef;
  if (!bySession.has(sid)) bySession.set(sid, []);
  bySession.get(sid).push(c);
}
const rows = [];
for (const q of questions) {
  const v = qv.get(q.question);
  const perSession = new Map();
  for (const [sid, cs] of bySession) {
    let best = -2;
    for (const c of cs) {
      const s = cosine(v, c.vector);
      if (s > best) best = s;
    }
    perSession.set(sid, best);
  }
  const ranked = [...perSession.entries()].sort((a, b) => b[1] - a[1]);
  const exp = perSession.get(q.expectedSessionId);
  const top = ranked[0];
  const rivalBest = ranked.find(([sid]) => sid !== q.expectedSessionId);
  const margin = exp - (rivalBest ? rivalBest[1] : -2);
  const ambiguousRivals = ranked.filter(([sid, s]) => sid !== q.expectedSessionId && exp - s < 0.03).map(([sid]) => sid);
  rows.push({
    id: q.id,
    question: q.question,
    expectedSessionId: q.expectedSessionId,
    expectedScore: +exp.toFixed(4),
    topSession: top[0],
    topScore: +top[1].toFixed(4),
    bestRival: rivalBest ? rivalBest[0] : null,
    bestRivalScore: rivalBest ? +rivalBest[1].toFixed(4) : null,
    margin: +margin.toFixed(4),
    ambiguousRivals_0p03: ambiguousRivals,
  });
}
const ambiguous = rows.filter((r) => r.margin < 0.03);
const summary = {
  measuredAt: new Date().toISOString(),
  workDb: DB,
  model: embedded.model,
  n: rows.length,
  marginThreshold: 0.03,
  ambiguousCount: ambiguous.length,
  ambiguousIds: ambiguous.map((r) => r.id),
  note: "question-to-session embedding pass named by golden-set-ambiguity.mjs; margin = expected session best-chunk cosine minus best rival session best-chunk cosine; margin < 0.03 reads as semantically answerable by more than one session. Egress preflight honored (92 questions, one batched call, purpose=query, work DB only, jobs writer disabled).",
};
console.log(`ambiguous (margin<0.03): ${ambiguous.length}/${rows.length}`);
for (const r of ambiguous) console.log(`  [${r.id}] margin ${r.margin} top=${r.topSession}`);
if (process.argv.includes("--write")) {
  writeFileSync(OUT_PATH, JSON.stringify({ ...summary, rows }, null, 2) + "\n", "utf8");
  console.log(`wrote ${OUT_PATH}`);
}
await close();
