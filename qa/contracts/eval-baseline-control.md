# Contract — eval-baseline-control (plan §10 U0.10 groundwork)

> Ground truth for the two sanity conditions every recall@k number in this repo is read against:
> a **question-blind control** (chance floor) and a **saturation/ceiling check**. Covers
> `packages/index/src/eval/baseline.ts`, `packages/index/src/eval/baseline.test.ts`, the
> `createNullRetriever`/`assessBaseline` exports in `packages/index/src/index.ts`, and the control
> half of `scripts/eval-recall.mjs` + the `control`/`assessment`/`goldenSetProvenance` fields of
> `data/eval/recall-report.json`.
>
> **Created and adopted by /checker in the same action** on the `eval-baseline-control` cycle-1
> check. The manifest deliberately deferred contract-writing to the checker per this project's
> segregation-of-duties rule (ISS-006), so there is no maker draft to react to — this file *is*
> the first draft, written from the manifest's proposed criteria plus this checker's own
> independent read of `baseline.ts`, `baseline.test.ts`, `eval-recall.mjs`, `recall.ts`,
> `gen-golden-set.mjs`, and its own re-derivation of every number.
>
> **Why this contract exists.** `qa/contracts/golden-set-recall.md` governs whether the recall
> harness *runs and reports a number*. It says nothing about whether that number can be *read*.
> It could not: `recallAtK: 1.000` with `misses: []` was on the books as evidence for a
> `checked-PASS` unit, and nothing in the repo distinguished "the retriever is excellent" from
> "the metric has no room left to move". This contract governs the instrument that tells those
> two apart, and it exists precisely so a future retrieval unit cannot report a bare score again.

## Scope

`packages/index/src/eval/baseline.ts` and its test, the two exports in
`packages/index/src/index.ts`, and the control/assessment reporting in `scripts/eval-recall.mjs`
and `data/eval/recall-report.json`.

