# Contract — evaluator-calibration (T-022)

> Ground truth for evaluator calibration, per plan §6c.3 evaluation plan and TASKS.md's own text
> ("Evaluator calibration on 30 hand-scored pairs", depends T-021). Drafted by the maker;
> /checker adopts or amends on first check.

## Scope, and an honest scope-down disclosed up front (same posture as T-021)
The plan's design is calibration against 30 **human**-hand-scored `(query, node)` pairs, run
through the real `packages/ask` evaluator with an LLM-backed `scoreFn`. Two blockers apply, both
already logged: (1) no human scorer is available in this autonomous session; (2) the real
LLM-backed scorer is blocked on ISS-015 (invalid `GEMINI_API_KEY`, same root cause as T-003/T-021).
This unit builds the injectable MAE-calibration harness (pure, testable, no I/O) plus a
**derived, not hand-scored** reference set (own-session pairs get a reference score of 1.0,
deliberately cross-topic pairs get 0.0 — a mechanical proxy for "clearly relevant" /
"clearly irrelevant", not nuanced human judgment) and calibrates it against a local heuristic
scorer built for this harness. **This is explicitly NOT the plan's final calibration** — a real
human-scored set + the real LLM judge, once ISS-015 clears, is the required follow-up before this
number means anything for production tuning.

## Criteria (each machine-checkable)

1. **`packages/ask/src/eval/calibration.ts`**: pure `computeMAE(pairs, scoreFn):
   Promise<CalibrationResult>` — `pairs: {id, query, node: TreeIndexNode, referenceScore:
   number}[]`, `scoreFn: ScoreFn` (the real evaluator seam type from `evaluator.ts`, so this
   harness works against ANY scorer — heuristic, fake, or a real LLM judge once available, without
   modification). Always treats `scoreFn` as async (`await Promise.resolve(...)`, matching
   `evaluator.ts`'s own dual-mode handling) so a sync OR async scorer both work unmodified.
   `CalibrationResult = {mae, n, details: {id, predicted, reference, absError}[]}` — every pair's
   individual error is named (matching this codebase's per-candidate audit-trail discipline).
2. **`packages/ask/src/eval/heuristic-scorer.ts`**: a local, self-contained keyword-overlap
   `ScoreFn` built for this harness (packages/ask cannot depend on `apps/api` or `packages/index`
   per `.dependency-cruiser.cjs`'s rules — this is a new, small, purpose-built scorer, not an
   illegal cross-package import of `apps/api/src/score.ts`'s `heuristicScore` or
   `packages/index/src/eval/heuristic-retriever.ts`). Same bag-of-words technique as those, scores
   `query` against `node.title + " " + node.summary}`.
3. **`data/eval/evaluator-calibration-set.json`**: derived from T-021's real
   `data/eval/golden-set.json` (`scripts/gen-calibration-set.mjs`, new) — for at least 15 golden
   questions, TWO pairs each: `{id, query, sessionId, referenceScore: 1.0}` (its own session,
   "clearly relevant") and `{id, query, sessionId: <a deliberately different session>,
   referenceScore: 0.0}` ("clearly irrelevant") — at least 30 pairs total. Idempotent
   (deterministic pairing rule, same output on re-run).
4. **`scripts/eval-calibration.mjs`**: same `tsx/esm/api` pattern as `scripts/eval-recall.mjs`;
   builds the real tree from `data/toc-migrated/*`, resolves each calibration-set entry's
   `sessionId` to its tree node, runs `computeMAE` against the heuristic scorer, prints MAE +
   every pair's detail, writes `data/eval/calibration-report.json` (`{generatedAt, scorer:
   "heuristic", mae, n, details}`). No live network call.
5. **Tests exist and pass**: `packages/ask/src/eval/calibration.test.ts` covering
   `computeMAE` with a fake sync `ScoreFn` (perfect predictions → mae 0; a known offset → mae
   equals that offset) and a fake ASYNC `ScoreFn` (proving the async-scorer path works
   unmodified — this is the seam's whole point per criterion 1); `packages/ask/src/eval/
   heuristic-scorer.test.ts` covering the scorer against a synthetic node (query overlapping the
   summary scores higher than a non-overlapping query).
6. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-022
- No claim that this MAE number calibrates the REAL LLM judge (blocked on ISS-015) or reflects
  real human judgment (no human scorer available). No wiring into `apps/api`'s production `/ask`
  route or `createLlmScorer` (T-009b) — this is an offline calibration script, same posture as
  T-021's `eval-recall.mjs`. No threshold-tuning of `evaluator.ts`'s `UPPER_THRESHOLD`/
  `LOWER_THRESHOLD` based on this run (premature against a non-representative scorer+reference).
