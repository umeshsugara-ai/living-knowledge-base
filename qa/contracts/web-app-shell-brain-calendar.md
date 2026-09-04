# Contract — web-app-shell-brain-calendar (plan §8b, phases 0-3 combined)

> Umesh saw the fast pages and said it still doesn't look like a professional product — asked
> for a real sidebar+navbar app, a dashboard, an "Obsidian-kinda" brain/graph view with
> drill-down, and a calendar of upcoming/past events. This un-defers `apps/web` (T-010, was
> "deferred, not near-term"). Two rounds of grounding research (real code reads + real Mongo
> queries) fixed what's honestly buildable before design: `tree_index` is the only real
> relational data (session↔topic/org membership); `graph_edges`/`topics`/`speakers`/`decisions`
# are schema-only with zero real rows; past events are solid (23 real sessions); upcoming
> events have no real data source today. Given the scope and urgency, phases 0-3 of the planned
> phased build (§8b) shipped together in one unit rather than four separate ones. Drafted by the
> maker; /checker adopts or amends on first check.

## Criteria (each machine-checkable)

1. **`apps/web`** (new workspace package) — Vite + React + TypeScript SPA. `package.json`
   declares `dev`/`build`/`test`/`typecheck` scripts. Imports **zero** `packages/*` (verify via
   `depcruise` — `apps/web` should show no dependency edges into `packages/`). Own
   `tsconfig.json` (DOM lib, JSX, bundler resolution — does NOT extend root `tsconfig.base.json`,
   which assumes a Node runtime). `pnpm --filter @lkb/web typecheck` and
   `pnpm --filter @lkb/web build` both exit 0 on a real run.
2. **App shell** — `AppShell.tsx` + `NavSidebar.tsx`: persistent left sidebar (not the fast
   pages' top pill-nav), links to Dashboard/Sessions/Brain/Calendar/Sources (real, internal,
   client-side routed) plus Compete/API Docs (external links to `apps/api`'s existing
   `/compete`/`/docs-ui`, using `VITE_API_BASE_URL` so they resolve correctly when the two apps
   run on different origins). `AuthProvider`/`LoginGate`: pastes an API key once, stores in
   `localStorage`, gates all children until set — same real auth mechanism the fast pages use,
   React-ified.
3. **Sessions, Dashboard, Sources pages** — real data via the already-real, already checker-
   PASSed `GET /sessions`, `GET /sessions/:id`, `GET /gaps`, `GET /sources` (no new backend work
   needed for these three). Verify: real browser screenshots (`qa/evidence/spa-sessions.png`,
   `spa-dashboard2.png`) show real session titles/dates and a real gaps empty state; `Sources`
   page (verified via accessibility snapshot) lists all 23 real source documents with real paths.
4. **`GET /graph`** (new, `apps/api/src/routes/graph.ts` + `packages/index/src/tree/
   flatten-graph.ts` + `createMongoGraphReadDeps` in `store.ts`) — flattens the real `tree_index`
   into `{nodes, edges}`. Node kinds: `session`/`topic`/`org` only (`tenant`/`year`/`month`
   excluded as visual noise, per design doc in the module comment). Edge kinds: `session-topic`/
   `session-org` (real, `inferred: false`) and `topic-cooccurrence` (derived from shared
   `sessionRefs`, `inferred: true`, disclosed on the wire, not just in docs). New `"graph"` API
   scope. Verify: `packages/index/src/tree/flatten-graph.test.ts` (6 pure-function tests) +
   `apps/api/src/routes/graph.test.ts` (3 route tests: 200 real data, 403 wrong scope, 404 no
   tree) all green.
