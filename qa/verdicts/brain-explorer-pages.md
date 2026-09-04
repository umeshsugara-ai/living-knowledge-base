# Verdict — brain-explorer-pages

Cycle checked: 1
Verdict: PASS

## Criterion-by-criterion
1. `pnpm -r test` fresh run — exit 0. apps/api: 33/33 pass (confirmed 0 fail across two independent runs). Workspace total: 217/217 pass (7+19+54+34+30+40+33). — PASS
2. `pnpm lint:structure` fresh run — exit 0. lint-loc/dirsize/root/dupes/migrations all OK, `docs/SNAPSHOT.md` matches fresh regeneration (112 lines), dependency-cruiser: "no dependency violations found (163 modules, 465 dependencies cruised)". — PASS
3. Read `packages/db/src/index.ts` — line 12: `export * from "./collections/gaps.js";` present. — PASS
4. Read `apps/api/src/routes/stubs.ts` — `STUB_ROUTES` (exported, `StubRoute` exported) now lists only `/search`, `/citations/:claimId`, `/webhooks/register`; `/sources` and `/sessions` removed. — PASS
5. Read `apps/api/src/routes/brain.ts` in full — `createBrainRouter(deps: BrainReadDeps)` implements `GET /sessions`, `GET /sessions/:id` (real 404 branch when `getSessionDetail` returns null), `GET /sources`, `GET /gaps`, each wrapped in `requireScope("sessions"|"sources"|"gaps")` matching its resource. Only imports types from `@lkb/core` and `../auth.js` — no direct `@lkb/db` import in the route file; `BrainReadDeps` is a plain injected interface. — PASS
6. Read `apps/api/src/store.ts`'s `createMongoBrainReadDeps` — wraps real `@lkb/db` accessors (`sessionsColl`, `sourcesColl`, `gapsColl`, `claimsColl`, `turnsColl`, `sessionPagesColl`). Session detail (`getSessionDetail`) does a real join: `sessionPagesColl(tenantId).findOne({sessionId})`, `claimsColl(tenantId).find({"evidence.sessionId": sessionId})`, `turnsColl(tenantId).find({sessionId})`, returned together with the session doc — not a bare passthrough. — PASS
7. Read `apps/api/src/routes/ui-shell.ts` and `pages.ts` in full.
   (a) `git diff apps/api/src/routes/compete-page.ts` DOES show a large diff — but cross-checked against `qa/manifests/live-demo-server.md` (item 7) and `qa/verdicts/live-demo-server.md` (already checker-PASSed, separate unit): that rewrite belongs to the already-PASSed `live-demo-server` unit, not to this one. Nothing in this unit's own diff set (`ui-shell.ts`, `pages.ts`, `brain.ts`, `store.ts`, `stubs.ts`, `server.ts`, `production.ts`, `fixtures.ts`, `packages/db/src/index.ts`) touches `compete-page.ts`. Untouched by *this* unit — PASS.
   (b) Grepped both files for `innerHTML` — zero hits in `ui-shell.ts`; one hit in `pages.ts` at line 7, which is a comment ("never `innerHTML` with server/LLM-derived text"), not an assignment. `clearChildren` (DOM-method based, no innerHTML) is defined in `ui-shell.ts`'s `CLIENT_AUTH_JS` and used correctly in `pages.ts`. Zero direct `X.innerHTML = <variable>` assignments anywhere. — PASS
   (c) `pages.ts` line 12 imports `STUB_ROUTES` from `./stubs.js` and uses it at line 252 (`STUB_ROUTES.map(...)`) to render the `/docs-ui` stub table — not a hand-copied list. — PASS
