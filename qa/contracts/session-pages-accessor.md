# Contract — session-pages-accessor (T-002 follow-up)

> Ground truth for the missing `session_pages` Mongo accessor, discovered when the first real
> seed of the `lkb` database ran (T-003's real Mongo connectivity check, 2026-09-03):
> `scripts/seed-toc.mjs`'s own comment disclosed that `packages/db/src/collections/` never got a
> `session_pages.ts` accessor (only sources/sessions/turns/claims exist per T-018 C6), so every
> real seed run has silently skipped inserting the 23 real session summaries/keyInsights/evidence
> docs — the actual, most information-dense content T-002 produced. Drafted by the maker; checker
> adopts or amends on first check.

## Scope
One new file, matching the existing `sources.ts`/`sessions.ts`/`turns.ts`/`claims.ts` pattern
exactly — no new abstraction, no design decision, purely filling a known, disclosed gap. Update
`scripts/seed-toc.mjs` to use it (removing the `counts.session_pages = 0` skip) and re-run the
real seed so the `lkb` database's `session_pages` collection actually has its 23 real documents.

## Criteria (each machine-checkable)

1. **`packages/db/src/collections/session-pages.ts`**: `sessionPages(tenantId)` accessor,
   `scopedCollection<SessionPages>(getDb(), "session_pages")(tenantId)` — identical shape to
   `sources.ts`. Exported from `packages/db/src/index.ts`.
2. **`scripts/seed-toc.mjs`** updated: imports `sessionPages` alongside the other four accessors,
   inserts `docs.session_pages` the same way as `docs.sources`/`docs.claims`, `counts.
   session_pages = docs.session_pages.length` (matching the dry-run count, no longer hardcoded 0).
3. **Real re-seed run, reported honestly**: the manifest documents an actual re-run of
   `node scripts/seed-toc.mjs` against the same real `lkb` Mongo database, with real output
   showing `session_pages: 23` inserted (not a dry run), plus an independent real count query
   against the live database confirming `session_pages` now has 23 documents (matching
   `sources`/`sessions`, and `turns`=2907/`claims`=72 unaffected by the re-run of an
   already-populated collection — since `insertOne` is used, not upsert, re-running MUST NOT
   duplicate sources/sessions/turns/claims; verify actual re-run behavior and disclose if a
   duplicate-key error occurs on the second run for those four, since `seed-toc.mjs` was designed
   for a first-time seed, not idempotent re-runs — see Non-goals).
4. **No regression**: `pnpm -r typecheck`, `pnpm gen:types --check`, `python schema/validate.py`,
   `pnpm lint:structure` all clean. (No dedicated test suite for `packages/db`'s collection
   accessors — matches the existing pattern; `sources.ts`/`sessions.ts`/etc. have no `.test.ts`
   siblings either, correctness is enforced via `tenantScope.typecheck-test.ts`'s compile-time
   tenant-safety check plus this unit's real end-to-end Mongo run.)

## Non-goals for this unit
- `seed-toc.mjs` is NOT made idempotent (upsert-based) in this unit — that would be a genuine
  design change beyond "fill a known gap," and the four already-seeded collections
  (sources/sessions/turns/claims) already have real data in `lkb`; a second full re-run of THOSE
  four would hit Mongo's `_id` uniqueness and fail loudly (not silently duplicate) — acceptable
  for this one-time gap-fill, not acceptable as the long-term ingestion story (a real upsert-based
  re-ingestion path is separate future work, same "seam now, robustness later" pattern as
  everything else in this codebase).
