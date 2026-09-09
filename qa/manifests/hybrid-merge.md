# Manifest — hybrid-merge
**Contract:** qa/contracts/hybrid-retrieval.md
**Goal task:** U1.5
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — roadmap feature work

## What this unit does NOT claim, stated first

**It does not claim `recall@5 ≥ 0.85`, and it does not report a hybrid recall number at all.**

Contract C7 requires U1.5 to measure its **own** hybrid recall rather than inherit U1.4's 0.935.
Measuring that honestly needs the vector arm wired at the composition root against real chunks and
a real per-request tenant (C6) — which is the *second* half of U1.5 and is not in this unit.

So this unit ships the **merge mechanism and its seam**, tested, and stops before the number. I am
recording that as a deliberate split rather than shipping a merge with an unmeasured claim
attached: this project's whole golden-set problem began with a number nobody could falsify.

## What changed

- `packages/ask/src/merge.ts` (new) — `rrfMerge`. Pure, no I/O, and deliberately knows nothing
  about vectors, lexical search or the tree. That is what keeps `packages/ask` free of a
  `packages/index` import (C10, dep-cruiser enforced): the arms are built at the composition root,
  which may import both; only their *results* arrive here.
- `packages/ask/src/ask-v2.ts` — optional `extraCandidateArmsFn` on `AskV2Deps`, merged into the
  **candidates thunk's input**. `router.ts` and `evaluator.ts` are **byte-unchanged** (C1,
  verified by `git diff --stat`, empty).

## The real design decision was the KEY, not the formula

Plan §10 says "deduped by turnId". **That is unimplementable as written**, and the contract's
author said so independently: the three arms speak three id vocabularies — tree search yields
`node_id`, the vector retriever `sessionId`, lexical search `turnId`. **No field all three carry.**

Deduping on a field two arms lack would silently dedupe *nothing* — worse than not deduping, because
the merge would look correct while one long session's chunks crowded the list. So the key is
explicit, total and injected; production uses `node_id`, the only vocabulary all three necessarily
share by the time C2 requires them to be tree nodes.

## Degradation is reported, not swallowed

A failed arm returns `[]` and `/ask` still answers from tree + lexical. But **empty-because-healthy
and empty-because-failed must not look identical** — this project has shipped three separate
silent-degradation bugs. A degraded arm writes an `ask.retrieval_degraded` job and an audit entry
naming which arm and why; an arm that ran and found nothing writes neither. Both are tested.

## How to verify

- `pnpm --filter @lkb/ask test` → 45 pass
- `git diff --stat -- packages/ask/src/router.ts packages/ask/src/evaluator.ts` → empty (C1)
- `npx depcruise …` → exit 0 (C10)
- mutations: drop the tie-break; collapse fusion to last-arm-wins; remove the degradation report

## Actual outputs

```
pnpm -r typecheck = 0 · pnpm -r test = 0 · @lkb/ask 45/45
depcruise = 0        · C1 diff: empty

MUTATION A  tie-break dropped (C4 determinism)          -> 44 pass / 1 fail
MUTATION B  fusion -> last-arm-wins (C3/C4 semantics)   -> 43 pass / 2 fail
MUTATION C  degradation report removed (C5 visibility)  -> 44 pass / 1 fail
restored byte-identical each time · MUTATIONS CLEAN: none outstanding
```

Three mutations, three different failure counts — so the assertions pin three distinct properties
rather than all tripping on one symptom.

## Disclosed — the checker should press on these

1. **C6 (tenancy) is NOT satisfied by this unit and I am not claiming it is.** The seam is designed
   for per-request binding — `extraCandidateArmsFn` is a closure the composition root builds — but
   **nothing binds it yet**, so there is no live tenant path to attack. C6 is security-class and
   never round-capped; it should be judged against the *next* unit, and this manifest should not be
   credited with it.
2. **C7 is deliberately unmet** (see the top). If the checker judges that a merge without its
   measurement should not PASS at all, that is a defensible FAIL and I would rather take it than
   have the split pass unexamined.
3. **C9 (`compete.ts`) is untouched** because the new dep is optional — the `tavilySearchFn`
   precedent. Verified by typecheck and the existing tests, not by a new one.
4. **`RRF_K = 60` is the conventional constant and I did not derive it.** The contract explicitly
   refused to fix a value, and no evidence in this repo bears on it. It is documented, not justified.
5. **The first arm wins ties** so the tree node's `summary` survives for the refine step. That is a
   real behavioural choice a reviewer should agree with rather than inherit.

## Status: ready-for-check
