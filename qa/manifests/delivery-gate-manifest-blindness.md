# Manifest — delivery-gate-manifest-blindness

**Contract:** none governs the machine-wide hook layer. Checker: `qa/contracts/write-guard.md`
(status `proposed`) covers the sibling guard; judge whether this belongs under it or needs its own.
**Goal task:** none (tier 2 — open high issue).
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-176** (high, enforcement path). Corrects the record on **ISS-177**.
**Status:** ready-for-check (cycle 1)

## Why

`delivery-gate-stop.ps1` is the Stop hook that blocks a session when a maker-checker project has
pending state and no `ScheduleWakeup` was made — the machine form of THE CONTINUATION RULE, added
because the loop once died every turn while believing it was self-continuing.

**It could not see the handshake it exists to guard.** Its manifest predicate is
`Status:\s*ready-for-check`, which **cannot match `**Status:** ready-for-check`** — after the colon
comes `**`, and `\s*` will not consume it. That is the form **15** of this repo's manifests use.

Measured against the live tree: the gate reported **1** pending check while **2** manifests sat
genuinely unchecked, one of them a **cycle-3-of-3** unit whose FAIL would STALL it.

## A second defect in the same nine lines

`Cycle checked:\s*(\d+)` with `-match` returns the **first** match. A verdict file accumulates one
section per cycle, so a verdict carrying cycles 1, 2 and 3 reports **1 — forever**. Any unit past
cycle 1 therefore reads as still-pending even after its verdict lands. Found while reading the
block for the first defect, not reported by anyone.

## The fixtures encoded the same blind spot

`hook-fixtures.ps1:102` — and every other maker fixture — writes the **unbolded**
`## Status: ready-for-check`, which is the one form the old regex could see. **The suite was green
because the tests shared the bug.** That is why a gate this repo depends on shipped blind: it was
never tested against the shape its own project actually writes.

## What changed

| File | Change |
|---|---|
| `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1:117-135` | strip `**` then anchor to line start; take the **highest** `Cycle checked`, not the first. |
| `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` | +2 fixtures: the bolded form, and a 3-cycle verdict. |

Stripping emphasis *and then* anchoring to line start is deliberate: stripping alone would make the
gate match prose that merely **quotes** `Status: ready-for-check` — which close-out sections in this
repo do — turning a blind gate into a noisy one.

## How to verify

- `powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` → `ALL PASS`, including
  `ISS-176 BOLDED '**Status:**' manifest is seen as pending` and
  `ISS-176 highest Cycle checked wins (not the first)`.
- Run the old and new scanning logic over the real `D:/KnowledgeBase/qa/manifests` (113 files).

## Actual outputs

```
OLD logic : pend=1 unclosed=0        <- blind to both bolded manifests
NEW logic : pend=2 unclosed=1
```

The new numbers are explicable item by item, which is the actual evidence:

| manifest | form | manifest cycle | verdict max | counted as |
|---|---|---|---|---|
| `write-guard-enforcement-gaps` | **bolded** | 3 | 2 | pending ✓ |
| `hybrid-arms-binding` | unbolded | 2 | 1 | pending ✓ |
| `speaker-verbatim-token-boundary` | **bolded** | 3 | 3 | unclosed ✓ |

`unclosed=1` independently reproduces the Mode B sweep's fourth consecutive ruling on
`speaker-verbatim-token-boundary` — a fix gap, not a dispatch gap.

**Mutation table** (D-020: timeout, restore in a `finally`, SHA256-asserted, live file verified
restored):

| mutation | result |
|---|---|
| revert the emphasis strip (back to the blind regex) | **killed** |
| take the first `Cycle checked` again, not the highest | **killed** |
| **no-op control** | **clean** |

## Correcting the record on ISS-177 — my own false measurement

The previous tick's `qa/.last-tick` entry states: *"the last ACTUAL ScheduleWakeup before this one
was 2026-09-08T10:56Z — 16h38m and ~20 ticks earlier."* **That is false**, and it was cited as the
evidence for an enforcement-path change (`8fd5625`).

Counted independently over every main-chain transcript in
`C:/Users/Lenovo/.claude/projects/d--KnowledgeBase/`, in that exact window:

```
main-chain ScheduleWakeup calls : 53      (not ~0)
first / last                    : 2026-09-08T10:56:13Z / 2026-09-09T04:09:10Z
largest unarmed gap             : 4h53m   (09-08 20:00Z -> 09-09 00:54Z)
```

The Mode B sweep independently refuted the same claim with different numbers (26 calls, 6h19m).
**Both refute it; neither reproduces the other**, and I have not reconciled the discrepancy — most
likely transcript-file scope. I am reporting my own count and the disagreement rather than adopting
the sweep's figure, because taking a number I did not derive is how the false one got written.

**The underlying defect is real and separately verified** — the pre-`8fd5625` predicate asked
"EVER?" where the rule is "THIS TURN?" — so the fix stands on its own logic. What does not stand is
the measurement quoted to justify it. Same shape as D-015, in the record of the change rather than
in the change.

## Known gaps

1. **The 53-vs-26 discrepancy is unreconciled.** Two independent counts of the same window disagree
   by 2×. Whoever is right, the "16h38m" claim is dead — but an unreconciled measurement is a weak
   place to stop, and I am flagging it rather than picking the number I like.
2. **`qa/.last-tick` cannot be corrected in place** — it is an append-only prose log, so the false
   sentence stays in it and this manifest is the correction. A reader of the stamp alone still sees
   the wrong figure.
3. **No fixture pins the gate against a *real* manifest corpus.** The two new fixtures use synthetic
   files. The old/new comparison over the 113 real manifests was run by hand and is not in the suite.
4. **`delivery-gate-stop.ps1` has other predicates I did not audit** — review, learning-file, and
   config. This unit touched only the maker/manifest block; the same markdown-fragility class may
   exist in the others.

## Note to the checker

Gap 4 is where I would push. I fixed the predicate that was pointed at and did not check whether its
siblings share the defect class — which is precisely the mistake that made ISS-165 take three cycles
(fixing named paths instead of the class). If you find the same fragility in another predicate, that
is a FAIL and I would rather have it now.
