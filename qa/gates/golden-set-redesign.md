# HUMAN_GATE — golden-set-redesign

**Opened:** 2026-09-08T01:30:00Z
**Blocks — scope corrected 2026-09-08 by the `eval-baseline-control` checker (verdict
`fcc2863`, ISS-071), which found my first draft of this gate wrong in BOTH directions:**

*Narrower than I first wrote* — U0.10 has three parts and only one is blocked:
- **BLOCKED:** the recall@5 half (T-021). Saturated, cannot demonstrate improvement.
- **NOT blocked:** the judge-agreement half (T-022) — a different instrument, unaffected.
- **NOT blocked:** "file the retraction of the heuristic-proxy PASS" — needs no question set.

*Wider than I first wrote* — the same saturation disarms two **Phase 1 exit gates** directly,
so this is a Phase-1 exit-criterion problem, not a U0.10-local one:
- **U1.4** — "recall@5 reported as a **delta against the U0.10 baseline**" (plan §10). Against a
  1.000 baseline the delta can only be ≤ 0: the gate can never register success.
- **U1.5** — "recall@5 **≥ 0.85** on the real golden set". Already cleared by anything not
  actively broken, so the vector layer's own acceptance test is unfailable before it is built.

Also blocks a meaningful `done_check` on `.goal` task **T-021** (`pending`, `done_check: null`).

The honest one-line statement of the defect, per the checker: the metric **can falsify a
regression, can never demonstrate an improvement, against an unfailable target.**

## The question, in one line

The recall@5 golden set is **saturated** (1.000, 46/46, zero misses), so U0.10's prescribed
remedy — "redo T-021/T-022 against a real LLM" — cannot produce a falsifiable number against it.
**Where should a non-saturated question set come from?**

## Why this needs a human and not a maker

Every option below trades off cost, independence, and data-approval scope — and the one thing a
maker cannot do is author "independent" questions, because anything it generates from the same
corpus reproduces the leak it is meant to remove. This is a scope/ownership call, not a build.

## The evidence (measured twice, independently)

| | value |
|---|---|
| heuristic retriever, recall@5 | **1.000** (46/46, **0 misses**) |
| question-blind control | **0.217** (= the chance floor exactly, 5 of 23 sessions) |
| lift over control | **+0.783** — the retriever genuinely beats chance, decisively |
| verdict | **saturated** — pinned at the ceiling |

Measured independently by the Mode B sweep (commit `c11515a`) on the same data:
- **0/46** questions appear verbatim in their target summary — so this is **not** a
  copy-detection tautology (an exact-substring matcher scores 0.000, not 1.000).
- mean score margin, correct session vs. best rival: **+0.501** on a 0..1 scale; only **1/46**
  contested.
- a **single globally-unique token** pins the correct session unaided in **29/46 (63%)**.

Diagnosis both passes agree on: **same-source vocabulary leakage plus ceiling saturation.** The
46 questions are `session_page.keyInsights` excerpts (see `scripts/gen-golden-set.mjs`) — written
by the same summarizer, over the same transcript, as the `summary` field being retrieved against.
They share the rare named entities that make the answer unique. A metric in this state can
register a regression but can never demonstrate an improvement.

**Consequence if this gate is skipped:** U0.10 runs, spends real LLM budget, returns ~1.000
again, clears `recall@5 >= 0.85` trivially, and the project *believes* falsifiability was fixed.
That is strictly worse than not running it.

## Options

**A — Hand-authored by the counsellor team (highest independence, highest human cost).**
Umesh or a counsellor writes ~50 real student-style questions against the 23 TOC sessions.
Fully independent of the summarizer. Slowest.

**B — Drawn from real Pathlynks student questions (highest realism, needs a data decision).**
Already partially approved: `D-007` covers Pathlynks questions for the eval bank *conditional on
anonymisation* (PII-stripped, human-reviewed once, hash-frozen). Would need confirmation that
this specific use is in scope, and someone to own the one-time review.

**C — Regenerated from raw TRANSCRIPTS by a different model/prompt than the summarizer, with
near-neighbour distractors (cheapest, partially independent).** Still machine-derived, so it
reduces rather than removes the leak — but it is buildable with no human authoring, and paired
with the now-shipped question-blind control it is honestly reportable. The sweep's own
recommendation was closest to this, plus phrasing questions as actual questions.

**D — Keep the current set, retire the metric.** Stop citing recall@5 as evidence, define
Phase 1's exit on something else. Cheapest, but leaves the plan's falsifiability requirement
unmet rather than solved.

## Also needs deciding in the same breath

`T-021`'s target of **recall@5 ≥ 0.85** is currently unfailable — anything not actively broken
clears it. Whichever option is chosen, that threshold should be re-set against the new set's
measured control, not kept as an inherited number.

## How to answer

