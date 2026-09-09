# Verdict — golden-set-sibling-ambiguity

**Cycle checked: 3**
**Date:** 2026-09-09
**Checker:** Mode A, bound to `D:\KnowledgeBase`
**Commit checked:** `9edca1c`
**Manifest:** `qa/manifests/golden-set-sibling-ambiguity.md`
**Binding spec:** `qa/gates/golden-set-redesign.md` (Option C), condition 4 — sibling-ambiguity half
**Goal task:** T-021
**Prior verdicts:** cycle 1 FAIL (ISS-234/235/236/237, +ISS-238) · cycle 2 FAIL (ISS-239, +ISS-240)

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 3/3 invariants hold
FAILURES: none
LIVE-BROWSER: not-applicable (qa/probes/golden-set-ambiguity.mjs, data/eval/golden-set-ambiguity.json — I read qa/ui-surfaces.json myself: `qa/**` is listed under `genuinely_not_user_facing`, and `data/eval/*.json` matches no clause of the `pattern` regex, which requires a .tsx/.jsx/.vue/.svelte/.html/.css extension or one of the named app/package/api paths)
ISSUES-WRITTEN: ISS-241 (low)
EXPLANATION: Both sections named by ISS-239 are now correct against the shipped artifact, checked value by value: `## How to verify` states NOT FLAGGED / rank 1/23 / 0 rivals / knownPositive.flagged false / medianRank 2 / rank1 30 / tail 11 / fromTwoShortestTranscripts 3, and every one of those matches the probe's live output and data/eval/golden-set-ambiguity.json; `## The usable signal` now carries a struck, issue-labelled heading with the cycle-2 figures beneath it. Nothing was re-measured — probe and JSON are byte-identical to the commit I checked at cycle 2 — and I re-derived ISS-240's "7 of 11" myself rather than accepting my own earlier number: 3 tail entries from the two shortest transcripts plus 4 from the longest five, disjoint sets, 7 of 11. What remains is one stale prose figure: two live sections still call the deliverable a "13-question list" where the artifact ships 11. That is off by two in the direction that understates the unit's own result, contradicts nothing quantitative, and misdirects no verification step, so it is filed as ISS-241 (low) and recorded here rather than charged as a failure.
```

## What I re-ran

```
node qa/probes/golden-set-ambiguity.mjs                     # no --write; full output compared line by line
git diff --stat 9fee80e 9edca1c -- data/eval/golden-set-ambiguity.json qa/probes/golden-set-ambiguity.mjs
```

The diff is **empty**: the probe and the shipped JSON are byte-unchanged from the commit I checked at
cycle 2, so the cycle-2 verification of the instrument and of the negative result carries over intact
and this check is confined to the document, as scoped. The only files that moved between `9fee80e`
and `9edca1c` are the manifest, the ledger, the cycle-2 verdict and `qa/.last-tick`.

I additionally re-derived, from the corpora rather than from my own prior verdict: the tail's
length composition (ISS-240's 7/11), and the `68 of 92` figure the scope-correction paragraph quotes.

## ISS-239, section 1 — `## How to verify`, line by line against the shipped JSON

| manifest says | probe / `data/eval/golden-set-ambiguity.json` | agrees |
|---|---|---|
| known positive `…-gq02` → `NOT FLAGGED` | `rank 1/23, rivals 0  ->  NOT FLAGGED` | yes |
| rank **1/23**, **0** rivals | `knownPositive.rank` 1, `rivalCount` 0 | yes |
| `knownPositive.flagged` **false** | `false` | yes |
| `headline.medianRank` **2** | `2` | yes |
| `headline.rank1` **30** | `30` (probe prints `30/92 = 32.6%`) | yes |
| `tailForAdjudication.count` **11** | `11`, and `ids` has exactly 11 entries | yes |
| `tailForAdjudication.fromTwoShortestTranscripts` **3** | `3` | yes |

