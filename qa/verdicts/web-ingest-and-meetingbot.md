# Verdict — web-ingest-and-meetingbot

Cycle checked: 1
Verdict: PASS

## Criterion-by-criterion

1. **PASS** — `apps/api/src/routes/ingest.ts:26-48`: `POST /ingest` behind `requireScope("ingest")`
   (line 29), validates `{url: string}` with `URL_RE = /^https?:\/\//i` (400 otherwise, line
   31-34), returns 201 with `{sessionId, sourceId, turnCount}` (line 37), catches adapter errors
   and returns 502 with the real `err.message` (line 38-44), never a generic 500. Ran
   `cd apps/api && npm test`: 48/48 pass, including all 4 `ingest.test.ts` tests. Read the
   "502 not 500" test (`ingest.test.ts:47-68`) — it injects a real thrown error via
   `fakeIngestDeps.ingestUrl`, asserts `res.status === 502` and `body.message` matches `/404/`.
   Confirmed.

2. **PASS** — `apps/api/src/ingest-store.ts:14,28,35`: imports and calls the real
   `createUrlSource` from `@lkb/ingest` (not reimplemented), `jinaReaderFetch` (line 18-25) fetches
   `https://r.jina.ai/${url}`, adds `authorization: Bearer <JINA_API_KEY>` only when the env var is
   set. `apps/api/package.json` lists `"@lkb/ingest": "workspace:*"` (line 17). Ran
   `npx depcruise --config .dependency-cruiser.cjs packages apps workers` myself: "✔ no dependency
   violations found (209 modules, 587 dependencies cruised)".

3. **PASS** — Live-fire tested for real. Started the real server (`cmd.exe`-wrapped
   `npx tsx src/index.ts`, real remote Mongo at `13.202.206.101:27017`, db `lkb`, port 3407), ran
   `node scripts/seed-demo-server.mjs` (confirmed it mints a key with `"ingest"` in its scopes
   array — `scripts/seed-demo-server.mjs:48`), then real-curled:
   - `POST /ingest {"url":"https://example.com"}` → real `201`,
     `{"sessionId":"2bcd871f-...","sourceId":"15adee62...","turnCount":6}`.
   - `GET /sessions/2bcd871f-...` → real `200` with 6 real turns, real extracted text
     ("Title: Example Domain", "URL Source: https://example.com/", etc.), `speakerRef:"url"`,
     real character-offset `tStart`/`tEnd` — proves the write path actually persisted, not just
     that the route returned 201.
   - `POST /ingest {"url":"not-a-url"}` → real `400`,
     `{"error":"bad_request","message":"body must be { url: string } (http/https only)"}`.
   - `POST /ingest` with an unreachable domain → real `502`,
     `{"error":"ingest_failed","message":"Jina Reader could not fetch this URL (HTTP 422)"}` — a
     genuine failure from a real outbound Jina Reader call, not a canned error.
   Server process killed afterward and confirmed down (`curl` timed out, status `000`).

