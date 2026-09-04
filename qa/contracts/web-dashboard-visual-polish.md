# Contract — web-dashboard-visual-polish

> Umesh, after the app-shell/brain/calendar unit shipped, gave direct critical feedback (verbatim,
> Hinglish): "ui abhi bhi dashboard jaise nhi lgg rha hai... dashboard and all mai kuch nhi aa
> rha... they all really look very basic." Two concrete problems: (1) the Dashboard page's entire
> content was just the `Knowledge health` / gaps section — no stats, no overview, nothing that
> reads as a populated product; (2) the visual design (nav, cards) was plain text with no icons or
> visual hierarchy. Drafted by the maker; /checker adopts or amends on first check.

## Criteria (each machine-checkable)

1. **`apps/web/src/components/icons.tsx`** (new) — hand-written inline SVG icon set, no new npm
   dependency (matches the repo's existing pattern of avoiding premature dependencies, e.g. the
   hand-rolled CORS middleware instead of the `cors` package). One icon component per nav item
   (Dashboard/Sessions/Brain/Calendar/Sources/Ingest/Meeting Bot/Settings) plus stat-card icons
   (Sessions/Sources/Key/Gap) and two external-link icons (Compete/API Docs).
2. **`apps/web/src/components/StatCard.tsx`** (new) — reusable `{icon, label, value, tone}` card
   component, `tone ∈ {accent, good, warn}` mapped to real CSS classes in `styles.css`.
3. **`apps/web/src/pages/DashboardPage.tsx`** (rewritten) — fetches real counts from the
   already-real, already checker-PASSed routes (`GET /sessions`, `GET /sources`, `GET /keys`,
   `GET /gaps` — no new backend work) in parallel via `Promise.all`, renders 4 real `StatCard`s
   (Sessions count, Sources count, Active API keys count, Open gaps count with `warn`/`good` tone
   based on whether any gap is open), a "Recent sessions" list (top 5 by date, newest first,
   each linking to `/sessions/:id`), and the original "Knowledge health" gaps section retained
   below. Every number is real or an honest loading/error state — never a placeholder.
4. **`apps/web/src/layout/NavSidebar.tsx`** (updated) — every nav item and the two external links
   (Compete, API Docs) render with an icon from `icons.tsx` alongside the label.
5. **`apps/web/src/styles.css`** (updated) — new `.stat-grid`/`.stat-card`/`.stat-card-icon`/
   `.stat-card-value`/`.stat-card-label` classes (+ `.stat-card-accent`/`-good`/`-warn` tone
   variants) and nav-icon alignment rules (`.nav-sidebar a` flex layout, `.nav-divider`).
6. **`apps/web/src/pages/DashboardPage.test.tsx`** (new — this page had zero test coverage
   before) — real API mocking via `vi.spyOn`, covering: populated stat cards + newest-first
   recent-sessions ordering, honest empty-gaps state, and the real error message on a failed
   fetch (never a silent blank page).
7. **No regression.** `pnpm --filter @lkb/web typecheck`, `pnpm -r test` (whole workspace), and
   `pnpm lint:structure` all exit 0.
8. **Live verification.** Real browser screenshots (Playwright, against the already-running dev
   servers) of the redesigned Dashboard (`qa/evidence/dashboard-redesign.png`) showing real stat
   numbers, plus a functional re-check of Brain (`qa/evidence/brain-page-recheck.png`) and
   Calendar (`qa/evidence/calendar-page-recheck.png`) confirming no regression from the nav/CSS
   changes and that nav icons render correctly across pages.

## Real evidence

### Typecheck
```
$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — exit 0)
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ingest:      34/34 pass
packages/ask:         30/30 pass
packages/meeting-bot: 40/40 pass
apps/api:             48/48 pass
apps/web:             28/28 pass   (+3 new DashboardPage tests)
Total: 268 tests, 268 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (183 file(s) within budget)
lint-dirsize: OK (71 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (218 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (913 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (113 lines, budget 200)
✔ no dependency violations found (212 modules, 600 dependencies cruised)
```

### Real browser screenshots (Playwright, dev servers already running :5173/:3300)
- `qa/evidence/dashboard-redesign.png` — real stat cards (25 Sessions, 25 Sources, 1 Active API
  key, 0 Open gaps), real recent-sessions list (real ingested URLs + real TOC sessions, newest
  first), nav icons rendered, retained gaps section below.
- `qa/evidence/brain-page-recheck.png` — Brain graph view still renders correctly (force-directed
  graph, real session/topic clusters) with the new nav icons, confirming no regression.
- `qa/evidence/calendar-page-recheck.png` — Calendar page still renders correctly (past sessions
  grouped by month, honest upcoming-empty-state) with the new nav icons, confirming no regression.

## How to verify (for the checker)
1. `pnpm --filter @lkb/web typecheck` — expect exit 0.
2. `pnpm -r test` from repo root — expect exit 0, 268/268 (apps/web 28/28 including 3 new
   DashboardPage tests).
3. `pnpm lint:structure` — expect exit 0.
4. Read `apps/web/src/components/icons.tsx`, `StatCard.tsx`, `pages/DashboardPage.tsx`,
   `layout/NavSidebar.tsx`, `styles.css` — confirm no new npm dependency was added for icons
   (check `apps/web/package.json` diff), confirm `DashboardPage` calls the four existing routes
   in parallel and never fabricates a number.
5. Real browser: visit `/`, confirm stat cards show real counts matching a fresh `GET /sessions`,
   `GET /sources`, `GET /keys`, `GET /gaps` call; visit `/brain` and `/calendar`, confirm nav
   icons render and no visual/functional regression from the CSS changes.
