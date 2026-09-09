# Stall diagnosis — write-guard-enforcement-gaps, cycle 3 of 3

**Dispatched by:** `/maker` on `STALLED` (Stall diagnosis, Phases 1–2 only, read-only toward code)
**Date:** 2026-09-09
**Verdict under diagnosis:** `qa/verdicts/write-guard-enforcement-gaps.md` `Cycle checked: 3`
(commit `5231a42`) — FAIL 4/7, ISS-180 high/security-class.

**Classification: LOOP-DESIGN failure.** Not execution, not environment, not a bad fix.

---

## Failure Capture

- **Session / task:** harden `aios-write-guard.ps1` so enforcement paths and the `docs/DECISIONS.md`
  append-only wall cannot be reached silently.
- **Goal in progress at failure:** closing ISS-172 (non-canonical path spellings bypassed the deny
  wall) and ISS-173.
- **Error:** no exception. The guard returns **silent** — a successful, wrong answer.
- **Last successful step:** cycle 3's canonicalisation. Re-probed at diagnosis time and it holds:
  `docs/DECISIONS.md` → `deny`, `docs/sub/../DECISIONS.md` → `deny`.
- **Last failing input:** `\\?\D:\KnowledgeBase\docs\DECISIONS.md` → **silent**.
- **Repeated pattern:** three cycles, three fixes, three new survivors — each in a *different organ*
  of the same nine-line block, each found by someone other than the author:

  | cycle | matched on | survivor found | organ |
  |---|---|---|---|
  | 1 | **position** relative to the Lab root | nested `.claude/` below the root | the root-relative `Substring` |
  | 2 | **shape** (regex over the path) | `..`, `.`, trailing separator | the raw string |
  | 3 | **identity** (`GetFullPath`) | `\\?\` extended-length prefix | **the existence probe** |

- **Environment verified, not assumed:** working tree clean for the artifact; the guard registered
  in `~/.claude/settings.json` is the tracked file; mutation ledger `MUTATIONS CLEAN`; the cycle-3
  fixtures, flagged uncommitted as ISS-182, are committed at `4a71633`.

## Root-cause diagnosis

**Diagnosis-table row:** *"Tests still failing after a fix → wrong hypothesis."* The hypothesis was
that the defect was in **matching**. It was not. The last three cycles all hardened the matcher; the
`\\?\` hole is in the line the matcher hands off to.

### The contract contradicts itself, and the bug lives in the contradiction

`qa/contracts/write-guard.md`:

- **[C1]** *"`<lab-root>/docs/DECISIONS.md` is `deny` **when the file exists**, and **silent when
  absent**"*
- **[I2]** *"**Path-shape, not path-existence, decides.** The decision for a path must not change
  because its parent directory does not exist yet — a guard that only protects files that already
  exist does not protect creation, which is when enforcement paths are most dangerous."*

**C1 makes existence decide. I2 forbids existence from deciding.** The implementation is a faithful
reading of C1: `Test-Path -LiteralPath` returns `False` for a `\\?\` path under PowerShell 5.1, so
the guard concluded *absent* and took C1's own blessed allow branch — the comment on that line is
literally `# initial creation (file absent) -- allowed for /init-lab`.

So the guard **did not violate its contract. It obeyed the wrong half of it.**

That is why three correct, well-pinned fixes did not converge: every cycle worked on the half I2
governs, and no cycle could touch the half C1 licenses, because C1 explicitly authorises it. A
verify surface derived from that contract cannot fail on this input by construction.

### The compounding gap

`grep -cniE "fail.closed|indetermin|unknown|cannot determine"` over the contract → **0**. The
contract says what to do when the file exists and when it is absent, and **nothing** about when
existence is *undecidable* — which is exactly the `\\?\` case. An unstated third state resolved to
the permissive branch, because that is the branch that was written.

### Why the cycles could not have caught it

Each cycle's evidence was a probe table over paths *someone chose*. The checker's cycle-3 suite was
materially better — 26 checks derived from the contract, 7/7 mutants killed — and it still could not
find this, **because it was derived from the contract, and the contract blesses the branch.** The
defect was found by a probe that asked a different question: *does a `Write` to this spelling
actually land on the file?* It does.

This is the D-015 shape one level up: not a fix measured against an author-chosen corpus, but a fix
measured against an **author-chosen specification**.

## Not the cause — checked and cleared

- **Not execution/environment.** No timeout, no crash, no tool failure, no context exhaustion; the
  working tree and the mutation ledger are clean and the registered file is the tracked one.
- **Not fix quality.** The checker independently credited cycle 3 at 7/7 mutants killed, including
  the trim the maker had disclosed as a first-table survivor.
- **Not the round cap.** D-014's class-based cap is what *allowed* round 5 to be reachable at all; a
  count-based cap would have closed this seam earlier, the same arithmetic that would have shipped
  ISS-078.
- **Not a dispatch or continuation defect.** Cycle 3 was re-dispatched cleanly after the process
  death and wrote its verdict.

## Smallest recovery (for the sweep to queue — `qa/QUEUE.md` is checker-owned, so this file does not write it)

**One contract amendment, then one small code change that follows from it.**

1. **Amend C1 to stop making existence decisive**, so it stops contradicting I2. Two shapes, either
   acceptable: drop the existence predicate entirely (deny on the DECISIONS shape, and let
   `/init-lab` creation be the documented exception it already needs), or keep it but add the
   missing third state — *when existence is indeterminate on a DECISIONS-shaped path, deny*.
   **This is a security criterion, so it is a CRITICAL amendment: checker-authored, Approver-ratified.**
   The contract is still `proposed` and unratified, which makes this the moment to fix it rather
   than ratify a self-contradiction.
2. **Then** ISS-180's code fix is a two-liner and falls out of the corrected criterion — strip a
   `\\?\` prefix before the existence probe, or invert the branch to fail closed.

Sequencing matters: doing (2) first would fix the fifth survivor and leave the contract that
produced all five untouched — which is precisely the loop that stalled.

## Preventive change to encode later

**When a criterion carries an escape clause (`… and silent when <condition>`), the contract must
also state what happens when `<condition>` is undecidable.** Every one of this seam's five survivors
reached a permissive branch, and the last one reached it through a condition the contract assumed
was always answerable. A guard's specification needs three states, not two.

Candidate home: the same place D-015 lives — the project CLAUDE.md's measurement rules — as a
companion to *"a fix measured against a corpus its own author chose."*

---

**Result:** blocked → escalate. The unit stays `STALLED`; ISS-180 opens a new unit **after** the C1
amendment, not before. One dispatch per unit per stall; this is it.
