# Verdict — web-app-shell-brain-calendar

Cycle checked: 1
Verdict: PASS

## Criterion-by-criterion
1. PASS — `apps/web` is a real Vite+React+TS SPA with `dev`/`build`/`test`/`typecheck` scripts.
   Own `tsconfig.json` does not extend root base. Confirmed independently below.
2. PASS — `apps/web/src/api/types.ts` is hand-mirrored, no `@lkb/core` import. `grep -rn "@lkb/"
   apps/web/src` finds only a *comment* mentioning `@lkb/core` (types.ts:3), zero real imports.
   depcruise JSON confirms 0 dependency edges from `apps/web` into `packages/`.
3. PASS — `pnpm --filter @lkb/web build` exit 0; real `dist/index.html`, `dist/assets/*.js`
   (367KB), `dist/assets/*.css` produced.
4. PASS — `packages/index/src/tree/flatten-graph.ts` read in full: pure function
   `flattenTreeToGraph(root: TreeIndexNode): Graph`, `walk()` only turns `level === "session"`
   nodes into graph nodes (tenant/year/month are only ever recursed through, never nodes),
   session-topic/session-org edges hardcode `inferred: false`, topic-cooccurrence edges (built
   from `sessionTopics` map, shared `sessionRefs`) hardcode `inferred: true`.
   `flatten-graph.test.ts` read in full — 6 tests exist; re-read the "two topics sharing a
   session" test and the "session-topic/session-org edges are real" test bodies, both assert
   exactly what the contract claims. `cd packages/index && npm test` → 25/25 pass (includes all
   6 new tests, confirmed by name in output).
5. PASS — `apps/api/src/routes/graph.ts`: `GET /graph` behind `requireScope("graph")`, takes
   injected `GraphReadDeps` (no `@lkb/db`/Mongo import in the route file — only `express` and
   `@lkb/index`'s `Graph` type). `store.ts`'s `createMongoGraphReadDeps` queries
   `tree_index.findOne({ node_id: \`tenant:${tenantId}\`, level: "tenant" })` — same node_id
   pattern as `createMongoTreeStore` (both share the `tenant:<id>` fix noted in a 2026-09-04
   comment) — and calls the real `flattenTreeToGraph`. `cd apps/api && npm test` → 37/37 pass,
   confirmed 3 new graph tests present and passing (200 real data, 403 wrong scope, 404 no tree).
6. PASS — `BrainPage.tsx` read in full: uses `ForceGraph2D` from `react-force-graph-2d` (the 2D
   package, not `-3d`). Session-node click calls the real `getSession(apiKey, id)` from
   `../api/sessions.js` — no mock in production code. Topic/org click derives `linkedIds` purely
   from `graph.edges` already in state, no fetch. `BrainPage.test.tsx` read in full: mocks
   `react-force-graph-2d` with a real DOM `<button>` stand-in exposing `graphData`/`onNodeClick`;
   the file's own top-of-file comment explicitly states "jsdom has no real 2D canvas context and
   pixel-accurate node hit-testing isn't something a component test should assert on" — matches
   the contract's stated reasoning. All 4 tests assert real behavior (loads real graph data,
   session click calls `getSession` and shows summary, topic click shows linked sessions via
   `getSessionSpy).not.toHaveBeenCalled()`, empty tree shows "No tree index built" message).
   `apps/web` Vitest run: 4/4 BrainPage tests pass.
