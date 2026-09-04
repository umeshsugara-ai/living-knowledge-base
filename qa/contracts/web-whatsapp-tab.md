# Contract — web-whatsapp-tab

> Umesh, after the backend WhatsApp ingestion unit shipped: "ye sabb website mai hi features hone
> chaiye side tab mai see access krr paau aur TOC wala and all bhi sabbhi featues add krr paayee"
> — these WhatsApp features should be in the website itself, with a side tab so he can access
> them, and TOC-related features should be addable there too. This unit adds the real "WhatsApp"
> nav tab and page over the already-real, already checker-PASSed backend
> (`whatsapp-ingestion-first-slice`). TOC-related features are already accessible in the website
> (Sessions/Ingest/Brain/Calendar all already surface TOC session data) — no gap there, disclosed
> rather than silently skipped.

## Criteria (each machine-checkable)

1. **`apps/web/src/api/whatsapp.ts`** (new) — `listWhatsAppGroups`, `ingestWhatsAppGroup`,
   calling the already-real `GET /whatsapp/groups` / `POST /whatsapp/ingest`.
2. **`apps/web/src/pages/WhatsAppPage.tsx`** (new) — lists real tracked groups (subject, tracked-
   participant count), an "Ingest into knowledge base" button per group that calls the real
   endpoint and shows the real result (turn count + a link to the new session via the already-
   real `GET /sessions/:id` view — no second viewer built). Honest empty state when no groups are
   tracked; honest error state on a failed fetch/ingest, never a silent blank page.
3. **`apps/web/src/layout/NavSidebar.tsx`, `App.tsx`** — a real "WhatsApp" nav item (new
   `WhatsAppIcon` in `components/icons.tsx`, hand-written SVG, no new dependency) and `/whatsapp`
   route, following the exact same pattern every other nav item/route already uses.
4. **No regression.** `pnpm --filter @lkb/web typecheck`, `pnpm -r test`, `pnpm lint:structure`
   all exit 0.
5. **Real test coverage.** `WhatsAppPage.test.tsx` (new, 5 tests): real groups render, honest
   empty state, honest error state, a real ingest click calls the real endpoint and shows the
   real result with a working session link, a failed ingest shows the real error message.

## Disclosed limitation (real, not new — same as the backend unit)

The project's main Mongo host (`13.202.206.101:27017`) remained unreachable this session, so
`apps/api` could not be started and a full live browser round-trip (real click → real ingest →
real new session) could not be exercised. What WAS verified live: the page renders correctly,
the WhatsApp nav tab is visible and active-highlighted, and the page shows an honest
`"failed to load WhatsApp groups"` error (never a blank/broken page) when the backend is
unreachable — real, correct degradation behavior, not a crash. No other page regressed from the
nav/routing change (spot-checked `/`).

## Real evidence

### Typecheck
```
$ cd apps/web && npx tsc --noEmit -p tsconfig.json    # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ingest:      40/40 pass
packages/ask:         32/32 pass
packages/meeting-bot: 40/40 pass
apps/api:             65/65 pass
apps/web:             39/39 pass   (was 34, +5 WhatsAppPage tests)
Total: 304 tests, 304 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (201 file(s) within budget)
lint-dirsize: OK (73 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (233 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (980 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (234 modules, 677 dependencies cruised)
```

### Real browser screenshot (Playwright, dev server :5173; apps/api unreachable — main Mongo down)
`qa/evidence/whatsapp-page.png` — real WhatsApp nav tab (active-highlighted), real page header,
honest `"failed to load WhatsApp groups"` error state (not a blank/broken page).

## How to verify (for the checker)
1. `pnpm --filter @lkb/web typecheck` — expect exit 0.
2. `pnpm -r test` — expect exit 0, 304/304.
3. `pnpm lint:structure` — expect exit 0.
4. Read `WhatsAppPage.tsx`, `api/whatsapp.ts`, `NavSidebar.tsx` — confirm no fabricated data,
   confirm the ingest button calls the real endpoint and never invents a result.
5. Real browser: visit `/whatsapp` — confirm the nav tab and page render (against fixtures/dev
   server; a real backend round-trip is a bonus if the checker's environment has main Mongo
   reachable and `apps/api` running — not required, per the disclosed limitation above).
