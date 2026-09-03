# Contract — ai-provider-seam (T-019)

> Ground truth for the multi-provider AI backend decided in D-005/D-008 (plan §6c.0/§6c.3, grill
> Q5/Q6: "no single-AI dependency… rotate kar paayen… jis provider ko choose kiya uske saare
> models ke versions dropdown mein aa jaayen"). Drafted by the maker; /checker adopts or amends on
> first check.

## Scope
`packages/ai` gains a provider interface, five adapters (gemini, anthropic, openai, ollama,
claude-code), a `listModels()` seam per adapter, a user-editable ordered routing chain per
`jobKind`, a `jobs` ledger write on every call, and an STT sub-seam (`packages/ai/stt`) with
whisper (default) + gemini adapters. No live network calls are required to PASS — every adapter's
HTTP/process-spawn call is behind an injectable transport so the contract is testable offline with
fakes, matching the pattern already used in `packages/ask` (injectable `score_fn`) and
`packages/index` (injectable `summarize`).

## Criteria (each machine-checkable)

1. **One `Provider` interface** (`packages/ai/src/provider.ts`):
   `complete(job: {kind: string, messages: Message[], tools?, schema?, maxCost?}) => Promise<{text,
   json?, usage: {inputTokens, outputTokens}, provider: string, model: string, costUsd: number}>`
   and `listModels(): Promise<{id: string, label: string}[]>`. Exported as a TS interface, one
   definition, imported by every adapter (no re-declared shape per adapter).
2. **Five adapters exist**, each implementing `Provider`, each in its own file ≤300 LOC:
   `packages/ai/src/providers/{gemini,anthropic,openai,ollama,claude-code}.ts`. Each adapter's
   HTTP/CLI call is behind an injected `transport` parameter (constructor or factory arg) so tests
   never make a real network call. `anthropic.ts` supports both an API-key mode and an
   OAuth/Claude-Code-login mode per D-008 (may delegate the OAuth mode to `claude-code.ts`
   internally — one implementation, not two).
3. **`listModels()` is real per adapter**, not a stub returning `[]`: gemini/openai/anthropic
   return a hardcoded-but-labeled current model list (documented as "static manifest, refresh via
   provider docs" since a live API call isn't required for PASS); ollama's `listModels()` calls its
   local `/api/tags`-shaped transport (injectable, testable with a fake); claude-code's returns a
   static manifest of Claude model aliases usable via `claude -p --model <alias>`.
4. **`config/ai-routing.yaml`** declares, per `jobKind`, an **ordered array** of provider names
   (length ≥ 1, user-editable, no hardcoded max) — e.g. `transcribe-namemap: [gemini, ollama,
   claude-code]`. `packages/ai/src/router.ts` exports `route(jobKind, config) => Provider[]`
   (resolves names to adapter instances in order) and `complete(jobKind, job, config) =>` tries
   each in order, returning the first success, throwing a typed `AllProvidersFailedError` (never a
   silent empty result) if every provider in the chain fails.
5. **`jobs` ledger write on every call**, success or failure: `packages/ai/src/jobs.ts` exports
   `recordJob(entry)` writing to the `jobs` collection shape from `schema/jobs.schema.json`
   (T-018) — `{tenantId, kind, status, provider, model, costUsd, createdAt, error?}`. Injectable
   `write` function (no live Mongo needed to test — matches the `packages/db` accessor pattern).
6. **STT sub-seam** (`packages/ai/src/stt/`): `transcribe(audio, opts) => Promise<Turn[]>`
   interface, `whisper.ts` (default, local) and `gemini.ts` (used when a Gemini key is configured
   and preferred, per H9) implementations, both behind injectable transport.
7. **Parity contract test**: `packages/ai/src/provider.test.ts` runs the SAME fixture job through
   at least 2 of the 5 adapters using fake transports that return canned-but-realistic responses,
   and asserts both produce a `complete()` result matching the shared `Provider` return shape
   (same keys, same types) — proving the interface is actually uniform, not just declared uniform.
   Also tests: `router.complete()` tries providers in order and stops at first success (fake
   transport #1 fails, #2 succeeds → result is from #2, #1 was attempted); `router.complete()`
   throws `AllProvidersFailedError` when every provider in the chain fails; `recordJob` is called
   exactly once per `complete()` attempt (success or failure) with the injectable `write`.
8. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (existing suites unaffected, new
   `packages/ai` tests green), `pnpm gen:types --check`, `python schema/validate.py`,
   `pnpm lint:structure` all clean.

## Non-goals for T-019
- No real API keys are called. No HTTP server/routes (T-009). No cost-budget enforcement /
  throttling (explicitly dropped per D-005/D-008 — "no budget-guard work now"). No web-search
  provider for CRAG (folds into `ask-router` v2, a separate unit, T-005b) unless trivially reusing
  this same `Provider` shape — if so, note it in the manifest but don't block T-019 on it.
