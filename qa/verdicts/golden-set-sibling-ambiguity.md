# Verdict — golden-set-sibling-ambiguity

**Cycle checked: 2**
**Date:** 2026-09-09
**Checker:** Mode A, bound to `D:\KnowledgeBase`
**Commit checked:** `9fee80e`
**Manifest:** `qa/manifests/golden-set-sibling-ambiguity.md`
**Binding spec:** `qa/gates/golden-set-redesign.md` (Option C), condition 4 — sibling-ambiguity half
**Goal task:** T-021
**Cycle-1 verdict:** FAIL — ISS-234, ISS-235, ISS-236, ISS-237 (+ ISS-238)

```
VERDICT: FAIL
SCOREBOARD: 6/7 criteria met, 3/3 invariants hold
FAILURES:
- [C6] sev: high · two unstruck sections of the manifest still state cycle-1 numbers as live, and one of them is the verification recipe: "How to verify" tells the next reader to expect `FLAGGED contested`, rank 21/23, `contestedRate 0.7717` and `medianRank 3` — all three now false — and its own void-rule ("if it ever prints NOT FLAGGED, every other number in the report is void") is tripped by the very output this cycle ships as its finding · strike/rewrite "## How to verify" and "## The usable signal: where the target actually ranks" to the cycle-2 figures; no re-measurement needed · issue: ISS-239
LIVE-BROWSER: not-applicable (qa/probes/golden-set-ambiguity.mjs, data/eval/golden-set-ambiguity.json — `qa/**` is listed under `genuinely_not_user_facing` in qa/ui-surfaces.json and `data/eval/**` matches no clause of its pattern; checked against the file, not the manifest's claim)
ISSUES-WRITTEN: ISS-239, ISS-240
EXPLANATION: All four cycle-1 fixes are real and independently reproduced, and the reversed conclusion is SOUND rather than a convenient exit — I re-ran the measure under four operationalisations (1/df raw, log-IDF raw, 1/df + baseline, log-IDF + baseline) and the gate's worked example gq02 ranks 1 or 2 of 23 in every one of them, so no principled variant or tail threshold detects it. What fails is document hygiene, and in the same class the unit was FAILed for at cycle 1: the shipped manifest's own verification section instructs a reader to treat this cycle's result as void. That is a doc-only fix and cycle 3 should clear in one edit.
```

## What I re-ran

```
node qa/probes/golden-set-ambiguity.mjs                 # reproduced verbatim, no --write
```

plus an independent re-implementation written from the gate and the raw corpora (reading
`data/eval/golden-set.json` and `loadCorpora().turnsText` directly), parameterised over
weighting × baseline so the two fixes could be decomposed, and two 20,000-draw permutation tests.

## My independent numbers

| quantity | manifest | mine | agrees |
|---|---|---|---|
| known positive id | `...-gq02` | `...-gq02` | yes |
| known positive | rank 1/23, 0 rivals, NOT FLAGGED | rank 1/23, 0 rivals, NOT FLAGGED | yes |
| rank 1 | 32.6% | 30/92 = 32.6% | yes |
| top-3 | 66.3% | 61/92 = 66.3% | yes |
| median rank | 2 | 2 | yes |
| tail (rank >= 10) | 11 | 11 | yes |
| tail from two shortest | 3 of 11 | 3 of 11 | yes |
| uniaccess mean rank / tail share | 3.75 / 10.0% | 3.75 / 10.0% (2/20) | yes |
| other mean rank / tail share | 3.99 / 12.5% | 3.99 / 12.5% (9/72) | yes |
| `log(N/df)` = 0 at df = N | claimed | exact 0; 106 tokens sit at df = 23 | yes |

Numbers I derived that the unit does not report:

| quantity | value |
|---|---|
| gq02 rank under **cycle-1's own measure** (`1/df`, no baseline) | **2 of 23**, 4 rivals |
| gq02 rank under **log-IDF, no baseline** | **2 of 23**, 4 rivals |
| gq02 rank under **`1/df` + baseline** | **1 of 23**, 0 rivals |
| gq02 rank under the shipped measure | **1 of 23**, 0 rivals |
| atlas-skilltech gq01 / gq02 / gq03 / gq04, shipped measure | rank 3 / 1 / 2 / 19 |
| corr(transcript length, session mean rank): cycle-1 `1/df` | **-0.662** |
| … log-IDF, no baseline | -0.636 |
| … **shipped (log-IDF + baseline)** | **-0.208** |
| mean rank: two shortest / longest five / the middle sixteen | **8.75 / 4.50 / 3.16** |
| tail entries from the **longest five** transcripts | **4 of 11** (20 of 92 questions) |
| uniaccess vs other under the **cycle-1** measure | **5.70 / 4.44**, tail 5/20 vs 8/72 |
| uniaccess vs other, log-IDF only (baseline off) | 5.45 / 4.21 |
| permutation p, abs(uniaccess − other) mean rank (B = 20,000) | **0.834** |
| permutation p, tail-share difference | **1.000** |
| sd of ranks / se of the cluster mean difference | 4.16 / ≈1.08 |
| binary `contested` rate under the new measure | **0.6739** (was 0.7717) |

## ISS-234 — fixed, and the fix is the unit's result

`KNOWN_POSITIVE` is now `2026-05-23-uniaccess-atlas-skilltech-gq02`, and the id, the question text
printed beside it, and the gate's sentence all agree — the three-way contradiction that produced
cycle 1's accidental pass is gone. The result reproduces exactly: **rank 1 of 23, zero rivals, NOT
FLAGGED.**

**The interpretation line does print in the probe's own output**, and it prints before every
headline figure — before the rank/top-3/median block, before the cluster table, before the tail. It
does *not* precede the known positive's own rank line, which sits two lines above it; the manifest's
"before any figure" is therefore very slightly generous, but the ordering does what the claim exists
to secure: no reader can lift 32.6% or the tail list without having read the disclaimer first. Not a
finding.

## ISS-236 — fixed, and it is real IDF

`idf = Math.log(N / df)`. At df = N it is exactly `Math.log(1) = 0` — I checked the identity, not the
description. 106 tokens sit at df = 23 and now contribute zero to both numerator and denominator,
against the 36%-of-mass they carried at cycle 1. The manifest's retraction of its cycle-1
"no stopword list needed" claim is correct and correctly scoped.

## ISS-235 — fixed, sound as a normalisation, with a residual it does not disclose

**It is a sound normalisation, not a trick.** Subtracting a session's own mean coverage asks "does
this session do better *than itself* here", which is exactly the right question for a set-recall
score whose absolute level is set by vocabulary size. The evidence that it works is the length
correlation, which I measured rather than inferred: **-0.662 → -0.208**. The claimed tail movement
(6/13 → 3/11) reproduces, and 26.1 → 32.6 / 62.0 → 66.3 / median 3 → 2 all reproduce.

**Does it now penalise broadly-relevant sessions?** In principle yes — the baseline is a
session-level constant, so a session that covers many questions' vocabulary pays for that on every
question, including the ones it genuinely owns. Measured, that is a real but second-order effect:
baselines run 0.09–0.13 for the two short sessions and 0.44–0.56 for the five longest, and the
correction slightly over-shoots at the long end. The longest five sessions now sit at **mean rank
4.50** against **3.16** for the middle sixteen, and supply **4 of the 11** tail slots from 22% of the
questions, while the two shortest are still under-corrected at 8.75. So the length artifact is
reduced by roughly two-thirds and has become two-sided rather than eliminated. The manifest claims
only "3 of 11", which is true, and does not claim the tail is clean — so this is an undisclosed
residual rather than a false statement. **ISS-240, low: ledger only, not a FAIL line.**

## ISS-237 — fixed, and "indistinguishable" is defensible

Restated from rank, as required. I re-derived 3.75 / 10.0% vs 3.99 / 12.5% independently. On whether
"indistinguishable" overstates what n = 20 vs n = 72 supports: **it does not**. A 20,000-draw
permutation test on the mean-rank difference gives **p = 0.834**, and on the tail-share difference
**p = 1.000**. There is no effect to speak of, in either direction, and the manifest's phrasing —
"this measure neither supports nor refutes the gate's structural claim" — is the correct one, being
careful in exactly the place where an over-reading would be tempting.

The honest caveat, which the manifest could carry but whose absence is not a defect: with sd 4.16 and
n = 20 vs 72, the se of the difference is ≈1.08, so this test could not have detected an effect
smaller than roughly two rank positions. It is underpowered to *rule out* a modest cluster effect —
which is precisely why "neither supports nor refutes" is the right sentence and "no cluster effect
exists" would not be.

**The 5.70 → 3.75 discrepancy: the maker's explanation is verified, and it is the whole
explanation.** Re-running my cycle-1 measure (`1/df`, no baseline) over today's code and data
reproduces **5.70 / 4.44** to the digit, with the same 5/20 vs 8/72 tail split. So my cycle-1 numbers
were not wrong and neither are these; the measure changed underneath them. I decomposed which fix
did it: the IDF change alone moves the pair only 5.70 → 5.45, and it is the **baseline subtraction**
that collapses it to 3.75 / 3.99. That matters, because the enrichment I reported at cycle 1 was
itself substantially the length artifact — atlas-skilltech, the shortest transcript in the corpus, is
a `uniaccess-*` session, so the cluster was carrying the artifact I filed separately as ISS-235. My
cycle-1 inference was correctly derived and, in hindsight, confounded. **I withdraw the cycle-1
claim that the tail supports the gate's seven-sibling story.**

## Ruling on the central claim: the negative result is SOUND, not a convenient exit

I went looking for the small principled variant that rescues detection, because that is what would
make "the cheap path is closed" premature. **There isn't one.**

| operationalisation | gq02 rank | flagged at tail ≥ 10? |
|---|---|---|
| cycle 1's own: `1/df`, raw coverage | 2 / 23 | no |
| IDF fixed only: `log(N/df)`, raw coverage | 2 / 23 | no |
| length fixed only: `1/df` minus baseline | 1 / 23 | no |
| **shipped: `log(N/df)` minus baseline** | **1 / 23** | **no** |

Ranking by raw coverage instead of baseline-adjusted advantage — the specific variant worth
suspecting, since it is the one that undoes the fix most likely to be tuned — puts gq02 at **rank 2
with 4 rivals out of 23**. Not flagged, and not near flagging. No tail threshold rescues it either:
to catch a rank-2 question you must set the tail at rank ≥ 2, which flags 68 of 92 and is not a
measure. The non-detection is therefore a **property of the lexical family**, not of this
parameterisation, and the maker's conclusion generalises further than the maker actually
demonstrated. The mechanism is plain once seen: *city*, *campus*, *secluded*, *located* are words the
target transcript happens to use and the sibling transcripts happen not to, even though — per the
gate's human reader — all seven sessions answer the question. Lexical presence and semantic
answerability come apart, which is what the manifest says in its own words at the top.

**Is cycle 2 more trustworthy than cycle 1, or merely different?** More trustworthy, and I can say
why in terms that do not depend on liking the answer. Three of the four changes are corrections
against a stated external standard, not tuning: `log(N/df)` is *the* definition of IDF and cycle 1's
`1/df` simply was not; gq02 is the gate's example and gq01 was not; the rank-based cluster statistic
is the one the document itself called usable. Only the baseline subtraction is a modelling choice,
and it is independently validated by a measurement that was never its target — the length
correlation falling from -0.662 to -0.208. And the direction of travel is against interest: the
corrected instrument makes the golden set look *less* ambiguous (median rank 3 → 2, rank-1 26.1% →
32.6%), which weakens the case for the very defect the unit was built to quantify, and it destroys
the unit's own headline. Fitting does not look like that.

**One thing the manifest overstates.** "Condition 4 needs semantic adjudication; it cannot be
reached this way" is sound for the *lexical-coverage* family this unit built. It is not evidence
about embedding similarity, which is deterministic, cheap, already in this repo's dependency
surface, and is the obvious next rung below an LLM pass. The repo's own vector recall@5 of 0.935
says the embedding layer separates these sessions well. "The cheap path is closed" should read "the
*lexical* cheap path is closed"; the *semantic-but-not-LLM* path is untested. That is a scoping
imprecision in the conclusion, not an error in it — it goes in this verdict for whoever picks up
condition 4, not into the FAILURES block.

## The three "also rule on" questions

**1. Does this advance T-021?** **Yes — more than cycle 1 did, and the value is real.** It converts
"a lexical proxy might quantify sibling ambiguity" from an open assumption into a closed one, with
the gate's own worked example as the counterexample and four operationalisations behind it. That is
worth having before anyone spends a human afternoon or an LLM budget on the wrong instrument.

**What should happen next, and who owns it — my position, restated.** At cycle 1 I said the next
move was the maker's, not the Approver's, because the choice would have been made on a broken
artifact. That objection is now answered, so **the position flips: this is the Approver's call, and
it is now a genuine one.** But it is a three-way choice, not the two-way one the manifest frames:

- **a bounded embedding pass** — cosine between each question and every session's transcript,
  flagging questions whose top-2 sessions are within a small margin. No LLM cost, no data approval,
  and it tests the one hypothesis this unit's negative result does not touch. **I would run this
  before paying for anything**, and it is a maker unit, not an Approver decision.
- **a bounded LLM adjudication** over whatever list survives that.
- **a human read**, the gate's Option-A-flavoured fallback.

The Approver's decision is only needed at the second and third. The first is unblocked work the
maker can pull today, and condition 4 should not sit on a human gate while an untested cheap path
remains. ISS-232's ~82% overlap caveat still applies wherever two rates are compared.

**2. The 11-question tail — ship it or drop it?** **Ship it, labelled as it now is, and do not use
it as the adjudication list.** The manifest's own framing ("a candidate list to read, explicitly not
a finding") is the correct one and I would not weaken or strengthen it. It is not misleading, because
the disclaimer that precedes it in the probe's output is unambiguous and because the gate's own
question being absent is stated in the same breath. But it is also not the deliverable: 4 of its 11
entries come from the five longest transcripts and 3 from the two shortest, so 7 of 11 slots are
still explicable by length alone, and the one question with an independent ambiguity judgement is not
on it. It is a reading list with a known bias, which is a fair thing to hand a human and an unfair
thing to hand a gate. The claim on manifest line 101 that the unit "reduces adjudication from 92
questions to 13" should not survive cycle 3 in that form — it is both stale (11, not 13) and stronger
than the tail can bear.

**3. Struck vs live.** **Not confirmed — this is the FAIL.** The strike discipline is mostly good:
the known-positive section, the deliverable-list section and the no-stopword-list section all carry
strikethrough headings with the issue id that withdrew them, and the cycle-1 77.2% section is
explicitly labelled. Two sections are not:

- **`## How to verify`** (manifest lines 180–185) is entirely cycle-1 and entirely wrong now. It
  tells the reader to expect `FLAGGED contested`, `rank 21/23`, `unusableBinary.contestedRate 0.7717`
  and `headline.medianRank 3`. The shipped artifact carries **0.6739** and **2**, and the probe prints
  **NOT FLAGGED / rank 1**. Worse than stale: the section's own rule — *"if it ever prints NOT
  FLAGGED, every other number in the report is void"* — is now tripped by the output the unit ships
  as its central finding, so a reader who follows the documented verification concludes the report is
  void. Cycle 2 deliberately reinterprets that rule; the recipe was never updated to say so.
- **`## The usable signal: where the target actually ranks`** (lines 128–138) is unstruck, unlabelled
  and states 26.1% / 62.0% / median 3 / tail 13 as current, fifty lines under a cycle-2 table giving
  32.6% / 66.3% / 2 / 11 for the same four quantities.

I am charging this at **high** rather than waving it through as documentation churn, for one reason:
it is the same defect class as ISS-234 — a shipped artifact stating, as live, a figure the same
document elsewhere withdraws — in the unit whose entire subject is measurement honesty, and this time
in the section that tells the next reader how to check. The fix is two edits and no re-measurement.

Also fixed and creditable, though not listed in `Issues addressed`: **ISS-238** — the probe now
prints `tail.slice(0, 13)` and the truncated-list defect is gone. Marked fixed.

## Ledger

| issue | status |
|---|---|
| ISS-234 | open → **fixed** (verified: probe pinned to gq02; id, text and gate sentence agree) |
| ISS-235 | open → **fixed** (verified: length correlation -0.662 → -0.208; tail 6/13 → 3/11) |
| ISS-236 | open → **fixed** (verified: `log(N/df)`, exactly 0 at df = N over 106 tokens) |
| ISS-237 | open → **fixed** (verified: restated from rank; cycle-1 refutation withdrawn, and I withdraw my own cycle-1 counter-claim) |
| ISS-238 | open → **fixed** (verified: full tail printed) |
| ISS-239 | **new, high** — manifest states withdrawn cycle-1 figures as live in the verification recipe |
| ISS-240 | **new, low** — residual length bias is now two-sided and undisclosed |

## What would clear cycle 3

Two edits to `qa/manifests/golden-set-sibling-ambiguity.md`, and nothing else. **Do not re-run the
measure and do not change the probe** — the instrument is correct and its conclusion stands.

1. Rewrite `## How to verify` to the cycle-2 expectations: `NOT FLAGGED, rank 1/23, 0 rivals`;
   `unusableBinary.contestedRate` **0.6739**; `headline.medianRank` **2**; tail **11**. State
   explicitly that the cycle-1 void-rule is superseded — the non-detection *is* the finding, and what
   would now void the report is the known positive being re-pinned or the probe printing FLAGGED
   without a stated reason.
2. Strike or retitle `## The usable signal…` as cycle 1, the way the neighbouring sections already
   are, and fix line 101's "92 questions to 13" to 11 with the tail's known length bias named.

Optional, and it would improve the result rather than merely repair it: narrow the conclusion to "the
*lexical* cheap path is closed", and record the four-variant robustness table above — the maker's
negative result is stronger than the single operationalisation it currently rests on, and one
sentence would say so.

## Note on process, not a finding

Cycle 1's manifest was rescued by its own instinct — "the headline finding is that my first statistic
was wrong" — and cycle 2 carried that instinct all the way to a result that deletes the unit's
headline and reports it anyway. That is the behaviour this pair exists to produce, and I want it on
the record separately from the FAIL, which is about two paragraphs nobody re-read.
