# Contract — sync-real-turns-to-mongo (T-003 phase 3)

> Ground truth for syncing the 19 real-transcribed sessions' turns (T-003 phase 2, checker-PASSed
> commit `e0fef9c`) into the live `lkb` Mongo database, which still holds the original T-002
> placeholder turns (2,907 docs, every `speakerRef: "unknown"`) from `scripts/seed-toc.mjs`'s
> initial seed. Explicitly deferred from phase 2's own manifest ("a separate deliberate step").
> Drafted by the maker; checker adopts or amends on first check.

## Scope
A new script, `scripts/sync-real-turns.mjs`, real CLI (same `tsx/esm/api` pattern as every prior
script this session), `--dry-run` required. For each session whose local `turns.json` is no
longer 100% placeholder (i.e. the 19 real sessions from phase 2 + any future ones), it DELETES
that session's existing turns in Mongo (`turns(tenantId).raw.deleteMany({sessionId})`) then
INSERTS the current real local turns — a full replace per session, not a merge/upsert (turn
counts and `_id` schemes differ between the old placeholder set and the new real set for the same
session, so a naive additive insert would either collide on `_id` or leave stale placeholder rows
alongside real ones).

## Criteria (each machine-checkable)

1. **`scripts/sync-real-turns.mjs`**: `--dry-run` (default expectation, required to PASS this
   contract) reads every `data/toc-migrated/<sessionId>/turns.json`, classifies each as
   placeholder (100% `speakerRef: "unknown"`) or real, and for the REAL ones only, prints
   `{sessionId, localTurnCount}` — no Mongo connection attempted (same unreachable-DB-safe
   precedent as `seed-toc.mjs --dry-run`/`migrate-mongo status`).
2. **Live run** (no flag) connects to the real `lkb` database via `packages/db`'s `turns(tenantId)`
   accessor (never a raw driver call — ARCHITECTURE §5), and for each REAL session: (a) counts
   existing Mongo turns for that `sessionId` before deleting (for the printed diff), (b)
   `deleteMany({sessionId})`, (c) inserts every turn from the local `turns.json` via `insertOne`
   in a loop (matching `seed-toc.mjs`'s existing per-doc insert style), (d) prints
   `{sessionId, before, deleted, inserted}`. PLACEHOLDER sessions are left completely untouched —
   never deleted, never re-inserted (their existing Mongo rows, whatever they are, stay as-is).
3. **Real run executed, reported honestly**: the manifest documents an ACTUAL real invocation
   against the live `lkb` database, with real per-session output, and an independent post-run
   Mongo query confirming: (a) total `turns` count in Mongo now reflects the sum of the 19 real
   sessions' real counts plus the 4 still-placeholder sessions' original counts (not a random
   number — computed and matched exactly); (b) a `speakerRef` distribution query shows real
   non-"unknown" values now present for the 19 synced sessions; (c) the 4 placeholder sessions'
   Mongo turns are confirmed UNCHANGED (same count, still `speakerRef: "unknown"` throughout) —
   proof criterion 2's "placeholder sessions untouched" rule genuinely held, not just claimed.
4. **No regression**: `pnpm -r typecheck`, `pnpm gen:types --check`, `python schema/validate.py`,
   `pnpm lint:structure` all clean. (No dedicated test suite — matches `seed-toc.mjs`'s own
   precedent; real end-to-end Mongo verification IS this unit's test.)

## Non-goals for this unit
- Does NOT re-sync `session_pages`/`sources`/`sessions`/`claims` (those are untouched by T-003's
  transcription work — only `turns` changed). Does NOT attempt the 4 remaining placeholder
  sessions (out of scope, per phase 2's own disclosed follow-up). Does NOT make the sync
  idempotent/automatically re-runnable on a schedule — a one-off real data-sync operation, same
  posture as every other real-Mongo-write script this session.
