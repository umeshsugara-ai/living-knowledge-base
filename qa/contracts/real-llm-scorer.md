# Contract — real-llm-scorer (T-009b)

> Ground truth for replacing the heuristic keyword-overlap scorer with a real async LLM-based
> relevance judge, per the checker's flagged follow-up during T-009 (`qa/contracts/developer-api.md`
> amendment log). Drafted by the maker; /checker adopts or amends on first check.

## Scope
Make `packages/ask/src/evaluator.ts`'s `ScoreFn` type accept an async return (`Promise<ScoreResult>`
in addition to the existing sync `ScoreResult`), update `evaluate()`/`ask()`/`askV2()` to `await`
it, and add a real LLM-backed scorer in `apps/api/src/score.ts` using T-019's provider router
(`complete("evaluator", ...)` jobKind) instead of the keyword heuristic. The heuristic stays as a
named fallback/test double, not deleted — useful for offline tests and as a documented degrade
path if the LLM call fails. **This is a breaking-ish interface change to an already-PASSed unit
(T-005/T-005b)** — must not regress any existing test in `packages/ask`.

## Criteria (each machine-checkable)

1. **`ScoreFn` type widened**: `packages/ask/src/evaluator.ts` — `type ScoreFn = (query, node) =>
   ScoreResult | Promise<ScoreResult>`. `evaluate()` awaits the result regardless of which shape
   `score_fn` returns (`await Promise.resolve(score_fn(...))`). All existing T-005/T-005b tests
   (sync fakes) must pass **unmodified** — this is the backward-compatibility bar.
2. **`ask()`/`askV2()` updated** to `await evaluate(...)` if not already (check — `evaluate` may
   already be awaited; if so this criterion is trivially met, note it in the manifest).
3. **`apps/api/src/score.ts`** gains `createLlmScorer(complete): ScoreFn` — calls T-019's real
   `complete` (routed for `jobKind: 'evaluator'`, add this jobKind to `config/ai-routing.yaml` if
   missing) with a prompt asking for a relevance score 0-1 + reason (mirrors the brain page
   `corrective-rag-crag`'s "be conservative with high scores" system-prompt guidance — cite it in
   the prompt as a comment), parses the response into `ScoreResult`. The existing
   `heuristicScore` stays exported, used as `createLlmScorer`'s fallback on a parse failure or
   `complete` throwing (never crash the `/ask` route because the judge call failed).
4. **Wired into production** (`apps/api/src/production.ts` or wherever T-009 assembles real deps):
   `/ask` and `/compete/start` (T-012) now use `createLlmScorer` by default, with `heuristicScore`
   as the documented fallback path, not the primary.
5. **Tests exist and pass:** new tests in `packages/ask/src/evaluator.test.ts` (extend, don't fork)
   covering an async fake `score_fn`; new tests in `apps/api/src/score.test.ts` covering
   `createLlmScorer` with a fake `complete` (valid response parses correctly; malformed response
   falls back to `heuristicScore`, not a thrown error).
6. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (every existing suite green, esp.
   `packages/ask`'s full existing count + `apps/api`'s 14), `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-009b
- No change to the evaluator's threshold logic (0.3/0.7 stays). No live API key required to PASS
  (fake `complete` in tests, as always). No UI change to the compete screen beyond the scorer
  swap underneath.
