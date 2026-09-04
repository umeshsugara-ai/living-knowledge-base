# Verdict — web-settings-keys

Cycle checked: 1
Verdict: PASS

## Criterion-by-criterion

1. **schema/label + gen:types freshness** — PASS. `schema/api_keys.schema.json` has typed
   `label: {"type":"string", ...}`. `packages/core/src/generated/api_keys.ts` has `label?: string`
   with the schema's description as a JSDoc comment. Re-ran `pnpm gen:types` myself: output
   `done: 22 collection(s), 0 file(s) written` — zero files rewritten, meaning the committed/
   working-tree file already matches fresh generation exactly. Not stale.

2. **`apps/api/src/routes/keys.ts`** — PASS. Read in full (67 lines). `GET /keys` returns
   `{keys}` from `deps.listKeys(req.auth!.tenantId)` only. `POST /keys` validates label
   (non-empty string) and scopes (non-empty string array) → 400 otherwise; returns
   `{id, key: rawKey}` once, 201; no other route or code path in this file reads `rawKey` back.
   `DELETE /keys/:id` returns 404 on `!revoked`, 200 `{ok:true}` otherwise. All three wrapped in
   `requireScope("keys")`. All three use `req.auth!.tenantId` — never `req.body`/`req.params` for
   tenant scoping. `keys.test.ts` (7 tests) verified — see item 5.

3. **`apps/api/src/store.ts` `createMongoKeysDeps`** — PASS. Read the implementation (lines
   107-147). `createKey` mints `lkb_<48-hex>` via `randomBytes(24)`, hashes with `sha256Hex`,
   stores the hash, returns `{id, rawKey}` — `rawKey` is never written to any collection.
   `listKeys` explicitly constructs `{_id, label, scopes, createdAt, revokedAt}` field-by-field
   from each Mongo doc — never spreads `...d`, so `keyHash` cannot leak even if the schema grows
   new sensitive fields later. `scripts/seed-demo-server.mjs` mints `demo_<hex>` — confirmed
   visually distinct prefix from `lkb_`.

4. **Security invariants, live server test** — PASS, verified against a real running instance,
   not just unit tests. Started the real production entrypoint
   (`apps/api/src/index.ts`, real Mongo at `mongodb://13.202.206.101:27017`, db `lkb`) on port
   3406. `GEMINI_API_KEY` from `.env` present but unused by this feature — confirmed
   `production.ts` only constructs `GeminiProvider` (no network call at construction), startup
   was not blocked.
   - Minted a demo key: `demo_438aa0bde23aceec15b06c9a3f019b6674ab8b50b73bd2fa`
   - `curl -X POST /keys -d '{"label":"checker-live-test","scopes":["ask"]}'` →
     `{"id":"1a33e6ab-...","key":"lkb_a30d1bbbcc8b0f5c37d08f31e5462756b408d679faaad727"}` (real
     raw key, id).
   - `curl GET /keys` → full list including that key by label/scopes/createdAt/revokedAt; grepped
     the raw response for `keyHash` and for any `lkb_...` substring — **zero matches**, confirming
     no hash/raw-key leak in the real wire response.
   - `curl -X DELETE /keys/1a33e6ab-...` → `{"ok":true}`.
   - `curl GET /keys` again → same key's `revokedAt` now `"2026-09-04T04:53:06.767Z"` (was
     `null`).
   - Grepped `keys.ts`, `store.ts`, `SettingsPage.tsx`, `api/keys.ts`, `api/client.ts`,
     `fixtures.ts`, `production.ts`, `server.ts` for `console.` — zero matches. No raw-key or
     full-document logging anywhere in the changed files.
   - Server process stopped cleanly after the test; an orphaned earlier dev-instance on port 3404
     (spawned during my own setup, not part of the feature) was also killed.

5. **`keys.test.ts` (7 tests)** — PASS, all 7 read and confirmed to test exactly what's claimed:
   raw key returned once on create; `GET /keys` has neither `keyHash` nor `key` in any list
   entry; tenant A never sees tenant B's key; DELETE sets `revokedAt` and it shows in `listKeys`;
   cross-tenant DELETE returns 404 and does NOT flip `revokedAt` (asserted `null` afterward);
   empty `scopes` → 400; missing `keys` scope on GET → 403. Ran `pnpm -r test` myself: exit 0,
   251/251 total, `apps/api: 44/44 pass` (confirmed the +7 new keys tests via full test-name
   listing), `apps/web: 17/17 pass` (Test Files 5 passed, Tests 17 passed, including
   `SettingsPage.test.tsx (4 tests)`).

