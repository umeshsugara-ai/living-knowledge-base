# Contract — brain-explorer-pages (UI visibility sprint, unit 1 of 2)

> Umesh asked where the other 5 feature areas' UI was, after only `/compete` had one. Two full
> designs were compared (fast server-rendered extension vs. a real `apps/web` SPA — the SPA's own
> honest estimate: ~3-5 weeks) and Umesh chose the hybrid path: ship fast pages now as a logged
> stopgap, `apps/web` stays a separate future unit. This is unit 1 of that stopgap — the 3
> READ-ONLY pages (Sessions, Dashboard, API Docs). Unit 2 (Ingest + Meeting Bot) is separate,
> higher-risk (a real write path), and out of scope here. Drafted by the maker; /checker adopts
> or amends on first check.

## Criteria (each machine-checkable)

1. **`packages/db/src/index.ts`** exports `packages/db/src/collections/gaps.ts` (it existed but
   was never re-exported — real gap found live). Verify: `import { gaps, listOpen } from
   "@lkb/db"` resolves; `pnpm --filter @lkb/db typecheck` green.
2. **`apps/api/src/routes/brain.ts`** (new) exports `createBrainRouter(deps: BrainReadDeps):
   Router` with a real `GET /sessions`, `GET /sessions/:id` (404 on unknown id), `GET /sources`,
   `GET /gaps`, each behind `requireScope(...)` matching its resource name. `BrainReadDeps` is
   injected (test fakes never touch Mongo). Verify: `brain.test.ts` — list/detail/404/403/200
   cases, all green.
3. **`apps/api/src/routes/stubs.ts`** — `/sources` and `/sessions` entries removed from
   `STUB_ROUTES` (real routes now exist in `brain.ts`); `STUB_ROUTES` is exported for the docs
   page to read. Verify: read the file; `server.test.ts`'s stub-route tests updated to target
   `/search` (still a real stub) instead of the now-real `/sources`, still green.
4. **`apps/api/src/store.ts`** exports `createMongoBrainReadDeps(): BrainReadDeps`, wrapping the
   real `@lkb/db` accessors (`sessions`, `sessionPages`, `claims`, `turns`, `sources`, `gaps`).
   Session detail joins `session_pages` (by `sessionId`), `claims` (by `evidence[].sessionId`),
   and `turns` (by `sessionId`) for one session. Verify: `pnpm --filter @lkb/api typecheck`
   green; wired into `apps/api/src/production.ts`'s `buildProductionDeps()`.
5. **`apps/api/src/routes/ui-shell.ts`** (new) — shared page chrome (`renderPage(opts)`,
   `CLIENT_AUTH_JS`) reusing `compete-page.ts`'s proven visual design, extracted so the 3 new
   pages don't each redeclare the same CSS. `compete-page.ts` itself is left untouched (already
   checker-PASSed, no refactor risk taken). Verify: read the file; grep confirms no `innerHTML`
   assignment from a variable anywhere in `ui-shell.ts` or `pages.ts` (only `textContent`/DOM
   methods for any server/LLM-derived value — flagged live by the repo's XSS guard on the first
   draft, which did use `innerHTML` string-concat for `clearChildren`-equivalent list clears).
6. **`apps/api/src/routes/pages.ts`** (new) — `createPagesRouter(): Router` serving `GET /`
   (index/nav), `GET /sessions-ui` (list, real 23 sessions), `GET /sessions-ui/:id` (detail:
   overview + claims + up to 200 turns, real data), `GET /dashboard-ui` (gaps, real — genuinely
   empty today, shown as an honest empty state, not fabricated rows), `GET /docs-ui` (renders
   directly from `stubs.ts`'s `STUB_ROUTES` + a hand-maintained `REAL_ROUTES` table — disclosed
   limitation: `REAL_ROUTES` is NOT auto-derived from route registration the way `STUB_ROUTES`
   is, so it could theoretically drift if a route's scope changes without updating this list;
   `STUB_ROUTES` — the higher-risk direction, a stub silently going stale-live — cannot drift).
   Every page mounted BEFORE `requireAuth` in `server.ts` (same reasoning as the `/compete` fix:
   a plain browser navigation carries no Authorization header). Verify: `pages.test.ts` — every
   page 200s with no auth header, docs page lists both a live and a stub route, no page's script
   assigns `innerHTML` from a variable.
7. **`apps/api/src/server.ts`** wires `brain: BrainReadDeps` into `ServerDeps`, mounts
   `createPagesRouter()` pre-auth and `createBrainRouter(deps.brain)` post-auth. Verify: read the
   file; full `apps/api` test suite green (33 tests, up from 18).
8. **Nav consistency.** `ui-shell.ts`'s nav only links to pages that exist today (Home, Sessions,
   Dashboard, API Docs, Compete) — no dead links to the not-yet-built Ingest/Meeting-Bot pages
   (those are unit 2, get their nav entries there).
9. **No regression.** `pnpm -r test` (whole workspace) and `pnpm lint:structure` (LOC/dir
   budgets, dependency-cruiser, `docs/SNAPSHOT.md` freshness) both exit 0.
10. **Real browser verification.** A real Playwright pass against the real running server
    (real Mongo, real seeded 23-session TOC data) confirms: `/sessions-ui` lists all 23 real
    sessions with real titles/dates; clicking one loads `/sessions-ui/:id` with a real summary
    and real transcript turns; `/dashboard-ui` shows the real (currently empty) gaps state;
    `/docs-ui` correctly separates live vs. stub routes.

## Non-goals (disclosed, not hidden)
- Ingest page (real write path — new adapter wiring, real risk) and Meeting Bot page (honest
  empty-state) are a SEPARATE unit, not built here.
- `apps/web` (the real SPA) is not started — `TASKS.md`'s T-010 stays exactly as `deferred, not
  near-term`, untouched by this unit.
- `topics`/`speakers`/`decisions` accessors (mentioned in the original plan sketch) were NOT
  built — no page in this unit consumes them; building an accessor nothing reads violates the
  "no premature abstraction" rule, so they're deferred until a page actually needs them.
- The session-detail page truncates the transcript display to the first 200 turns (a documented
  UI limit, not a data limit — the API itself returns every turn).
