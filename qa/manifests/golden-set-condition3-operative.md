# Manifest — golden-set-condition3-operative

**Contract:** `qa/gates/golden-set-redesign.md` (Option C) is the binding spec — conditions 2 and 3.
**Goal task:** T-021 (tier 3, roadmap).
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none directly — closes a measurement gap on T-021's conditions 2 and 3.

## Why — three recall numbers rest on an unmeasured set

The gate makes condition 3 a **precondition on reporting a recall number**;
`scripts/lib/golden-set-diagnostics.mjs`'s own header says the diagnostics "must be re-run on any
regenerated set **BEFORE** its recall number is reported."

They were run — on a **75-question** set scoring recall@5 0.307. **The operative set is a different
one.** `data/eval/golden-set-provenance.json` records 92 questions generated 2026-09-08T09:01 (kept
92, rejected 0), and all three current reports score against it: heuristic 0.391, vector 0.935,
hybrid 0.870. `gen-golden-set.mjs` writes the set and the reject list and nothing else, and **no
file under `data/eval/` contained a pin rate**.

So three recall numbers rested on a set whose leakage was never measured — **including the 0.870 I
shipped this morning and cited in a PASSed unit.**

I did **not** regenerate the set. Conditions 1–3 were satisfied for the 75-set by
`golden-set-regeneration`, and the generator's provenance shows the 92-set was produced the same
Option C way (raw transcripts, `gemini-2.5-pro` against a `gemini-2.5-flash` summarizer,
near-neighbour distractors). What was missing was the measurement, so that is what this unit adds.

## What changed

- `qa/probes/golden-set-condition3.mjs` (new) — reuses `loadCorpora()` and `diagnose()` rather than
  re-deriving either. Read-only, offline, pure functions over files already on disk, so the checker
  reproduces it exactly.
- `data/eval/golden-set-diagnostics.json` (new) — the report the gate requires.

## Condition 3 — measured on the OPERATIVE set

| diagnostic | operative 92-set | leaky baseline | prior 75-set |
|---|---|---|---|
| verbatim overlap (mean) | **0.161** | 1.000 | 0.071 |
| verbatim overlap (max) | 0.313 | — | — |
| near-verbatim (≥ 0.8) | **0** | — | — |
| unique-token pin — **blunt** | **17/92 = 18.5%** | 29/46 = 63% | 9.3% |
| unique-token pin — **corrected** | **0/92 = 0.0%** | — | not measured |

**Both pin criteria are reported, and the second is the one that means anything.** `diagnose()` uses
the *blunt* criterion — unique in the **scored** corpus, which is only ~3.1k words, so ordinary words
land in one session by chance. Its 17 "pinned" questions are pinned by `you`, `should`, `will`,
`people`, `paths`, `skills`, `living`, `story`, `parents` — **the same word list ISS-093 recorded**
when this criterion was used as a generation filter. A question pinned by the word `you` is not
pinned. So 18.5% is an **upper bound**, kept only because it is the one number comparable to the
gate's 63% baseline.

`buildPinTokens` is ISS-093's corrected criterion — unique across the **raw transcripts** (~218k
words) *and* present in the page text. Under it, **0 of 92** questions are pinned.

**That zero is real, not an empty denominator** — the check I owed after five vacuity findings today.
The corrected pin set holds **159 tokens**, and they are what a real pin looks like: `shagun`,
`handa`, `flywire`, `cept`, `leeds`, `italia`, `provident`. `flywire` — the gate's *own* worked
example of a trivially-pinning token — **is** in the set, and no question uses it.

## Condition 2 — measured on the same set

| | value |
|---|---|
| heuristic baseline recall@5 | **0.391** (36/92) |
| misses | **56** |
| question-blind control | **0.217** (20/92) |

Strictly inside the (0.217, 1.000) band with a non-zero miss count. **Not 1.000, so no Option B
escalation.**

## The number that moved the wrong way, stated rather than buried

**Mean verbatim overlap is 0.161 against the prior set's 0.071 — 2.3× higher.** The gate's wording is
"must stay ~0". Max overlap is 0.313 and **zero** questions reach the 0.8 near-verbatim threshold, so
this is nowhere near a copy-detection tautology — but 0.161 is not "~0" in the way 0.071 is, and I am
not going to describe it as such. Whether that clears the gate's bar is the checker's call, not mine.

## How to verify

- `node qa/probes/golden-set-condition3.mjs` → the table above; add `--write` to persist
- `node -e` over `buildPinTokens` → map size **159**, `flywire` → `2026-05-08-funding-dreams-loans-forex`
- `data/eval/recall-report.json` → hits 36 / total 92, control `recallAtK` 0.2174

## Not claimed

- **The gate is not closed by this unit.** Condition 4 remains blocked by the two defects the gate
  records — sibling-session ambiguity across the seven `uniaccess-*` sessions, and ISS-093 (status
  `fixed`, `verified_date: null`). This supplies conditions 2 and 3 on the operative set; closing is
  the checker's or the Approver's.
- **No recall number is re-derived here.** The three existing ones stand as measured; what changes is
  that the set under them now has diagnostics.

## Live browser evidence

`Not UI-touching — no surface changed.` Changed paths are `qa/probes/golden-set-condition3.mjs` and
`data/eval/golden-set-diagnostics.json`; `qa/**` is `genuinely_not_user_facing` in
`qa/ui-surfaces.json`, and `data/**` matches no pattern in it.

## Status: ready-for-check
