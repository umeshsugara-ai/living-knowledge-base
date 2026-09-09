# Contract — vector-retrieval

> **Status:** ACTIVE. Created by **/checker** on 2026-09-09 under `/checker init-contract`, authorized
> by the human answer recorded in `qa/gates/vector-retrieval-contract.md` (**Answered: 2026-09-09 —
> Option 1, both layers**, Umesh). That gate's own provenance note is honest that the answer was a
> general "go with whatever is best" rather than an option-by-option ruling; what it authorizes is
> exactly the recommendation on the table — **the checker drafts, the human approves.**
>
> **Criteria in this file may be changed only by a checker, never by the maker.** A maker writing the
> contract it will be judged against is the segregation-of-duties failure ISS-006 was filed for, and
> `.claude/CLAUDE.md` makes `qa/contracts/` read-only to the maker (feedback goes to
> `qa/feedback-inbox.md`).
>
> **Derivation.** Every criterion below is derived from the **code** (`packages/index/src/vector/*.ts`,
> `scripts/eval-recall.mjs`), from **D-021**, from plan §10 U1.4/U1.5, and from the two
> `vector-cosine-retriever` verdicts (cycles 1–2) — *not* transcribed from the manifest. Where the
> manifest and a verdict agree on a constraint, the verdict is cited, because the manifest is the
> artifact under judgement.

## North star

`packages/index/src/vector/` is a **pure, exact, deterministic ranking layer**. It takes vectors and
returns rankings; it performs no I/O. Its two jobs are (a) to be *correct enough to be trusted as a
measuring instrument* — because every recall delta in this project is read off it — and (b) to
**refuse loudly** rather than return a plausible-looking wrong number. A silently wrong ranking looks
exactly like a correct one, which is why most criteria below are about refusal and determinism rather
than about score.

## Scope

**In scope**
- `packages/index/src/vector/cosine.ts` — `cosineSimilarity`, `rankByCosine`, `rankSessionsByCosine`
- `packages/index/src/vector/retriever.ts` — `createVectorRetriever`
- `scripts/eval-recall.mjs` **`--retriever vector` mode only** — the vector branch, its latency block,
  and its per-retriever report path

**Out of scope — a future checker must NOT grade these against this contract**
- The **recall number's absolute value as a quality claim.** C6/C7 govern how it may be *cited*; this
  contract sets no floor on recall itself. Ranking quality is a property of the corpus, the chunker
  and the embedding model, none of which live here.
- **The golden set** (`qa/contracts/golden-set-recall.md`, `qa/gates/golden-set-redesign.md`), the
  control/`assessBaseline` machinery, and `filterBias` — those predate this layer and are
  retriever-agnostic (`eval-recall.mjs:96-99` marks the boundary explicitly).
- **The embedding provider** and the batched `embed()` call. The embedding is hoisted out of the hot
  path on purpose (`retriever.ts:5-14`); provider behaviour is `ai-provider-seam.md`'s.
- **The heuristic and tree retrievers**, and `RetrieveFn`'s synchronous signature itself.
- **End-to-end `/ask` latency**, `vectorSearchFn` injection at the composition root, and the hybrid
  merge — those are U1.5's and belong in `ask-router-v2.md` or a successor, not here. See C8.
- **Plan §10 prose as such.** Four consecutive checks in this repo graded shipped layers against plan
  bullets. This file exists to stop that; grade the criteria below.

## Acceptance criteria

### C1 — Dimension mismatch refuses, it does not truncate or coerce
`cosineSimilarity(a, b)` with `a.length !== b.length` **throws**, naming both lengths. `rankByCosine`
throws on the first mismatched chunk **by default**, and skips only when the caller passes
`skipMismatched: true` explicitly.
*Verified by:* mutation — change `a.length !== b.length` to `false` (and separately invert the
`skipMismatched` default) and confirm a **named** test reddens. Reachable in practice: a re-embed
under a changed model leaves 768- and 3072-dim rows side by side.