The superseding of the cycle-1 void-rule is stated explicitly and correctly: the section now says the
non-detection *is* the finding and quotes the old rule verbatim before retiring it, so a reader who
knows the cycle-1 recipe is told why it no longer applies rather than left to discover the conflict.
This was the substance of the cycle-2 FAIL and it is closed.

**One omission, not a defect.** My cycle-2 clearing note asked for `unusableBinary.contestedRate`
**0.6739** in the recipe; the rewritten section drops the field rather than restating it. The shipped
JSON does carry `0.6739`, and the section no longer asserts the stale `0.7717`, so nothing false
remains — a reader simply gets one fewer assertion to check. Recorded, not charged.

## ISS-239, section 2 — `## The usable signal`

Now `## ~~The usable signal: where the target actually ranks~~ (CYCLE 1 FIGURES, SUPERSEDED — ISS-239)`,
with the cycle-1 line struck through and the cycle-2 figures (30/92 = 32.6%, 61/92 = 66.3%, median 2,
tail 11) stated beneath as current. It also adds the sentence that matters most — that the
"moderately discriminating set" reading is *beside the point*, since none of these figures is evidence
about ambiguity. That is a stronger fix than the strike I asked for.

## My own sweep for anything else stated as live

I did not assume the maker's sweep was complete; I walked every section.

**Correct and verified:**

- The two spots the maker neutralised on its own initiative both check out: the `~~It is flagged: rank
  21 of 23~~` sentence is struck and followed by an explicit `**VOID (ISS-234).**`, and the tail-table
  row for `…-gq01` carries `← NOT the gate's example (ISS-234); gq02 is, and it ranks 1`.
- The cycle-1/cycle-2 comparison table is correctly columned as history vs current on all five rows.
- The block quote of the known-positive result matches the probe's stdout verbatim.
- `measured on 13% of the set` (line 99) is 12/92 — unrelated to the tail count, and correct.
- Every struck section (77.2% headline, usable signal, known-positive, deliverable list, no-stopword-
  list) carries the withdrawing issue id in its heading.

**ISS-240 — the "7 of 11" figure, re-derived rather than accepted.** The maker took this number from my
cycle-2 verdict, so I measured it independently from `loadCorpora()`: the two shortest transcripts are
`…-atlas-skilltech` and `…-decoding-ever-expanding-cast`, contributing tail entries
`decoding-gq04`, `decoding-gq03`, `atlas-skilltech-gq04` = **3**; the longest five contribute
`creative-futures-gq02`, `ashoka-university-gq01`, `visa-blueprint-part2-gq04`,
`beyond-black-robes-gq02` = **4**. Disjoint. **7 of 11 confirmed**, and the tail is now labelled a
reading list with that bias stated in the same breath. ISS-240 closed.

**Scope correction — accurately stated, and not overstated in the maker's favour.** The conclusion now
reads "a negative result about the **LEXICAL** cheap path" and "what is closed is the **lexical**
family". The four operationalisations are named correctly and the `1 or 2 of 23 in every one` claim
matches my cycle-2 table. I re-checked the one number in that paragraph I had not previously stated in
a form the maker could copy blind: **`68 of 92`**. Under the raw-coverage variant — the one where gq02
actually sits at rank 2, so the one the threshold argument must be made against — the rank-1 count is
24, leaving **68** questions at rank ≥ 2. The figure is right *and* correctly paired with the variant
it belongs to. The paragraph also closes with "the result generalises **further** than I demonstrated",
which disclaims the maker's own evidence for it and attributes the four-variant run to the checker.
No credit is taken that was not earned.

**Next-steps framing — my position recorded accurately.** The manifest replaced its own "Approver's
call" framing with: a bounded embedding pass is "**unblocked maker work needing no approval**", it is
"the first leg … mine, not the Approver's", and "only after that is the human-vs-LLM choice a real
one". That is my cycle-2 position, including the flip from cycle 1 and the reason for it. It is
recorded as a correction I made, not laundered as the maker's own idea.

**The one thing left stated as live — ISS-241 (low).** Two unstruck sections still give the deliverable
as thirteen questions:

