# Verdict — rank-probe-relocation

**Cycle checked: 2**
**Date:** 2026-09-09
**Checker:** Mode A, bound to `D:\KnowledgeBase`
**Contract:** none — judged against ISS-212 and ISS-213's recorded `fix_direction` (D-015), plus the cycle-1 FAIL (ISS-222).
**Commit under check:** `96647d6` (3 files: `docs/SNAPSHOT.md`, `qa/manifests/rank-probe-relocation.md`, `qa/probes/rank-probe.mjs`)

```
VERDICT: PASS
SCOREBOARD: 3/3 verify commands reproduce, 2/2 issue fix-directions satisfied, 1/1 cycle-1 failure cleared
FAILURES: none
LIVE-BROWSER: not-applicable (changed paths `docs/SNAPSHOT.md`, `qa/manifests/*`,
  `qa/probes/rank-probe.mjs`; `qa/**` is listed in `qa/ui-surfaces.json:12` under
  `genuinely_not_user_facing`, and `docs/SNAPSHOT.md` is a generated read-first digest with no
  rendered surface — verified against the file myself, not taken from the manifest)
ISSUES-WRITTEN: none
EXPLANATION: The cycle-1 FAIL is cleared on the only evidence that counts — `pnpm lint:structure`
re-run end to end with no filter, exit 0, with `snapshot --check` printing OK in the body of the
output where cycle 1's two grep windows had hidden it. The SNAPSHOT diff is exactly the one
`qa/probes/` line and nothing rode along. Both target issues still hold after the cycle-2 edits:
the probe reproduces `6 / INCONCLUSIVE / 2` live, is still read-only, and the dated evidence file
is still byte-identical below its header in git's canonical form. Both self-corrections the maker
volunteered check out against the history.
```

## What I re-ran

### 1. `pnpm lint:structure` — GREEN, on unfiltered output

The cycle-1 defect was method, not luck, so I ran the command once and read all of it:

```
lint-loc: OK (288 file(s) within budget)
lint-dirsize: OK (78 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (311 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1365 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (116 lines, budget 200)
… 12/12 lint.test.mjs pass · tracker-audit: OK (gate G1,G4) · depcruise: no violations
=== EXIT: 0 ===
```

The line that was red in cycle 1 is the sixth of nine steps — precisely the position a
`head`-shaped and a `tail -3`-shaped filter both miss. Exit code 0 is now derived from the whole
command, not from a window onto it.

**The snapshot diff is the single line and nothing else.** `git show 96647d6 -- docs/SNAPSHOT.md`
is one hunk, `+  - qa/probes/`, at line 47 of the directory tree. The full commit is three files:
SNAPSHOT (+1), the manifest (+46/-11 prose), the probe (+18/-11 comment). No source file, no
config, no test moved. **ISS-222 → `fixed`.**

### 2. The probe — RE-RUN live, unchanged behaviour

```
q="visa student university funding" hits=10 distinctSessions=6 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=2 scores=[1.0000,1.0000,0.7500,…]
q="2026 intake" hits=10 distinctSessions=1 -> INCONCLUSIVE for pairing: all hits share one session, so a mis-pairing is unobservable
q="counselling" hits=2 distinctSessions=2 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=1 scores=[1.0000,1.0000]
```

Identical to cycle 1's re-run — the ISS-223 edit is comment-only, as claimed, and did not perturb
the instrument. Still read-only: a grep for `insert|update|delete|replace|bulkWrite|findOneAnd|drop(`
over `qa/probes/rank-probe.mjs` returns one hit, the word "replacement" in the header prose. Reads
reach Mongo only through `store.search(...)` and `turns.findOne(...)`.

### 3. The byte-identical restoration — still holds

Compared in git's canonical form, not the worktree (`core.autocrlf=true` makes a worktree diff
lie here):

```
$ git show 2873df4^:qa/evidence/live-rank-probe-2026-09-08.mjs > /tmp/pre.mjs        # 29 lines
$ git show HEAD:qa/evidence/live-rank-probe-2026-09-08.mjs   > /tmp/head.mjs         # 46 lines
$ tail -n 29 /tmp/head.mjs > /tmp/headtail.mjs && cmp /tmp/pre.mjs /tmp/headtail.mjs
BYTE-IDENTICAL-BELOW-HEADER
```

17-line VOID header, 29 bytes-equal lines beneath it. Cycle 2 did not touch the file. **ISS-213
stays `fixed`; ISS-212 stays `fixed`.**

## ISS-223 — fixed inside the cycle despite being filed `file-don't-fix`. That was right.

**The second occurrence was real, and I had missed it.** My cycle-1 finding named the probe comment
only. The maker found the same sentence in the manifest's own ISS-212 section at `633161c`:

> *"Under an ISS-084-shaped mutation the probe reports **6 / 0 / 2** across its three queries — and
> that middle `0` is exactly the single-session query, not a clean bill of health."*

Unqualified present tense, subject "the probe", in a document describing this probe — the same
false assertion in the same defect class, in the artifact a checker reads first. Verified by
`git show 633161c:qa/manifests/rank-probe-relocation.md`. Both occurrences now name the predecessor
in the past tense.

**Did fixing it widen the unit past its FAIL? No.** The D-014 class-based cap forbids opening
**round N+1** on a capped seam; it does not forbid correcting a comment in a file already open
inside an in-flight fix cycle. The cost was one hunk, comment-only, with the live re-run above
proving no behaviour change — against the alternative of leaving a known-false durable
self-description on disk in the very chain that exists to close that class. Had the maker created a
new unit for it, that would have been the violation. It did not.

It also folded in my `distinctSessions >= 2` note verbatim as a NECESSARY, NOT SUFFICIENT block
naming the 5+5 vs 9+1 asymmetry and the within-session blind spot. That is my own recorded
limitation now living where the next reader of the instrument will actually meet it, which is the
whole argument this chain has been making.

## The concurrent-commit account — verified against the history, and it is accurate

The maker's claim is unusual enough to be worth checking rather than accepting. It holds exactly:

| commit | time | contents |
|---|---|---|
| `6ec03cb` *"qa/debug: correct the stall diagnosis"* | 14:15 | `qa/debug/delivery-gate-manifest-blindness-cycle3.md` (+48) **and** `qa/probes/rank-probe.mjs` (+78, file creation) **and** `qa/evidence/live-rank-probe-2026-09-08.mjs` (the restoration) |
| `633161c` *"rank-probe-relocation: restore the dated artifact, move the instrument"* | later | the manifest, and nothing else (`1 file changed, 77 insertions`) |

`git log --diff-filter=A -- qa/probes/rank-probe.mjs` returns `6ec03cb`. So the account is exact:
the maker's two code files were staged, a concurrent session ran `git commit` over the shared index
in the gap, and its commit carries them under a message about a debug report.

**Nothing was lost and nothing is unrecoverable** — both files are in history with correct content,
and the cycle-1 check (which re-derived from the working tree and from `git show`) reached the right
conclusions regardless. What is genuinely damaged is provenance: a reader auditing this unit by
`git log --oneline -- qa/probes/` lands on a commit message about a stall diagnosis, written by
another session's turn. That is the reference-repointing family D-019 names, arriving through the
index instead of through an id. The remedy the maker states — **stage and commit atomically, or do
not stage at all** — is the right one and is the rule two concurrent loops in one worktree need; it
sits alongside ISS-221 (open), which found the same class on the ledger's shared counter. I am not
filing it: the maker diagnosed it unprompted, wrote the rule, and `96647d6` obeys it.

## The withdrawn "deviation" claim — accepted, correctly

The maker withdraws its cycle-1 description of restore+header as a deviation from ISS-213's fix
direction, accepting that it is branch 2 verbatim. That matches my cycle-1 ruling and the ledger row.
Nothing further owed. The real deviation — `qa/probes/` over a dated 09-09 path — remains an
improvement on both recorded branches.

## Issue status changes

- **ISS-222 → `fixed`** — `lint:structure` green on unfiltered output, exit 0; snapshot diff is the one line.
- **ISS-223 → `fixed`** — both occurrences corrected, second occurrence independently confirmed real.
- **ISS-212, ISS-213** — remain `fixed`; re-verified live and by `cmp` this cycle.

## Ruling on stopping — the exit is CONFIRMED, and cycle 2 was not one round too many

My predecessor's recommendation stands and I am closing it out rather than extending it.

Cycle 2 was **owed, not optional**: cycle 1 left the repo's structural gate RED on master, and a
FAIL is not cleared by an argument. One command fixed it, one comment hunk rode along, and the
whole cycle is three files with zero behaviour change. That is a fix cycle behaving as designed, not
a round eight in disguise — the distinction being that no new unit was opened on the seam and no new
issue was manufactured to justify one.

The chain **ends here**. It has run seven-plus units on a QA instrument no product surface consumes;
the seam is non-security and long past D-014's two-PASS cap; and the remaining yield is doc accuracy
on a probe. ISS-223's own row already says *"Do NOT open a round-8 unit for it"*, and this cycle
closed it without one.

Next, per this repo's backlog priority:

1. The open enforcement `HUMAN_GATE` —
   `qa/gates/enforcement-hooks-unauthorized-and-live-regressed.md`. It needs the **Approver**, not
   the maker; surface it and wait, do not build around it.
2. **Tier 3 — the next unblocked roadmap task, T-021 (golden set).** Tiers 1–2 on this seam are
   clear. Pull a feature.

Anything that comes back pointing at `qa/probes/rank-probe.mjs` again is `file-don't-fix` unless it
is security class.
