# Stall diagnosis — delivery-gate-manifest-blindness, cycle 3 of 3

**Dispatched by:** `/maker` on `STALLED` (Stall diagnosis, Phases 1–2 only, read-only toward code)
**Date:** 2026-09-09
**Verdict under diagnosis:** `qa/verdicts/delivery-gate-manifest-blindness.md` `Cycle checked: 3`
(commit `d171d0c`) — FAIL 5/9.

**Classification: LOOP-DESIGN failure.** Not execution, not environment. And it shares its root
cause with the sibling stall — see the comparison at the end.

---

## Failure Capture

- **Task:** make `delivery-gate-stop.ps1` see a `ready-for-check` manifest written in the bolded
  form, so the Stop hook that guards THE CONTINUATION RULE can detect a pending handshake.
- **Error:** no exception in any cycle. Every failure is a *successful, wrong answer* — the gate
  returns a decision, and the decision is wrong in the silencing direction.
- **Last successful step:** cycle 3's headline fix works. The live gate now reads `pend=1` and names
  this handshake; cycle 2's defect is dead, independently reproduced by the checker.
- **Repeated pattern — the reason this is a diagnosis and not a bug report:**

  | cycle | fix | how it was verified | what the verification missed |
  |---|---|---|---|
  | 1 | strip `**`, anchor to line start | fixtures the maker wrote | fixtures used only the **unbolded** form the old regex already saw |
  | 2 | field boundaries (`·`, `—`, `(`) | scored against an **unanchored** pattern | the referee shared the prose-match error, so the silencing case scored as *agreement* |
  | 3 | strip code spans, ASCII-only | a **safety property** vs an unanchored *bound* | the bound counts prose occurrences, so a stamp read out of prose scores `equal`, never `higher` |

- **Three consecutive vacuous fixtures**, each passing for the wrong reason:
  cycle 1 — the census forms were the ones already matched;
  cycle 2 — `-notmatch '1 check(s) pending'`, true whether the value read 6 **or** 0;
  cycle 3 — the census-forms check asserts only a pending count, so mutant **M5** (drop the `(`
  boundary) killed a real form and the whole suite still passed.
- **Environment verified, not assumed:** working tree clean for the artifact after every mutation
  run (SHA256-asserted); the hook registered in `~/.claude/settings.json` is the tracked file; the
  counterexample reproduces in the hook's own PowerShell runtime.

## Root-cause diagnosis

**Diagnosis-table row:** *"Tests still failing after a fix → wrong hypothesis."* But the hypothesis
that was wrong was never about the regex. It was about **what could be trusted to judge the regex.**

### One shape, three cycles

Every vacuous fixture asserts **the outcome the maker expected**, never **the distinction the fix
makes**. "The gate blocks" is true for any reason the gate blocks. A fix to a *discriminator*
changes *which inputs* produce that outcome — so a test for it must contain **both sides of the
discrimination**, differing only in the property under test. None of the three did.

That is why mutation caught two of them and the checker caught the third: a mutant is the only thing
that supplies the missing side. Where the maker did not think to write a mutant, the vacuity
survived.

### And the mutant set was author-chosen too

This is the recursion that makes it a loop-design failure rather than carelessness. Cycle 3 ran six
mutants — all of them properties the maker believed were load-bearing. **M5 was not among them**,
because the maker did not believe the `(` boundary was load-bearing. The checker's independent set
found it immediately.

So the chain of judges is: fix → fixtures the author wrote → mutants the author chose → a bound the
author picked. **Every link authored by the party whose work is on trial.**

### The specific cycle-3 error: a bound is not an escape from an oracle

Cycle 2 was failed for scoring against a self-chosen oracle. Cycle 3 replaced it with a *bound* —
"never return a cycle higher than a stamp present in the file" — and believed the change of
category bought independence. It did not: the bound is another regex over the same prose, and it
counts prose occurrences as stamps. **A prose `(Cycle checked: 9)` in a file whose only real stamp
is 1 makes the reader return 9 and the property report no violation.** The property was structurally
blind to precisely the defect that failed cycle 2.

Worse, cycle 3's own new code manufactures values the property cannot see: `Strip-Code` erases a
value held in an inline span, leaving a bare label, and `\s*` crosses the newline to adopt the next
line's leading digit. Reproduced in the hook's runtime — reader returns `3` with no such stamp in
the file (ISS-205).

**You cannot manufacture independence by choosing a different function of the same artifact.**

## Do the two stalls share a cause? Yes — same class, different organ

`qa/debug/write-guard-enforcement-gaps-cycle3.md` found a **self-contradictory contract**: C1 made
existence decisive while I2 forbade it, and the guard obeyed the wrong half. This stall found a
**self-chosen instrument**: the oracle, then the bound, then the fixtures, then the mutants.

Both reduce to one sentence:

> **The artifact that decides whether the fix is correct was authored by the author of the fix.**

