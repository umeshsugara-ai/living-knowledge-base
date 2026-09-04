# Contract — web-sessions-calendar-brain-richness

> Umesh, in one message (2026-09-04): (1) "session wala bhut rough hai non informative" — the
> Sessions page needed real visual/informational richness; (2) "konsa meeting and all aana
> chahiye and atleast give it access to my mail" — wants real upcoming meetings surfaced, backed
> by his GWS credentials; (3) (mid-turn) "brain ko bhi obsidian ki tarah dikhao taaki wahi se
> content access kar paaye" — wants the Brain graph view to work like Obsidian's graph: click a
> node, read its actual content right there, every link itself clickable. Drafted by the maker;
> /checker adopts or amends on first check.
>
> **Scope note on the Gmail half of ask (2):** Umesh's own follow-up answer described a
> multi-step approval/auto-trust workflow ("gmail meeting but i will approve first... after 2-3
> times auto confirmed") that is materially larger (new collections, an approval endpoint, a
> trust-threshold rule) than this unit's Calendar-only scope. This contract covers ONLY the
> Calendar half (real upcoming meetings, read-only, via `gws calendar`); the Gmail
> approval/auto-trust workflow is a separate, disclosed follow-up unit, not silently dropped.

## Real credential source found and used (disclosed, not new)

`gws` (the Google Workspace CLI already used by the `doc-polisher` skill for Docs) is already
OAuth'd as `umeshsugara@vidysea.com` with `calendar.readonly` and `gmail.readonly` among its
granted scopes (confirmed live via `gws auth status`). No new Google Cloud project or OAuth flow
was created — this unit reuses that existing, already-working credential.

## Criteria (each machine-checkable)

1. **`apps/api/src/gws-calendar.ts`** (new) — `listUpcomingGwsMeetings(windowDays)`: shells out to
   `gws calendar events list` via `cmd /c` (same wrapping pattern as `doc-polisher`'s
   `gws_doc_polisher.py`'s `run_gws()`), parses the JSON stdout past `gws`'s own diagnostic
   prefix line, filters to events with a real joinable video-conference link (`hangoutLink` or a
   `conferenceData` video entry point). Returns `[]` (never throws) on any failure — `gws`
   missing, not authenticated, network error, malformed output — so the Calendar page always
   renders an honest state instead of a 500.
2. **`apps/api/src/routes/calendar.ts`** (new) — `GET /calendar/upcoming`, `requireScope
   ("calendar")`, injected `CalendarReadDeps`. Wired into `server.ts`/`production.ts`
   (`createGwsCalendarReadDeps`)/`fixtures.ts` (`fakeCalendarReadDeps`), same DI pattern as
   `graph.ts`/`brain.ts`. New `"calendar"` scope added to `scripts/seed-demo-server.mjs` and
   `apps/api/src/routes/pages.ts`'s `REAL_ROUTES` (API docs page; `/graph` was also missing from
   that list and is added too, a real disclosed gap-fix while touching the same array).
3. **`apps/web/src/pages/CalendarPage.tsx`** — the "Upcoming" section now fetches
   `GET /calendar/upcoming` and renders real meetings (title, formatted local time range,
   organizer, a real "Join" link to the meeting URL) instead of the previous permanent
   honest-empty-state copy. A failed/empty fetch still degrades honestly (own error state,
   never blocks the independent "Past" sessions section).
4. **`apps/web/src/pages/sessions/SessionsListPage.tsx`** — rewritten from a plain text row list
   to a real card grid (`.session-grid`/`.session-card`): an icon per session, title, date/org/
   participant-count meta line, and real colored transcribe/index status badges (reusing the
   existing `.badge-good`/`-warn`/`-bad` classes) — no fabricated data, every field already came
   from the existing `GET /sessions` response.
5. **`apps/web/src/pages/BrainPage.tsx`** — Obsidian-style drill-down: the content side panel is
   now ALWAYS visible (a "click a node" placeholder before any click, not hidden until one),
   clicking a session node shows its real summary + up to 8 real claim texts (not just a count) +
   turn count + a "View full session →" link, and every linked session inside a topic/org panel
   is itself a clickable element that opens that session's content (not plain text) — so a
   topic/org node is a real entry point into content, never a dead end.