- line 109: *"its actual deliverable — reduces adjudication from 92 questions to **13**"*
- line 211: *"What the unit provides is a **prioritised 13-question list**"*

The artifact ships 11 (`tailForAdjudication.count`, and 11 `ids`), and the manifest itself says 11 in
four other places. My cycle-2 clearing note named line 101's "92 questions to 13" as a rider on
condition 2; the rider was missed while the primary was fixed.

I am **not** failing on it, and I want the reasoning on the record so this is not read as a checker
going soft on cycle 3. ISS-239 was charged at high because the verification recipe told a reader to
conclude the report was **void** — it inverted the unit's result and misdirected the one procedure a
reader would run. "13" where the artifact says 11 inverts nothing, misdirects no check, and errs in the
direction that makes the unit's own deliverable look *weaker* than it is. Every quantitative section,
the verification recipe, the shipped JSON and the probe now agree with each other and with my
independent re-derivation. Sending that to STALLED with an `/agent-debugger` dispatch over a two-count
prose figure would be a defect in this gate, not a service to it.

**What would clear ISS-241** (for whatever unit next touches this file, per the medium/low rule in the
project CLAUDE.md): change both occurrences to 11 and, at line 211, name the tail's known length bias
the way line 84 already does.

## Convention check — struck heading, unstruck body

The dispatch warned that a struck heading over an unstruck affirmative claim still misleads, so I
checked the one place it occurs: under `## ~~The deliverable: 13 questions, not 92~~ (CYCLE 1,
SUPERSEDED — 11 questions after length normalisation)` the body is unstruck and its "four of thirteen
are `decoding-…`, only five are `uniaccess-*`" counts are cycle-1 (the current tail has 2 and 2).

I judge this **within the document's stated convention rather than a live claim**: every struck heading
in this manifest labels its section with the cycle and the withdrawing issue id, and this one names both
the cycle and the corrected count in the heading itself. The same pattern governs the withdrawn cluster
section. A reader meets the retraction before the prose in both cases. Had the heading been bare, I
would have charged it. Noted here so the convention is on the record and a future checker does not have
to re-litigate it.

## Ledger

| issue | status |
|---|---|
| ISS-234 | fixed → **verified** (probe still pinned to gq02; id, text and gate sentence agree; result reproduces) |
| ISS-235 | fixed → **verified** (baseline subtraction unchanged on disk; tail 3/11 re-derived) |
| ISS-236 | fixed → **verified** (`log(N/df)` unchanged on disk) |
| ISS-237 | fixed → **verified** (rank-based cluster statement unchanged; refutation stays withdrawn) |
| ISS-238 | fixed → **verified** (probe prints all 11 tail rows; counted in my own run) |
| ISS-239 | open → **fixed** (both named sections corrected; every figure re-checked against the shipped JSON) |
| ISS-240 | open → **fixed** (tail labelled a reading list; "7 of 11 explicable by length" stated and independently re-derived) |
| ISS-241 | **new, low** — two live sections still call the deliverable a 13-question list; the artifact ships 11 |

`.goal/goal.json` deliberately left untouched (modified in the working tree by a concurrent session;
the dispatch pinned it out of scope). T-021's close-out is the maker's to record in its close-out tick.

## Position on what happens next for condition 4

Unchanged from cycle 2, and now recorded correctly in the manifest: **the bounded embedding pass is
maker work, not an Approver decision.** Cosine between each question and every session transcript,
flagging a near-tied top-2 — no LLM spend, no data approval, and it tests the one hypothesis this
lexical negative does not touch. The Approver's call is only the *second* leg: a bounded LLM
adjudication versus a human read, over whatever survives the embedding pass. Condition 4 should not sit
on a human gate while an untested cheap path remains.

## Note on process

Three cycles, and the unit's trajectory was cycle 1 shipping a headline, cycle 2 destroying it and
reporting that instead, cycle 3 repairing the document that still argued for the deleted headline. The
measurement was right after cycle 2; what took a third cycle was making the prose agree with it. That
is a cheaper failure than the alternative, and it is the one this pair exists to catch.
