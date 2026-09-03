# Verdict — url-adapter (T-023)

**Result: PASS**

Contract: `qa/contracts/url-adapter.md`
Manifest: `qa/manifests/url-adapter.md`
Commit checked: `bcc6f1e4eada1ea4b6e59b74d1ce9fc6fa2df30f`
Cycle checked: 1
Checker run: fresh shell, `cd /d/KnowledgeBase`, git-bash, all commands re-executed independently (not copied from the manifest).

## Criterion-by-criterion (contract §Criteria)

1. **Schema additive, gen/validate clean** — PASS. `git show bcc6f1e -- schema/sources.schema.json`
   confirms `kind` enum gained `"url"` only (recording/document/spreadsheet/whatsapp-batch
   untouched) and a new optional `url: {type:"string"}` property was added; nothing else in the
   file changed. Re-ran `pnpm gen:types --check` → `OK: 21 generated type file(s) + index.ts
   match schema/`. Re-ran `python schema/validate.py` → `PASS: 21 collection schema(s) validated
   correctly`, including `sources` (5 error(s) on its invalid fixture, valid fixture still
   passes — the pre-existing `sources` fixtures don't use `kind:"url"` and were unaffected).

2. **`detect(input)`** — PASS. Read `packages/ingest/src/sources/url.ts` in full:
   `URL_RE = /^https?:\/\//i` matches bare http(s) strings; `isUrlHint` matches `{kind:"url",
   url:string}`; `extractUrl` returns undefined for anything else (plain strings, document
   hints). `url.test.ts`'s first test exercises true/false cases including a document hint and
   confirms rejection.

3. **`fetch(input, consent)`** — PASS. Reads `tenantId` off the hint/input and throws
   `"url adapter: fetch() requires a tenantId"` when absent (verified test:
   "fetch throws when tenantId is missing (never silently defaults tenancy)", matches
   `document.ts`'s identical pattern at `document.ts:88-89`). Calls injected `deps.fetcher(url)`
   for text, `deps.hasher(text)` for the hash, returns `{source:{kind:"url", url, hash,
   captureMode, consent, createdAt}, media:[]}` — no media, matching `document.ts`'s own
   `media: []` convention.

4. **`toTurns(source)`** — PASS. Throws when `source.url` missing (test: "toTurns throws when
   source.url is missing"). Re-fetches via the same injected `deps.fetcher` (not a second seam —
   confirmed by reading the function body, single `deps.fetcher` reference in the whole file) and
   pipes through `splitIntoParagraphTurns`, imported at `url.ts:10` (`import {
   splitIntoParagraphTurns } from "./document.js";`) — genuinely reused, not reimplemented.
   Grepped `url.ts` for any duplicate paragraph-splitting logic: none found. Each turn tagged
   `speakerRef: "url"` (test: "url.toTurns() re-fetches the source url and splits into paragraph
   turns with speakerRef 'url'" — passed, `turns[0].speakerRef === "url"`).

5. **Registry wiring, no ambiguity** — PASS. `index.ts` re-exports `./sources/url.js` (one line,
   confirmed via `git show`). `registry.test.ts`'s new test
   ("T-023: detectSource picks the url adapter for an http(s) input, no ambiguity with
   document/recording") exercises the genuinely ambiguous case
   `https://example.com/report.pdf` and asserts it resolves to the `url` adapter, not
   `document`. **Empirically verified the fix is load-bearing**: reverted
   `packages/ingest/src/sources/document.ts` to its pre-T-023 content
   (`git show bcc6f1e~1:...`) and re-ran `pnpm --filter @lkb/ingest test` — the T-023 registry
   test failed exactly as predicted (`AssertionError: 'document' !== 'url'`), all 25 other tests
   still passed. Restored the file via `git checkout --`, re-ran, 26/26 green again. This proves
   the `document.ts` one-line fix is a genuine necessary bugfix, not scope creep.

6. **Tests exist and pass** — PASS, with one manifest inaccuracy noted below. `url.test.ts` has
   **7 tests** (not 9 as the manifest's "What changed" §6 states), covering exactly the cases the
   contract requires: detect true/false, fetch hash/captureMode/url, fetch throws on missing
   tenantId, fetch throws on unrecognized input, toTurns produces paragraph turns with
   `speakerRef:"url"`, toTurns throws on missing `source.url`. All use the injected
   `fakeUrlFetcher` — grepped the file for `fetch(` / `http` / `XMLHttpRequest`: none found, no
   live network call anywhere.

7. **No regression** — PASS, all re-run independently:
   - `pnpm -r typecheck` → 9/9 workspace projects `Done`, 0 errors.
   - `pnpm --filter @lkb/ingest test` → 26/26 pass (18 pre-existing + 7 new `url.test.ts` + 1 new
     `registry.test.ts`).
   - `pnpm -r test` → index 11/11, ai 23/23, ingest 26/26, ask 21/21, meeting-bot 20/20,
     apps/api 18/18 — all green, matches manifest exactly.
   - `pnpm gen:types --check` → OK.
   - `python schema/validate.py` → PASS 21/21.
   - `pnpm lint:structure` → all 6 sub-checks OK, 0 dependency violations (129 modules, 353
     dependencies cruised).

## Diff-scope check (contract implicit, manifest "Files touched")

`git show bcc6f1e --stat` matches the manifest's file list exactly: `schema/sources.schema.json`,
`packages/core/src/generated/sources.ts` (regenerated), `packages/ingest/src/sources/url.ts`
(new), `packages/ingest/src/sources/url.test.ts` (new), `packages/ingest/src/sources/document.ts`
(4 lines added: `URL_RE` const + doc comment + 1-line early-return in `hasDocumentExtension`),
`packages/ingest/src/registry.test.ts` (extended), `packages/ingest/src/testUtils.ts` (new
`fakeUrlFetcher`), `packages/ingest/src/index.ts` (1-line re-export), plus the new contract and
manifest files. `document.test.ts` diff is empty (`git show bcc6f1e --
packages/ingest/src/sources/document.test.ts` produced no output) — confirms T-020's 4
pre-existing document tests are byte-identical, untouched.

## Manifest inaccuracy found (non-blocking)

The manifest's "What changed" §6 and "How to verify" narrative claim "17 pre-existing + 9 new
`url.test.ts` tests + 1 new registry test" for the ingest package. Actual counts (verified by
`grep -c '^test('` and by reading the full test-run listing): `url.test.ts` has **7** new tests,
pre-existing tests numbered **18** (not 17) — the registry suite alone had 4 pre-existing tests
(recording/document/no-match/first-matching-order), not 3 as separately claimed. The *totals*
manifest cites (26 for ingest, and the full cross-package breakdown) are correct and were
independently reproduced exactly — this is a narrative/breakdown error in the manifest text, not
a functional defect or a contract violation. Flagging so the maker corrects the manifest's prose
in a follow-up; does not block this unit's PASS since every criterion and every actual command
output was independently verified to hold.

## Verdict

All 7 contract criteria independently re-verified from a fresh shell, including one criterion
(document.ts fix necessity) strengthened by empirical revert-and-reproduce. **PASS.**
T-023 flipped to `done` in `TASKS.md` and `.goal/goal.json` (citing this verdict + commit
`bcc6f1e`).