### C2 — A zero-magnitude vector scores 0, never `NaN`
`magA === 0 || magB === 0` returns `0`.
*Verified by:* mutation — remove the guard and confirm a named test reddens on the re-admitted `NaN`.
Rationale is load-bearing, not cosmetic: `NaN` poisons every comparison it touches and sorts
unpredictably, so one bad row would silently scramble a whole ranking.

### C3 — Ranking is deterministic on identical input
Equal scores break ties on `chunkId`, so the same corpus and query always yield the **same ordered**
result — not merely the same set.
*Verified by:* mutation — reduce the comparator to `y.score - x.score` and confirm a named test
reddens. Additionally, a re-run of `--retriever vector` must reproduce the previous report's misses
**including each miss's full ordered top-5 `got` list**; only `generatedAt` may differ. (Cycle 1
established this holds byte-identically; it is a criterion now, not an observation.)

### C4 — Dedupe before truncate
`rankSessionsByCosine` ranks **all** chunks, collapses to one row per `sessionId` keeping that
session's **best** chunk, and only then takes `k`.
*Verified by:* two mutations, each of which must redden a named test — (a) truncate first
(`rankByCosine(…, k)` instead of `chunks.length`), (b) keep the **worst** chunk per session (drop the
`!best.has` guard). This defends against one long session filling every slot with near-duplicate
neighbours, which the deliberately overlapping chunker makes *more* likely.

### C5 — A missing question embedding is never scored as a retrieval miss
`createVectorRetriever` **throws** by default when `questionVectors` has no entry for the question.
Returning `[]` is available only via an explicit `onMissingEmbedding: "empty"` opt-in.
*Verified by:* mutation — make the missing case return `[]` unconditionally and confirm a named test
reddens. This is the criterion that keeps the instrument honest: a metric that reports a plumbing
failure as a retrieval failure is worse than no metric.

### C6 — `recall@5 = 0.935` is a FLOOR and carries its caveat wherever it is cited
**This is the criterion the gate was raised for.** Stated so it survives out of the manifest and the
verdict it currently lives in:

> **0.935 (86/92) is a downward-biased FLOOR, citable only with the sibling-session-ambiguity caveat
> attached, and it may NOT on its own satisfy a `≥ 0.85` exit criterion, nor close condition 4 of
> `qa/gates/golden-set-redesign.md`, while that gate's precondition 1 (sibling-session ambiguity)
> remains open.**

