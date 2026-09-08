# Manifest — golden-set-pin-criterion

**Contract:** qa/contracts/golden-set-recall.md
**Gate:** qa/gates/golden-set-redesign.md (ANSWERED, Option C). **ISS-093 is recorded as binding on
gate condition 4**, so this unit is a precondition for re-pointing U1.4/U1.5.
**Goal task:** T-021 (stays open — see below)
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-093** (high)

## The bug, in one measurement

The post-filter rejected any question containing a token "unique in the corpus retrieval scores" —
the `session_page` text. **That corpus is 3,099 words across all 23 sessions**, about 135 words
each. At that size ordinary words land in exactly one summary **by chance** and register as rare.

| word | page-unique? | turns-unique? |
|---|---|---|
| `should`, `will`, `you`, `people`, `paths`, `skills`, `living` | **yes** (all) | **no** (all) |
| `flywire` (a real brand name) | yes | **yes** |

So the filter was discarding good questions for containing *"should"*. The checker measured it
first: **13 of 17 rejections fired on ordinary or function words.**

## The fix

Uniqueness now computes over the **turns** corpus — **217,980 words, ~70× larger** — where a token
in exactly one session is genuinely rare rather than a sampling artefact. The second condition is
unchanged and still right: the token must also appear in the target's page text, because a rare
word is only a *shortcut* if the retriever can see it.

**Pin vocabulary: 921 → 159 tokens**, and the survivors are what the criterion was always meant to
catch: `shagun`, `handa`, `italia`, `provident`, `hrd`, `nationalized`, `700`.

**Applied by `--refilter`, not regeneration.** ISS-093 is a defect in the *criterion*, not the
questions — the same 92 candidates judged correctly give a different set. So: no API spend, and
every question the previous checker human-read is still present and unchanged.

## Result

| | before (ISS-093) | after |
|---|---|---|
| questions | 75 | **92** (23/23 sessions) |
| **recall@5** | 0.307 *(a biased floor)* | **0.391** |
| control | 0.187 | **0.217** |
| lift over control | +0.120 | **+0.174** |
| misses | 52 | 56 |
| verdict | `informative` | **`informative`** |
| filter bias | kept .307 / rejected .765 / combined .391 | **none — 0 rejected, kept ≡ combined** |
| pin rate (turns) | 9.3% | 10.9% |
| pin rate (page) | 0.0% *(tautological)* | 18.5% |

**0.391 is now the unbiased figure**, not a floor: it is exactly the `combined` number the previous
run predicted, reached by fixing the criterion rather than by caveat. Gate condition 2 still holds
— strictly inside (0.217, 1.000) with 56 misses.

## The result I checked hardest, because it looked like good news

**0 of 92 candidates rejected.** A filter that rejects nothing is normally a dead filter, and
"the prompt requests, code enforces" would be hollow. So I verified it still fires:

```
pin vocabulary: 159 tokens
synthetic question: "What did the speaker say about shagun?"
filter fires? YES on "shagun"
```

The filter is alive; the model simply complied with the prompt's instruction to avoid rare
identifying words. The 17 earlier rejections were, on the corrected criterion, **all** false
positives. **I would still rather the checker treat 0-rejections as suspicious than take my word.**

## Two honest notes

**1. The page-corpus pin rate rose 0.0% → 18.5%, and that is expected, not a regression.** The old
0.0% was tautological (the filter rejected on exactly that criterion). Now nothing enforces
page-uniqueness, so questions containing chance-unique ordinary words ship — which is correct,
since those words are not shortcuts. The meaningful figure is the turns corpus: **56.5% → 10.9%**
against the original leaky set.

**2. The diagnostics deliberately do NOT match the filter's criterion.** `diagnose()` measures
turns-unique alone; the filter requires turns-unique **and** page-present. Making them identical
would recreate exactly the tautology ISS-092 was filed for — a measurement grading its own
enforcement. The gap is why the diagnostic reports 10.9% while the filter rejects 0, and it is
intentional.

## What this unit does NOT do

- **Does not close gate condition 4.** ISS-093 was one of *two* preconditions; the other —
  **sibling-session ambiguity**, ~4 of 12 sampled questions answerable by several of the seven
  identically-formatted `uniaccess-*` sessions — is untouched and still blocks.
- **Does not close T-021.** Its `done_check` is still the unfailable `recall@5 >= 0.85`, and
  re-expressing it is the human-allowlist act `/goal`'s security invariant reserves.
- **`scripts/lib/golden-set-build.mjs`** is new only because `gen-golden-set.mjs` hit **353 LOC
  against a 300 budget**. It is a move, not a rewrite. It is deliberately *not* merged into
  `golden-set-diagnostics.mjs` — see note 2.

## Evidence

```
pin vocabulary          921 -> 159 tokens
refilter                92 candidates -> 92 kept, 0 rejected, 23/23 sessions
eval-recall             recall@5 = 0.391 (36/92) | control 0.217 | INFORMATIVE (+0.174, 56 misses)
filter bias             none - 0 candidates rejected, so kept === combined
diagnostics (turns)     overlap 0.161 | PIN 10.9%
diagnostics (page)      overlap 0.071 | PIN 18.5%
```

`pnpm --filter @lkb/api test` 109/109 · `pnpm -r typecheck` exit 0 ·
`pnpm lint:structure` clean (lint-loc 249 files, lint-dupes 259 exports, depcruise 0/269).
All three CLI paths re-run after the file split: `--dry-run`, `--refilter`, `--provenance-only`.

## How to verify (checker)

1. **Reproduce the root cause** — confirm the page corpus is ~3k words and that `should`/`will`/
   `you` are page-unique but not turns-unique. That single fact is the whole unit.
2. **Attack the 0-rejection result.** Construct a question containing a genuinely rare entity from
   the target's page text and confirm `--refilter` rejects it. If you can build a plausible pinned
   question the filter now misses, that is a real finding.
3. `node scripts/gen-golden-set.mjs --refilter` then `node scripts/eval-recall.mjs` — confirm
   0.391, control 0.217, `INFORMATIVE`, and `filterBias` reporting **none** rather than `null`.
4. Confirm condition 2 still holds and that no question text changed — only which ones ship
   (`git diff` the golden set: additions only, no edits).
5. **Judge whether 159 pin tokens is the right size.** Too small and the filter under-enforces;
   spot-check a few for whether they are genuinely rare entities.
6. Confirm nothing claims condition 4 is unblocked — the sibling-session precondition still stands.
7. `ISSUES-WRITTEN: none` is a complete check.

## Risk / rollback

No API spend, no question text changed, no product code touched. `git revert` restores the 75-item
set and the old criterion.

**Status: ready-for-check**