6. **No regression** — PASS. `pnpm -r test` exit 0, 251/251. `pnpm lint:structure` exit 0
   (lint-loc/dirsize/root/dupes/migrations all OK, SNAPSHOT.md fresh, dependency-cruiser "no
   dependency violations found", 200 modules/559 dependencies).

7. **`TASKS.md` T-010** — PASS. Line reads `| T-010 | done | ... Phase 4 (Settings/API-key CRUD
   ...): qa/verdicts/web-settings-keys.md, checker PASS. Ingest/Meeting-Bot pages remain a
   separate, later unit (not part of T-010's original scope). |`. Explicitly disclosed non-goal
   as required.

## SettingsPage.tsx / SettingsPage.test.tsx (item 6 of the contract's own verify list)

Read `SettingsPage.tsx` in full (110 lines). Raw key from create lives only in
`justCreated` component state; grepped the file and `api/keys.ts` for `localStorage`/
`sessionStorage` — zero matches. Dismissing the banner calls `setJustCreated(null)`, which
un-mounts the `{justCreated && (...)}` block entirely (conditional render, not a CSS
hide) — confirmed by the test itself: `expect(screen.queryByText("lkb_realsecretvalue"))
.not.toBeInTheDocument()` after the dismiss click, which is a real DOM-removal assertion, not
a visibility check. All 4 `SettingsPage.test.tsx` tests read and match claims: masked list
render (`queryByText(/^lkb_/)` absent), create→banner→dismiss removes the raw value from the
DOM, revoke calls the real API and triggers a second `listKeys` call, failed create surfaces a
real error message (`getByText("missing keys scope")`), never silently swallowed.

## Issues found

None. No FAIL-worthy findings.

## Notes (not issues, for completeness)

- The repo's working tree also carries unrelated uncommitted changes (long-audio-chunking work:
  `packages/ai/src/stt/*`, `scripts/transcribe-toc-session.mjs`,
  `qa/contracts/long-audio-chunking.md`, etc.) — not part of this manifest's "What changed" list
  and not touched by this check; scoped review confirms the web-settings-keys diff itself
  (`apps/api/src/{routes/keys.ts,routes/keys.test.ts,store.ts,server.ts,fixtures.ts,production.ts}`,
  `apps/web/src/{pages/SettingsPage.tsx,pages/SettingsPage.test.tsx,api/keys.ts,api/client.ts,
  layout/NavSidebar.tsx,App.tsx}`, `schema/api_keys.schema.json`,
  `packages/core/src/generated/api_keys.ts`, `scripts/seed-demo-server.mjs`, `TASKS.md`) contains
  nothing undisclosed.
- The live-server GET /keys list also showed a pre-existing "Test Integration" key from the
  maker's own earlier browser-evidence session (already revoked) alongside my test key — expected
  leftover state in the shared dev Mongo, not a defect.

## Real commands run + real output

```
$ pnpm -r test
... (full run)
apps/api test: ℹ tests 44 / fail 0   (includes 7 new keys tests, confirmed by name)
apps/web test: Test Files 5 passed (5) / Tests 17 passed (17)  (includes SettingsPage.test.tsx, 4 tests)
Total: 251 tests, 251 pass, exit 0

$ pnpm lint:structure
lint-loc: OK (178 file(s) within budget)
lint-dirsize: OK (70 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (218 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (878 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration
✔ no dependency violations found (200 modules, 559 dependencies cruised)
exit 0

$ pnpm gen:types
done: 22 collection(s), 0 file(s) written
$ git diff packages/core/src/generated/api_keys.ts   # only vs last commit, unaffected by regen
(no change caused by the regen itself — file already current)

$ MONGO_URL=mongodb://13.202.206.101:27017 MONGO_DB=lkb PORT=3406 node --import tsx --import dotenv/config apps/api/src/index.ts
@lkb/api listening on :3406

$ node scripts/seed-demo-server.mjs
API key (save this, shown once): demo_438aa0bde23aceec15b06c9a3f019b6674ab8b50b73bd2fa
tenantId: toc

$ curl -X POST http://localhost:3406/keys -H "authorization: Bearer demo_438aa0..." -d '{"label":"checker-live-test","scopes":["ask"]}'
{"id":"1a33e6ab-8c9a-4f9b-b9b2-7c796d911418","key":"lkb_a30d1bbbcc8b0f5c37d08f31e5462756b408d679faaad727"}

$ curl http://localhost:3406/keys -H "authorization: Bearer demo_438aa0..."
{"keys":[... "checker-live-test" entry with label/scopes/createdAt/revokedAt only, no keyHash, no key field ...]}
$ (response) | grep -o "keyHash"     -> no match
$ (response) | grep -o "lkb_[a-f0-9]*"  -> no match

$ curl -X DELETE http://localhost:3406/keys/1a33e6ab-8c9a-4f9b-b9b2-7c796d911418 -H "authorization: Bearer demo_438aa0..."
{"ok":true}

$ curl http://localhost:3406/keys -H "authorization: Bearer demo_438aa0..."
... "_id":"1a33e6ab-...","revokedAt":"2026-09-04T04:53:06.767Z" ...   (was null before DELETE)

$ grep -n "console\." apps/api/src/routes/keys.ts apps/api/src/store.ts apps/web/src/pages/SettingsPage.tsx apps/web/src/api/keys.ts apps/web/src/api/client.ts apps/api/src/fixtures.ts apps/api/src/production.ts apps/api/src/server.ts
(no output — zero matches)
```
