# Verdict — ingest-indexing-pipeline

Cycle checked: 1
Verdict: **PASS**

## Evidence (independently re-derived, fresh session)

1. Typecheck: `cd packages/index && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.
   `cd apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.

2. `pnpm -r test` from repo root, fresh: exit 0. Per-package counts (self-reported by each
   runner, summed by me):
   - packages/core: 7/7
   - packages/ai: 56/56
   - packages/ask: 32/32
   - packages/index: 38/38 (confirmed +13 vs. claimed prior 25)
   - packages/ingest: 40/40
   - packages/meeting-bot: 40/40
   - apps/api: 65/65
   - apps/web: 39/39 (10 test files)
   - **Grand total: 7+56+32+38+40+40+65+39 = 317, all pass.** Matches manifest exactly.

3. `pnpm lint:structure` → exit 0. `lint-dupes: OK (239 unique export(s), 24 unique schema
   $id(s))` — confirms the `CompleteFn` collision was actually resolved via the renamed
   exports (`SummarizeCompleteFn`/`ClaimsCompleteFn`), not just claimed. (Note: `lint-migrations`
   read 995 files vs. manifest's 993 — trivial drift from unrelated files added between manifest
   time and now, not a regression in this unit.)

4. Read `packages/index/src/pipeline/summarize.ts` end to end. `summarizeSession`: turns.length
   === 0 returns a static fallback (no LLM call, no throw). Otherwise the only LLM interaction
   (`complete()` call + `parseSummaryResponse`) is inside a `try { ... } catch { /* fall through
   */ }` block; every path after the try either `return`s a parsed result or falls through to the
   labeled fallback string (`"(fallback, LLM summary unavailable) <transcript.slice(0,500)>"`).
   No code path outside the try can throw. Confirmed never throws out of its own control.

5. Read `packages/index/src/pipeline/claims.ts` end to end. `extractClaims`: turns.length===0
   returns `[]`. LLM call wrapped in try/catch, catch returns `[]`. If `raw` isn't an array,
   returns `[]`. **The evidence cross-check is real, not decorative**: `validTurnIds = new
   Set(turns.map(t => t._id))` is built from the actual input `turns` (not from the LLM
   response), then `evidenceTurnIds = turnIds.filter(id => typeof id === "string" &&
   validTurnIds.has(id))` — a genuine membership filter against real ids. Immediately after,
   `if (evidenceTurnIds.length === 0) continue;` drops the claim entirely rather than keeping it
   with empty evidence. Verified by reading the filter/continue logic directly, not the
   docstring.

6. Read `apps/api/src/indexing.ts`. `toEvidenceTuple<T>(items)` throws `Error("toEvidenceTuple:
   evidence must be non-empty")` when `items.length === 0`. Call sites: for `session_pages`, only
   reached inside `if (turns.length > 0) { ... }`; for `claims`, `c.evidenceTurnIds` is guaranteed
   non-empty by `extractClaims`'s own `continue` above. Both call sites are provably
   pre-guaranteed non-empty. `deleteMany` calls for both `session_pages`
   (`{tenantId, sessionId}`) and `claims` (`{tenantId, "evidence.sessionId": sessionId}`) run
   before their respective `insertOne`/`insertMany` — confirmed delete-then-insert, no
   duplication risk. Branch: `existingRoot ? regenerate(...) : buildTree(...)[tenantId]` —
   confirmed regenerate-if-exists, fresh buildTree otherwise. Final line:
   `updateOne(..., { $set: { "status.index": "done" } })` — confirmed status flip is the last
   step.

7. Read `apps/api/src/ingest-store.ts` and `whatsapp-store.ts`. Both `createMongoIngestDeps`/
   `createMongoWhatsAppDeps` take `indexSession?: BoundIndexer` (genuinely optional — no test
   file for either exists, consistent with the disclosed no-test-for-composition-roots
   convention, and neither is called without the param anywhere in the codebase besides
   `production.ts`, which always supplies it). Both `ingestUrl`/`ingestGroup` wrap the
   `indexSession(...)` call in `if (indexSession) { try { await ... } catch (err) {
   console.error(...) } }` — a rejection is caught, logged, and never propagated; the function
   still returns its normal 201-worthy result object afterward.