D-015 already named this for the *corpus* — "a fix measured against a corpus its own author chose".
The write-guard stall found it in the *specification*. This stall found it in the *instrument*.
Three organs, one disease, and D-015's rule is written narrowly enough that neither of the last two
violated its letter.

## Not the cause — checked and cleared

- **Not execution/environment.** No crash, no timeout, no context exhaustion. Every mutation run
  restored SHA256-clean; the tree is clean.
- **Not fix quality.** The cycle-3 headline fix demonstrably works — the live gate names the
  handshake it was blind to, and ISS-193 is genuinely moot (232 files × 3 decoders, 0 decision
  changes).
- **Not the round cap.** D-014's class-based cap sends a **non-security** seam past two rounds to a
  HUMAN_GATE rather than round N+1, which is exactly what happened. The cap worked.
- **Not a dispatch or continuation defect.** Every cycle was dispatched and verdicted.

## Smallest recovery (named for the sweep to queue — `qa/QUEUE.md` is checker-owned)

1. **ISS-205, the only real code defect.** Require the digits on the same line (`[^\S\r\n]*` for
   `\s*`) and reject a label whose value was erased by stripping. Small; belongs to whatever unit
   next touches the block, **not** a cycle 4.
2. **The C4 decision** — `qa/gates/delivery-gate-c4-heading-form.md`. Three of the five failures
   collapse into it, and it is an Approver amendment.
3. **The durable one, and the reason this diagnosis exists:** *derive mutants from the diff, not
   from the design.* Every changed token in a fix is a mutation candidate; the author's belief about
   which lines are load-bearing is exactly the belief under test. Had cycle 3 mutated its own diff
   mechanically, M5 would have been in the set and the third vacuous fixture would have died before
   the checker saw it.

## Preventive change to encode later

Two, both narrow enough to be checkable:

- **A regression test for a discrimination must contain both sides of it** — one input that must
  fire and one that must not, differing only in the property under test. An assertion that names
  only the expected outcome is vacuous by construction.
- **A surviving mutant is a failed test, not a missing one.** Cycle 3 reported "6/6 killed" while M5
  was simply never written. The table should be derived from the diff so it cannot be curated.

Candidate home: alongside D-015 in the project CLAUDE.md, generalised from *corpus* to
**"the corpus, the specification, and the instrument"** — since the same defect has now appeared in
all three.

---

**Result:** blocked → escalate. The unit stays `STALLED`. ISS-205 goes to the next unit touching the
block; the C4 gate goes to the Approver. One dispatch per unit per stall; this is it.

---

# CORRECTION — 2026-09-09, after the Mode B sweep refuted half of this report

The Mode B sweep (`6aed4fb`, ISS-220) attacked the unifying claim above and **half of it does not
hold.** Verified here rather than accepted:

```
$ git log --format="%h %an %s" -- qa/contracts/write-guard.md
  d703897 umesh  checker: FAIL write-guard-enforcement-gaps (cycle 1) + a seventh silent-allow class
$ grep "Authored by" qa/contracts/write-guard.md
  ... Authored by the checker on 2026-09-09
```

**One commit, and it is a checker commit.** The contract that licensed the write-guard stall's
fifth survivor was written by the **independent** party. My phrase *"an author-chosen
specification"* is simply false, and the sibling report's use of it is false the same way.

## What that changes

The **INSTRUMENT limb stands.** Four self-chosen judges inside one unit — cycle-1 fixtures, the
cycle-2 oracle, the cycle-3 bound, and a mutant set missing M5 because I did not believe the `(`
boundary mattered — each caught by an independent party, each satisfying D-015's letter, which
speaks only of a *corpus*. That is a real gap in a real rule.

The **SPECIFICATION limb is refuted.** Independence was *present* at write-guard and did not help.
Its defect is different in kind: [C1] makes existence decisive while [I2] forbids it, and neither
covers the undecidable third state (`grep` for fail-closed language: **0** hits).

**So these are two rules, not one** — and the sweep's sharper point is that collapsing them aims
the remedy at the wrong target. "More independence" was already satisfied at the seam it would be
applied to; the real hole there is a contract that contradicts itself and is silent on a third
state. Filing them together would have left that unnamed.

I reached for the unifying story because it was more satisfying than two separate ones. That is the
same reflex as choosing a corpus that agrees with you — a *narrative* selected for fitting, and I
did it in the report diagnosing exactly that reflex.

The Approver decision is now `qa/gates/d015-generalisation-scope.md` (A / B / both / neither), which
is where it belongs rather than asserted in a debug report.

## A second error, mine, in the same tick

I dispatched that sweep calling the stamp "19h stale". `qa/.last-sweep` is a **9-line append log**;
I read the **first** line (`2026-09-08T13:05Z`) when the last is `2026-09-09T14:15Z` — about 50
minutes old. The sweep was not due, and I asserted an age from the wrong end of a file. The sweep
filed the log's shape as ISS-217; the misreading was mine.
