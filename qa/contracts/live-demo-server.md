# Contract — live-demo-server (T-009/T-012 follow-up: make the running product actually reachable)

> Umesh asked to see the product running live in a browser, as it would look heading into
> production, with Docker as an option for packaging. This unit does NOT add new product
> features — `apps/api`'s server, `/ask`, and `/compete` already existed (T-009/T-012). It fixes
> the real bugs that made the ALREADY-BUILT server unreachable/broken when actually run for the
> first time against real seeded data, upgrades `/compete`'s page from a bare unstyled form into
> something presentable, and adds real Docker packaging. Drafted by the maker; /checker adopts or
> amends on first check.

## Criteria (each machine-checkable)

1. **`apps/api/src/store.ts`** `createMongoTreeStore().load(tenantId)` queries
   `node_id: \`tenant:${tenantId}\`` (matching `packages/index/src/tree/build.ts`'s actual root
   node_id), not the bare `tenantId` the code queried before. Verify: read the file, confirm the
   query object; `pnpm --filter @lkb/api test` still green.
2. **`apps/api/src/server.ts`** mounts `createCompetePageRouter()` BEFORE `requireAuth`, so a
   plain browser GET `/compete` (no Authorization header) returns 200 with the HTML page, not a
   401. Every other route (`/ask`, `/compete/start`, `/compete/:id/score`, stub routes) stays
   behind auth — verify via the existing `compete.test.ts`/`server.test.ts` auth-negative tests,
   still green, plus a real unauthenticated `curl -o /dev/null -w '%{http_code}' GET /compete`
   returning 200 against a real running instance.
3. **`apps/api/src/index.ts`** direct-execution guard uses `pathToFileURL(process.argv[1]).href`
   instead of hand-built `file://${...}` string concatenation (which never matched on Windows,
   so `main()` silently never ran and the process exited 0 with no server and no error). Verify:
   read the file; a real `npx tsx apps/api/src/index.ts` on this machine actually binds the port
   and logs `@lkb/api listening on :<port>` (paste the real log line).
4. **`packages/ai/src/json.ts`** (new) exports `parseJsonLoose(text): unknown` — tries a raw
   `JSON.parse` first, then strips a leading/trailing markdown code fence
   (```` ```json ... ``` ````) and retries, returning `null` (never throwing) if both fail.
   `packages/ask/src/select-nodes.ts`, `packages/ask/src/refine.ts`, and `apps/api/src/score.ts`
   each replace their own private fragile `JSON.parse`-in-a-try/catch with this shared helper.
   Verify: `pnpm --filter @lkb/ai --filter @lkb/ask --filter @lkb/api test` all green; a real
   `POST /ask` against real seeded data returns `verdict: "correct"` or `"ambiguous"` with a
   non-empty `scored` array for a question the real data actually answers (NOT `"no candidates"`
   with an empty `scored: []`, which is what every real call produced before this fix, because
   Gemini fences its `{"node_ids": [...]}` reply and the old parser silently treated that as
   unparseable).
5. **`scripts/seed-demo-server.mjs`** (new, one-off real CLI) builds the tenant `"toc"` tree
   index from the real `sessions`/`session_pages` already in Mongo (via `packages/index`'s
   `buildTree`, no fabricated data) and upserts it into the `tree_index` collection (previously
   empty — nobody had ever populated it), and mints one real `api_keys` document with a random
   key (printed once, never logged again) and every scope the current routes check. Verify: a
   real run's console output (paste it) plus a real Mongo read confirming `tree_index` and
   `api_keys` are non-empty for tenant `toc`.
6. **`apps/api/src/routes/compete-page.ts`** — the `/compete` page is rewritten with real CSS
   (readable typography, cards, a verdict badge, formatted per-source citation cards built via
   `textContent`/DOM methods, never `innerHTML` with server- or LLM-derived text) instead of the
   original bare unstyled form. `apps/api/src/routes/compete.ts`'s `/compete/start` response now
   includes `scored` and `verdict` in `aiAnswer` (previously dropped, so the page's "cited
   sources" section always rendered empty even when askV2 had real scored candidates). Verify:
   `compete.test.ts` still asserts a working `/compete/start` response shape; a real browser
   screenshot (Playwright) of a real `/compete` round-trip shows a non-empty "Cited sources"
   section with a real session title, a relevance percentage, and the judge's real reasoning text.
7. **`apps/api/Dockerfile` + `.dockerignore` + `docker-compose.yml`** (new) — a real multi-stage
   Docker build for `@lkb/api` that runs the actual pnpm workspace (source run via `tsx`, no
   compiled `dist/` step yet, disclosed as a documented future optimization, not silently
   pretended-away). Verify: `docker build -f apps/api/Dockerfile -t lkb-api:demo .` exits 0 on
   this machine; `docker run` with real `MONGO_URL`/`MONGO_DB`/`GEMINI_API_KEY` env vars logs
   `@lkb/api listening on :3000` and NOT `ERR_MODULE_NOT_FOUND` for any `@lkb/*` package
   (real bug hit and fixed during this unit: the runtime stage's `COPY packages ./packages` /
   `COPY apps/api ./apps/api` from the build context was clobbering the `deps` stage's
   already-created per-package `node_modules` symlinks — fixed by copying the whole `deps` output
   first, then overlaying source on top); a real `curl` against the container's mapped port
   returns 200 on `/compete` and a real cited answer on `POST /ask`.
8. **No regression.** `pnpm -r test` (the whole workspace) exits 0 with zero failures — paste the
   real aggregate output, not a per-package excerpt only.

## Non-goals (disclosed, not hidden)
- This is NOT the Phase-3 production web app (`apps/web`, deck-parity UI) — that is separate,
  larger, not-yet-started work. `/compete` stays a functional internal preview page.
- No compiled/production JS build step — the Docker image still runs TypeScript source via `tsx`
  at request time. A leaner compiled image is real follow-up work, not silently done here.
- The T-003 long-audio-chunking work (recursive tail-splitting, the still-unresolved deterministic
  stall in one segment of `2026-04-21-visa-blueprint-part2-italy-france-nz`) is a SEPARATE unit
  (`qa/contracts/long-audio-chunking.md`) and is explicitly OUT of scope for this contract.
