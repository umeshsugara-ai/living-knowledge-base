# Contract — whatsapp-ingestion-first-slice (T-007, first slice)

> Umesh: "TOC and all wala sabb ho gyaa hai and whatsapp msg and all wale saare featues ho gyee
> hai" — the `sources/whatsapp_msg` archiver (a separate, independently governed submodule) is
> feature-complete and working (its own README: "Working end to end: live capture verified with
> messages stored and correctly attributed, zero unresolved senders"; confirmed live this unit —
> real Mongo, real captured messages, real people resolved). T-007 ("WhatsApp → claims ingestion
> review", `depends T-020`, T-020 already done) was the only remaining blocker, and that blocker
> is now the archiver actually having real data to pull from — which it does. This unit is
> T-007's first, concrete slice: get real WhatsApp messages into the Living Knowledge Base's own
> `sources`/`sessions`/`turns`, the same "ingest" step every other source kind already has.
> Drafted by the maker; /checker adopts or amends on first check.

## Scope note (disclosed, not silently dropped)

The plan's full T-007 vision (A9: topic/decision/sensitive-content detection, duplicate
flagging, an approve-before-publish review queue before anything becomes a `claim`) is
explicitly **OUT of this slice** — same disclosed-scope pattern as the Gmail meeting-candidate
unit's split from its own approval workflow. This unit only gets real messages **into** the KB as
a real session+turns, exactly as far as the URL/document adapters already go. Claim extraction,
topic detection, and any review/approval UI over WhatsApp content are separate, larger follow-up
units.

## Real data found (disclosed, not assumed)

The one currently-tracked group ("Millionaires", 50 real captured text messages, real people —
`Navnit Chaubey Vidysea`, `Himanshu Tomar`, etc.) is an internal Vidysea team/test group, not yet
a real TOC/expert-group WhatsApp thread. This unit ships the real, working ingestion pipeline;
pointing it at a genuine expert group is Umesh's own action inside `sources/whatsapp_msg`'s own
UI (which group to track is that submodule's own governance, per this repo's CLAUDE.md), not
something this unit does or needs to wait for.

## Criteria (each machine-checkable)

