# Manifest — watched-sources-entrypoint

**Contract:** none yet — checker, please author `qa/contracts/watched-sources-entrypoint.md`.
**Goal task:** T-027 / catalogue **A13**.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — new feature work.
**Status:** ready-for-check
**Branch:** `lane/c-unrun-writers`
**Ledger:** per D-019 this lane files to `qa/issues.c-unrun-writers.jsonl` with `ISS-C-UNRUN-WRITERS-NNN` ids.

## Why

T-027 shipped Watched Sources' schema, its tenant-scoped accessors (`createWatchedSource`,
`recordFetch`, `listActive`) and its pure due-check — **all checker-PASSed** — and then nothing
called them. `packages/ingest/src/watched/schedule.ts` still says *"a future scheduler runs
`listActive`"*. The collection has been empty ever since, which is exactly why A13 scores MISSING:
the probe is `collection watched_sources (empty)`.

**The gap was never the logic. It was that no user action could reach it.** This is that action.

## What changed

| File | Change |
|---|---|
| `apps/api/src/routes/watched-sources.ts` | **new** — `POST /watched-sources`, `GET /watched-sources`. |
| `apps/api/src/routes/watched-sources.test.ts` | **new** — 7 tests, written first. |
| `apps/api/src/fixtures.ts` | `fakeWatchedSourceDeps`, tenant-partitioned. |
| `apps/api/src/server.ts` | mount + `ServerDeps.watchedSources`. |
| `apps/api/src/store.ts` | `createMongoWatchedSourceDeps` — delegates to T-027's accessors. |
| `apps/api/src/production.ts` | wire it. |
| `TASKS.md`, `.goal/goal.json` | tracker fixes, see below. |

No accessor, schema or pure-logic file was touched. This unit is **wiring plus validation**; the
feature underneath is T-027's and keeps its verdict.

## Validation is strict on purpose

A watched source is a URL the system will later **fetch on a timer**, so an unvalidated `url` here
is a stored server-side request target, not just a string. The route refuses anything that is not
an absolute `http(s)` URL — `javascript:`, `file://`, relative and empty all 400 and store nothing.
Same reasoning that made the Ask page refuse a `javascript:` citation.

`reputationTier` is checked against the schema's exact three values, and `checkIntervalHours` must
be positive — `isDueForCheck` compares `elapsed >= interval`, so 0 would make a source permanently
due.

The fake is **partitioned by tenant**, not one shared array: a fake that ignores `tenantId` cannot
fail the isolation test, and isolation is the property most worth testing on a route that stores
outbound fetch targets.

## Evidence

```
$ pnpm --filter '@lkb/api' test    tests 131   pass 131   fail 0    (124 + 7 new)
$ pnpm -r test                     all packages green
$ pnpm -r typecheck                exit 0
$ pnpm lint:structure              green; tracker-audit OK (G1); depcruise 279 modules / 0 violations
```

## Two tracker corrections, both disclosed

1. **My own:** I had recorded U2.4 as `partial` in `TASKS.md`. That is not a known status — G1
   enumerates open / pending / in_progress / blocked / done — so my attempt at an honest label
   broke the gate. Now `in_progress`, and `.goal/goal.json` aligned to match. The detailed note
   still says exactly what is and is not done.
2. **Not mine:** G1 also failed on `U1.0` being in `goal.json` but absent from `TASKS.md` — the
   **other maker loop's** chunk-backfill unit. I reconciled the row *from goal.json* and labelled
   it as reconciled-not-authored, because the gate blocks `lint:structure` and therefore this
   unit's own acceptance evidence. I did not invent any content for it.

## Known gaps — stated, not hidden

1. **A13 will NOT flip on this unit alone.** The collection is still empty: this makes a real write
   *reachable*, it does not perform one. A row requires a real `POST`, and the probe additionally
   needs it to appear in a live-verify artifact.
2. **No scheduler.** `listActive` → `isDueForCheck` → `checkWatchedSource` → `recordFetch` is still
   unwired, so nothing is ever actually re-fetched, hashed or diffed. That is A13's substance and
   it is a separate unit — expect A13 to need a human downgrade to PARTIAL even once rows exist,
   for the same reason B3 did.
3. **No de-duplication.** Registering the same URL twice creates two rows.
4. **`recordFetch` remains uncalled**, as does the whole `gaps` accessor set (A5/D8) — the other
   half of this lane, untouched here.
5. **No UI.** Reachable via the API only; no `apps/web` page.

## Note to the checker

Judge the validation hardest — it is the only part that is genuinely new logic rather than wiring,
and a stored URL is a future outbound request. Try to get a non-http(s) target past it. Please also
rule on gap 2: I claim A13 deserves PARTIAL not REAL even once rows exist, because nothing re-fetches
anything. If you think shipping the entrypoint without the scheduler is the wrong unit boundary, say
so. `ISSUES-WRITTEN: none` is creditable.