7. PASS — `CalendarPage.tsx` read in full: "Past" section built from real `listSessions(apiKey)`,
   grouped by `date.slice(0,7)` month key, sorted ascending then `.reverse()`'d for
   most-recent-first display. "Upcoming" section (`<div className="card empty-note">`) is
   unconditionally rendered (no guard/conditional around it) with real explanatory text ("Real
   calendar sync ... aren't wired to a live data source yet"). Grepped the file — no fabricated
   event objects, no hardcoded fake dates beyond the honest-empty-state copy.
   `CalendarPage.test.tsx` read in full — 3 tests match: permanent empty state, month-grouping
   with most-recent-first, honest empty state for zero past sessions too. 3/3 pass in the Vitest
   run.
8. PASS — `apps/api/src/cors.ts` read in full: hand-rolled `createCors(allowedOrigins: string[])`
   middleware, sets `Access-Control-Allow-Origin` only when the request's `Origin` header is in
   the allowlist (never `*`), handles `OPTIONS` preflight with 204. `server.ts`:
   `app.use(createCors(deps.corsOrigins ?? []))` is the second line in `createServer`, right
   after `express.json()`, before all routers — early in the middleware chain, matching claim.
   `production.ts`: `corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map(s =>
   s.trim()).filter(Boolean)` — correct split/trim/filter, defaults to `[]` (empty = deny-all)
   when unset.
9. PASS — Live-verified independently on ports 3403/8081 (different from the maker's
   3400/8080, maker's `lkb-api-demo`/`lkb-web-demo` containers untouched). Both `docker build`
   commands exited 0. `curl http://localhost:8081/` → 200. `curl
   http://localhost:8081/sessions` (direct load, not client nav) → 200, proving
   `nginx.conf`'s `try_files $uri $uri/ /index.html` fallback actually fires, not just reads
   correctly in source. Ran `node scripts/seed-demo-server.mjs` fresh, minted a new key,
   `curl http://localhost:3403/graph -H "authorization: Bearer <fresh key>"` returned real
   non-empty `nodes`/`edges` JSON (23 real TOC sessions + topics + org, e.g. "Visa Blueprint
   Part 2", "The Outreach Collective (TOC)"). `curl -H "Origin: http://localhost:8081" -i
   http://localhost:3403/sessions ...` returned `Access-Control-Allow-Origin:
   http://localhost:8081` — CORS is real and actually fires cross-origin, not just present in
   source. Cleaned up `lkb-checker-api`/`lkb-checker-web` after verification.
10. PASS — `TASKS.md:52`: `| T-010 | in_progress | Product shell (\`apps/web\`, real Vite+React
    SPA) — un-deferred 2026-09-04 ... Phases 0-3 shipped in one unit
    (\`qa/contracts/web-app-shell-brain-calendar.md\`) ... Phase 4 (Settings/API-key CRUD)
    remains. |` — real, specific status change, referencing this unit's own contract.

## Full workspace test + lint re-run (independent)
- `pnpm -r test`: 240/240 pass, 0 fail. Confirmed per-package: core 7/7, index 25/25 (+6),
  ai 54/54, ingest 34/34, ask 30/30, meeting-bot 40/40, api 37/37 (+3), **web 13/13** (4 test
  files: CalendarPage 3, SessionsListPage 3, BrainPage 4, LoginGate 3) — matches manifest claim
  exactly.
- `pnpm lint:structure`: all sub-checks OK, `depcruise` "no dependency violations found (195
  modules, 541 dependencies cruised)".

## Issues found (if any)
None that affect this contract. Note (not a defect, disclosure only): the working tree also
carries unrelated uncommitted changes from a separate unit (`long-audio-chunking` —
`packages/ai/src/stt/chunk-audio.ts`, `gemini-file-upload.ts`, `scripts/transcribe-long-session.mjs`,
`qa/contracts/long-audio-chunking.md`, etc.) sitting alongside this unit's files in `git status`.
These are clearly a different work unit (different contract file, unrelated file paths) and not
part of this manifest's claimed scope — flagged for awareness, not a failure of this contract.
`.env.development` is correctly excluded from `git status` output (gitignored by `**/.env.*`);
`.env.example` correctly shows as trackable (allowlisted). No hardcoded secrets found in any new
file (Dockerfiles, nginx.conf, cors.ts, graph.ts/.test.ts, flatten-graph.ts).

## Real commands run + real output
```
$ pnpm -r test                     # exit 0, 240/240 (see per-package breakdown above)
$ pnpm lint:structure               # exit 0, depcruise clean, apps/web 0 edges into packages/
$ pnpm --filter @lkb/web build      # exit 0, dist/index.html + assets/*.js (367KB) + *.css
$ npx depcruise --config .dependency-cruiser.cjs apps/web --output-type json | ...
  edges from apps/web into packages/: 0
$ grep -rn "@lkb/" apps/web/src     # only a comment in types.ts, no real import
$ cd packages/index && npm test     # 25/25, all 6 flatten-graph tests present + passing
$ cd apps/api && npm test           # 37/37, all 3 graph route tests present + passing

$ docker build -f apps/api/Dockerfile -t lkb-api:checker-verify .      # exit 0
$ docker run -d --name lkb-checker-api -p 3403:3000 \
    -e MONGO_URL=mongodb://13.202.206.101:27017 -e MONGO_DB=lkb \
    -e GEMINI_API_KEY=AIzaSy... -e CORS_ORIGINS=http://localhost:8081 lkb-api:checker-verify
@lkb/api listening on :3000

$ docker build -f apps/web/Dockerfile -t lkb-web:checker-verify \
    --build-arg VITE_API_BASE_URL=http://localhost:3403 .              # exit 0
$ docker run -d --name lkb-checker-web -p 8081:80 lkb-web:checker-verify

$ curl -o /dev/null -w '%{http_code}' http://localhost:8081/           -> 200
$ curl -o /dev/null -w '%{http_code}' http://localhost:8081/sessions   -> 200 (SPA fallback, live)

$ node scripts/seed-demo-server.mjs
API key (save this, shown once): demo_2f510433e5cb9f824a51836befcf951707b345ddb7dff61b
tenantId: toc

$ curl http://localhost:3403/graph -H "authorization: Bearer demo_2f51..."
{"nodes":[{"id":"2026-04-21-visa-blueprint-part2-italy-france-nz","label":"Visa Blueprint Part 2:
Italy, France, New Zealand","kind":"session"}, ...], "edges":[...]}   # real, non-empty

$ curl -H "Origin: http://localhost:8081" -i http://localhost:3403/sessions \
    -H "authorization: Bearer demo_2f51..."
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:8081
Vary: Origin
...

$ docker rm -f lkb-checker-api lkb-checker-web    # cleanup done
$ docker ps -a --filter name=lkb-                 # only maker's lkb-api-demo/lkb-web-demo remain
```