Reply with the option letter (and any scope note), e.g. `C, but phrase them as real questions
and keep the control in every report`. Then append below:

`Answered: <ISO date> — <choice> — <where>`

---

*Raised by the maker on the 2026-09-08T01:35 tick and again on the 01:20 tick's report; recorded
here on disk because a gate that lives only in chat gets re-asked every sweep (the D-006 loop
this project already paid for once).*

---

**Answered: 2026-09-08 — Option C (regenerate from raw transcripts) — Umesh, in session; recorded
here per the Gate record rule before any unit acts on it.**

Chosen over A (hand-authored) and B (Pathlynks questions under D-007) on cost/latency: C needs no
human authoring and no data-approval step, so it unblocks Phase 1 now. It is explicitly the
*weakest* of the three on independence and is accepted as such, with the conditions below.

**Scope of what C authorizes.** Rewrite `scripts/gen-golden-set.mjs` so questions are generated:
- from the **raw transcripts** (`data/toc-migrated/<sessionId>/turns.json`), **not** from
  `session_page.json`. The present leak is exact and visible at `gen-golden-set.mjs:39`
  (`question: insight`): the question is a verbatim `keyInsights` string from the same
  `session_page.json` document whose `summary` field retrieval then scores against — same author,
  same pass, same rare named entities. That is the whole 1.000.
- by a **different model and prompt** than the summarizer that produced `session_page.json`;
- phrased as **actual questions** a student would ask, not declarative excerpts;
- with **near-neighbour distractors** — sessions deliberately chosen to share topic vocabulary
  with the target — so a single globally-unique token cannot pin the answer (it currently does in
  29/46, 63%).

**Acceptance conditions — binding on whoever runs this unit.**
1. The report states plainly that C reduces but does **not** remove same-source vocabulary
   leakage, and cites the question-blind control (**0.217**) beside every new score.
2. Pass = a recall@5 **strictly between 0.217 and 1.000, with a non-zero miss count**.
   **1.000 is a FAILURE of this remedy, not a success** — it is evidence the leak survived the
   regeneration, and escalates to Option B rather than closing this gate.
3. Re-run the sweep's two independent diagnostics on the new set before reporting: verbatim-overlap
   (must stay ~0, i.e. still not a copy-detection tautology) and the single-unique-token pin rate
   (must fall well below 63%).
4. Only after (2) and (3) hold may U1.4's "delta against baseline" and U1.5's "≥ 0.85" be
   re-pointed at the new set. Until then both Phase 1 exit gates remain unfailable and must not be
   cited as passed.

This gate is **not** closed by this answer. It closes when a unit satisfies conditions 1–4, or
when condition 2 fails and the decision escalates to Option B.

---

## Progress against the conditions (appended 2026-09-08 by the maker — the answer above is untouched)

**Conditions 1–3: satisfied**, by unit `golden-set-regeneration`
(`qa/verdicts/golden-set-regeneration.md`, PASS cycle 2). Regenerated from
`data/toc-migrated/<id>/turns.json` with `gemini-2.5-pro` (the summarizer is `gemini-2.5-flash`).

**Condition 2, measured:** recall@5 **0.307** (23/75), **52 misses**, question-blind control
**0.187**, `assessBaseline` verdict **`informative`** (was `saturated`). Strictly inside the
(0.217, 1.000) band with a non-zero miss count — **not 1.000, so no Option B escalation.**
**Condition 3:** unique-token pin rate 56.5% → **9.3%**; verbatim overlap vs the scored corpus
1.000 → **0.071**.

### ⚠️ TWO PRECONDITIONS ON CONDITION 4 — read before re-pointing U1.4/U1.5

Condition 4 lets U1.4's "delta against baseline" and U1.5's "≥ 0.85" be re-pointed at the new set
once 2 and 3 hold. They do. **But two defects found during the work would be inherited by those
gates, and both need the same regeneration to fix**, so they are cheapest to fix together:

1. **Sibling-session ambiguity.** An independent read of 12 questions found **~4 genuinely
   answerable by more than one session**, driven by seven identically-formatted `uniaccess-*`
   sessions — e.g. *"is the university in the city or a secluded campus?"* is answered by all of
   them. A material share of the 52 misses are therefore **not** retriever failures, and a gate
   pointed here would punish a retriever for questions that have no unique answer.
2. **`ISS-093` (high) — the post-filter's pin criterion is too blunt.** It rejects tokens "unique
   in the scored corpus", which catches ordinary words: **13 of 17 rejections fired on words like
   `should`, `will`, `you`, `people`, `paths`, `skills`, `living`.** Because the criterion runs
   over the corpus retrieval scores, it preferentially removes questions the retriever answers —
   so **recall@5 = 0.307 is a downward-biased FLOOR, not an unbiased estimate**. Measured every
   run as `filterBias` in `data/eval/recall-report.json`: kept **0.307** / rejected **0.765** /
   combined **0.391**.