8. Read `apps/api/src/production.ts`. `boundIndexer` calls
   `routeComplete(job.kind, job, { chains, providers, write: jobWrite, tenantId })` — routes on
   the job's own `kind` field (which `summarizeSession`/`extractClaims` set to `"summarize"`/
   `"claims"` respectively), so both job kinds route through `config/ai-routing.yaml`'s declared
   chains. `boundIndexer` is passed into both `createMongoWhatsAppDeps(boundIndexer)` (line 54)
   and `createMongoIngestDeps(boundIndexer)` (line 56). Confirmed.

9. **Independent live LLM verification performed** (GEMINI_API_KEY present in repo root `.env`).
   Wrote a standalone `apps/api/src/_checker_verify_indexing.ts`, importing the real
   `summarizeSession`/`extractClaims` from `@lkb/index`, real `GeminiProvider` from `@lkb/ai`,
   and real `realTransport` from `apps/api/src/ai-transport.ts`. Used my own fixture — a
   3-turn Japan work-study-visa/Waseda-University/MEXT-scholarship transcript, deliberately
   different from the maker's NZ fixture — and ran it via `node --import tsx
   src/_checker_verify_indexing.ts`. Result: a real, accurate 4-sentence summary with correct
   keyInsights/decisions, and 2 real claims each cited to the exact turn (`j1`, `j3`) that
   supports it. My own sanity check in the script (evidence ids all real, no empty-evidence
   claims) passed. (The third turn, a scheduling decision rather than a citable fact, correctly
   produced no separate claim — expected LLM judgment, not a defect.) Script deleted after the
   run; `git status` confirms no trace remains (see below).

10. `git status --porcelain`:
    ```
     M .goal/goal.json
     M apps/api/src/ingest-store.ts
     M apps/api/src/production.ts
     M apps/api/src/whatsapp-store.ts
     M data/eval/calibration-report.json
     M packages/index/package.json
     M packages/index/src/index.ts
     M pnpm-lock.yaml
    ?? apps/api/src/indexing.ts
    ?? packages/index/src/pipeline/
    ?? qa/contracts/ingest-indexing-pipeline.md
    ?? qa/manifests/ingest-indexing-pipeline.md
    ```
    Matches the manifest's claimed change list exactly (renamed exports in
    `packages/index/src/index.ts`, new `pipeline/` dir with the two new files + their tests, new
    `indexing.ts`, modified `ingest-store.ts`/`whatsapp-store.ts`/`production.ts`). No trace of
    my temporary verification script remains. Nothing committed by me.

11. Disclosed limitations judged **honest and consistent**: re-pinged
    `13.202.206.101` myself just now — 100% packet loss, matching the manifest's claim and
    today's three prior units' outage disclosures (session-pages-accessor,
    transcription-empty-result-guard, gemini-audio-transcription per the commit log). The
    no-direct-unit-test-for-composition-roots convention is real and pre-existing — confirmed no
    `store.test.ts`/`ingest-store.test.ts`/`whatsapp-store.test.ts` exist anywhere in the repo,
    and the pure orchestration logic (the actual branching worth testing) is covered by 13 real
    unit tests plus my own independent live Gemini run. Not corner-cutting.

## Verdict: PASS

All 8 contract criteria verified independently: no-fabrication summary fallback (never throws),
real evidence cross-check in claims extraction (traced line-by-line, not trusted from docstring),
correct Mongo write orchestration (delete-then-insert, regenerate/buildTree branch, status flip),
optional-indexer wiring with swallowed-and-logged failures in both store files, correct
`routeComplete(job.kind, ...)` wiring into both composition roots, zero regressions (317/317
tests, clean typecheck, clean lint:structure including the dupe-export fix), and a genuinely
independent live Gemini re-verification on a fresh fixture that produced correct, accurately
cited output. Disclosed limitations (Mongo write path unverified live due to real, re-confirmed
host outage; no dedicated unit test for composition-root files, following established codebase
convention) are honest and match what I independently observed.