5. **Brain page** (`BrainPage.tsx`) — renders the real graph via `react-force-graph-2d` (2D
   canvas, not 3D/WebGL). Clicking a session node fetches the already-real `GET /sessions/:id`
   and shows it in a side panel (no data duplicated in the graph payload). Clicking a topic/org
   node shows its linked sessions, derived client-side from the edges already in the graph
   response (no extra fetch). Verify: `BrainPage.test.tsx` (4 tests, `react-force-graph-2d`
   mocked with a real DOM stand-in exposing the exact `graphData`/`onNodeClick` prop contract —
   canvas pixel-coordinate clicking is not a meaningful thing to assert on, so the test proves
   the component's own drill-down LOGIC instead) + a real browser screenshot
   (`qa/evidence/spa-brain-graph.png`) showing an actual rendered force-directed graph against
   real seeded data (visible session/topic clusters, visible dashed co-occurrence edges).
6. **Calendar page** (`CalendarPage.tsx`) — "Past" section: real 23 sessions grouped by month
   (`sessions.date`), most recent month first, each entry linking to its session detail. No
   calendar-grid library used (reasoning in the file's module doc: 23 entries across ~4 months is
   too sparse for a grid to be a better UX than a list). "Upcoming" section: a real, PERMANENT
   empty state (not conditionally hidden) with an honest explanation of why it's empty (no real
   calendar-sync or gap-due-date data source exists yet) — never fabricated entries. Verify:
   `CalendarPage.test.tsx` (3 tests) + a real browser screenshot (`qa/evidence/spa-calendar.png`).
7. **CORS** (`apps/api/src/cors.ts`, new, hand-rolled — no `cors` npm dependency added, the real
   requirement is narrow enough that a few lines of middleware cover it exactly) wired into
   `server.ts` via `deps.corsOrigins` (defaults to an empty list — safe by default, no origin
   works until explicitly allowlisted) and `production.ts` (`CORS_ORIGINS` env var). Verify: a
   real cross-origin browser session (SPA on `:8080`, API on a different container `:3400`)
   loads real data with zero CORS errors in the console (`qa/evidence/spa-docker-brain.png`).
8. **Docker packaging** — `apps/web/Dockerfile` (multi-stage: full-workspace build stage running
   `vite build`, then a minimal `nginx:1.27-alpine` runtime stage serving only the static
   `dist/`) + `apps/web/nginx.conf` (SPA fallback: `try_files $uri $uri/ /index.html`, so a direct
   load or refresh on a client-side route like `/sessions` doesn't 404 against nginx's default
   static-only behavior — real bug found and fixed live). Verify: `docker build` exits 0, the
   built container serves 200 on `/` AND on a direct load of `/sessions` (not just via
   client-side navigation), and (criterion 7) works cross-origin against the real
   `apps/api` container.
9. **No regression.** `pnpm -r test` (whole workspace, now including `apps/web`'s Vitest suite)
   and `pnpm lint:structure` both exit 0.
10. **`TASKS.md`'s T-010** gets updated to reflect it is now in progress, not "deferred, not
    near-term" — a real, disclosed status change (part of this unit's own manifest/commit, not a
    silent edit made elsewhere).

## Real bugs found and fixed during this unit (disclosed, not hidden)

1. **`VITE_API_BASE_URL` unset in dev** — the SPA's fetch client defaulted to same-origin (`""`),
   so every API call in dev mode hit the Vite dev server itself (5173) instead of `apps/api`
   (3300), failing with a generic "failed to load" message. Fixed via `apps/web/.env.development`
   (gitignored, like every other `.env.*` in this repo) + `apps/web/.env.example` for onboarding.
2. **`.dependency-cruiser.cjs`'s resolver never knew `.tsx` existed** — `enhancedResolveOptions.
   extensions` was `[".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]`, missing `.tsx`,
   because `apps/web` is the first `.tsx`-containing package in the monorepo. Every internal
   `apps/web` import (written with a `.js` extension per convention, pointing at a real `.tsx`
   file) showed as `no-unresolvable-workspace-import` even though nothing was actually broken.
   Fixed by adding `.tsx` to the extensions list.
3. **nginx served no SPA fallback** — the first Docker build/run of `apps/web` returned 200 on
   `/` but would have 404'd on a direct load or refresh of any client-side route (`/sessions`,
   `/brain`, etc.) since nginx's default config only serves literal static files. Fixed via
   `nginx.conf`'s `try_files ... /index.html`; verified with a real direct-load curl to `/sessions`
   against the built container (200, not 404).
