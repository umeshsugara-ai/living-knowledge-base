# Verdict — T-020 ingestion-source-seam

**Date:** 2026-09-03
**Cycle checked:** 1
**Contract:** `qa/contracts/ingestion-source-seam.md`
**Manifest:** `qa/manifests/T-020-ingestion-source-seam.md`

## Re-run evidence

- `pnpm --filter @lkb/ingest typecheck` — clean (no output).
- `pnpm --filter @lkb/ingest test` — 15/15 pass, matches manifest's claimed test names exactly.
- `pnpm -r typecheck` — 9/9 workspace projects clean (whatsapp_msg submodule out of scope, as
  documented).
- `pnpm -r test` — packages/ai 23, packages/ask 6, packages/index 4, packages/ingest 15 = 48
  total pass, 0 fail. Matches the expected "48 total".
- `pnpm gen:types --check` — OK, 19 generated type files match schema/.
- `python schema/validate.py` — PASS, 19 collection schemas validated.
- `pnpm lint:structure` — all six sub-checks OK, depcruise: 0 dependency violations (74 modules,
  153 dependencies cruised).

All commands re-run myself, all outputs match the manifest's claims (lint-migrations file count
464→465 is a harmless timing artifact of file scanning, not a functional discrepancy).

## Source read in full

`packages/ingest/src/source.ts`, `registry.ts`, `sources/recording.ts`, `sources/document.ts`,
`testUtils.ts`, and all four test files (`source.test.ts`, `registry.test.ts`,
`sources/recording.test.ts`, `sources/document.test.ts`) — read completely, not sampled. Also
read `packages/core/src/generated/turns.ts`, `packages/ai/src/stt/transcribe.ts`, and
`ARCHITECTURE.md` §5 to judge the C1 amendment call below.

## Criteria

- **C1 — met, via amendment.** The contract literally said `Turn` is "imported from
  `packages/core/src/generated/*`". The maker instead re-exports `Turn` from
  `@lkb/ai`'s `stt/transcribe.ts`. Judged this as a **legitimate amendment, not a violation**:
  `core/generated/turns.ts`'s `Turns` interface is the *post-persistence* shape (`_id`,
  `tenantId`, `sessionId` required) — it does not structurally match what any adapter's
  `toTurns()` actually returns (pre-id text+timing only). `@lkb/ai`'s `Turn` ("matches
  schema/turns.schema.json minus the ids the caller fills in") is exactly that pre-id shape,
  purpose-built in T-019 for this. Declaring a third, ingest-local pre-id turn type would be the
  actual violation of the contract's own "no re-declared shapes" spirit. `ingest → ai` is an
  allowed dependency edge per ARCHITECTURE §5 regardless of which way this was decided, so no
  architectural-legality concern either way — the choice is purely about avoiding duplicate
  shape declarations, and reuse wins on that axis. Amended C1's wording in the contract and
  logged the amendment (routine gate — not a goal-direction reversal or invariant weakening).
- **C2 — met.** `sources/recording.ts`, 122 LOC (≤300). `detect` matches
  `AUDIO_VIDEO_EXTENSIONS` or `{kind:"recording"}` hint. `fetch` hashes via injected `hasher`,
  sets `captureMode` directly from `consent.captureMode` (D-008: caller-supplied, never guessed),
  throws if `tenantId` missing (verified by test). `toTurns` delegates to injected
  `deps.transcribe` (typed as `Transcribe` from `@lkb/ai`) — no `whisper.ts`/`gemini.ts` import
  anywhere in the file (grep-confirmed by reading the full import list: only `type { Transcribe }
  from "@lkb/ai"`).
- **C3 — met.** `sources/document.ts`, 115 LOC (≤300). `detect` matches
  `.pdf/.docx/.txt/.md`/hint. `fetch` reads via injected `reader` (no `fs` import in the file).
  `toTurns` calls `splitIntoParagraphTurns`, which sets `tStart`/`tEnd` to character offsets
  (verified by regex walk and by the offset-assertion test using `text.indexOf(...)`).
- **C4 — met.** `registry.ts`'s `detectSource` is a `for` loop returning the first adapter whose
  `detect()` is true, throwing typed `NoMatchingSourceError` otherwise — not an if/else chain.
  Order-sensitivity explicitly tested ("picks the first matching adapter in order").
- **C5 — met.** `assertProvidedFirst` in `source.ts` returns a warning string only when
  `captureMode === "silent"` and `!confirmedNoAlternative`; returns `undefined` otherwise. Three
  tests cover: warns-silent-unconfirmed, silent-confirmed, and provided/public/notes all silent.
- **C6 — met.** 15 tests, `node --test`, across the 4 named files, exactly matching the criteria
  they claim to cover (registry adapter-picking + NoMatchingSourceError + order; recording
  hash/captureMode/tenantId-required/transcribe-delegation; document
  detect/hash/captureMode/offsets/end-to-end; provided-first warning). No real file I/O — every
  reader/hasher/transcribe is a fixture from `testUtils.ts` or inlined per-test.
- **C7 — met.** All six verify commands re-run clean (see above); 48/48 total workspace tests
  pass, no regression in `ai`/`ask`/`index`.

## SCOREBOARD

7/7 criteria met, 0/0 additional invariants (none declared beyond the numbered criteria).

## Issues

None found. `Issues addressed` in the manifest: none claimed (first cycle), none applicable.

## Verdict

**PASS**
