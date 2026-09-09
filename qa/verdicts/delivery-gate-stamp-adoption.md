# Verdict — delivery-gate-stamp-adoption

**Cycle checked:** 1
**Date:** 2026-09-09
**Checker:** Mode A, fresh context, bound to `D:/KnowledgeBase`.
**Commit under check:** `91b051c` (KnowledgeBase) / `e5402d6` (`D:/ai_os`, the artifact).
**Contract:** `qa/contracts/delivery-gate.md` (status `proposed`).

```
VERDICT: FAIL
SCOREBOARD: 5/9 criteria met, 2/3 invariants hold
FAILURES:
- [C2][C3][I2] sev: high · ISS-205's own recorded reproduction (a) still silences the gate at HEAD: a
  span-erased value whose SAME line later carries a digit reads that digit — the fix moved the
  boundary to the line, not to the stamp · apply the second half of ISS-205's own fix_direction
  (reject a label whose value the stripper erased — match before stripping, or leave a sentinel) ·
  issue: ISS-227
- [C7] sev: high · the Fix cycle predicate five lines above the changed line carries the identical
  newline-crossing defect and was neither fixed nor audited; it silences the gate in the same
  direction · apply the same whitespace-except-newline class there too, and state the audit for
  every stamp predicate and both sibling hooks · issue: ISS-228
- [D-015] sev: high · the unit measured itself against a four-row probe table it authored, not
  against ISS-205's three recorded reproductions; measured against the ledger the result is 2/3,
  and the miss is the reproduction the issue's fix_direction names · report by issue id against the
  ledger corpus · issue: ISS-229
- [C5] sev: medium · fixture side 2 is not the second side of a discrimination — it passes
  byte-identically before and after the fix (my mutant M1 kills side 1 only) · make side 2 assert
  something the pre-fix hook fails, or describe it as the regression guard it is · issue: ISS-230
- [C6] sev: medium · no old-vs-new re-derivation itemised per manifest was submitted; aggregate
  safety-property counts are not that evidence · issue: ISS-231 (I supplied the re-derivation; see
  below — the change is inert on today's corpus)
LIVE-BROWSER: not-applicable (D:/ai_os/.claude/hooks/delivery-gate-stop.ps1,
  D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1 — two PowerShell hook files; no match against
  D-024's surface list, which additionally names packages/ask/**, packages/index/src/{vector,tree,
  search}/**, apps/web/**; verified against DECISIONS D-024 Result + Changes-authorized, not against
  the manifest's paraphrase)
ISSUES-WRITTEN: ISS-227, ISS-228, ISS-229, ISS-230, ISS-231
EXPLANATION: The fix is real and I reproduced it independently in the hook's own runtime — three
constructed corpora that the pre-fix hook read as fully checked (span value + digit next line, value
in a fenced block, and the same under CRLF) all go PENDING at HEAD, and the whole fixture suite is
green with the five prior properties still pinned. It is not sufficient. ISS-205's own ledger row
records three reproductions and names two remedies; this unit implemented one and closed neither the
reproduction that survives nor the predicate five lines above it that shares the bug. The unit is
also the first built under the stall diagnosis's preventives, and only one of the two held: the
diff-derived mutant is genuine, but the "both sides" fixture pair has one vacuous side.
```

---

## 1. What I re-ran (nothing below is the maker's evidence)

Harness: `scratchpad/chk/probe-chk.ps1` + `mutrun.sh`. Every case builds a throwaway project tree
(`qa/manifests/a.md`, `qa/verdicts/a.md`, `qa/QUEUE.md` with one TODO row so the block always emits)
and drives the **real hook** end to end, parsing `pend`/`unclosed` out of the block reason. The
pre-fix comparator is the shipped file with the one token reverted (`old.ps1`), asserted to be a
single-occurrence replacement.

**D-020 posture, stronger than the rule requires: no mutation ever touched a tracked file.** Mutants
were applied to an isolated `cp -r` of `D:/ai_os/.claude/hooks`, whose own copy of the fixture suite
runs green unmutated (the suite is `$PSScriptRoot`-relative, so it exercises the copy). Restore from
a pristine byte backup runs in a `trap ... EXIT INT TERM ERR` and is verified with `cmp`; every suite
run is wrapped in `timeout 900`.

### 1a. The defect and the fix — reproduced