4. **PASS** — `apps/web/src/pages/IngestPage.tsx`: calls real `ingestUrl` (`api/ingest.js`, line
   24), shows `Link to={/sessions/${result.sessionId}}` on success (line 65), shows
   `err.message` from a real `ApiError` on failure (line 28), and visibly renders the scope-cut
   disclosure ("Document upload (PDF/DOCX/TXT/MD) and recording upload need real file-upload
   handling this app doesn't have yet", lines 72-75) — not just a code comment. Ran
   `cd apps/web && npx vitest run --config vitest.config.ts`: 25/25 pass including all 4
   `IngestPage.test.tsx` tests (success+link, real error text, empty-URL-never-calls-API,
   disclosure-is-rendered). Viewed both screenshots: `spa-ingest-result.png` shows a real
   "Created a real session with 112 real paragraph turn(s)" result banner with a working "View
   it" link; `spa-ingested-session-fixed.png` shows the Wikipedia "Study_abroad" session detail
   view with 112 turns and correct "0chars–28chars" / "30chars–84chars" style labels. Both match
   the manifest's claims.

5. **PASS** — `apps/web/src/pages/MeetingBotPage.tsx`: grepped for `fetch`/`useEffect` —
   no matches, confirmed fully static. Grepped for `meeting-bot` import — no matches, confirmed it
   does not import `packages/meeting-bot`. Visible text clearly separates "Real and tested today"
   (platform detection, consent gate, join-strategy selection, private-segment exclusion) from
   "Not real yet" (no joiner has ever joined a live meeting, no real Vexa instance, no real
   browser automation, no real OS audio capture). `MeetingBotPage.test.tsx`'s 2 tests both pass
   (part of the 25/25 vitest run above).

6. **PASS, most scrutinized** — `packages/ingest/src/sources/document.ts:53-54`: doc comment
   reads "Splits extracted text into paragraphs ... each carrying its character offset in the
   original text as `tStart`/`tEnd`" — confirmed `tStart`/`tEnd` are genuinely documented as
   character offsets, not time, predating this unit (also referenced at the file's top-of-file
   comment, line 2-6). `SessionDetailPage.tsx:16-18`'s `timeUnitLabel(speakerRef)` returns
   `"chars"` for `"url"`/`"document"`, else `"s"` — logic matches the contract exactly, and it's
   used at line 67/70 in the render (`t.speakerRef}` /`{t.tStart}{unit}...`). Confirmed both
   branches are exercised in `SessionDetailPage.test.tsx`: test 1 (`speakerRef:"spk:0"`) asserts
   `"spk:0 · 0s–28s"`; test 2 (`speakerRef:"url"`) asserts `"url · 0chars–28chars"`. Both pass.

7. **PASS** — `NavSidebar.tsx:23-24` lists real `NavLink`s for `/ingest` ("Ingest") and
   `/meeting-bot` ("Meeting Bot"). `App.tsx:12-13,29-30` imports `IngestPage`/`MeetingBotPage` and
   wires `<Route path="/ingest" .../>` and `<Route path="/meeting-bot" .../>` as real routes
   inside the real `<Routes>` tree.

8. **PASS** — Ran `pnpm -r test` myself: exit 0. Per-package tallies from the run: core 7,
   ai 56, index 25, ingest 34, ask 30, meeting-bot 40, api 48, web 25 = **265 total, 265 pass, 0
   fail** — matches the manifest exactly (api 48 = 44 + 4 new ingest tests; web 25 = prior 19 + 4
   IngestPage + 2 MeetingBotPage, with SessionDetailPage's 2 new tests replacing zero prior
   coverage there). Ran `pnpm lint:structure` myself: exit 0, all sub-checks OK (loc, dirsize,
   root, dupes, migrations, SNAPSHOT freshness, depcruise 209 modules/587 deps, 0 violations).

## Issues found (if any)

None blocking. One observation, not a bug: `jinaReaderFetch` in `ingest-store.ts:20` interpolates
the raw user-supplied URL directly into the Jina Reader request path
(`` `https://r.jina.ai/${url}` ``) without `encodeURIComponent`. This is the documented Jina Reader
usage pattern (append the raw target URL after `r.jina.ai/`) and is what the contract explicitly
calls out as the intended design (Jina Reader proxying an arbitrary caller-supplied URL server-side
is the whole point of this feature) — not an unintended additional SSRF surface. No other
outbound-fetch bypass of Jina Reader was found; the raw `url` is never used in any other network
call.

## Real commands run + real output

```
$ cd apps/api && npm test
... 48/48 pass (incl. all 4 ingest.test.ts tests)

$ npx depcruise --config .dependency-cruiser.cjs packages apps workers
✔ no dependency violations found (209 modules, 587 dependencies cruised)

$ node scripts/seed-demo-server.mjs   (MONGODB_URL=mongodb://13.202.206.101:27017)
loaded 24 sessions, 23 session_pages for tenant "toc"
wrote tree_index root "tenant:toc" (1 year node(s))
API key (save this, shown once): demo_44ffdda4dd5f4c89d7565f99c5c2fa9ccdc46001618c672f
tenantId: toc

$ curl -X POST http://localhost:3407/ingest -d '{"url":"https://example.com"}'
{"sessionId":"2bcd871f-fcaa-4e8b-8703-909e20b855f4","sourceId":"15adee6232daf...","turnCount":6}
HTTP_STATUS:201

$ curl http://localhost:3407/sessions/2bcd871f-fcaa-4e8b-8703-909e20b855f4
{"session":{...},"page":null,"claims":[],"turns":[ 6 real turns, speakerRef:"url", real char offsets ]}
HTTP_STATUS:200

$ curl -X POST http://localhost:3407/ingest -d '{"url":"not-a-url"}'
{"error":"bad_request","message":"body must be { url: string } (http/https only)"}
HTTP_STATUS:400

$ curl -X POST http://localhost:3407/ingest -d '{"url":"https://this-domain-absolutely-does-not-exist-zzz12345.example"}'
{"error":"ingest_failed","message":"Jina Reader could not fetch this URL (HTTP 422)"}
HTTP_STATUS:502

(server killed; confirmed down: curl timed out, HTTP_STATUS:000)

$ cd apps/web && npx vitest run --config vitest.config.ts
Test Files 8 passed (8) / Tests 25 passed (25)

$ pnpm -r test
core 7/7, ai 56/56, index 25/25, ingest 34/34, ask 30/30, meeting-bot 40/40, api 48/48, web 25/25
= 265/265 pass, exit 0

$ pnpm lint:structure
lint-loc OK / lint-dirsize OK / lint-root OK / lint-dupes OK / lint-migrations OK /
SNAPSHOT fresh / depcruise 0 violations, exit 0
```
