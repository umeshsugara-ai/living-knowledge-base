# Manifest — golden-set-sibling-ambiguity

**Contract:** `qa/gates/golden-set-redesign.md` (Option C) — the sibling-ambiguity half of the two
defects blocking **condition 4**.
**Goal task:** T-021 (tier 3, roadmap).
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none directly — supplies the quantification condition 4 is blocked on.

## What the gate asks for, and what I can honestly deliver

The gate records: *"An independent read of **12** questions found ~4 genuinely answerable by more
than one session, driven by seven identically-formatted `uniaccess-*` sessions."* Condition 4 is
blocked on that, measured on 13% of the set.

**"Genuinely answerable by more than one session" is a semantic judgement and no deterministic
script can make it.** What is measurable is **lexical non-discrimination** — whether the question's
distinguishing vocabulary appears in the target's transcript any more than in its siblings'. That is
a proxy **in both directions**: a session can share the vocabulary without answering, and answer
without sharing it.

So this unit does not claim to quantify ambiguity. It reports what a lexical measure sees, **tests
that measure against the gate's own worked example**, and — its actual deliverable — reduces
adjudication from 92 questions to 13.

## The headline finding is that my first statistic was wrong

I built the obvious measure first: *contested* = any other session covers the question's weighted
vocabulary at least as well as the target. It flags **71/92 = 77.2%**.

**I am not reporting that as the answer, because it disagrees with the reference reading in both
rate and direction:**

| | this measure | gate's hand read |
|---|---|---|
| ambiguity rate | 77.2% | 33.3% (4/12) |
| `uniaccess-*` cluster | **70.0% — LESS contested** | named as *the driver* |
| all other sessions | 79.2% | — |

A statistic that fires on 2.3× as many questions as the reference *and* inverts its structural claim
is measuring something else. The cause is mechanical: `rivals >= expectedCoverage` counts every
**tie**, and at a mean target coverage of 0.769 across 23 sessions, ties dominate.

It is kept in the report **labelled unusable**, not deleted, because the next reader will otherwise
recompute the obvious statistic and believe it.

**I did not tune the threshold until the rate matched 33.3%.** That would be fitting the instrument
to the answer — the metric-gaming this repo's own D-015 exists to stop — and it would have been easy
to do and hard to detect.

## The usable signal: where the target actually ranks

| | value |
|---|---|
| target ranks **1st of 23** | 24/92 = **26.1%** |
| target ranks **top-3** | 57/92 = **62.0%** |
| **median rank** | **3** of 23 |
| tail at rank ≥ 10 | **13** questions |

That is a **moderately discriminating set, not a degenerate one** — and it is a different picture
from what the binary flag suggested.

## Known-positive test — the discipline I kept failing today

The gate's worked example is literally in the set:
`2026-05-23-uniaccess-atlas-skilltech-gq01` — *"Is the university located right in the city or is it
more of a secluded campus?"*, stated by the gate to be answerable by all seven `uniaccess` sessions.

**It is flagged: rank 21 of 23, 20 rivals.** The measure fires on the one case whose answer is
already known. Without that, a low finding anywhere else would mean nothing — which is exactly how
the 16-hour gap, the `[].every()` assertion and the forced 0/92 all got past me earlier today.

## The deliverable: 13 questions, not 92

`data/eval/golden-set-ambiguity.json` → `tailForAdjudication`. Worst first:

```
rank 23  2026-05-29-decoding-ever-expanding-cast-gq04
rank 22  2026-05-29-decoding-ever-expanding-cast-gq02
rank 21  2026-05-23-uniaccess-atlas-skilltech-gq01   ← the gate's own example
rank 19  2026-05-29-decoding-ever-expanding-cast-gq03
rank 19  2026-05-23-uniaccess-atlas-skilltech-gq04
rank 18  2026-05-29-decoding-ever-expanding-cast-gq01
rank 17  2026-05-20-telling-your-brand-story-better-gq02
rank 13  2026-08-03-uk-beyond-offer-letters-gq04
rank 11  2026-06-19-entrance-exams-pathways-india-part1-gq01
rank 11  2026-07-22-uniaccess-cept-university-gq01
rank 11  2026-08-12-uniaccess-ashoka-university-gq01
rank 10  2026-08-12-uniaccess-ashoka-university-gq02
```

Note what the tail contains: **four of thirteen are `decoding-ever-expanding-cast`**, a session the
gate never mentions, while only five are `uniaccess-*`. If the gate's seven-sibling story were the
whole driver, the tail would not look like this.

## No stopword list, deliberately

The repo already carries two (`extract-topics.ts`'s `STOPWORDS`, `gen-golden-set.mjs`'s module-local
`STOP`). A third would be a third definition to drift. Tokens are weighted by **inverse session
frequency** instead — a word in every session carries ~0 weight, a word in one carries nearly all of
it — which is what a stopword list crudely approximates.

## How to verify

- `node qa/probes/golden-set-ambiguity.mjs` → the tables above; `--write` persists
- known positive → `FLAGGED contested`, rank 21/23. **If it ever prints NOT FLAGGED, every other
  number in the report is void**, and the probe says so in its own output.
- `data/eval/golden-set-ambiguity.json` → `unusableBinary.contestedRate` 0.7717, `headline.medianRank` 3

## What this does NOT settle

**Condition 4 is not unblocked by this unit.** A lexical proxy cannot decide semantic answerability,
and its disagreement with the gate's hand read is unresolved in both directions — I do not know
whether the hand read was conservative or my measure over-flags. What the unit provides is a
**prioritised 13-question list**, so the adjudication that does settle it (a human read, or a
bounded LLM pass) is tractable. Choosing between those two, and paying for the second, is the
Approver's call — as is ISS-232's caveat that this set shares ~82% of its questions with the one the
earlier hand read sampled.

## Live browser evidence

`Not UI-touching — no surface changed.` Changed paths: `qa/probes/golden-set-ambiguity.mjs`,
`data/eval/golden-set-ambiguity.json`. `qa/**` is `genuinely_not_user_facing` in
`qa/ui-surfaces.json`; `data/**` matches no pattern in it.

## Status: ready-for-check
