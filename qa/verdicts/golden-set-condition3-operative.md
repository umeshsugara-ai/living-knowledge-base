# Verdict — golden-set-condition3-operative

**Date:** 2026-09-09
**Cycle checked: 1**
**Unit commit:** `829070d`
**Binding spec:** `qa/gates/golden-set-redesign.md` (Option C), conditions 2 and 3
**Goal task:** T-021
**Mode:** A (Mode D not applicable — see below)

```
VERDICT: FAIL
SCOREBOARD: 4/5 criteria met, 2/3 invariants hold
FAILURES (if any):
- [C-honesty] sev: high · the required artifact `data/eval/golden-set-diagnostics.json` and the gate
  note both compare MIXED CORPORA: an 18.5% page-corpus pin rate is placed beside the 63%/9.3%
  baselines, which are TURNS-corpus numbers (the page-corpus analogue of the leaky set is 100%, not
  63%), and a 0.161 max(page,turns) overlap is placed beside a 0.071 page-only prior, manufacturing a
  "2.3× regression" that does not exist · report the turns-corpus pin (10/92 = 10.9%) as the
  like-for-like figure and compare overlap page-to-page (0.0711 vs 0.071) and turns-to-turns (0.1607
  vs 0.164) · issue: ISS-224
- [C3b] sev: high · the corrected 0/92 is arithmetically FORCED, not a measurement: the operative set
  is the output of `refilter()` (commit `6055634`), whose `judgeCandidate` rejects exactly the
  predicate `buildPinTokens` the probe recomputes — I re-ran it and it rejects 0/92 · disclose the
  forcing (as `golden-set-regeneration` did for the page-corpus zero, ISS-092) and lead with the
  non-optimised turns-corpus 10.9% · issue: ISS-225
LIVE-BROWSER: not-applicable (changed paths `qa/probes/golden-set-condition3.mjs`,
  `data/eval/golden-set-diagnostics.json`; `qa/**` is `genuinely_not_user_facing` in
  `qa/ui-surfaces.json` and `data/**` matches no pattern in it — confirmed by reading the file)
ISSUES-WRITTEN: ISS-224, ISS-225, ISS-226
EXPLANATION: Conditions 2 and 3 do hold on the operative 92-question set — but not for the reasons
the unit gives, and not by the numbers it reports. Both of its headline condition-3 figures are
mis-framed: 18.5% is compared to a baseline measured on a different corpus, and the 0/92 is the
filter grading its own criterion. The genuinely comparable number, which the unit never computes, is
10.9% on the turns corpus (prior set 9.3%, leaky set 56.5%) — comfortably below 63%. The disclosed
"2.3× overlap regression" is not real: page-to-page overlap is 0.0711 vs 0.071 and turns-to-turns is
0.1607 vs 0.164. That correction is in the maker's favour and it still fails, because the artifact
the gate requires now carries three false comparisons — the ISS-091 failure class this project has
already paid for twice.
```

## What I re-ran myself (nothing below is read from the manifest)

| check | my result | manifest claim | agrees |
|---|---|---|---|
| `node qa/probes/golden-set-condition3.mjs` | 92 questions / 23 sessions; overlap mean **0.1607** max **0.3125** near-verbatim **0**; blunt pin **17/92 = 18.5%**; corrected **0/92**; unique tokens 921 | identical | ✅ |
| `buildPinTokens` map size + `flywire` | **159**, `flywire` → `2026-05-08-funding-dreams-loans-forex` | 159, same session | ✅ |
| `data/eval/recall-report.json` | hits **36** / total **92**, recall **0.3913**, control **0.2174** (20), misses **56**, `filterBias` kept=combined (0 rejected) | 0.391 / 56 / 0.217 | ✅ |
| `diagnose(qs, pageText)` — page corpus only | pin **17/92 (18.5%)**, overlap mean **0.0711**, max 0.2143 | not reported | — |
| `diagnose(qs, turnsText)` — turns corpus only | pin **10/92 (10.9%)**, 3910 unique tokens, overlap mean **0.1607** max **0.3125** | **not reported** | ❌ |
| `judgeCandidate` re-applied to all 92 shipped questions | **0 rejected** | not reported | ❌ |
| probe regex `/[a-z][a-z'-]*/g` vs `tokenize()` for the corrected pin | both **0/92**, **0 disagreements** | — | ✅ |
| gate file byte-intactness (`git diff 829070d~1 829070d -- qa/gates/golden-set-redesign.md`) | pure append after line 175; zero deletions | "the answer above is untouched" | ✅ |

## Attack 1 — is the 0/92 fake?

**The tokenizer hypothesis is dead, and I killed it by measurement rather than by reading.** The
probe splits the question with `/[a-z][a-z'-]*/g` while the pin map's keys come from `tokenize()`,
which splits on `\W+` — so `on-site`, `don't`, `parents'` are single probe tokens that can *never*
equal a pin key. That is a genuine divergence (filed **ISS-226**, medium, latent). But re-running the
lookup with `tokenize()` instead gives **0/92 as well, with 0 per-question disagreements**, so it is
not what produces the zero. `buildPinTokens` is reachable, returns **159** tokens, and `flywire` — the
gate's own worked example — is in it. The denominator is not empty.

**The zero is nonetheless not evidence, for a different reason the manifest does not raise.**
`git log -- data/eval/golden-set.json` shows the operative set was last written by **`6055634`
"fix(eval): pin on genuinely rare tokens, not small-corpus artefacts (ISS-093)"** — i.e. by
`refilter()`, which keeps only candidates passing `judgeCandidate`, whose pin predicate *is*
`buildPinTokens`. I re-applied `judgeCandidate` to all 92 shipped questions: **0 would be rejected.**
Every shipped question was already certified clean under the exact predicate the probe recomputes, so
0/92 is arithmetically forced.

This is the same tautology `golden-set-build.mjs`'s own header claims the file split prevents
("what stops the measurement from grading the filter's own criterion — the tautology ISS-092 was
filed for"), and the same one the `golden-set-regeneration` checker named for the page-corpus zero:
*"a page-corpus pin rate of exactly 0.0% is arithmetically forced; it is not evidence."* ISS-093 moved
the criterion from page to turns-and-page; it did not move the measurement out of the filter's shadow.
The manifest's "**that zero is real, not an empty denominator** — the check I owed after five vacuity
findings today" answers the denominator objection and misses the forcing objection.

**Ruling: real arithmetic, zero information.** Not fabricated; not usable as a leakage estimate.

## Attack 2 — the blunt-vs-corrected framing, and attack 4 — is 18.5% like-for-like with 63%?

These turn out to be the same question, and the maker has it backwards.

I checked the 17 pinning tokens: `parents`, `interest`, `story`, `living`, `sat`, `applicants`,
`should`, `paths`, `skills`, `people`, `officers`, `will`, `aptitude`, `you`. The maker's reading of
*these tokens* is correct and not self-serving — a question "pinned" by `you` is not pinned, and the
list does match ISS-093's.

But the comparison it is put to is wrong. `qa/verdicts/golden-set-regeneration.md` records what the
baselines actually measure:

| | leaky 46-set | prior 75-set | operative 92-set (mine) |
|---|---|---|---|
| pin, **turns** corpus | **56.5%** (26/46) | **9.3%** (7/75) | **10.9%** (10/92) |
| pin, **page** corpus | **100%** | 0.0% (declared tautological) | 18.5% (17/92) |

The gate's 63% (29/46) and the prior 9.3% are **turns-corpus** figures. The page-corpus analogue of
the leaky set is **100%**, not 63%. So the probe's own comment — *"deliberately the same blunt
criterion that produced the gate's 63% baseline, so the comparison is like-for-like"* — is false, and
the persisted report repeats it in `pinCriterion` and in `comparison.leakySet`.

The correctly like-for-like number is one the unit never computes: **10/92 = 10.9% on the turns
corpus**, against 9.3% prior and 56.5%/63% leaky. It is not the filter's own criterion (the filter
additionally requires page-presence, so this is a strict superset and free to be non-zero — and it
*is* non-zero, pinned by `distracted`, `isolated`, `remotely`, `matched`, `realistically`, `outsider`,
`politely`, `emotions`, `awkward`, `disability`), and it is **well below 63% by any reading**.

**Ruling: condition 3's pin half is satisfied — at 10.9%, not at 18.5% and not at 0%.** Both reported
numbers are unusable for the gate's comparison; the unit reached the right conclusion through two
wrong numbers.

## Attack 3 — is 0.161 mean overlap "~0" for this gate?

**There is no regression to judge.** The maker compares `diagnose(questions, pageText, turnsText)`,
which reports `max(page, turns)` per row, against a prior figure of 0.071 that was **page-corpus
only**. Measured separately on the operative set:

- **page corpus (the surface retrieval scores against): mean 0.0711, max 0.2143** — prior set 0.071, max 0.214.
- **turns corpus (the surface questions were generated from): mean 0.1607, max 0.3125** — prior set 0.164, max 0.313 (`golden-set-regeneration.md:232`, verbatim: *"mean 0.071 against the scored corpus, 0.164 against turns; max 0.313"*).

Page-to-page the sets are identical to three decimals; turns-to-turns the operative set is
*marginally better*. The "2.3× higher" is an artifact of comparing max(page,turns) to page.

On the substance: condition 3 asks that overlap "stay ~0, i.e. still not a copy-detection tautology",
and the diagnostic's own docstring gives the operational meaning — *"is the question literally a span
of the target's own text?"*. Zero questions at or above 0.8, max 0.3125, and a scored-corpus mean of
0.0711 all say no. **Ruling: condition 3's overlap half is SATISFIED, and the disclosed regression is
not real.** The maker's instinct to surface an unwelcome number rather than bury it is right; the
error is that it did not check whether the two numbers were the same measurement, and the prior
verdict it inherited states both on one line.

## Gate file, scoping, and the three recall numbers

- **Gate integrity: intact.** The commit's diff against the gate file is additions-only after line
  175. The `Answered:` lines, the human's Option C decision, and the earlier progress note are
  byte-identical. The note also correctly adds no decision and asks for none.
- **Scoping: correct.** Not closing the gate is the right call. Condition 4 is blocked by
  sibling-session ambiguity and by ISS-093 (`verified_date: null`), neither of which this unit
  touches, and closure is not the maker's to declare.
- **T-021 stays open**, and would have stayed open even on a PASS: condition 4 is the gate's own
  precondition for re-pointing U1.4/U1.5, and the diagnostics artifact needs the corrections above.
- **The three recall numbers (0.391 / 0.935 / 0.870): retroactively supported on the leakage
  question, and no recall value needs re-stating.** The operative set is not a copy-detection
  tautology (overlap max 0.3125, zero near-verbatim) and is not token-pinned (10.9% turns-corpus), so
  the condition-3 precondition is now met in fact for all three. What needs re-stating is not the
  recall figures but this unit's own comparison table and the gate note's regression paragraph.
- **A caveat the unit could have claimed and did not:** the 92-set is not an independently generated
  set. It is the *same candidate pool* as the 75-set, re-judged by `refilter()` under the corrected
  criterion (0 rejected, so kept = candidates). The manifest's framing — "a different 92-question
  set" — is loosely true but obscures why every diagnostic lands within noise of the 75-set's. Stating
  the lineage would strengthen the unit, not weaken it.

## Fix direction for cycle 2 (no rebuild required)

1. Report **pin on the turns corpus (10/92 = 10.9%)** as the gate-comparable figure, beside 9.3%
   (prior) and 56.5%/63% (leaky).
2. Keep the page-corpus 18.5% and the corrected 0/92, but label them honestly: 18.5%'s leaky analogue
   is **100%**, and 0/92 is **forced by `refilter()`**, citing `6055634`.
3. Compare overlap page-to-page (0.0711 vs 0.071) and turns-to-turns (0.1607 vs 0.164); withdraw the
   "2.3× regression" from the persisted report and from the gate note (by a further append, never an
   edit).
4. Optional (ISS-226): use `tokenize()` in the probe instead of `/[a-z][a-z'-]*/g`, so the probe's
   split matches the map it queries.

Items 1–3 are edits to `data/eval/golden-set-diagnostics.json`'s comparison fields, the probe's
comments/constants, and one appended paragraph. The measurement code is sound and I reproduced every
number it prints.