Out of scope: `packages/index/src/eval/recall.ts` and `heuristic-retriever.ts` (governed by
`golden-set-recall.md`, deliberately untouched by this unit), the *content* of
`data/eval/golden-set.json` and its generator (governed by `golden-set-recall.md` C1, and the
subject of ISS-071 — this contract measures the set's inadequacy, it does not fix it), and the
execution of U0.10 itself.

## Criteria (each machine-checkable)

1. **[C1] The control is genuinely question-blind.** `createNullRetriever(sessionIds)` returns a
   `RetrieveFn` whose output depends on `sessionIds` and `k` only — never on the question
   argument. Verified by reading `baseline.ts:25-28` (the parameter is `_question`, unreferenced
   in the body) and by C7's mutation.
2. **[C2] The control is deterministic.** Repeated calls with any questions return byte-identical
   id arrays; no randomness, no time, no I/O. It copies `sessionIds` on construction so a later
   mutation of the caller's array cannot change past behaviour.
3. **[C3] The control respects `k`.** `retrieve(q, k).length === k` for `k <= sessionIds.length`.
4. **[C4] `at-chance` outranks `saturated` in verdict precedence.** In `assessBaseline`, the
   `liftOverControl <= 0` branch is evaluated **before** the `saturated` branch, so a retriever
   that fails to beat a blind control is reported `at-chance` even when its score is a perfect
   1.000 with zero misses. Reporting that case as merely `saturated` would flatter it; this
   ordering is the point of the module, not an implementation detail.
5. **[C5] Saturation is computed, never assumed.** `saturated` is derived as
   `measured.recallAtK >= 1 && measured.misses.length === 0` — read from the measurement, not a
   literal. `chanceFloor` is `k / sessionCount`, clamped to 1, with `sessionCount === 0 → 0`.
6. **[C6] The eval script reports the control beside the score, and persists it.**
   `node scripts/eval-recall.mjs` prints recall, control, chance floor, and a `VERDICT:` line, and
   writes `control`, `assessment`, and `goldenSetProvenance` into `data/eval/recall-report.json`.
   **A bare recall number with no control is not a reportable result under this contract.**
7. **[C7] Mutation-provable, both properties.** (a) Forcing `saturated = false` must redden
   exactly the "perfect score is reported SATURATED" test and nothing else. (b) Making
   `createNullRetriever` question-aware must redden **both** the blindness test and the
   chance-floor test. Each mutation must be proven applied by `diff` against a backup before its
   red/green result is trusted.
8. **[C8] The blindness test must be run on inputs the implementation could react to.** The
   questions in the blindness test must NAME session ids present in the candidate list. A
   blindness test whose questions contain nothing the control could respond to does not test
   blindness — it false-greens. (Re-derived independently: with the earlier id-free questions, a
   question-aware control passes the test named "ignores the question entirely".)
9. **[C9] Build stays green.** `pnpm --filter @lkb/index test`, `pnpm -r typecheck`,
   `pnpm lint:structure` all clean, and `node scripts/catalogue-score.mjs` is **unchanged** — this
   is eval instrumentation, not one of plan §4c's 57 catalogue features, so a score move here
   would indicate scope leakage.

## Invariants

- **[I1] Never report a recall number without its control.** Any future retrieval unit (U1.4,
  U1.5, U0.10 itself) that reports `recall@k` without the question-blind control beside it
  violates this contract, whatever its score. This is the invariant the whole unit exists to
  install.
- **[I2] Never soften the verdict to make a score look good.** Removing the `saturated` branch,
  reordering `at-chance` below `saturated`, or widening the `informative` branch so a pinned
  metric reports as informative is a CRITICAL amendment (it weakens a validity guard), never a
  routine edit — even if a number "looks wrong" as a result.
- **[I3] `chanceFloor == controlRecall` is a balanced-set coincidence, not a law.** It holds here
  because the golden set is exactly 2 questions per session across all 23 sessions, so a
  deterministic blind top-5 covers 10/46 = 5/23 exactly. On an **unbalanced** set the
  deterministic control is one specific draw, not an expectation, and the two will legitimately
  diverge. The script's side-by-side print is a sanity check, not an assertion — do not turn it
  into a hard equality check, and do not read a divergence as a harness bug without first
  checking the set's per-session balance.
- **[I4] The control must never be made question-aware "to be more realistic".** A control that
  sees the question is not a floor. If a stronger baseline is wanted (e.g. BM25), it is an
  *additional* baseline beside this one, never a replacement for it.

## Out of scope / ignore

- The golden set's provenance defect itself (ISS-071) — this contract's job is to *measure* it;
  fixing it is `golden-set-redesign`, a HUMAN_GATE unit already with the user.
- `recall.ts` / `heuristic-retriever.ts` internals — `golden-set-recall.md` owns them.
- Whether recall@5 = 1.000 is "good". Under this contract that question is not answerable from
  this set, which is the finding, not a criterion.

## Amendment log

- 2026-09-08 · routine · Contract CREATED and ADOPTED by /checker in the same action on the
  `eval-baseline-control` cycle-1 check, from the manifest's proposed criteria (deferred per
  ISS-006 segregation of duties) plus this checker's own independent verification: read of
  `baseline.ts`/`baseline.test.ts`/`eval-recall.mjs`/`gen-golden-set.mjs`; own re-run of
  `node scripts/eval-recall.mjs` (1.000 / 0.217 / SATURATED); independent re-derivation of the
  chance floor from the raw data (10 of 46 questions fall in a blind top-5 of 23 sessions =
  0.2174 = 5/23 exactly, control does not exceed it); both mutations reproduced with `diff` proof
  of application (a → 55/56 with only the saturation test red; b → 54/56 with both the blindness
  and chance-floor tests red), restored to 56/56 with no residue; and an independent
  reproduction of the disclosed false-green (reverting only the blindness test's questions to
  id-free ones under mutation b returns that test to GREEN — confirming C8 is load-bearing and
  the maker's fix is real). START stands on plan §10 U0.10.