8. Read `apps/api/src/server.ts` — `brain: BrainReadDeps` is in `ServerDeps` (line 23); `createPagesRouter()` mounted at line 36, `requireAuth` at line 37 (pages before auth); `createBrainRouter(deps.brain)` mounted at line 41, after `requireAuth` (behind auth). Read `apps/api/src/production.ts` — `createMongoBrainReadDeps()` imported and wired into `buildProductionDeps()`'s returned object (`brain: createMongoBrainReadDeps()`, line 36). — PASS
9. `ui-shell.ts`'s `NAV_ITEMS` (lines 60-66) links only to `/`, `/sessions-ui`, `/dashboard-ui`, `/docs-ui`, `/compete` — exactly 5 items, no `/ingest-ui` or `/meeting-bot-ui`. — PASS
10. Live-fire test against a fresh, independently-started server instance (port 3402, separate from the maker's :3300 instance, same real Mongo/`.env` credentials):
    - `GET /` → 200, `GET /sessions-ui` → 200, `GET /dashboard-ui` → 200, `GET /docs-ui` → 200, all with NO Authorization header.
    - Minted a fresh key via `node scripts/seed-demo-server.mjs` (`demo_d75095f5...`).
    - `GET /sessions` with that key → 23 real sessions (verified count programmatically).
    - `GET /sessions/<real id>` → real joined detail: `session: true, claims: 6, turns: 107, page: true`. `GET /sessions/does-not-exist-xyz` → 404.
    - `GET /gaps` with that key → `200 {"gaps":[]}` — real empty array, never 501.
    - `GET /docs-ui` HTML: contains both "live" (8 occurrences) and "501 not_implemented" (3 occurrences) labels; grepped for the literal broken string `Bearer <key>` — zero matches; description reads "Authorization: Bearer header with your API key..." — the HTML-tag-eating bug is genuinely fixed.
    - Killed only my own server process (PID 20832 on :3402); the maker's :3300 instance was left untouched.
    — PASS

## Issues found (if any)
None. One thing worth flagging for awareness, not a defect: the working tree currently has uncommitted changes from at least 3 different units mixed together (`brain-explorer-pages`, the already-PASSed `live-demo-server`, and what looks like in-flight `long-audio-chunking` work under `packages/ai/src/stt/`). This made criterion 7(a)'s `compete-page.ts` diff look alarming at first glance until cross-referenced against `qa/verdicts/live-demo-server.md`, which had already independently PASSed that specific rewrite. Recommend committing/landing units before starting the next one to avoid this ambiguity in future checks — but it did not affect this unit's correctness.

## Real commands run + real output
```
$ pnpm -r test   (fresh run)
apps/api test: ℹ tests 33 / pass 33 / fail 0
Total across workspace: 7+19+54+34+30+40+33 = 217, all pass. Exit 0.

$ pnpm lint:structure   (fresh run)
lint-loc: OK (160 file(s) within budget)
lint-dirsize: OK (63 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (214 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (798 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (112 lines, budget 200)
✔ no dependency violations found (163 modules, 465 dependencies cruised)

$ MONGO_URL=... MONGO_DB=lkb GEMINI_API_KEY=[redacted] PORT=3402 npx tsx apps/api/src/index.ts &
@lkb/api listening on :3402

$ node scripts/seed-demo-server.mjs
loaded 23 sessions, 23 session_pages for tenant "toc"
wrote tree_index root "tenant:toc" (1 year node(s))
API key (save this, shown once): demo_d75095f5ae7c04c5f3c7092cd980cb6cc7f6a94494617729

$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/            -> 200
$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/sessions-ui -> 200
$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/dashboard-ui -> 200
$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/docs-ui     -> 200
$ curl http://localhost:3402/sessions -H "authorization: Bearer $KEY"   -> count: 23
$ curl http://localhost:3402/sessions/2026-04-21-visa-blueprint-part2-italy-france-nz -H "authorization: Bearer $KEY"
  -> has session: true claims: 6 turns: 107 page: true
$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/sessions/does-not-exist-xyz -H "authorization: Bearer $KEY" -> 404
$ curl -o /dev/null -w '%{http_code}' http://localhost:3402/gaps -H "authorization: Bearer $KEY" -> 200
$ curl http://localhost:3402/gaps -H "authorization: Bearer $KEY" -> {"gaps":[]}
$ grep -o "Bearer <key>" /tmp/docs-ui.html -> (no match)
$ grep -c "live" /tmp/docs-ui.html -> 8
$ grep -c "501 not_implemented" /tmp/docs-ui.html -> 3

$ taskkill /F /PID 20832 -> SUCCESS (my own server on :3402 only; :3300 untouched)

$ grep -n "T-010" TASKS.md -> "deferred, not near-term per Umesh" (untouched)
$ ls apps/ -> api/  (no apps/web)

$ git diff apps/api/src/fixtures.ts apps/api/src/server.test.ts apps/api/src/production.ts
  apps/api/src/routes/stubs.ts apps/api/src/server.ts packages/db/src/index.ts
  -> all diffs match manifest's "What changed" list exactly, nothing undisclosed.
```
