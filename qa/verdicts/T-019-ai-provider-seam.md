# Verdict — T-019 ai-provider-seam

**Date:** 2026-09-03
**Cycle checked:** 1
**Checker mode:** A (unit check), fresh subagent, read-only toward the artifact.

## Re-run evidence (all commands re-executed by the checker, not trusted from the manifest)

```
pnpm --filter @lkb/ai typecheck   -> clean (no output)
pnpm --filter @lkb/ai test        -> 23/23 pass (matches manifest test names + counts exactly)
pnpm -r typecheck                 -> 9/9 workspace projects Done, no errors
pnpm -r test                      -> packages/ask 6/6, packages/index 4/4, packages/ai 23/23, all pass
pnpm gen:types --check            -> OK: 19 generated type file(s) + index.ts match schema/
python schema/validate.py         -> PASS: 19 collection schema(s) validated correctly
pnpm lint:structure                -> lint-loc/dirsize/root/dupes/migrations OK, snapshot fresh,
                                        depcruise: no dependency violations (65 modules, 123 deps)
```
All 7 verify commands clean; independently reproduced, not pasted-output-trusted.

## Criteria (read against source, not the manifest's self-report)

- **C1** — MET. `packages/ai/src/provider.ts` declares one `Provider` interface plus the shared
  `Message`/`Job`/`CompleteResult`/`ModelInfo`/`Transport` shapes; every adapter imports these
  types, none re-declares them.
- **C2** — MET, verified by direct read of all 5 files + grep. Each adapter file is its own
  file, well under 300 LOC (96/83/81/81/72 lines). Each routes 100% of its network/CLI I/O
  through the injected `transport` parameter — confirmed by reading gemini.ts, openai.ts,
  ollama.ts, anthropic.ts, claude-code.ts, whisper.ts, gemini.ts (stt) in full: no adapter calls
  `fetch`/`http`/`child_process`/`exec`/`spawn` directly. `grep -n
  'fetch\(|axios|child_process|execSync|spawn\(' packages/ai/src` returned exactly one hit, in
  `routing-config.ts` — a false positive (`/regex/.exec(line)`, not process exec), confirmed by
  reading that file. **The anthropic/claude-code "one implementation" claim verified directly**:
  `anthropic.ts`'s oauth mode calls `runClaudeCodePrompt` imported from `./claude-code.js`
  (`anthropic.ts:9,45`); `claude-code.ts` defines `runClaudeCodePrompt` once and both
  `ClaudeCodeProvider.complete` and `AnthropicProvider`'s oauth branch call the same function —
  no duplicated CLI-argv-building or response-parsing logic exists in `anthropic.ts`. This is
  genuinely one implementation, not two adapters that happen to coexist.
- **C3** — MET. gemini/openai/anthropic/claude-code return static labeled arrays (`GEMINI_MODELS`,
  `OPENAI_MODELS`, `ANTHROPIC_MODELS`, `CLAUDE_CODE_MODELS`); ollama's `listModels()` makes a real
  call through `transport` to a `/api/tags`-shaped request (`ollama.ts:65-80`), test-verified with
  a fake transport and a `.endsWith("/api/tags")` assertion.
- **C4** — MET. `config/ai-routing.yaml` has 7 jobKinds, each an ordered array (all Gemini-first,
  per D-005). `router.ts` exports `route()` (resolves names to `Provider` instances, throws on
  unknown jobKind/provider) and `complete()` (tries in order, first success wins, throws typed
  `AllProvidersFailedError` with per-attempt errors — never a silent empty result).
- **C5** — MET. `jobs.ts`'s `recordJob(entry, write)` types `JobEntry` from the generated `Jobs`
  type (`@lkb/core`, itself generated from `schema/jobs.schema.json`, confirmed via `pnpm
  gen:types --check` passing), fills `createdAt` if absent, calls the injected `write` — no live
  Mongo. `router.ts.complete()` calls `recordJob` exactly once per attempt (both the success path
  and the catch path), test-verified in `router.test.ts` for order/first-success/all-fail/
  single-provider cases.
- **C6** — MET. `stt/transcribe.ts` declares the shared `SttAdapter`/`Turn`/`Transcribe`
  interface; `whisper.ts` (local, default, calls a local `:8899/transcribe` HTTP job endpoint) and
  `gemini.ts` (calls the Gemini `generateContent` endpoint) both implement it, both exclusively
  through the injected `Transport` — confirmed by reading both files in full.
- **C7** — MET. `provider.test.ts` runs the same fixture job through `GeminiProvider` (http
  transport) and `ClaudeCodeProvider` (cli transport) with fake transports and asserts identical
  `CompleteResult` key sets and field types — genuine cross-adapter parity, not two separate
  assertions. `router.test.ts` covers ordered-first-success, `AllProvidersFailedError` on total
  failure (asserting `err.attempts` names both providers), and `recordJob`-once-per-attempt for
  both the 2-provider fallback case and the 1-provider success case.
- **C8 (no regression)** — MET, see verify-command re-run above; identical pass counts to the
  manifest (23/23 packages/ai, 6/6 ask, 4/4 index — no drop from prior baseline).

Non-goal (web-search CRAG provider) correctly deferred per contract; open ledger item ISS-010
(goal-coverage sweep finding, not a T-019 acceptance criterion) already reflects this as a scoped
amendment target for T-005b, not a T-019 blocker — left open, unaffected by this unit.

## Contract adoption

Contract was maker-drafted. Read in full against D-005 and D-008
(`docs/DECISIONS.md`) and plan §6c.3: Gemini-first ordering, Claude via OAuth/claude-code CLI (not
API keys) with Anthropic Messages API optional/flagged, jobs ledger with `maxCost`, five adapters
+ `listModels()` + STT seam — all faithfully reflected in the contract's criteria. Adopted as-is;
appended a routine amendment-log entry recording the adoption (`qa/contracts/ai-provider-seam.md`,
no wording changes).

## No issues found

No new `qa/issues.jsonl` entries — no defect discovered in this unit.

---

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, all invariants hold (no separate [I*] invariants beyond the C1-C8 criteria in this contract)
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All 7 verify commands re-run independently and clean, matching the manifest's claims
exactly. Direct read of provider.ts, router.ts, jobs.ts, all 5 provider adapters, both STT
adapters, and 3 test files confirms every criterion is genuinely met: a single Provider interface,
five adapters each behind an injected transport with zero raw network/process calls outside that
seam, real ollama listModels(), an ordered router with typed failure and exactly-once ledger
writes, and a true cross-adapter parity test. The anthropic/claude-code OAuth delegation is
confirmed to be one shared implementation (runClaudeCodePrompt), not two.
```
