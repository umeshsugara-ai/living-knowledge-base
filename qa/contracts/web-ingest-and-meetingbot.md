# Contract — web-ingest-and-meetingbot (final phase of the UI sprint, plan §8)

> Closes out the last item on the UI-visibility sprint: an Ingest page (a real write path — the
> higher-risk piece §8 always called out separately from the read-only pages) and a Meeting Bot
> page (necessarily an honest empty-state — no real vendor integration exists). Drafted by the
> maker; /checker adopts or amends on first check.

## Criteria (each machine-checkable)

1. **`apps/api/src/routes/ingest.ts`** (new) — `POST /ingest`, body `{url: string}` (http/https
   only, 400 otherwise), behind `requireScope("ingest")`. On success (201): creates a real
   `sources` doc, a real `sessions` doc wrapping it, and real `turns` (paragraph-split extracted
   text) — returns `{sessionId, sourceId, turnCount}`. A real fetch/extraction failure surfaces
   as 502 with the real error message, never a generic 500. Verify: `ingest.test.ts` (4 tests) —
   happy path, bad request, 502-not-500 on a real adapter failure, 403 without scope.
2. **`apps/api/src/ingest-store.ts`** (new) — real `IngestDeps` impl. Uses `@lkb/ingest`'s
   already-real, checker-PASSed `createUrlSource` (no re-implementation of the adapter), a real
   Jina Reader fetch (`https://r.jina.ai/<url>`, works anonymously; uses `JINA_API_KEY` as a
   Bearer token when set, neither required nor assumed since none is configured in this
   environment). `apps/api/package.json` gains `@lkb/ingest` as a real dependency (previously
   apps/api never imported it, despite the dependency-cruiser rule already allowing `apps →
   ingest`). Verify: `pnpm --filter @lkb/api typecheck` green; `depcruise` shows no new
   violations (the edge was already allowed, just never used).
3. **`apps/web/src/pages/IngestPage.tsx`** (new) — a real form (URL input, submit), calls the
   real `POST /ingest`, shows the real result (turn count + a link into the already-real
   `GET /sessions/:id` page — no second "view ingested content" UI built) or the real error
   message on failure. Explicitly discloses the v1 scope cut: URL ingestion only, document/
   recording upload deferred (needs real multipart file-upload handling this app doesn't have).
   Verify: `IngestPage.test.tsx` (4 tests) — success flow with link, real error surfaced, empty
   URL never calls the API, the scope-cut disclosure is actually rendered (not just written in a
   comment). Real evidence: a live browser session actually ingested
   `https://en.wikipedia.org/wiki/Study_abroad` end-to-end (real Jina Reader fetch, real Mongo
   write, 112 real paragraph turns), then viewed the created session through the existing detail
   page — `qa/evidence/spa-ingest-result.png`, `qa/evidence/spa-ingested-session-fixed.png`.
4. **`apps/web/src/pages/MeetingBotPage.tsx`** (new) — a static, honest disclosure page: lists
   what's real and tested (platform detection, consent gate, join-strategy selection, private-
   segment exclusion) clearly separated from what is NOT real (no joiner has ever joined a live
   meeting — no real Vexa instance, no real browser automation, no real OS audio capture).
   Contains no fabricated "connected" state and does not import `packages/meeting-bot` (not
   possible anyway — `.dependency-cruiser.cjs` doesn't allow `apps → meeting-bot`; this page
   needed no data fetch at all, since there is no real meeting-bot data to show). Verify:
   `MeetingBotPage.test.tsx` (2 tests).
5. **Real bug found and fixed while testing #3 live**: `SessionDetailPage.tsx` labeled every
   turn's `tStart`/`tEnd` as seconds, which is correct for an audio transcript but factually
   wrong for a document/URL-ingested turn (`tStart`/`tEnd` there are character offsets, per
   `packages/ingest/src/sources/document.ts`'s own `splitIntoParagraphTurns` docs) — a real
   ingested Wikipedia page's turns read as "0s-28s" when that's actually characters 0-28. Fixed
   via a `speakerRef`-based unit label (`"url"`/`"document"` → "chars", otherwise → "s").
   Verify: `SessionDetailPage.test.tsx` (2 new tests, this page had none before), plus the
   already-referenced real browser screenshot showing "0chars–28chars" instead of "0s–28s".
6. **Nav + routing** — `/ingest` and `/meeting-bot` added to `NavSidebar.tsx`/`App.tsx`.
7. **No regression.** `pnpm -r test` (whole workspace) and `pnpm lint:structure` both exit 0.

## Non-goals (disclosed, not hidden)
- Document/recording file upload is NOT built (needs real multipart handling) — the Ingest page
  says so explicitly rather than silently only supporting URLs with no explanation.
- The Meeting Bot page is intentionally inert — no polling, no fake "connecting..." state, no
  data fetch of any kind. There is nothing real to show yet.
- This closes the UI-visibility sprint (plan §8/§8b) started earlier this session. No further
  planned UI phases remain open after this unit.
