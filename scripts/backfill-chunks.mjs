#!/usr/bin/env node
/**
 * scripts/backfill-chunks.mjs — U1.0. Populates the `chunks` collection for sessions that were
 * indexed BEFORE the vector layer existed.
 *
 * WHY THIS EXISTS. U1.1 (embed seam), U1.2 (chunker + schema) and U1.3 (embed-on-index) all
 * shipped and all PASSed, and `chunks` was still empty — measured 0 docs against 26 sessions /
 * 2118 turns. Nothing was broken: `writeSessionChunks` only runs *during indexing*, and every one
 * of those sessions had been indexed before that code existed. Three PASSed units therefore added
 * a capability that had never once produced a row. This script is the missing backfill step, and
 * it is what makes U1.4's cosine retriever measurable against something other than an empty set.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not call `indexSession`. That would re-run the
 * `summarize` and `claims` LLM jobs for all 26 sessions — real spend for no benefit — and, worse,
 * a degraded summarize response could overwrite a good `session_pages` row. This calls only
 * `writeSessionChunks`, the exact function the live pipeline uses (imported, not reimplemented),
 * so the backfill and the shipped path cannot drift.
 *
 * Flags:
 *   --dry-run        chunk every session and report the exact plan counts WITHOUT calling the
 *                    embedding provider and WITHOUT writing. Costs nothing. Same
 *                    unreachable-DB/no-spend precedent as `seed-toc.mjs --dry-run`.
 *   --session <id>   restrict to one session (use this to smoke-test before a full run).
 *   --tenant <id>    tenant to back-fill (default: `toc`, the only tenant with real sessions).
 *   --limit <n>      process at most n sessions.
 *
 * packages/db and apps/api are TypeScript with no build step, so this plain .mjs loads them at
 * runtime via tsx's programmatic register() API — same mechanism seed-toc.mjs already uses.
 */
import "dotenv/config";
import { register } from "tsx/esm/api";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const DRY_RUN = has("--dry-run");
const TENANT = val("--tenant", "toc");
const ONE_SESSION = val("--session", null);
const LIMIT = Number(val("--limit", "0")) || 0;

const unregister = register();
try {
  const { getDb, connect, close, scopedCollection } = await import("../packages/db/src/index.ts");
  const { buildChunks } = await import("../packages/index/src/index.ts");
  const { writeSessionChunks } = await import("../apps/api/src/indexing.ts");
  const { embed: routeEmbed } = await import("../packages/ai/src/index.ts");
  const { buildRouting } = await import("../apps/api/src/production.ts");

  // Same env vars as migrate-mongo-config.cjs and seed-toc.mjs — one convention, not a third.
  await connect(process.env.MONGODB_URL || "mongodb://localhost:27017", process.env.MONGODB_DB || "lkb");
  const db = getDb();
  const sessionsColl = scopedCollection(db, "sessions");
  const turnsColl = scopedCollection(db, "turns");
  const chunksColl = scopedCollection(db, "chunks");

  const filter = ONE_SESSION ? { _id: ONE_SESSION } : {};
  let sessions = await sessionsColl(TENANT).find(filter).toArray();
  if (LIMIT > 0) sessions = sessions.slice(0, LIMIT);

  const before = await chunksColl(TENANT).countDocuments({});
  console.log(`tenant=${TENANT} sessions=${sessions.length} chunks_before=${before}${DRY_RUN ? "  [DRY RUN — no embedding calls, no writes]" : ""}`);
  if (sessions.length === 0) {
    console.log("no sessions matched — nothing to do");
    process.exit(0);
  }

  // Built once, outside the loop: registering providers per session would re-read the routing
  // config 26 times and create 26 job writers for no reason.
  const { chains, providers, jobWrite } = DRY_RUN ? {} : buildRouting();
  const embed = DRY_RUN
    ? null
    : (job) => routeEmbed("embedding", job, { chains, providers, write: jobWrite, tenantId: TENANT });

  let totalPlanned = 0;
  let totalWritten = 0;
  const failures = [];

  for (const s of sessions) {
    const turns = await turnsColl(TENANT).find({ sessionId: s._id }).toArray();
    const planned = buildChunks(turns).length;
    totalPlanned += planned;

    if (DRY_RUN) {
      console.log(`  ${s._id}  turns=${String(turns.length).padStart(4)}  would_write=${planned}`);
      continue;
    }

    const res = await writeSessionChunks(TENANT, s._id, turns, embed, db);
    totalWritten += res.written;
    // `writeSessionChunks` never throws — it returns why it skipped. Reporting that explicitly is
    // the point: a backfill that printed only successes would hide a provider outage as "done".
    if (res.skipped) failures.push({ sessionId: s._id, reason: res.skipped, planned });
    console.log(`  ${s._id}  turns=${String(turns.length).padStart(4)}  planned=${planned}  written=${res.written}${res.skipped ? `  SKIPPED(${res.skipped})` : ""}`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN: ${sessions.length} session(s) would produce ${totalPlanned} chunk(s). No calls made, nothing written.`);
    await close();
    process.exit(0);
  }

  const after = await chunksColl(TENANT).countDocuments({});
  console.log(`\nchunks_before=${before} chunks_after=${after} planned=${totalPlanned} written=${totalWritten}`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} session(s) did NOT get chunks:`);
    for (const f of failures) console.log(`  ${f.sessionId} — ${f.reason} (${f.planned} chunk(s) not written)`);
  }
  await close();
  // Exit non-zero when any session was skipped, so a partial backfill can never be mistaken for a
  // complete one by a caller that only checks the exit code.
  process.exit(failures.length > 0 ? 1 : 0);
} finally {
  unregister();
}