6. **Real bug found and fixed while building criterion 5 (disclosed, not hidden):** the graph
   canvas and the newly-always-visible side panel raced on layout — the graph flex item's default
   `min-width: auto` blocked it from shrinking below its rendered canvas width, crushing the side
   panel to ~33px (confirmed via `getBoundingClientRect` in a live browser: panel width 32.8px
   against and intended 320px). Fixed by measuring the graph container with a `ResizeObserver`
   and passing explicit `width`/`height` to `ForceGraph2D` instead of relying on the library's own
   internal auto-sizing, which raced the same way. `apps/web/src/setupTests.ts` gets a
   `ResizeObserver` polyfill (jsdom has none; every real browser does) so the existing test suite
   keeps exercising real component behavior instead of skipping this code path.
7. **No regression.** `pnpm --filter @lkb/web typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm -r test` (whole workspace), and `pnpm lint:structure` all exit 0.
8. **Live verification.** Real browser screenshots + a real authenticated `curl` against
   `GET /calendar/upcoming` proving real Google Calendar events come back (not fixtures), plus a
   before/after screenshot pair proving the Brain-page layout bug (criterion 6) is fixed.

## Disclosed limitation (not a defect, a scope boundary)

`gws-calendar.ts` only works on a machine with the `gws` CLI + its OAuth keyring configured
(Umesh's own machine today) — not yet portable to a hosted multi-tenant deployment, and it reads
one calendar ("primary", Umesh's own), not a per-tenant mapping. Same category of disclosed
single-operator limitation as the rest of this repo's local-first stage.

## Real evidence

### Typecheck
```
$ cd apps/web && npx tsc --noEmit -p tsconfig.json    # exit 0, no output
$ cd apps/api && npx tsc --noEmit -p tsconfig.json    # exit 0, no output
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
apps/api:             51/51 pass   (includes 3 new calendar route tests, was 48 before this unit)
apps/web:             32/32 pass   (includes 4 new/updated CalendarPage tests, 1 new
                                     SessionsListPage badges test, 1 new BrainPage linked-session
                                     drill-down test — was 25 before this unit)
Total: 275 tests, 275 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (187 file(s) within budget)
lint-dirsize: OK (71 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (218 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (940 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (113 lines, budget 200)
✔ no dependency violations found (216 modules, 618 dependencies cruised)
```

### Real end-to-end Calendar integration (live dev server, real `gws` call, real Google Calendar)
```
$ curl http://localhost:3300/calendar/upcoming -H "Authorization: Bearer <demo key>"
{"meetings":[{"id":"velco24c97ka3to9j3fmmctiu7_20260907T113000Z","title":"Tech Team - Weekly
Review Meeting","startTime":"2026-09-07T17:00:00+05:30", ... "meetingUrl":
"https://meet.google.com/umn-cwkx-opy","organizer":"manish.k@vidysea.com"}, ...8 real events...]}
```
`qa/evidence/calendar-real-meetings.png` — the same real meetings rendered in the Calendar page's
Upcoming section, with working "Join" links.

### Real browser screenshots (Playwright, dev servers :5173/:3300)
- `qa/evidence/sessions-redesign.png` — real card-grid Sessions page, 25 real sessions, icons,
  real transcribe/index status badges.
- `qa/evidence/brain-obsidian-before-fix.png` — the layout bug live (side panel invisible,
  crushed to ~33px, graph filling the whole card).
- `qa/evidence/brain-obsidian-after-fix.png` — the same page after the `ResizeObserver`/explicit-
  size fix, side panel correctly visible with its placeholder text.
- `qa/evidence/calendar-real-meetings.png` — real upcoming meetings list.

## How to verify (for the checker)
1. `pnpm --filter @lkb/web typecheck` and `pnpm --filter @lkb/api typecheck` — expect exit 0 both.
2. `pnpm -r test` — expect exit 0, 275/275.
3. `pnpm lint:structure` — expect exit 0.
4. Read `apps/api/src/gws-calendar.ts`, `routes/calendar.ts`, `apps/web/src/pages/CalendarPage.tsx`,
   `SessionsListPage.tsx`, `BrainPage.tsx` — confirm each matches this manifest's description; in
   particular confirm `gws-calendar.ts` never throws out of `listUpcomingGwsMeetings` (all paths
   return an array).
5. Real browser: visit `/sessions` — confirm the card grid with real status badges; visit
   `/calendar` — confirm real upcoming meetings (or an honest empty/error state if `gws` isn't
   reachable from the checker's environment — acceptable, since the adapter is disclosed as
   machine-local); visit `/brain`, confirm the side panel is visible before any click and after
   clicking `getByRole('button')`-style within the test suite (canvas pixel-clicking in a live
   browser is not reliably automatable for a physics-simulated graph — rely on
   `BrainPage.test.tsx`'s 5 passing tests for the drill-down logic itself, not a live click).