4. **First draft of `fakeGraphReadDeps` was a broken placeholder** (`as never`/`as unknown as`
   casts instead of a real fake) — caught during self-review before it ever ran; replaced with a
   real in-memory fake matching `GraphReadDeps`'s actual shape.

## Real evidence

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass   (+6 flatten-graph tests)
packages/ai:          54/54 pass
packages/ingest:       34/34 pass
packages/ask:          30/30 pass
packages/meeting-bot:  40/40 pass
apps/api:              37/37 pass  (+3 graph route tests, was 34)
apps/web:              13/13 pass  (new package: CalendarPage, SessionsListPage, BrainPage, LoginGate)
Total: 240 tests, 240 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (175 file(s) within budget)
lint-dirsize: OK (70 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (218 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (863 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (113 lines, budget 200)
✔ no dependency violations found (195 modules, 541 dependencies cruised)
```

### Real Docker build + run, both apps, cross-origin
```
$ docker build -f apps/api/Dockerfile -t lkb-api:demo .          # exit 0
$ docker run -d --name lkb-api-demo -p 3400:3000 ... -e CORS_ORIGINS=http://localhost:8080 lkb-api:demo
@lkb/api listening on :3000

$ docker build -f apps/web/Dockerfile -t lkb-web:demo --build-arg VITE_API_BASE_URL=http://localhost:3400 .   # exit 0
$ docker run -d --name lkb-web-demo -p 8080:80 lkb-web:demo
$ curl -o /dev/null -w '%{http_code}' http://localhost:8080/            -> 200
$ curl -o /dev/null -w '%{http_code}' http://localhost:8080/sessions    -> 200  (SPA fallback works)
```

### Real browser screenshots (Playwright)
- `qa/evidence/spa-dashboard2.png` — real dashboard, real empty-gaps state, dev server (:5173/:3300).
- `qa/evidence/spa-sessions.png` — real 23-session list.
- `qa/evidence/spa-brain-graph.png` — real force-directed graph, session/topic clusters visible.
- `qa/evidence/spa-calendar.png` — real month-grouped past events + honest upcoming empty state.
- `qa/evidence/spa-docker-brain.png` — the SAME brain graph, fully containerized (SPA on :8080,
  API on :3400, real cross-origin CORS, zero console errors), proving the whole stack works
  end-to-end in the production-shaped deployment, not just dev mode.

## How to verify (for the checker)
1. `pnpm -r test` from repo root — expect exit 0, 240/240 (apps/web's 13 new, apps/api's 3 new
   graph tests, packages/index's 6 new flatten-graph tests).
2. `pnpm lint:structure` — expect exit 0, dependency-cruiser confirms `apps/web` imports zero
   `packages/*`.
3. `pnpm --filter @lkb/web build` — expect exit 0, a real `dist/` output.
4. Read `packages/index/src/tree/flatten-graph.ts`, `apps/api/src/routes/graph.ts`,
   `apps/api/src/cors.ts`, `apps/web/src/pages/BrainPage.tsx`, `CalendarPage.tsx` — confirm each
   matches this manifest's description (node/edge kinds, `inferred` flag, CORS default-deny,
   drill-down logic, honest empty states).
5. Build and run both Docker images with real env vars (`MONGO_URL`/`MONGO_DB=lkb`/
   `GEMINI_API_KEY` from `.env`, `CORS_ORIGINS` on the API pointing at the web container's
   origin, `VITE_API_BASE_URL` build-arg on the web image pointing at the API container) — real
   `curl`/browser check that `/`, `/sessions`, `/brain`, `/calendar`, `/sources` all load real
   data cross-origin with zero CORS errors, and that a DIRECT load of `/sessions` (not via
   client-side nav) returns 200, not a 404.
6. Confirm `TASKS.md`'s T-010 entry now reflects "in progress" (real change, part of this unit).