| case | pre-fix | at HEAD |
|---|---|---|
| span value, digit on next line (the ISS-205 shape) | pend=0 unclosed=0 — **silent** | pend=1 — pending |
| value in a **fenced block**, digit next line | pend=0 unclosed=0 — **silent** | pend=1 |
| the same with **CRLF** line endings | pend=0 unclosed=0 — **silent** | pend=1 |
| baseline stamp on its own line (LF and CRLF) | pend=0 unclosed=1 | pend=0 unclosed=1 |
| TAB between label and digit | reads it | reads it |
| stamp split across a table row | pend=1 | pend=1 |
| NBSP between label and digit | pend=1 (noisy; a BOM-less decode, not the regex) | pend=1 |

The fix does what it claims for the newline class, including under CRLF and inside fences, and does
not regress the forms the corpus actually uses.

### 1b. Survivor hunt — three survivors, all in the silencing direction

Manifest at `Fix cycle: 3`, verdict genuinely at cycle 1. Same file, one token apart:

| verdict body | at HEAD |
|---|---|
| stamp value in a span, then `9/9 criteria met` **on the same line** | **pend=0 — SILENT** (reads 9) |
| the same line without the stray digit (control) | pend=1 |
| genuine `Cycle checked: 1`, plus prose `The predecessor unit (Cycle checked: 9) is unrelated.` | **pend=0 — SILENT** |
| genuine `Cycle checked: 1`, plus a list row `- see (Cycle checked: 4) elsewhere` | **pend=0 — SILENT** |
| genuine `Cycle checked: 1` alone (control) | pend=1 |

The first is ISS-205 reproduction **(a)** — see §2. The last two come from the leading paren
alternative in the pattern, which **no fixture pins**: my mutant M2 deletes it and the whole suite
still passes. The hook's own comment says the paren heading form is deliberately unreachable; the
alternative that remains therefore buys nothing and costs a prose-adoption path.

### 1c. Mutation — including tokens the maker did not change

| mutant | result |
|---|---|
| M0 no-op control (comment only) | **survived (clean)** |
| M1 **DIFF**: revert the whitespace class to `\s*` | **killed** — by fixture side 1, and by side 1 alone |
| M2 untouched: delete the leading paren alternative | **SURVIVED** — unpinned, and it is a survivor's mechanism |
| M3 untouched: drop the list-marker class before the label | **SURVIVED** — unpinned |
| M4 untouched: make the colon mandatory | **SURVIVED** — unpinned |
| M5 untouched: highest-cycle `-gt` → `-lt` | killed (5 checks) |
| M6 untouched: pending boundary `-lt` → `-le` | killed (5 checks) |
| M8 untouched: tighten the `Fix cycle` predicate the same way | **SURVIVED** — and that is the §3 bug |

(M7, dropping `Singleline` from the inline-span strip, is an equivalent mutant — the negated
character class matches newlines regardless of the flag — so it is excluded rather than counted as a
survivor.)

The maker's claim that the mutant is diff-derived **holds**, and M1's kill is real. What the table
adds is that the fixtures are **over-fitted to the one line touched**: four tokens in the same two
regexes can be changed with the suite still green.

## 2. Measured against the ledger, not against a probe table (D-015)

`qa/issues.jsonl` ISS-205 records three reproductions. Re-run verbatim in the hook's runtime:

| ISS-205 reproduction | pre-fix | at HEAD |
|---|---|---|
| (a) span-erased value, digit later on the same line → reads 9 | silent | **silent — STILL OPEN** |
| (b) bare label, blank line, `9 issues were written.` | silent | pending — fixed |
| (c) span value + next line `3 criteria met.` | silent | pending — fixed |

**ISS-205: 2/3.** The manifest reports four probe rows it authored this cycle, all passing, and does
not name (a) as deliberately left open. ISS-205's `fix_direction` has two clauses; the unit
implemented the first and silently dropped the second — *"Reject a label whose value was erased by
code-span stripping (match before stripping, or leave a sentinel)"* — which is precisely the clause
that closes (a). This is the exact habit D-015 exists to stop: a fix measured against a corpus its
own author chose that cycle.

## 3. C7 — the audit that was not done, and what it would have found

C7 requires a defect found in one predicate to be audited across every predicate sharing the pattern,
with the result stated. The manifest states nothing. Five lines above the changed line, in the same
block, in the same file, the `Fix cycle` predicate still ends in `\s*(\d+)` — same stripper upstream,
same newline crossing. Measured, on two manifests identical except for one pair of backticks, each
with a genuine cycle-1 verdict:

| manifest | at HEAD |
|---|---|
| `Fix cycle` value inside a code span, next line begins `1 file changed` | **pend=0, reported only as "1 PASS not closed out" — SILENT on a cycle-3 unit** |
| the same manifest with the value on its own line (control) | pend=1 — pending |

Silencing is I2's expensive failure, and here the gate reports the unit as merely awaiting close-out
while a cycle-3 check sits unanswered.

**The siblings, audited (the answer the manifest owed):** `mc-sessionstart.ps1:17,19` and
`mc-precommit.ps1:43` use `Select-String`, which is line-oriented, so no pattern there can cross a
newline — **checked, not affected.** That is a one-line answer the maker could have written; C7's
complaint is the silence, not the outcome.

## 4. C6 — the re-derivation, supplied

Old vs new over the live `qa/manifests` + `qa/verdicts` corpus, itemised: three manifests are at
`ready-for-check` today — one with no verdict, two `quiet` — and **the two readers agree on all
three**. The counting change is inert on today's corpus. That is a satisfactory answer; it is not one
the manifest gave, and C6 asks for the itemisation, not an aggregate.

## 5. The safety-property framing (Known Gap 2) — still overclaiming

Gap 2 concedes "corroboration, not proof" and then reasserts: *"It cannot manufacture a stamp, so it
remains a usable upper bound."* **That sentence is false, and its own issue says so.** ISS-205's title
is "the cycle-3 safety property is **false**: Strip-Code + `\s*` can **MANUFACTURE** a cycle stamp
that appears nowhere in the file." §1b's first row manufactures one at HEAD: the reader returns 9 and
the string `Cycle checked: 9` occurs nowhere in that file. The honest statement is that the bound is
**refuted**, not merely unsound, and that `higher=0` over 118 verdicts is a statement about today's
corpus and nothing more. Downgrading a refuted claim to "corroboration" while restating the refuted
sentence is a smaller retreat than the evidence requires.

## 6. Known Gaps 3 and 4

- **Gap 3 (fenced branch unfixtured) — confirmed, still true.** My fenced-block case exercises it; the
  maker's fixtures do not. Carried, not charged beyond ISS-230.
- **Gap 4 (six verdicts read lower) — accepted.** Noisy direction, none live; my §4 re-derivation
  agrees that nothing live changes.

## 7. The ruling the maker asked for (Known Gap 1)

**A unit MAY touch an unauthorized enforcement path to fix a defect in it. I am not FAILing on this.**

On the merits:

1. **The alternative is not neutrality, it is choosing the defect.** `4a71633` is already live and
   already uncovered; leaving a manufacture-a-stamp bug in a hook that runs on every session on this
   machine does not reduce the governance exposure by one line, it adds a correctness exposure on top
   of it. There is no "leave it alone" state — the file executes from the working tree.
2. **Reverting is not the safer option here either.** Reverting to a reviewed commit is the clean
   remedy when one exists; the gate file itself records that the whole file has been running
   uncommitted all day, so there is no reviewed state to revert *to*. That is the Approver's question,
   not a unit's.
3. **The scope test is what keeps this from becoming a licence.** This change is one token plus
   comments, wholly inside the defect, and it is committed — so the Approver rules on a diff rather
   than on a moving working tree. A unit that *extended* an unauthorized enforcement path, changed
   what it blocks, or widened its blast radius would get the opposite answer, and I would FAIL it.
4. **Referencing the existing gate was correct.** ISS-214 filed duplicate gates for one file; a tenth
   gate would restate a question already asked in
   `qa/gates/enforcement-hooks-unauthorized-and-live-regressed.md`, whose §2 restatement was written
   to be durable against exactly this — a file that keeps moving while the gate waits.

One condition, and it is the reason that gate exists: **its durable question now covers a second
commit and does not say so.** "Commit or revert what is live, and retro-authorize or revert
`4a71633`" should read on `4a71633` **and `e5402d6`**, or the Approver will ratify one commit and
believe the file is covered. Recorded in ISS-228's remediation note rather than as a new gate.

## 8. What a PASS needs

1. Close ISS-205 (a) — the stripper-erased-label clause of its own `fix_direction`.
2. Fix the `Fix cycle` predicate in the same block, and state the C7 audit across all stamp
   predicates (the sibling answer is in §3; it still has to be written down by the unit that owns it).
3. Re-measure against `qa/issues.jsonl`'s recorded reproductions and report `ISS-205: N/3` by id.
4. Either make fixture side 2 discriminate, or stop describing it as the second side.
5. Extend the existing gate's durable question to name `e5402d6`.
