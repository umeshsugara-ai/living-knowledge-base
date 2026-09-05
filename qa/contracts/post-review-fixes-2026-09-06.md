# Contract — post-review-fixes-2026-09-06

> The Stop hook's lifecycle "review" gate fired after 408 code-file edits this session with no
> review agent dispatched. Three fresh-context review agents were dispatched (data-engineer over
> the WhatsApp ingestion pipeline, ai-engineer over the summarize/claims pipeline, senior-
> software-engineer over the surrounding API/web wiring), each reading the real code
> independently. This unit fixes every finding at Warning severity or above. Drafted by the
> maker; /checker adopts or amends on first check.

## Findings fixed (each machine-checkable)

1. **[Block, ai-engineer] `summarize`'s provider chain was broken in production.**
   `config/ai-routing.yaml`'s `summarize: [gemini, claude-code, ollama]` chain was never
   satisfiable — `apps/api/src/production.ts` only registered `gemini`/`claude-code`, and
   `packages/ai/src/router.ts`'s `route()` eagerly resolves EVERY chain member to a registered
   `Provider` before trying any of them, throwing immediately on the unregistered `ollama` name.
   Every real `summarizeSession` call in production therefore threw before Gemini was ever
   tried, silently degrading to the labeled fallback for every single session. **Fix:** register
   `OllamaProvider` (already built, unused, per D-008 "Ollama is a required adapter from the
   outset") in `production.ts`'s `providers` map. Reproduced the bug live, then reproduced the
   fix live (see Real evidence).
2. **[Critical, data-engineer] WhatsApp ingestion had no idempotency.** `source._id` was hashed
   from the message *count*, not content — a re-ingest with new messages duplicated the entire
   history as new turns; a re-ingest with no change hit a Mongo duplicate-key error and returned
   502 for a correct no-op; a count that happened to repeat (one deleted + one added) made a
   group permanently un-ingestable. **Fix:** `source._id` (and the derived `sessionId`) are now
   stable per `(groupJid, ownerUserId)`; every write (`sources`, `sessions`, `turns`) is a real
   upsert; each turn's `_id` is derived from the real, upstream-unique WhatsApp `messageId`
   (`sources/whatsapp_msg`'s own dedup key) instead of a positional index. A re-ingest with no
   new messages now leaves the corpus byte-identical; a re-ingest with N new messages adds
   exactly N new turns.
3. **[High, data-engineer] `ownerUserId` was a client-supplied, unvalidated tenant-equivalent
   selector.** `POST /whatsapp/ingest` took `ownerUserId` straight from the request body with no
   binding to the caller's tenant — any key with the `whatsapp` scope could ingest any archiver
   owner's private group messages. **Fix:** the route no longer accepts `ownerUserId` at all;
   `ingestGroup`'s real implementation resolves it itself from the live `listTrackableGroups()`
   result, keyed only by the `groupJid` the caller asked for — a client can never supply an
   owner identity that wasn't already independently discoverable via the real trackable-groups
   list.
4. **[Medium, data-engineer] Non-deterministic turn ordering on real timestamp ties.** The live
   `whatsapp_msg` data has genuine same-second message pairs; `.sort({ ts: 1 })` alone gives
   Mongo no stable tiebreak. **Fix:** `.sort({ ts: 1, _id: 1 })` — deterministic replay,
   verified live (see Real evidence: turn ids identical across two independent runs).
5. **[Medium, senior-software-engineer] `CalendarPage.tsx`'s approve/reject handler had no
   `.catch`**, unlike every other async call in that file — a failed decision (404 on a
   concurrently-already-decided candidate, a transient 502) silently no-opped the button with no
   error shown. **Fix:** mirrors the file's own established pattern
   (`setCandidatesError` on rejection).

## Findings explicitly NOT fixed in this unit (disclosed, tracked as follow-ups)

Per the data-engineer's own recommendation, these are acceptable as disclosed limitations for
this slice, not blocking:
- F4 (double-fetch: `fetch()`/`toTurns()` and the composition root's own `fetchWhatsAppMessages`
  call each re-query — same deterministic query, no correctness cost, a performance nit).
- F6 (resolved `displayName` computed then discarded — `speakerRef` stays the raw `personId`;
  `sessions.participants` stays unpopulated).
- F7 (the `captureMode: "provided"` label isn't checked against the group's live
  `trackAllSenders` flag — true for today's one tracked group, would need a guard the day that
  flag flips).
- F8–F12 (connection-lifecycle hardening, error-message sanitization on Mongo connection
  failures, unbounded fetch/no pagination, minor correctness nits) — all named with file:line in
  the original data-engineer review, none block this fix batch.
- The `apps/api/src/whatsapp-store.ts:31` `MessageDoc` interface still omits `groupJid` (a
  senior-software-engineer open question, not urgent — `tsc` passes, the filter still works at
  runtime).

## Real evidence

### Reproduced the summarize-chain bug, then reproduced the fix (live, real Gemini API)
```
$ npx tsx verify_bug.mjs      # BEFORE the fix (providers map missing ollama)
CONFIRMED BUG - threw: router.route: unknown provider "ollama" in chain "summarize"

$ npx tsx verify_fix.mjs      # AFTER registering OllamaProvider
FIXED - real completion via provider: gemini text: OK.
```

### Reproduced the WhatsApp idempotency fix (live, real whatsapp_msg data, no mocks)
```
$ npx tsx verify_idempotency.mjs
group: { groupJid: '120363405936621456@g.us', ownerUserId: '6a8d0c692fcc75f0e911b878',
         subject: 'Millionaires', trackedPersonCount: 3 }
source A _id: 45e3b9e8e0cc60a61bf6bc6ce8d7ce693970fbda0659c399ef9a93c60d02b369
source B _id: 45e3b9e8e0cc60a61bf6bc6ce8d7ce693970fbda0659c399ef9a93c60d02b369
STABLE (idempotent): true
turns: 50, unique turn ids: 50 (must match)
turn ids identical across two independent runs: true
```

### Typecheck
```
$ cd packages/ingest && npx tsc --noEmit -p tsconfig.json   # exit 0
$ cd apps/api && npx tsc --noEmit -p tsconfig.json           # exit 0
$ cd apps/web && npx tsc --noEmit -p tsconfig.json           # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/ai:          56/56 pass
packages/ingest:      41/41 pass   (was 40, +1: source._id stability test)
packages/index:       38/38 pass
packages/ask:         32/32 pass
packages/meeting-bot: 40/40 pass
apps/api:             66/66 pass   (was 65, +1: client-supplied ownerUserId ignored)
apps/web:             40/40 pass   (was 39, +1: CalendarPage approve/reject failure path)
Total: 320 tests, 320 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (206 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (239 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (996 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (239 modules, 701 dependencies cruised)
```

## Disclosed limitation (unchanged from prior units)

Main Mongo host (`13.202.206.101:27017`) has remained unreachable this entire session (confirmed
again via `ping`, 100% packet loss), so a live HTTP `POST /whatsapp/ingest` round-trip through a
running `apps/api` server (proving the real upsert writes end-to-end, not just the pure
adapter/store logic verified above) is still deferred. Everything that COULD be verified without
main Mongo (the summarize routing fix, the full idempotency chain against real WhatsApp data) was
verified live, with no mocks.

## How to verify (for the checker)
1. `pnpm --filter @lkb/ingest typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm --filter @lkb/web typecheck` — expect exit 0 each.
2. `pnpm -r test` — expect exit 0, 320/320.
3. `pnpm lint:structure` — expect exit 0.
4. Read `production.ts` — confirm `OllamaProvider` is now imported and registered.
5. Read `whatsapp.ts` (adapter) — confirm `_id` hash no longer includes message count.
6. Read `whatsapp-store.ts` — confirm `ingestGroup` no longer takes `ownerUserId` as a parameter
   and resolves it from `listTrackableGroups()`; confirm all three writes are upserts
   (`replaceOne`/`bulkWrite` with `upsert: true`, never a bare `insertOne`/`insertMany`); confirm
   the Mongo sort is `{ ts: 1, _id: 1 }`.
7. Read `routes/whatsapp.ts` — confirm the body schema no longer includes `ownerUserId`.
8. Read `CalendarPage.tsx`'s `handleDecision` — confirm the `.catch` is present.
9. If `whatsapp_msg`'s Mongo is reachable, independently re-run the idempotency verification
   yourself (real data, no mocks) — strongest possible check.
