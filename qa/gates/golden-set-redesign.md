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
