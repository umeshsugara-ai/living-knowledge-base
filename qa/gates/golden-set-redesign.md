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
