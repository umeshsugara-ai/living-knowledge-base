# Manifest — hybrid-arms-binding (U1.5 part 2)
**Contract:** qa/contracts/hybrid-retrieval.md
**Goal task:** U1.5 (part 2 — discharges the C6/C7 deferral)
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — roadmap feature work

## THE HEADLINE: the hybrid merge is WORSE than vector alone, and I am reporting that, not burying it

C7 required U1.5 to measure its **own** recall rather than inherit U1.4's 0.935. Measured, through
the same harness, the same 92-question golden set and the same question-blind control:

| retriever | recall@5 | hits |
|---|---|---|
| heuristic (tree) | 0.391 | 36/92 |
| **vector (cosine)** | **0.935** | 86/92 |
| **hybrid (RRF, 3 arms)** | **0.891** | 82/92 |
| control (question-blind) | 0.217 | — |

**hybrid vs vector: −0.043. A REGRESSION.** It introduced **8 new misses** that pure vector got
right (and recovered 4 the vector arm missed).

Against plan §10's literal bar it "passes" — 0.891 ≥ 0.85. **I do not think that should be
credited**, and C7 is written to prevent exactly that reading: the honest statement is that adding
the tree and lexical arms **diluted** a better ranking. Reciprocal-rank fusion weights every arm
equally, and the tree arm scores 0.391 — barely above the 0.217 chance floor — so it is voting with
almost the authority of noise.

**What I have NOT done, deliberately:** tuned per-arm weights until the number went up. That would
be fitting the merge to a 92-question set whose ground truth an open gate precondition already
disputes, and calling the result an improvement. The contract's author refused to fix arm weights
for the same reason — no evidence in the repo bears on them.

**My read:** the merge machinery is correct (three cycles of adversarial checking say so) and the
*configuration* is not yet justified. The next honest step is U2.2-style measurement of what each
arm contributes, not a weight I picked because it made this number rise.

## What changed

- `apps/api/src/ask-arms.ts` (new) — the vector and lexical arms. **A FACTORY taking `tenantId`**,
  which is C6's substance, not packaging: `buildProductionDeps()` has no tenant and its router-level
  id is the literal `"system"`, so arms bound at boot would query one tenant's corpus for every
  tenant's questions — **ISS-078's shape aimed at the corpus instead of the API.**
- `apps/api/src/routes/ask.ts` — binds the arms per request from the **verified key's** tenantId.
  `AskRouteDeps` now *excludes* `extraCandidateArmsFn` from `askDeps`, so a bound function cannot be
  smuggled in at boot even by accident.
- `packages/ask/src/ask-v2.ts` — the arms fn now receives the tree, so an arm maps its own id
  vocabulary (sessionIds) to nodes **without duplicating `buildTree`'s path convention**.
- `scripts/eval-recall.mjs` — `--retriever hybrid`, writing its own report file. It **reuses
  `rrfMerge`** rather than reimplementing fusion, so the measured merge is the shipped merge.

## How to verify

- `pnpm --filter @lkb/api test` → 170 pass · `pnpm -r test` → exit 0
- `node scripts/eval-recall.mjs --retriever hybrid` → 0.891, own report file
- mutations: arms query the boot tenant instead of the request tenant; vector failure swallowed

## Actual outputs

```
MUTATION I  arms query "system" not the request tenant (C6)  -> 168 pass / 2 fail
MUTATION J  vector failure swallowed (C5)                    -> 169 pass / 1 fail
restored byte-identical · MUTATIONS CLEAN · clean run 170 pass / 0 fail

recall@5 = 0.891 (82/92) · control 0.217 · VERDICT: INFORMATIVE, 10 misses left to move
```

## Disclosed — the checker should press on these

1. **The regression is the finding, and I want it ruled on.** If a merge that measurably loses to
   one of its own arms should not ship at all, that is a defensible FAIL and better than a green
   tick on a number I have just argued against.
2. **The hybrid arm is not yet reachable from `/ask` in production** in the sense of having been
   exercised against live Mongo — it is wired and unit-tested with an injected db, but I did not run
   a live `/ask`. Given that C6 is security-class, a live two-tenant probe is the stronger evidence
   and I did not produce it.
3. **`k = 5` per arm and `RRF_K = 60` are conventional, not derived.** Same reasoning as the
   contract's refusal to fix weights.
4. **The eval harness's hybrid path fuses SESSION IDS while `askV2` fuses NODES.** Both use the same
   `rrfMerge` and the same key discipline, but they are not the same call path — so the measured
   number is of the merge *policy*, not of `askV2` end to end. That is a real gap between what I
   measured and what ships.

## Status: ready-for-check
