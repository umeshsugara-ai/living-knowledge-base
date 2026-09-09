# Verdict — golden-set-condition3-operative

**Date:** 2026-09-09
**Cycle checked: 2**
**Unit commit:** `95dcc76`
**Binding spec:** `qa/gates/golden-set-redesign.md` (Option C), conditions 2 and 3
**Manifest:** `qa/manifests/golden-set-condition3-operative.md` (Status: ready-for-check, Fix cycle: 2 of max 3)
**Goal task:** T-021 (stays `pending` — see §5)
**Checker:** /checker Mode A, fresh context, bound to `D:\KnowledgeBase` (default coding adapter — no `qa/adapter.json`)
**Mode:** A (Mode D not applicable — see below)
**Supersedes** the cycle-1 FAIL verdict at this path (commit `2399d45`), which remains in git history and is answered rather than withdrawn — its three findings were correct and are all fixed here.

```
VERDICT: PASS
SCOREBOARD: 5/5 criteria met, 3/3 invariants hold
FAILURES (if any):
- none
LIVE-BROWSER: not-applicable (changed paths `qa/probes/golden-set-condition3.mjs`,
  `data/eval/golden-set-diagnostics.json`, `qa/gates/golden-set-redesign.md`,
  `qa/manifests/golden-set-condition3-operative.md`; `qa/**` is listed under
  `genuinely_not_user_facing` in `qa/ui-surfaces.json`, and `data/eval/*.json` matches no
  alternative in that file's `pattern` — re-read the file and the regex myself, not taken
  from the manifest)
ISSUES-WRITTEN: ISS-232 (medium), ISS-233 (low) — neither blocks; both are statements the
  artifact should carry, not errors in it
EXPLANATION: Every number in the manifest, the probe's stdout and the persisted report reproduces
exactly on my own run, and the two corpora are now measured and reported separately. Condition 3
holds on both halves: overlap page-to-page 0.0711 vs 0.071 and turns-to-turns 0.1607 vs 0.164 with
zero questions at or above 0.8; pin 10/92 = 10.9% on the turns corpus against 9.3% (prior) and
56.5%/63% (leaky). I re-derived 10.9% from `diagnose(questions, turnsText)` in my own script
without reference to my cycle-1 figure, and tested the direction of the correction rather than
accepting it: it is not the favourable framing, because the maker's own page-corpus 18.5% would
also have cleared the gate and 0/92 was smaller still — the maker gave up two better-looking
numbers to report the correctly-scoped one. Two things the artifact should say and does not — the
92-set's lineage, and that 10.9% is not entirely filter-independent — are filed, not failed:
neither was in cycle 1's FAILURES or fix direction, and failing on them now would be moving the
goalposts after the maker hit them.
```

## What I re-ran myself (nothing below is read from the manifest)

| check | my result | manifest / report claim | agrees |
|---|---|---|---|
| `node qa/probes/golden-set-condition3.mjs` | 92 questions / 23 sessions; turns pin **10/92 = 10.9%**, overlap mean **0.1607** max **0.3125**, 3910 unique tokens; page pin **17/92 = 18.5%**, overlap mean **0.0711** max **0.2143**, 921 unique tokens; near-verbatim **0** on both; forced **0/92** from a **159**-token map | identical | ✅ |
| independent re-derivation of `diagnose(qs, turnsText)` in my own script (not the probe) | pin **10/92**, pinRate **0.10869565…**, mean **0.16071850…**, max **0.3125** | 10.9% / 0.1607 / 0.3125 | ✅ |
| independent `diagnose(qs, pageText)` | pin **17/92**, pinRate **0.18478260…**, mean **0.07113778…**, max **0.21428…** | 18.5% / 0.0711 / 0.2143 | ✅ |
| persisted `data/eval/golden-set-diagnostics.json`, field by field | `gateComparable` 10 / 0.108695… / 0.160718… / 0.3125; `pageCorpus` 17 / 0.184782… / 0.071137… / 0.214285…; `forcedZero` 0, 159, `forced: true`; `nearVerbatim` page 0 turns 0 | — | ✅ |
| `grep "2.3\|regression" data/eval/golden-set-diagnostics.json` | **no match** — the withdrawn claim is gone from the persisted report, not merely struck in prose | "withdrawn" | ✅ |
| ISS-226 fix: probe source + re-run | probe imports `tokenize()` from the diagnostics lib and uses it for the pin lookup; its own `/[a-z][a-z'-]*/g` is deleted; result **0/92**, unchanged | fixed | ✅ |
| `judgeCandidate` re-applied to all 92 shipped questions | **0 rejected** — the forcing ISS-225 names is real | "forced" | ✅ |
| page-presence of the 10 turns-pinning tokens | **all 10 page-absent**, none in the 159-token pin map | not claimed | — (→ ISS-233) |
| `data/eval/recall-report.json` | hits **36** / total **92**, recall **0.391304…**, control **0.217391…** (20 hits), `filterBias` kept n=75 / rejected n=17 / combined n=92, 0 rejected this run | 0.391 / 56 / 0.217 | ✅ |
| gate byte-intactness: `git diff 95dcc76~1 95dcc76 -- qa/gates/golden-set-redesign.md` | **37 insertions, 0 deletions**; `diff` of the pre-cycle-1 gate against lines 1–177 of the current file: **identical** | "the answer above is untouched" | ✅ |
| `qa/ui-surfaces.json` read directly | `qa/**` in `genuinely_not_user_facing`; the `pattern` regex matches no `data/eval/*.json` path | not UI-touching | ✅ |

## 1. Condition 3 — ruled on separately, as asked

**Overlap half — SATISFIED.** Page-to-page 0.0711 vs the prior set's 0.071; turns-to-turns 0.1607 vs 0.164 — identical on the first, marginally better on the second. The gate's wording is "must stay ~0, i.e. still not a copy-detection tautology", and the diagnostic's own docstring gives the operational meaning: *"is the question literally a span of the target's own text?"*. Max overlap is 0.3125 and **zero** questions reach the 0.8 near-verbatim threshold on either corpus. Nothing here is a string-matching tautology.

The cycle-1 "2.3× regression" is now absent from the persisted JSON as well as from the prose. That is the part that mattered: a struck heading in a manifest does not unpublish a number that a report file still asserts, and this project has twice paid for a false statement living on in a derived artifact (ISS-091).

**Pin half — SATISFIED, at 10.9%.** Re-derived independently: `globallyUniqueTokens(turnsText)` over the 23 raw transcripts yields 3910 session-unique tokens, and 10 of the 92 questions contain one belonging to their own expected session. Against 9.3% (prior 75-set, same instrument) and 56.5%/63% (leaky 46-set), that is "well below 63%" by any reading.

**Did the maker over-correct into a different favourable framing?** No — and I tested it rather than trusting that my own cycle-1 number was safe to inherit:

- **10.9% is not the smallest number available.** 0/92 was, and the maker's own text now calls it worthless. A maker choosing the flattering frame keeps the zero and buries the label.
- **10.9% is not even the only passing number.** The page-corpus 18.5% also clears 63% comfortably. The maker gave up a *better-looking* figure to report the correctly-scoped one — the opposite of framing.
- **The instrument is fixed by the baselines, not chosen.** 63% and 9.3% were measured with `globallyUniqueTokens` over turns (`qa/verdicts/golden-set-regeneration.md:212–214`). Only the turns row can sit beside them. The maker did not pick a corpus; the comparison picked it.
- **The 10 pinning tokens are content words** — `distracted`, `isolated`, `remotely`, `matched`, `realistically`, `outsider`, `politely`, `emotions`, `awkward`, `disability` — not the `you`/`should`/`will` chance-uniqueness artifacts of the 3.1k-word page corpus. A small residue of real words is what an honest measurement of this kind looks like; a clean zero is what a rigged one looks like.

One qualification, filed rather than failed (**ISS-233**, low): the manifest and the gate correction both call 10.9% *"never optimised against by any filter"*. That is stronger than the truth. `refilter()`'s keep-predicate is turns-unique **∧** page-present, so it removed a *subset* of exactly this class. I checked all ten survivors: **every one is page-absent**, and none appears in the 159-token pin map — precisely the residue that predicate leaves behind. The accurate sentence is the cycle-1 one: *not the filter's own predicate, but a strict superset of it, so free to be non-zero.* This leaves the comparison against the equally-filtered 9.3% exact, and makes the comparison against the unfiltered 63% mildly favourable-biased. 10.9% vs 63% survives that bias by a wide margin, so no ruling changes.

## 2. Is `forced` sufficient labelling, or should the 0/92 be removed?

**Sufficient. Keep it — the maker is right, and I am overruling the tidier option.**

The label is not a sentence in prose that a reader can skip past. It is a structured field on the artifact: `forcedZero: { pinnedCount: 0, uniqueTokenCount: 159, forced: true, why: "the operative set is the output of refilter() (6055634) whose keep-predicate IS buildPinTokens, so re-applying it rejects 0 by construction. Carries no information about leakage; it restates the filter." }`. The stdout line carries the same clause. Nobody can lift that zero out of this report and present it as a leakage result without deleting the words attached to it.

Deleting it would be worse, for a reason specific to this project's history. `buildPinTokens` is the ISS-093-corrected criterion — it is the *obvious* thing to compute on this set. If the report simply omits it, the next maker recomputes it, gets 0/92, and reports a triumph, because nothing on disk explains why the obvious check is uninformative here. **A recorded refutation prevents a future error; a deletion invites its repetition.** "0/92, forced" is both the honest form of the number and the useful one.

The bar this had to clear is that the label be *load-bearing rather than decorative*: the field is machine-readable (`forced: true`), it names the mechanism, and it names the commit that causes it. It clears it.

## 3. Appending a correction below a wrong note, versus editing the note

**Gate integrity — confirmed by measurement, not by reading.** The cycle-2 commit's diff against the gate file is **37 insertions and zero deletions**, and the pre-cycle-1 gate compares byte-identical against lines 1–177 of the current file. The `Answered: 2026-09-08 — Option C (regenerate from raw transcripts) — Umesh` line, the full scope-of-C paragraph, all four acceptance conditions, and the earlier `Answered: still Option C` progress note are untouched.

**Appending is correct, and editing would have been a protocol violation rather than a style preference.** This file is the on-disk record of a human decision and of what each unit believed when it acted; its own text says why it exists — *"recorded here on disk because a gate that lives only in chat gets re-asked every sweep (the D-006 loop this project already paid for once)"*. Editing the 2026-09-09 note in place would produce a file in which no wrong number was ever reported, which is false, and which silently orphans the cycle-1 verdict that quotes those numbers. It is the same reasoning that makes `docs/DECISIONS.md` append-only with a reasoned `Supersedes` field instead of editable: **effective status is computed from the history, and a mutable record cannot be cited.**

The append also meets the standard the form demands of it. It opens *"The note above is wrong in two ways and its numbers should not be used"*, so a reader who lands on the earlier note through a `grep` hit is redirected rather than misled; it restates both corrected tables in full rather than referring out; and it correctly adds no decision and asks for none, since an arithmetic correction does not disturb the human's Option C choice.

## 4. Condition 2 — SATISFIED (re-verified, unchanged from cycle 1)

Heuristic recall@5 **0.391304** (36/92), **56 misses**, question-blind control **0.217391** (20/92). Strictly inside the (0.217, 1.000) band with a non-zero miss count. **Not 1.000, so no Option B escalation.** Condition 1 also holds: the control is cited beside the score both in the report and in the gate note.

## 5. T-021 — stays open. What remains, and whose work it is

Cycle 1's ruling stands and cycle 2 does not change it. Conditions 1, 2 and 3 now hold on the operative 92-question set, on numbers I reproduced myself. **Condition 4 remains blocked** by the two defects already recorded in the gate — neither touched by this unit, and neither fixable by it:

| what remains before the gate can close | whose work |
|---|---|
| **Sibling-session ambiguity.** ~4 of 12 sampled questions are genuinely answerable by more than one of the seven identically-formatted `uniaccess-*` sessions, so an unknown share of the 56 misses are not retriever failures. A gate pointed here punishes a retriever for questions that have no unique answer. | **Maker** — measurable and fixable with no human: quantify the multi-answerable share across all 92, then either drop those questions or score them against a set of acceptable sessions. |
| **ISS-093** — status `fixed`, `verified_date: null`. The gate names it as blocking condition 4. | **Maker** produces the evidence; **checker** moves `fixed → verified`. It cannot self-close. |
| **Re-pointing U1.4's "delta against baseline" and U1.5's "≥ 0.85" at the operative set, and re-setting the 0.85 threshold against *this* set's measured control (0.217)** rather than keeping the inherited number — which the gate explicitly demands under "Also needs deciding in the same breath". | **Approver.** A threshold is a target, not a measurement; a maker choosing its own passing bar is the exact failure this gate was opened to stop. |
| **Declaring the gate closed.** | **Approver.** The gate closes "when a unit satisfies conditions 1–4"; 4 is not satisfied. |

So: two measurable items for the maker, one number for Umesh, then closure. The maker's "Not claimed" section states precisely this and claims no closure — correct scoping, and worth recording, because the temptation on a cycle-2 PASS is to round "conditions 2 and 3 hold" up to "the gate holds".

## 6. The lineage caveat — filed (ISS-232, medium), not failed

The manifest still calls the operative set *"a different 92-question set"* and does not state its provenance. Measured: `refilter()` draws its candidates from `previouslyKept ∪ previouslyRejected`, and `filterBias` in `data/eval/recall-report.json` records kept **n=75**, rejected **n=17**, combined **n=92**. So **the 92-set is exactly the 75-set plus its own 17 rejects, re-judged under the corrected criterion with 0 rejected** — 75 of the 92 questions are the same questions the prior diagnostics ran on.

That bears on how much any of these diagnostics prove, in both directions, which is why it belongs on the artifact:

- It **explains** why every figure lands within noise of the 75-set's (0.0711 vs 0.071, 0.1607 vs 0.164, 10.9% vs 9.3%). Those four agreements are largely a property of 82% shared questions, not four independent confirmations of Option C.
- It **weakens** any reading of the 92-set as a fresh test of the regeneration, and it identifies where the real new information is: the 17 re-admitted questions, precisely those the blunt criterion had rejected.
- It **does not** disturb either ruling above. Condition 2's band and condition 3's thresholds are properties of the set actually in use, whatever its lineage.

I file rather than fail on this deliberately. It was raised in cycle 1 as *"a caveat the unit could have claimed and did not"*, it was **not** in that verdict's FAILURES block, and it was **not** among its four numbered fix directions. Promoting an explicitly-optional observation to a blocking finding on the cycle where the maker fixed everything I did list would be marking a different exam from the one I set — the D-015 failure mode aimed at the checker instead of the maker.

## Ledger

- **ISS-224 → fixed.** The corpora are measured and reported separately; the persisted report contains no cross-corpus comparison and no "2.3× regression"; the gate note carries an appended correction.
- **ISS-225 → fixed.** The zero is retained and labelled `forced: true`, with the mechanism and commit `6055634` named in the artifact. See §2 for why retention beats deletion.
- **ISS-226 → fixed.** The probe uses `tokenize()` throughout; its own regex is deleted. Re-run gives 0/92, unchanged, as predicted at cycle 1.
- **ISS-232 (medium, new)** — the diagnostics artifact does not record that the 92-set is the 75-set's candidate pool (75 kept + 17 previously-rejected) re-judged, which is why its diagnostics agree with the 75-set's.
- **ISS-233 (low, new)** — "never optimised against by any filter" overstates the independence of the turns-corpus 10.9%; `refilter()` removed the page-present subset of that class, and all 10 survivors are page-absent.

## Round-cap note (D-014)

This is the **first** PASS on the `golden-set-condition3` seam (cycle 1 was a FAIL), so the two-PASS cap is not in play. Neither new issue is security-class, and neither should be pulled as a unit of its own: ISS-232 is a sentence in a report, ISS-233 a sentence in two. Both are to be verified inside the next unit that touches `data/eval/golden-set-diagnostics.json` — most naturally the sibling-session-ambiguity unit from §5.