**ISS-093 is recorded as blocking condition 4.** Nothing yet depends on 0.307 being unbiased,
because condition 4 is unexecuted — which is exactly why it should be fixed before it is.

**Answered: still Option C. This note adds no decision and asks for none** — it records what the
work found, so whoever executes condition 4 reads it here rather than having to find it in a
verdict file.

---

## Conditions 2 and 3 re-measured on the OPERATIVE set (appended 2026-09-09 by the maker — the answer above is untouched)

**The progress note above measures a set that is no longer the one in use.** It reports a
75-question set at recall@5 0.307. `data/eval/golden-set.json` now holds **92** questions
(provenance: generated 2026-09-08T09:01, kept 92, rejected 0, `gemini-2.5-pro` against the
`gemini-2.5-flash` summarizer), and all three current reports score against it — heuristic 0.391,
vector 0.935, hybrid 0.870. No condition-3 diagnostics existed for it: `gen-golden-set.mjs` writes
the set and the reject list only. Unit `golden-set-condition3-operative` supplies them.

**Condition 2, on the operative set:** heuristic recall@5 **0.391** (36/92), **56 misses**,
question-blind control **0.217** (20/92). Strictly inside (0.217, 1.000) with a non-zero miss count
— **not 1.000, so no Option B escalation.**

**Condition 3, on the operative set** (`data/eval/golden-set-diagnostics.json`):

- verbatim overlap **mean 0.161 / max 0.313 / zero questions at or above 0.8**
- unique-token pin, **blunt criterion** (the one that produced the 63% baseline): **17/92 = 18.5%**
- unique-token pin, **ISS-093-corrected criterion**: **0/92 = 0.0%**

The blunt 18.5% is an **upper bound dominated by ordinary-word artifacts** — its pinning tokens are
`you`, `should`, `will`, `people`, `paths`, `skills`, `living`, which is the same list ISS-093
recorded. The corrected zero is real rather than an empty denominator: the corrected pin set holds
**159** tokens (`shagun`, `handa`, `flywire`, `cept`, `leeds`, `italia`, `provident`), and `flywire`
— this gate's own worked example — is among them and used by no question.

**Reported against, not buried:** mean verbatim overlap is **2.3× the prior set's** (0.161 vs
0.071). Nothing reaches the near-verbatim threshold and the max is 0.313, so it is far from a
copy-detection tautology — but it is not "~0" in the way 0.071 was. Whether that clears condition
3's wording is a judgement this note does not make.

**This note adds no decision and asks for none.** Condition 4 stays blocked by the two defects
already recorded above (sibling-session ambiguity; ISS-093, still `verified_date: null`).

### CORRECTION to the note above (2026-09-09, same maker, cycle 2) — I compared mixed corpora

The note above is wrong in two ways and its numbers should not be used.

**There is no overlap regression.** `diagnose()` returns overlap against the WORSE of the two
corpora, and I set that `max(page, turns)` figure beside a prior of 0.071 that was **page-only**.
`qa/verdicts/golden-set-regeneration.md:232` states both prior numbers on one line — "mean 0.071
against the scored corpus, 0.164 against turns". Like-for-like:

| | operative 92-set | prior 75-set |
|---|---|---|
| overlap vs **page** corpus | **0.0711** | 0.071 |
| overlap vs **turns** corpus | **0.1607** | 0.164 |

Page-to-page identical, turns-to-turns marginally better. **Condition 3's overlap half is satisfied**
— zero questions at or above 0.8, max 0.3125.

**The pin comparison was also not like-for-like.** 63% and 9.3% are **turns**-corpus figures; my
18.5% was **page**-corpus. The page-corpus analogue of the leaky 46-question set is **100%**, not
63%. The gate-comparable number is:

| corpus | pin rate | comparable to |
|---|---|---|
| **turns (~218k words)** | **10/92 = 10.9%** | 63% leaky / 9.3% prior — **the gate-comparable row** |
| page (~3.1k words) | 17/92 = 18.5% | nothing |
| `buildPinTokens` | 0/92, **forced** | nothing |

**The 0/92 carries no information.** `data/eval/golden-set.json` is the output of `refilter()`
(`6055634`), whose keep-predicate **is** `buildPinTokens` — re-applying it rejects nothing by
construction. It restates the filter.

**10.9% is the number condition 3 asks for**: turns-corpus, never optimised against by any filter,
pinning tokens that are real content words (`distracted`, `isolated`, `remotely`, `realistically`,
`disability`), and well below 63%. The previous note's conclusion stands; its arithmetic did not.

Report: `data/eval/golden-set-diagnostics.json`. **This note adds no decision and asks for none.**