1. **`packages/ingest/src/sources/whatsapp.ts`** (new) — the `whatsapp` `Source` adapter (the
   interface's own doc comment already named `whatsapp` as an intended adapter slot). `detect()`
   matches `{ kind: "whatsapp", groupJid, ownerUserId }` only. `fetch()` pulls real messages via
   an injected `WhatsAppFetcher` (no database access baked into the adapter — matches every other
   adapter's convention), writes a `SourceDoc` with `kind: "whatsapp-batch"` (already in the
   schema's enum) and `captureMode: "provided"` (a WhatsApp archiver only captures a sender the
   account owner explicitly selected for tracking — a deliberate act, not silent background
   capture, D-008). `toTurns()` maps each real message to one turn: `speakerRef` = the real
   internal `personId` (traceable back to who actually said it, same as an audio turn's `spk:N`),
   `tStart`/`tEnd` = seconds elapsed since the batch's first message (both equal — a chat message
   is a point in time). The web UI's existing `speakerRef`-based unit-label switch already
   renders this correctly as "s" with zero frontend change (only `"url"`/`"document"`
   `speakerRef`s get "chars").
2. **`apps/api/src/whatsapp-store.ts`** (new) — `fetchWhatsAppMessages` (real, read-only
   connection to `sources/whatsapp_msg`'s own, separate Mongo — confirmed live at
   `mongodb://127.0.0.1:27018`/`whatsapp_msg`, its own Docker container) and `listTrackableGroups`
   (real, live-queried, never hardcoded). `createMongoWhatsAppDeps()` composes the adapter with
   these real deps and persists a real `sources`+`sessions`+`turns` set on ingest, reusing the
   already-real `GET /sessions/:id` view (no second viewer built) — same shape `ingest-store.ts`
   already does for URLs.
3. **`apps/api/src/routes/whatsapp.ts`** (new) — `GET /whatsapp/groups` (real trackable-group
   list), `POST /whatsapp/ingest` (`{groupJid, ownerUserId}` → real ingest, 201 + real result; a
   real fetch/adapter failure is 502 with the real message, never a silent 500; a malformed body
   is 400). Both `requireScope("whatsapp")`. New `"whatsapp"` scope added to
   `scripts/seed-demo-server.mjs` and `apps/api/src/routes/pages.ts`'s `REAL_ROUTES`.
4. **No regression.** `pnpm --filter @lkb/ingest typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm -r test`, `pnpm lint:structure` all exit 0.
5. **Real unit-test coverage** (fixtures/fakes for HTTP-route tests, since the main app Mongo is
   real infra — see disclosed limitation below): `whatsapp.test.ts` (adapter, 6 tests) +
   `whatsapp.test.ts` (route, 6 tests).
6. **Real, live, end-to-end data verification** (not a fixture): a standalone script imports the
   actual shipped `whatsapp-store.ts` + `createWhatsAppSource` and runs the full real pipeline
   (`listTrackableGroups` → `fetch` → `toTurns`) against the real, currently-running
   `whatsapp_msg` Mongo — no mocks, the real database. See Real evidence below.

## Disclosed limitation (real, not hidden)

The project's own remote main Mongo host (`13.202.206.101:27017`) remained unreachable this
session (same outage disclosed in the prior `ask-web-fallback-tavily` unit — confirmed still
down via `ping`), so the full `apps/api` server could not be started and a real HTTP
`POST /whatsapp/ingest` round-trip (which needs the main Mongo for the API-key store and for
writing `sources`/`sessions`/`turns`) could not be exercised end-to-end through the live server.
What COULD be, and was, verified live: the entire real-data pipeline up to persistence —
`listTrackableGroups()`, `fetchWhatsAppMessages()`, and the full adapter (`fetch()` +
`toTurns()`) — all run against the real `whatsapp_msg` database, no mocks. Only the final
Mongo-insert step (already covered by unit tests with a fake, and byte-identical to the
already-shipped, checker-PASSed `ingest-store.ts` pattern for URLs) is unverified live, pending
the main Mongo host recovering.

## Real evidence

### Typecheck
```
$ cd packages/ingest && npx tsc --noEmit -p tsconfig.json    # exit 0
$ cd apps/api && npx tsc --noEmit -p tsconfig.json            # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ingest:      40/40 pass   (was 34, +6 whatsapp adapter tests)
packages/ask:         32/32 pass
packages/meeting-bot: 40/40 pass
apps/api:             65/65 pass   (was 59, +6 whatsapp route tests)
apps/web:             34/34 pass
Total: 299 tests, 299 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (200 file(s) within budget)
lint-dirsize: OK (73 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (233 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (974 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (231 modules, 668 dependencies cruised)
```

### Real, live, end-to-end run against the real `whatsapp_msg` database (no mocks)
```
$ npx tsx wa-verify-module.mjs   # imports the REAL shipped whatsapp-store.ts
listTrackableGroups(): [ { groupJid: '120363405936621456@g.us', ownerUserId:
  '6a8d0c692fcc75f0e911b878', subject: 'Millionaires', trackedPersonCount: 3 } ]
fetchWhatsAppMessages() returned 50 messages
first 3 (with resolved displayName): [
  { personId: '...2360', displayName: 'Navnit Chaubey Vidysea', text: 'Harshita jeb kaato',
    ts: '2026-08-25T09:43:21.000Z' },
  { personId: '...2361', displayName: 'Himanshu Tomar', text: 'helooe',
    ts: '2026-08-25T09:43:43.000Z' }, ... ]

$ npx tsx wa-verify-adapter.mjs  # imports the REAL createWhatsAppSource + real fetcher together
source: { _id: 'b610fd...', tenantId: 'toc', kind: 'whatsapp-batch', captureMode: 'provided',
  path: '120363405936621456@g.us', ownerUserId: '6a8d0c69...', ... }
toTurns() produced 50 real turns
first 3 turns: [
  { speakerRef: '...2360', tStart: 0, tEnd: 0, text: 'Harshita jeb kaato' },
  { speakerRef: '...2361', tStart: 22, tEnd: 22, text: 'helooe' },
  { speakerRef: '...2361', tStart: 24, tEnd: 24, text: 'eheloww' } ]
```
The `tStart` offsets (0, 22, 24 seconds) match the real message timestamps
(09:43:21, 09:43:43, 09:43:45) exactly.

### Main Mongo connectivity (why the full HTTP round-trip is deferred)
```
$ ping -n 2 13.202.206.101
Packets: Sent = 2, Received = 0, Lost = 2 (100% loss)
```

## How to verify (for the checker)
1. `pnpm --filter @lkb/ingest typecheck` and `pnpm --filter @lkb/api typecheck` — expect exit 0.
2. `pnpm -r test` — expect exit 0, 299/299.
3. `pnpm lint:structure` — expect exit 0.
4. Read `whatsapp.ts` (adapter), `whatsapp-store.ts`, `routes/whatsapp.ts` — confirm no
   fabricated data, confirm `captureMode` is always `"provided"` never inferred `"silent"`,
   confirm `toTurns()`'s offset math and `fetchWhatsAppMessages`'s deleted/media-only exclusion.
5. If `whatsapp_msg`'s Mongo (`127.0.0.1:27018`) is reachable in the checker's environment, an
   independent re-run of `wa-verify-module.mjs`-style code (import the real module, call it) is
   the strongest verification — real data, no mocks. If the main Mongo (`13.202.206.101`) has
   recovered by check time, a full live `curl -X POST http://localhost:3300/whatsapp/ingest` is a
   bonus, not required — the disclosed limitation above already explains why it couldn't be done
   at manifest time.