The robust statement is the **delta** (+0.543 over the heuristic 0.391), because both retrievers face
the identical ambiguity over the identical 92 questions, so whatever share of the six residual misses
is mislabelled subtracts from both sides.
*Verified by:* a checker greps every artifact that cites the number — manifests, verdicts,
`docs/PROGRESS.md`, DECISIONS entries, code comments — and confirms each citation either carries the
caveat or is a delta. A bare `0.935` used to clear a threshold is a **FAIL of this criterion**,
independent of whether the unit's own work is sound.
*Why it is a criterion and not a note:* an uncaveated `1.000` became load-bearing in this project
once already, before the golden set was rebuilt. Precondition 1 is still open; precondition 2
(ISS-093's biased post-filter) **is** discharged — the current set rejects 0 candidates, so
`kept === combined` — and this criterion is satisfied when precondition 1 closes, not before.

### C7 — The two retrievers' reports never overwrite each other
The heuristic baseline (`data/eval/recall-report.json`) and the vector report
(`data/eval/recall-report-vector.json`) are separate files, and `scripts/eval-recall.mjs` is the
**only** writer of either.
*Verified by:* `git diff <pre-unit-sha> HEAD -- data/eval/recall-report.json` is **empty** after a
vector run, plus `grep -rn "recall-report" scripts packages apps package.json` showing no second
writer. A delta is meaningless if the run that produces one arm silently rewrites the other.

### C8 — The latency figure is measured, scoped, and stated as ranking-only
The vector run records `p50 / p95 / max` over the **ranking calls only**, excluding the batched
embed, with the exclusion disclosed **in the report's own `note` field**. The excluded term is
legitimate *for the decision this number supports* — brute force vs ANN — because embedding cost is
common to both arms and cancels.
Two bounds, both binding:
- **`p95` must remain inside D-021's ~500 ms revisit threshold.** Above it, D-021 says revisit; a
  checker files that rather than waving it through. (Observed: 62–78 ms across two independent runs —
  roughly 6–8× inside.)
- **This figure may NOT be cited as end-to-end `/ask` latency**, where one un-amortised embed
  round-trip per question is real and is measured by nothing in this layer.
*Verified by:* re-run `node scripts/eval-recall.mjs --retriever vector`, read `latency` from the
report you just generated, and confirm the disclosure text is present. Wall-clock values will differ
run to run (25 % spread is ordinary for ~92 CPU-bound samples); judge the **band and the threshold**,
never a decimal match.

### C9 — Purity and the seam
Nothing in `packages/index/src/vector/` performs I/O, imports a database or provider client, or
depends on `apps/`. `createVectorRetriever` satisfies `RetrieveFn` unchanged, so swapping in a real
vector DB later is an injection change and not a rewrite.
*Verified by:* `npx depcruise --config .dependency-cruiser.cjs packages apps` exit 0, plus a read of
the imports in both files.

### C10 — Standing gates
`pnpm -r typecheck` and `pnpm -r test` each exit 0, judged **by their own exit codes** and not
through the `lint:structure` wrapper.
*Verified by:* running each. A `lint:structure` exit 1 attributable to another lane's `TASKS.md` /
`.goal/goal.json` tracker rows is **not** chargeable to this layer; say so and move on.

## Invariants

- **[I1] The layer is a measuring instrument before it is a feature.** Any change that improves a
  recall number while weakening C1–C5 is a regression, whatever the number does.
- **[I2] Every criterion above is mutation-checkable, and coverage is assumed absent until a mutation
  proves it present.** In this repo three separate guards shipped whose branch never executed, and
  every one was found by mutation rather than by a passing suite. A test sitting near the code is not
  coverage.
- **[I3] Refusals are defaults; permissiveness is opt-in.** `skipMismatched` and
  `onMissingEmbedding: "empty"` must both stay non-default. Flipping either default is a **critical**
  amendment requiring human approval, not a routine tightening.
- **[I4] No number produced by this layer closes a gate that gates this layer.** C6 is the standing
  instance.

## Deliberately NOT criteria, and why

- **A recall floor (e.g. "≥ 0.90").** The evidence does not support pinning one. 0.935 is measured on
  one corpus with acknowledged ambiguous ground truth, and at least two of the six residual misses
  are a corpus-coverage artifact — `2026-05-23-uniaccess-atlas-skilltech` has **4 chunks** against
  21–45 for the other missed sessions. A floor set from that number would encode a corpus property as
  a code requirement, and the first honest re-chunk would break it.
- **"Six residual misses are acceptable."** Whether those six are retrieval failures or mislabelled
  ground truth is precisely what gate precondition 1 is open about. Writing either answer into a
  contract would settle by fiat a question the gate holds open.
- **An ANN/index requirement, or a prohibition on one.** D-021 chose brute force on measured grounds
  with a stated revisit threshold; C8 enforces the threshold. Naming an implementation would
  duplicate D-021 and drift from it.
- **A p95 numeric budget tighter than D-021's ~500 ms.** Only two runs on one laptop exist. A tighter
  budget would be invented, not derived, and would fail on a slower machine for no defect.
- **Anything about `vectorSearchFn` injection or the hybrid merge.** Not built yet; grading unbuilt
  work against prose is the failure this file exists to end.

## Amendment log

- 2026-09-09 · **START (human-approved)** · contract CREATED by /checker under `/checker
  init-contract vector-retrieval`, per the answer recorded in `qa/gates/vector-retrieval-contract.md`
  (2026-09-09, Umesh, Option 1, both layers). Criteria derived from `cosine.ts`, `retriever.ts`,
  `scripts/eval-recall.mjs`, D-021, plan §10 U1.4/U1.5, and the cycles 1–2 `vector-cosine-retriever`
  verdicts. C6 lifts the 0.935-is-a-floor constraint out of a manifest and a verdict and into a
  criterion, which is what the gate asked for. No criterion was taken on the maker's word.
