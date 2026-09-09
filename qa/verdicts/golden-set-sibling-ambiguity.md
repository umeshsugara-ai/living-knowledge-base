# Verdict — golden-set-sibling-ambiguity

**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** Mode A, bound to `D:\KnowledgeBase`
**Commit checked:** `caf66c9`
**Manifest:** `qa/manifests/golden-set-sibling-ambiguity.md`
**Binding spec:** `qa/gates/golden-set-redesign.md` (Option C), condition 4 — sibling-ambiguity half
**Goal task:** T-021

```
VERDICT: FAIL
SCOREBOARD: 2/7 criteria met, 2/3 invariants hold
FAILURES:
- [C1] sev: high · the known-positive test is anchored on the WRONG question; the gate's actual worked example ranks 2/23 and the measure does not flag it · re-pin KNOWN_POSITIVE to `...-gq02` and report the resulting non-detection as the finding · issue: ISS-234
- [C5] sev: high · 6 of the 13 tail questions come from the two shortest transcripts; `coverage()` is a set-recall fraction with no length normalisation, so the adjudication list is substantially a transcript-length artifact · normalise, or score tail membership against a length-matched null · issue: ISS-235
- [C4] sev: medium · `1/df` is not inverse document frequency and does not suppress generic vocabulary: it floors at 1/23, and in the probe's own worked example four df=23 words carry ~36% of the weight mass against 13.8% for the single content word · use `log(N/df)` (exactly 0 at df=N) or accept a stopword list · issue: ISS-236
- [C7] sev: medium · the cluster/tail-composition claim is stated backwards and is argued from the statistic the unit itself declared unusable; on the USABLE rank measure `uniaccess-*` is enriched in the tail (5/20 = 25% vs 8/72 = 11%) with worse mean rank (5.70 vs 4.44) — it supports the gate's seven-sibling story rather than undercutting it · issue: ISS-237
- [C3] sev: medium · the stated cause of the 77.2% vs 33.3% disagreement ("counts every tie") explains the rate but not the direction: with strict `>` the rate is 58.7% and the cluster inversion SURVIVES (uniaccess 0.500 vs other 0.611) · issue: ISS-237
LIVE-BROWSER: not-applicable (qa/probes/golden-set-ambiguity.mjs, data/eval/golden-set-ambiguity.json — `qa/**` is `genuinely_not_user_facing` in qa/ui-surfaces.json; `data/eval/**` matches no pattern in its regex; verified against the file, not the manifest's claim)
ISSUES-WRITTEN: ISS-234, ISS-235, ISS-236, ISS-237, ISS-238
EXPLANATION: Every number in the manifest reproduces exactly, and the decision to lead with rank rather than the 77.2% binary was correct — a creditable call, not an evasion. But the unit's own stated validity gate fails: the probe's KNOWN_POSITIVE is `...-gq01` ("What kind of support is available for students looking for internships?"), while the gate's worked example is `...-gq02` ("Is the university located right in the city or is it more of a secluded campus?"). The manifest prints the gq02 text beside the gq01 id, and the report the unit shipped records the gq01 text — the contradiction was already on disk. The real worked example ranks 2/23: the measure does NOT fire on the one case whose answer is known. Compounding it, 6 of the 13 tail entries belong to the two shortest transcripts (450 and 495 unique tokens against a next-smallest of 983), whose questions average rank 16.13 against 3.63 for the rest, so the deliverable list is substantially a length artifact.
```

## What I re-ran

```
node qa/probes/golden-set-ambiguity.mjs          # reproduced verbatim, no --write
```

plus three independent re-derivations written from the gate and the raw corpora (not from the
maker's probe), reading `data/eval/golden-set.json` and `loadCorpora().turnsText` directly.

## My independent numbers

| quantity | manifest | mine | agrees |
|---|---|---|---|
| rank 1 of 23 | 24/92 = 26.1% | 24/92 = 26.1% | yes |
| top-3 | 57/92 = 62.0% | 57/92 = 62.0% | yes |
| median rank | 3 | 3 (mean 4.72) | yes |
| tail rank >= 10 | 13 | 13 | yes |
| binary contested (`>=`) | 71/92 = 77.2% | 71/92 = 77.2% | yes |
| mean target coverage | 0.769 | 0.7695 | yes |
| uniaccess vs other (binary) | 70.0% / 79.2% | 70.0% / 79.2% | yes |
| tail composition | 4 decoding, 5 uniaccess | 4 decoding, 5 uniaccess | yes |

Numbers I derived that the unit does not report:

| quantity | value |
|---|---|
| contested with **strict `>`** (ties removed) | 54/92 = **58.7%** |
| uniaccess vs other, strict `>` | **0.500 / 0.611** — inversion survives |
| **mean rank, uniaccess vs other** | **5.70 / 4.44** (median 4 / 3) |
| **uniaccess share of the tail** | **5/20 = 25%** vs other 8/72 = 11.1% |
| **rank of the gate's ACTUAL worked example (gq02)** | **2 of 23** |
| rank of the probe's KNOWN_POSITIVE (gq01) | 21 of 23 |
| unique tokens: atlas-skilltech / decoding / next smallest | **450 / 495 / 983** |
| mean question rank, those two sessions vs all others | **16.13 / 3.63** |
| tail entries from those two sessions | **6 of 13** |
| tail size at rank >= 9 / 10 / 11 / 12 | 16 / 13 / 11 / 8 |
| questions with >=1 token absent from every session | 11 (one token each, of 14–24) |
| sessions with missing or empty transcript | 0 |

## Ruling on the discarded 77.2%

**The call was right; the reasoning given for it is not.**

Leading with rank instead of the binary flag was correct and I would have made the same call. A
`>=` predicate over 23 sessions at mean coverage 0.769 is dominated by ties, and reporting it as
"77.2% of the golden set is ambiguous" would have been a materially false claim. Keeping it in the
report labelled unusable, rather than deleting it, is better practice than either reporting it or
hiding it. This was not an inconvenient number swapped for a friendlier one — the substituted
framing (median rank 3, 26% unique) is *less* favourable to the maker's own thesis that the set is
ambiguous, which is the opposite of what fitting looks like.

**But the diagnosis is wrong.** The manifest says the cause is mechanical — `rivals >= expectedCoverage`
counting ties. Remove the ties (strict `>`) and the rate is still **58.7%**, 1.8x the hand read, and
the cluster inversion is **unchanged** (uniaccess 0.500 vs other 0.611). Ties explain part of the
rate; they explain none of the direction. The manifest offers one mechanical cause for a two-column
disagreement and only half of it holds.

## Ruling on threshold tuning

**No evidence of fitting. `TAIL_RANK = 10` is arbitrary but innocent.**

Tail sizes at nearby thresholds are 16 (>=9), 13 (>=10), 11 (>=11), 8 (>=12). There is no cliff at
10 and no comfortable round number produced — 13 is not a number anyone fits to, and the rank
histogram has empty buckets at 7 and 12, so 10 sits inside a plateau rather than at an edge. More
importantly the threshold does not touch the headline: the 26.1% / 62.0% / median-3 figures are
threshold-free, and the tail's composition (decoding + uniaccess dominant) is the same at 9, 10, 11
and 12. The maker's claim that it did not tune to 33.3% is credible, and structurally so — no rank
threshold could produce 33.3% from this histogram at all.

## Ruling on "moderately discriminating, not degenerate"

**Supported, with a caveat the manifest should carry.** 26.1% at rank 1 and 62.0% top-3 against a
chance baseline of 4.3% / 13.0% is a real signal, and the phrase is a fair reading of it. The
caveat: the distribution is strongly bimodal — 65 of 92 sit at rank <= 3, then a near-empty middle,
then a tail concentrated in two sessions. "Moderately discriminating" describes the mean of a
distribution that has no middle. That is a nuance rather than a misstatement, so it is not a
FAILURE line.

## The attacks, ruled individually

**Inverse-session-frequency weighting — FAILS its stated purpose (ISS-236).** The manifest claims
"a word in every session carries ~0 weight ... which is what a stopword list crudely approximates."
Checked by hand on the probe's own known positive, *"What kind of support is available for students
looking for internships?"*:

| token | df | weight `1/df` | share of the question's total weight mass |
|---|---|---|---|
| internships | 15 | 0.0667 | **13.8%** |
| support | 19 | 0.0526 | 10.9% |
| available | 19 | 0.0526 | 10.9% |
| kind / students / looking | 22 | 0.0455 | 9.4% each |
| **what / of / is / for** | **23** | **0.0435** | **9.0% each — 36% combined** |

`1/df` floors at `1/N` = 0.0435, not ~0. Four words present in every single session carry more than
a third of the weight, nearly three times the single content word. Real IDF, `log(N/df)`, is exactly
0 at df = N and would have done what the manifest claims. The concern about a third stopword list
was reasonable; the substitute chosen does not do the job.

**The known-positive test — FAILS, and in the way that matters (ISS-234).** The probe pins
`KNOWN_POSITIVE = "2026-05-23-uniaccess-atlas-skilltech-gq01"`. That id's question is *"What kind of
support is available for students looking for internships?"*. The gate's worked example is *"Is the
university located right in the city or is it more of a secluded campus?"* — which is in the set, at
**`...-gq02`**. The manifest prints the gq02 sentence beside the gq01 id, and
`data/eval/golden-set-ambiguity.json` `knownPositive.question` records the gq01 sentence with the
gq02 justification (`"stated to be answerable by all seven uniaccess sessions"`) attached to it.

Run the test on the right question and it **does not fire**: gq02 ranks **2 of 23**. Under the
headline signal the unit actually reports, the gate's own all-seven-siblings example is one of the
cleanest questions in the set. All four atlas-skilltech questions, for completeness: gq01 rank 21,
gq02 rank 2, gq03 rank 5, gq04 rank 19.

The accidental pass is exactly the shape the dispatch anticipated. gq01 ranks 21 not because
siblings answer it — nine sessions tie at coverage 1.0 — but because the target transcript happens
to lack two ordinary words, **`support`** and **`looking`**, while containing `internships`. It is
flagged for two absent stopwords.

**Tokens absent everywhere (`df === undefined -> continue`) — correct, and immaterial.** 11 of 92
questions have exactly one such token, out of 14–24 tokens each. `tokenize` runs over the same
corpus that builds `df`, so a token absent everywhere is a question-only word that discriminates
between nothing; skipping it is right, and including it would add the same zero to every session's
numerator. No finding.

**`coverage()` on a missing or empty transcript — no live hazard, but a real latent one.** All 23
sessions have non-empty transcripts, so nothing is silently scoring 0 today. The guard that matters
is a different one and it is live: `coverage()` has **no length normalisation** and is a
set-membership recall over the session's vocabulary, so a short transcript scores low mechanically.
The two shortest sessions have **450** and **495** unique tokens against a next-smallest of **983**;
their 8 questions average rank **16.13** against **3.63** for the other 84, and they supply **6 of
the 13** tail entries. That is ISS-235, and it is why the deliverable list cannot be used as-is.

## The three "also rule on" questions

**1. Does this advance condition 4?** *Partly, and less than claimed.* The negative result is real
and worth having: a lexical measure cannot settle semantic answerability, and saying so with numbers
beats the gate's 12-question hand read alone. The 13-question list is a real idea and not busywork —
reducing adjudication from 92 to 13 is the right move. But **this particular list is not yet the
deliverable**: 6 of its 13 members are there for transcript length, and the one question the gate
itself named as ambiguous is not on it. Fix ISS-234 and ISS-235 and the deliverable stands up; ship
it as-is and condition 4's adjudication reads the wrong 13 questions.

**2. The tail composition finding.** Reproduced exactly: 4 `decoding-ever-expanding-cast`, 5
`uniaccess-*`, 13 total. The inference drawn from it is wrong in both halves.

*The decoding half:* that session is the **second-shortest transcript in the corpus** (495 unique
tokens) and **all four** of its questions are in the tail. That is a length artifact announcing
itself, not a session the gate missed.

*The uniaccess half:* "only five are `uniaccess-*`" understates it. `uniaccess-*` is 20 of 92
questions (21.7%) and 5 of 13 tail slots (38.5%) — a 1.8x enrichment — with worse mean rank (5.70 vs
4.44) and worse median (4 vs 3). **The tail supports the gate's seven-sibling story.** The manifest
reaches the opposite conclusion by arguing from `byCluster`, which is computed on the binary flag
the same document declares unusable two sections earlier. A statistic cannot be unusable for the
headline and authoritative for the refutation.

**3. What should happen next on condition 4, and who owns it.** I disagree that the next move is the
Approver's. **The maker owns one more cycle first**, and the choice should not be put to a human on
the current evidence:

- Re-pin `KNOWN_POSITIVE` to `...-gq02` and report the non-detection as the unit's finding. A probe
  that fails its own known positive is a publishable result, and more useful to condition 4 than the
  current framing.
- Length-normalise `coverage()` (or score the tail against a length-matched null) and re-derive the
  13. Only then is there a list worth paying a human or an LLM to read.
- Replace `1/df` with `log(N/df)` — a one-line change that makes the manifest's own stated rationale
  true.
- Re-state the cluster section from rank, not from the discarded binary. On the current numbers that
  section reverses.

Then the Approver's call is a genuine one — human read vs bounded LLM pass over a defensible 13 —
rather than a choice about which artifact to trust. ISS-232's caveat (~82% question overlap with the
set the original hand read sampled) stands and should be quoted wherever the two rates are compared;
it is the reason the 33.3% and any new rate are not fully independent.

## Note on process, not a finding

The manifest's framing — "the headline finding is that my first statistic was wrong" — is the right
instinct and I want it preserved through the fix cycle. What went wrong is narrower than the
framing: the self-scepticism was aimed at the statistic and not at the test that was supposed to
validate it. The known-positive id was never checked against the question text sitting in the same
JSON the unit wrote.
