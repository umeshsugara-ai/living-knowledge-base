# Verdict — ask-web-fallback-tavily

Cycle checked: 1
**Verdict: PASS**

## Evidence (re-run fresh, this session, from D:\KnowledgeBase)

1. `cd packages/ask && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.
2. `cd apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.
3. `pnpm -r test` from repo root, fresh run → exit 0 across all packages. Per-package counts
   confirmed individually from raw output:
   - packages/core 7/7, packages/index 25/25, packages/ai 56/56, packages/ingest 34/34,
     **packages/ask 32/32** (matches claimed +2 from 30), packages/meeting-bot 40/40,
     **apps/api 59/59** (matches claimed +3 from 56), apps/web 34/34 (9 test files, vitest).
   - Sum: 7+25+56+34+32+40+59+34 = **287**, all pass, 0 fail — matches contract exactly.
4. `pnpm lint:structure` → exit 0. lint-loc/lint-dirsize/lint-root/lint-dupes/lint-migrations all
   OK, SNAPSHOT.md fresh, dependency-cruiser 226 modules/648 deps clean.
5. `git diff --stat packages/ask/src/router.ts packages/ask/src/router.test.ts` → **empty output**,
   confirmed. Frozen sync interface genuinely untouched.
6. Source review:
   - `packages/ask/src/ask-v2.ts` (lines 60-97): `askResult.insufficient_coverage && tavilySearchFn`
     gate is correct. Traced `router.ts`'s `finishAsk` (lines 51-58): `insufficient_coverage` is
     set `true` only in the branch where `webFallbackFn === undefined` — i.e. whenever a sync
     `webFallbackFn` is supplied and verdict != correct, it always runs and `insufficient_coverage`
     is `false`. So the async tavily path and the sync path are provably mutually exclusive by
     construction, not just by convention. Logs via `recordJob({kind: "ask.web_fallback", ...})`
     and pushes `auditLog` entry with `step: "web_fallback"` — matches. When `tavilySearchFn` is
     omitted, the `if` block is skipped entirely and `askResult` flows through unchanged —
     byte-identical to pre-unit behavior, confirmed by reading the diff shape (only additive).
   - `packages/ask/src/ask-v2.test.ts` (lines 100-153): 2 new tests are real and meaningfully
     distinct — one drives `insufficient_coverage: true` via a low score with no sync
     `webFallbackFn`, injects a fake async `tavilySearchFn`, and asserts it fires, clears
     `insufficient_coverage`, sets `web_used: true`, merges `sources.web`, and is audited; the
     other omits `tavilySearchFn` entirely and asserts `insufficient_coverage` stays `true`,
     `web_used` stays `false`, and no `web_fallback` audit entry appears.
   - `apps/api/src/ask-web-fallback.ts`: `createTavilySearchFn()` returns `undefined` when
     `process.env.TAVILY_API_KEY` is falsy (line 39-40); the real `tavilySearch()` throws
     `Error("Tavily search failed (HTTP ${res.status})")` on `!res.ok` — never swallows to `[]`;
     maps Tavily's real `{results:[{title,url,content}]}` shape 1:1 into `WebSource[]`.
   - `apps/api/src/ask-web-fallback.test.ts`: 3 tests, all real — (a) key unset → `undefined`,
     (b) key set + `fetch` genuinely monkey-patched on `globalThis.fetch` (not a real network
     call) → asserts exact request URL/body and mapped response, (c) `fetch` returns `ok:false`
     → asserts the promise rejects with the exact error message. Not tautological; each asserts
     real behavior with fetch fully mocked.
   - `apps/api/src/production.ts` (lines 35, 60-63): `const tavilySearchFn = createTavilySearchFn();`
     then `...(tavilySearchFn ? { tavilySearchFn } : {})` — genuine spread-conditional, matches
     the file's existing `corsOrigins` composition-root style. Confirmed not unconditional.
7. `git status --porcelain`: modified `apps/api/src/production.ts`, `packages/ask/src/ask-v2.ts`,
   `packages/ask/src/ask-v2.test.ts`; untracked `apps/api/src/ask-web-fallback.ts`,
   `apps/api/src/ask-web-fallback.test.ts`, `qa/contracts/ask-web-fallback-tavily.md`,
   `qa/manifests/ask-web-fallback-tavily.md` — matches the manifest's claimed changed-file set
   exactly (plus unrelated pre-existing `.goal/goal.json` and `data/eval/calibration-report.json`
   diffs not part of this unit). Nothing committed by this checker.
8. Disclosed limitations independently sanity-checked, both hold up:
   - `.env`'s `TAVILY_API_KEY=` is genuinely empty — confirmed by direct read.
   - `ping -n 2 13.202.206.101` re-run this session: 100% packet loss, same as manifest's claim —
     the Mongo host is still unreachable. Both limitations are honestly disclosed with real
     evidence attached, not used to paper over untested logic — the actual new code (merge logic,
     Tavily client, wiring) is fully unit-tested with fakes/mocks, and the limitations only affect
     the un-mockable live-network paths (real Tavily account, real Mongo-backed server), which
     the manifest is explicit about never having claimed to verify.

## Conclusion

All 8 verification steps from the contract's "How to verify" section reproduce cleanly. The
design constraint (frozen `router.ts` untouched, new async fallback layered entirely in
`ask-v2.ts`) is real and provably mutually exclusive with the existing sync path by tracing
`finishAsk`. Test coverage is real, not tautological, and mocks network correctly. No issues
found.
