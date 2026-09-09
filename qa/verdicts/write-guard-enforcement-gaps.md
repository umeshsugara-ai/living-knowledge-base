# Verdict — write-guard-enforcement-gaps

**Cycle checked:** 1
**Date:** 2026-09-09
**Commit under check:** a5101bb
**Contract:** none existed. Authored this cycle: `qa/contracts/write-guard.md` (status: proposed,
awaiting Approver ratification per the checker's criticality gate on initial contract creation).
Criteria below are numbered against it.
**Bound root:** D:/KnowledgeBase

## VERDICT: FAIL

**SCOREBOARD:** 4/7 criteria met, 3/4 invariants hold

## What I re-ran

All probes executed by me, read-only, against `D:/ai_os/.claude/hooks/aios-write-guard.ps1` as it
stands at repo commit a5101bb, compared against the three replaced scripts still on disk
(`decisions-append-guard.ps1`, `config-protection.ps1`, `edit-in-place-guard.ps1`), merged
most-restrictive-first.

### 1. The manifest's probe table — 13/13 rows reproduce exactly

```
PATH                                             OLD      NEW
D:\KnowledgeBase\.claude\CLAUDE.md               silent   ask
D:\KnowledgeBase\CLAUDE.md                       silent   ask
D:\KnowledgeBase\.claude\rules\x.md              ask      ask
D:\KnowledgeBase\.claude\settings.local.json     silent   ask
D:\KnowledgeBase\docs\DECISIONS.md               deny     deny
D:\KnowledgeBase\.claude\settings.json           ask      ask
D:\KnowledgeBase\.claude\hooks\mc-precommit.ps1  ask      ask
D:\KnowledgeBase\scripts\append_decision.ps1     ask      ask
D:\ai_os\CLAUDE.md                               ask      ask
C:\Users\Lenovo\.claude\settings.json            ask      ask
D:\KnowledgeBase\apps\api\src\search-store.ts    ask      silent
D:\KnowledgeBase\qa\manifests\x.md               silent   silent
D:\KnowledgeBase\README.md                       silent   silent
```

Not one row is overstated. **[C1] met, [C3] met, [C4] met** — DECISIONS still denies, every named
enforcement path outside a Lab root still asks, ordinary source/manifests/README still silent, and
the 84-files-stopped-prompting win is intact (`search-store.ts` went ask -> silent and stayed there).

### 2. Adjudicating the central claim — the maker is right on both counts

**(a) `CLAUDE.md` / `.claude/CLAUDE.md` / `.claude/settings.local.json` inside a Lab root was a
PRE-EXISTING gap. The sweep's stated cause was wrong; the maker's reading of the source is right.**

Confirmed in source: `config-protection.ps1:33-40` computes `$isEnforcement` (which *does* match
`CLAUDE.md` and `.claude\rules\` unconditionally, as the sweep said) and then walks up for
`docs\DECISIONS.md` and `exit 0`s the moment a Lab root owns the path — deferring to
`decisions-append-guard.ps1`, whose `$isEnforcement` list at `:92-94` is exactly three entries and
names neither. Confirmed by probe: OLD = **silent** on all three. The sweep's phrase "matched both
unconditionally" describes only the first half of `config-protection.ps1` and misses its `exit 0`.
The prior senior-software-engineer review was right; ISS-160's `fix_direction` narrative was half wrong.

Third, independent confirmation: `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1:149-151` builds a
temp Lab root and **asserts** `Lab root owns it -> silent (no double prompt)` for
`<lab>/.claude/CLAUDE.md`. The old behaviour was not merely pre-existing — it was pinned as intended.

**(b) `.claude/rules/` was a genuine regression the maker introduced, and its stated cause is exact.**

`config-protection.ps1:33` gates the walk on `while ($dir -and (Test-Path $dir))`; `Get-ProtocolRoot`
in the merged guard does not. `D:\KnowledgeBase\.claude\rules\` **does not exist** on disk, so the old
walk's body never executed, no Lab root was found, and it asked. The new walk finds the root and
skips CHECK 2. Reproduced: OLD = ask, NEW (pre-fix) = silent. The Open Question the earlier review
marked *"low real-world likelihood, not run/tested"* reproduces on the first probe, as the maker says.

**ISS-160 -> fixed.** Measured against the ledger row's own recorded reproductions per D-015:
`.claude/CLAUDE.md`, `CLAUDE.md`, `.claude/rules/foo.md` -> **3/3 ask**, plus
`.claude/settings.local.json` -> ask. No recorded reproduction left open.

### 3. The hunt — the fix is NOT sufficient, and the manifest's justification is disproved

The manifest's load-bearing sentence:

> "inside a Lab root, CHECK 1 now covers every class CHECK 2 covers, so the existence-gated-walk
> difference can no longer produce a silent allow on an enforcement path."

It covers them **only at the Lab root**. CHECK 1 matches on `$rel`, computed by stripping the root
prefix, and then tests root-relative *equality* (`.claude\settings.json`) or root-relative *prefix*
(`.claude\hooks\`, `.claude\rules\`). Any `.claude/` directory **below** the root falls out of CHECK 1
entirely, and CHECK 2 is then skipped unconditionally by
`if ($isConfig -and [string]::IsNullOrWhiteSpace($protocolRoot))`.

Six reproductions, same repo, same defect class, OLD asks and NEW is silent:

```
D:\KnowledgeBase\apps\api\.claude\settings.json                  ask -> silent
D:\KnowledgeBase\apps\api\.claude\hooks\evil.ps1                 ask -> silent
D:\KnowledgeBase\apps\api\.claude\rules\evil.md                  ask -> silent
D:\KnowledgeBase\apps\api\.claude\CLAUDE.md                      ask -> silent
D:\KnowledgeBase\.claude\worktrees\lane-a\.claude\settings.json  ask -> silent
D:\KnowledgeBase\.claude\worktrees\lane-a\CLAUDE.md              ask -> silent
```

Control run, a temp Lab root with every parent directory **pre-created**: nested
`sub/.claude/{settings.json,hooks/x.ps1,rules/r.md,CLAUDE.md}` are silent under **both** stacks. So
the six deltas above are driven by exactly the same existence-gated-walk difference the maker
admitted for `.claude/rules/` and declared unreachable. It is not unreachable; it was made
unreachable for four paths and left live for an unbounded set. This repo runs concurrent lanes in
worktrees (D-019), and `\.claude\worktrees\` is named in this very file's CHECK 3 allowlist — this is
not a hypothetical shape.

**[C5] not met** (ISS-165, high). **[I2] not met** — the decision still flips on whether the parent
directory happens to exist.

This is the third time this seam's defect has been found by someone other than the author, and the
third time on a path the author did not think to probe. That is a *measurement habit*, not bad luck —
the same finding D-015 was written for.

### 4. Known Gap 1 — its stated reason is false, and the deferral is refused

Gap 1: *"I did not add one in this cycle because the guard lives outside any repo with a test runner."*

`D:/ai_os` is a git repo (HEAD `837bf00`). `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` is an
18.5 KB runnable regression harness dated 2026-09-08 — exit code = failed checks, with a `RunHook`
helper that pipes precisely the JSON this unit probed by hand, and a Lab-root fixture already built.
The instrument was in the same directory as the artifact, unused, while the unit hand-ran a table.

Worse, that harness still asserts the **pre-fix** behaviour (`:149-151`), so it now encodes a
statement this unit's own evidence contradicts. A third unit on this seam with no test, next to a
harness that contradicts it, is not an acceptable deferral. **[C6] not met** (ISS-167, high).

### 5. Findings the unit did not declare

**[C7] not met** — `aios-write-guard.ps1` is **untracked** in `D:/ai_os`
(`git status --short .claude/hooks/` -> `?? .claude/hooks/aios-write-guard.ps1`, plus an uncommitted
` M edit-in-place-guard.ps1`). The sole enforcer of this repo's append-only DECISIONS wall is a file
one `git clean -fd` from vanishing, with no error and no prompt — precisely the untracked-artifact
failure the verdict-commit rule exists to kill. ISS-166, high.

### 6. Ruling on Gap 3 (the one the maker asked me to push on)

**A superseding DECISIONS entry is NOT required before this unit can PASS — but leaving it as a
manifest bullet is not acceptable either.**

D-023's Result (*"Protection is unchanged and was verified by parity test"*) is measurably false: it
changed on ISS-160's four paths and on ISS-165's six. The maker is right that appending a superseding
entry to an append-only, Approver-governed record is the Approver's act, not the maker's, and this
checker will not require a maker to take a decision reserved to Umesh. What the checker *does*
require is that the question outlive the manifest: raise it as `qa/gates/d023-supersede.md` with the
`Answered:` line written when Umesh rules. Filed as ISS-168 (medium). This is not among the reasons
for the FAIL.

## FAILURES

- **[C5]** sev: **high** · `aios-write-guard.ps1` is still silent on enforcement-shaped paths in nested
  `.claude/` directories inside a Lab root (6 reproductions, OLD=ask -> NEW=silent), so the manifest's
  claim that widening CHECK 1 made the existence-gated-walk difference unreachable is disproved ·
  match CHECK 1 on path *shape* (any `\.claude\{settings*.json,hooks\,rules\,CLAUDE.md}` tail, or a
  trailing `CLAUDE.md`) instead of root-relative equality, or drop `$protocolRoot` from CHECK 2's
  condition · issue: ISS-165
- **[C6]** sev: **high** · Gap 1's deferral rests on a false premise —
  `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` is a runnable harness in the artifact's own
  directory that already fixtures this seam, and still asserts the pre-fix behaviour at `:149-151` ·
  add an `== aios-write-guard.ps1 ==` block covering C1–C5 with both existence states of the parent
  dir, and correct the stale assertion · issue: ISS-167
- **[C7]** sev: **high** · the live guard is untracked in `D:/ai_os` git while registered in
  `~/.claude/settings.json:162` · commit it (and the modified `edit-in-place-guard.ps1`) · issue: ISS-166
- **[I2]** sev: **high** · a path's decision still depends on whether its parent directory exists ·
  same fix as C5 · issue: ISS-165

## ISSUES-WRITTEN

ISS-165, ISS-166, ISS-167, ISS-168. ISS-160 -> `fixed` (3/3 recorded reproductions now `ask`).

## EXPLANATION

The unit's own probe table is honest — all 13 rows reproduce at a5101bb, ISS-160's four paths are
genuinely fixed, and nothing regressed: DECISIONS still denies, every enforcement path still asks,
and ordinary source stayed silent, so the merge's approval-fatigue win survives the re-tightening.
The maker also wins the adjudication it asked for: `CLAUDE.md` inside a Lab root was a pre-existing
gap (proved in `config-protection.ps1:33-40`, by probe, and by a fixture that pinned the old silence
as intended), and `.claude/rules/` was a real regression whose cause it diagnosed exactly. It FAILs on
the third question it correctly identified as the highest-value one and then answered wrongly: I
hunted, and the silent allow is still there for every nested `.claude/` directory — six reproductions
including worktree paths this repo actually uses — so widening CHECK 1 to four root-anchored names
treated the instances, not the class. That, plus a test harness that was available and unused (and
now encodes the wrong assertion) and a guard that is untracked in git, is three units and three
externally-found defects on one seam. Gap 3 is not a PASS blocker, but it goes to a gate file.


---
---

# Verdict — write-guard-enforcement-gaps · **Cycle checked: 2**

**Date:** 2026-09-09
**Cycle checked:** 2
**Mode:** A (unit check)
**Bound root:** `D:/KnowledgeBase`
**Contract:** `qa/contracts/write-guard.md` (status `proposed`, authored by the cycle-1 checker)
**Commit under check:** `d469340` (KnowledgeBase) · artifact commits `371d3b3`, `ac9e2e7` (`D:/ai_os`)

```
VERDICT: FAIL
SCOREBOARD: 4/7 criteria met, 4/4 invariants hold
FAILURES:
- [C1] sev: high · the docs/DECISIONS.md deny wall returns `silent` for any non-canonical spelling
  of the same file (`docs/sub/../DECISIONS.md`, `docs/./DECISIONS.md`), both of which resolve to the
  protected file · canonicalise the path with [System.IO.Path]::GetFullPath before matching, instead
  of matching the raw string · issue: ISS-172
- [C2] sev: medium · `.claude/hooks/` is matched as `*.ps1` direct children only, so a hook in any
  other language or in a subdirectory is silent; the criterion says `.claude/hooks/*` · widen line 102
  the way the `.claude/rules` rule on line 105 already is · issue: ISS-173
- [C3] sev: medium · not met by the artifact (out-of-Lab config paths are now intentionally silent);
  this is an Approver-level change that needs a criticality-gated amendment, not a silent divergence,
  and the checker may not soften the criterion to grant a pass · issue: ISS-174
ISSUES-WRITTEN: ISS-172, ISS-173, ISS-174, ISS-175 (ISS-165, ISS-166, ISS-167 moved open -> fixed)
EXPLANATION: The three highs from cycle 1 are genuinely closed and I verified each independently —
the shape-matched block closes all six ISS-165 reproductions, the guard is tracked and is the exact
file `~/.claude/settings.json` registers, and the harness is real and non-vacuous under my own
mutation run (8/8 killed, control clean). The unit still fails because the survivor hunt the dispatch
asked for found a fourth member of the very defect class this cycle was meant to close, and this one
lands on the `deny`: the guard matches a path's spelling rather than its identity, so two ordinary
alternative spellings of `docs/DECISIONS.md` pass straight through the append-only wall. The maker's
own Gap 1 is answered the other way — I drove the replacement CONFIG predicate myself and it fires
correctly, so that is not what fails this unit.
```

## What I re-ran (nothing here is the maker's pasted output)

| # | Command / probe | Result |
|---|---|---|
| 1 | `powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` | **ALL PASS**, exit 0; **16** checks in the `aios-write-guard.ps1` block |
| 2 | 33-case probe table against the live guard, JSON piped on stdin | see below |
| 3 | Approval-fatigue sweep over every source file in this repo | **314 judged, 1 prompts** |
| 4 | My own D-020 mutation harness, 9 mutants | **8 killed / 1 control survived clean** |
| 5 | `delivery-gate-stop.ps1` CONFIG predicate, 4 synthetic transcripts | fires correctly, ordering rule correct |
| 6 | Malformed-input sweep (7 inputs) for [I1] | all exit 0, silent |
| 7 | `D:/ai_os` git: `371d3b3`, `ac9e2e7`, tracked status of the guard | both exist, guard tracked and unmodified |

---

## 1. ISS-165 and [I2] — the fourth survivor, and it reaches the `deny`

The dispatch asked me to hunt a fourth member of this class after three consecutive rounds found it
on paths the author had not named. **There is one, and it is worse than its predecessors.**

```
Write   D:/KnowledgeBase/docs/DECISIONS.md          -> deny      (canonical, correct)
Write   D:/KnowledgeBase/docs/sub/../DECISIONS.md   -> silent    <-- ISS-172
Write   D:/KnowledgeBase/docs/./DECISIONS.md        -> silent    <-- ISS-172
Write   D:/KnowledgeBase/qa/../docs/DECISIONS.md    -> deny      (survives only by accident of the regex)
Edit    D:/KnowledgeBase/docs/DECISIONS.md          -> deny
MultiEdit D:/KnowledgeBase/docs/DECISIONS.md        -> deny
Write   D:\KnowledgeBase\docs\DECISIONS.md          -> deny      (backslash input)
Write   D:/KnowledgeBase/docs/DECISIONS.MD          -> deny      (case)
```

Both silent spellings name the protected file:

```
Resolve-Path 'D:\KnowledgeBase\docs\sub\..\DECISIONS.md' -> D:\KnowledgeBase\docs\DECISIONS.md
Resolve-Path 'D:\KnowledgeBase\docs\.\DECISIONS.md'      -> D:\KnowledgeBase\docs\DECISIONS.md
Test-Path -LiteralPath (both)                            -> True
```

`aios-write-guard.ps1:78` matches the raw string `'\\docs\\DECISIONS\.md$'` after only a `/` → `\`
substitution. Nothing canonicalises. So the guard protects a *spelling*, not a *file* — which is the
identical root cause as ISS-160 (named four paths), ISS-165 (matched position relative to the Lab
root) and [I2] (varied with parent-directory existence). The cycle-2 fix moved the matching from
*position* to *shape*; it did not move it to *identity*, which is the only formulation that closes
the class.

The same root cause, at lower impact, also hits the `ask` block:

```
Write   D:/KnowledgeBase/.claude/settings.json/     -> silent   (trailing separator)
Write   docs/DECISIONS.md            (relative)     -> silent
Write   .claude/settings.json        (relative)     -> silent
```

**The honest bound on this finding.** I could not establish whether the Claude Code harness
canonicalises `file_path` before the PreToolUse hook receives it, because the only decisive test is
to issue a real Write at `docs/DECISIONS.md`, which this checker may not do. If the harness does
normalise, this is unexploitable *through that one route*. It is still charged as a [C1] failure,
for two reasons: the criterion is about the guard's decision and the guard's decision is wrong; and
the guard is registered as the sole enforcer of the wall, so "another component probably saves us"
is exactly the reasoning D-023's Result was corrected for. Recorded in the ledger row as
`NOT CONFIRMED` rather than asserted either way.

**Everything else in the hunt came back clean.** UNC paths, mixed separators, deeply nested
worktrees, submodules, `Edit`/`MultiEdit`, a `CLAUDE.md` inside `node_modules`, `.claude` as a file
rather than a directory — all behave correctly:

```
KB/.claude/worktrees/lane-a/.claude/settings.json  -> ask     <- ISS-165 class, closed
KB/sources/whatsapp_msg/.claude/settings.json      -> ask     <- submodule with its own Lab repo, closed
KB/apps/api/.claude/hooks/h.ps1                    -> ask
KB/.claude/rules/sub/x.md                          -> ask
KB/CLAUDE.md, KB/.claude/CLAUDE.md                 -> ask
KB/.claude/settings.local.json                     -> ask
KB/scripts/append_decision.ps1                     -> ask
```

One genuine narrowing did fall out (ISS-173, medium): `.claude/hooks/newhook.mjs`,
`.claude/hooks/newhook.py` and `.claude/hooks/sub/deep.ps1` are all silent, because line 102 encodes
the extension `.ps1` and a no-separator segment class. [C2] says `.claude/hooks/*`, and hook commands
are not restricted to PowerShell. No such file exists in the repo today, so it is latent — but it is
one more enumerated spelling standing in for a class.

## 2. ISS-167 — the harness is real, and non-vacuous by my own measurement

I ran it: **ALL PASS**, exit 0, **16 checks** in the `aios-write-guard.ps1` block. I did not re-run
the maker's mutations. I built my own, per D-020: the guard was copied to an isolated sandbox
(`%TEMP%/sb/.claude/hooks/`, SHA256-identical to the live file, and the harness resolves the hooks
dir from `$PSScriptRoot` so the sandbox copy tests itself), every run wrapped in a 240 s `timeout`,
restore in a `finally` with a SHA256 assertion on both the sandbox **and** the live guard.

| # | mutant | result |
|---|---|---|
| M1 | DECISIONS wall `deny` → `ask` (a downgrade, subtler than the maker's `deny`→allow) | **KILLED** |
| M2 | drop the `.claude/hooks/*.ps1` shape rule | **KILLED** |
| M3 | drop the `settings(.local).json` shape rule | **KILLED** |
| M4 | drop the `CLAUDE.md` shape rule | **KILLED** |
| M5 | drop the `.claude/rules` shape rule | **KILLED** |
| M6 | drop the `scripts/append_decision.ps1` rule | **KILLED** |
| M7 | **re-introduce the [I2] defect** — gate the ask on parent-directory existence | **KILLED** |
| M8 | **re-introduce ISS-165** — ask only directly under the Lab root | **KILLED** |
| M9 | control, comment only | **survived clean** |

```
BASELINE failures in write-guard block: 0
RESTORE sandbox: MATCH        LIVE guard untouched: YES
```

Six of these are mutants the maker did not try, and M7/M8 are the two historical defects themselves:
**the harness demonstrably kills the exact regressions this seam has already shipped twice.** That is
a stronger result than the maker claimed, and [I2] is discharged on evidence rather than on argument.

*A note against my own run:* my first attempt raced a background copy of itself on the same sandbox
file and produced a contaminated table (control "killed", baseline drifting 0↔4, restore MISMATCH).
I discarded it and re-ran sequentially. The live guard was never at risk — the sandbox is what
absorbed it — but it is the same concurrency hazard D-020 was written for, in a harness written to
satisfy D-020, and it is only visible because the control mutant was in the table. Reported here
because a mutation result without a control is not evidence.

## 3. ISS-166 — tracked, and the tracked file is the live one

```
371d3b3  hooks: track aios-write-guard.ps1 -- the live PreToolUse guard was untracked
ac9e2e7  hooks/tests: pin aios-write-guard behaviour (ISS-167)
git status .claude/hooks/  ->  aios-write-guard.ps1 absent from the output (tracked, unmodified)
~/.claude/settings.json:163 -> powershell ... -File D:/ai_os/.claude/hooks/aios-write-guard.ps1
```

The registered path *is* the tracked file and the working tree has no divergent copy — I checked
this specifically, because a tracked-but-superseded file would satisfy the commit while leaving the
original defect live. Both commit messages match what they contain. **[C7] met.**

## 4. The moved target — keeping it was correct, and the replacement fires

Judged on the merits, three ways.

**Was keeping it correct? Yes.** The maker was mid-cycle on a control that Umesh, the named Approver
of this repo, had just removed by direct instruction. Fighting that would have been a maker
overriding the Approver on a scope question — precisely the decision class the maker does not own.
The reasoning in the guard's own comment is also independently right: this hook sees only
`Write|Edit|MultiEdit`, so a `sed` or heredoc edit walks past it, and a gate with a second route
around it buys the interruption without the safety.

**Is the feedback recorded properly? Yes.** `qa/feedback-inbox.md` carries it verbatim with
attribution, the mechanism, the measured cost, and an APPLIES NEXT that generalises past this hook.
That is the inbox format, used well.

**Can the unit PASS while the protection depends on a Stop-hook predicate this unit neither wrote
nor verified?** The maker invited a FAIL here. **I decline it, because I verified the predicate
myself.** `delivery-gate-stop.ps1:160-196` exists and fires. Driven with synthetic transcripts and
fresh session ids from cwd `D:/ai_os` (from a maker-checker cwd the earlier MAKER CONTINUATION
predicate blocks first and masks it):

```
A  config edit, no auditor        -> block: "1 config-file edit(s) this session and /aios-config-auditor never ran"
B  config edit, auditor AFTER     -> no block
C  config edit, auditor BEFORE    -> block          (the "only a run after the last edit counts" rule is correct)
D  ordinary edit only             -> no block
```

It is also strictly wider than the ask it replaced: it reads the transcript, so it catches the
Bash/`sed` route the PreToolUse hook never could. So the substance of Gap 1 is discharged — the
protection did not evaporate, it moved and got stronger, and it is now verified by someone other
than the session that wrote it.

**What does fail is the bookkeeping (ISS-174, medium).** `[C3]` still says those paths are `ask`;
they are silent. A checker may not soften a criterion to pass an artifact, and *removing a control*
is a CRITICAL amendment under the criticality gate — human-decided, away from any pending verdict.
So `[C3]` counts as not met this cycle and rides with the contract's ratification. The maker is not
charged for it; it is not a fix direction the maker can execute.

## 5. The Lab Protocol ask survives — re-probed, not read

`docs/DECISIONS.md` → **deny** (canonical spellings; see §1 for the exception). Every Lab enforcement
class → **ask**, including the nested class: `.claude/settings.json`, `.claude/settings.local.json`,
`.claude/hooks/*.ps1`, `scripts/append_decision.ps1`, `CLAUDE.md`, `.claude/CLAUDE.md`,
`.claude/rules/**` at the root, in a submodule, in a worktree lane, and under `apps/api/`. **[C5] met.**

## 6. The approval-fatigue win survives

Re-measured over this repo rather than taken from the manifest — every `.py .ts .tsx .js .jsx .go
.rs .java .rb .cs .c .h` file outside `node_modules`/`.git`/`.venv`/`dist`/`build`, each piped
through the live guard:

```
judged source files: 314
PROMPTING now:       1
  D:/KnowledgeBase/packages/ask/src/ask-v2.ts
```

**314 → 1**, and the one is a true positive: `ask-v2.ts` beside `ask.ts` is the literal `foo_v2`
pattern the anti-drift rule exists for. Against the 84 the merge was built to remove, the win holds
with no false positives at all. **[C4] met.**

On the per-write cost: the ~5088 ms → ~1100 ms claim is a claim about *four PowerShell spawns versus
one*, and `~/.claude/settings.json` now registers exactly one PreToolUse command for
`Write|Edit|MultiEdit` (line 163). One spawn is the structural fact behind the number and it is
confirmed; I did not re-derive the millisecond figures, since a single-process guard cannot cost
four cold starts. **[I4] met.**

## 7. The four Known Gaps

1. **The generic-config route is carried by a Stop hook the maker did not verify.** *Discharged* —
   §4. I verified it; it fires, with the correct ordering rule, and it is wider than what it replaced.
2. **`Get-ProtocolRoot` still differs from the original's existence-gated walk.** *Accepted, and now
   evidenced rather than argued.* The maker claimed the difference affects only the reason. My
   mutant M7 re-introduced the existence gate on the decision and the fixture block **killed it**, so
   the property is pinned, not merely asserted. [I2] holds.
3. **The harness runs only on demand.** *Accurate and unresolved.* Nothing in any session or commit
   path invokes `hook-fixtures.ps1`. Not charged as a failure — [C6] asks for a committed, runnable
   harness and that exists — but it is the reason this seam keeps regressing between checks. A
   PostToolUse or pre-commit invocation scoped to `.claude/hooks/**` is the obvious closure; it is
   `D:/ai_os` work, not KnowledgeBase work, so I have not filed it against this repo's ledger.
4. **ISS-168 needs the Approver.** *Correctly handled.* `qa/gates/d023-supersede.md` is well-formed:
   dated, one-line question, why it needs the human, exactly what is false, options A/B with a
   recommendation, an answer format, and the literal command. It has no `Answered:` line, which is
   right — it has not been answered. **And the maker did not write the DECISIONS entry itself:**
   `git log -S` finds no commit introducing D-024's text, `d469340`'s stat does not touch
   `docs/DECISIONS.md`, and the file's only uncommitted change is 8 added lines — D-024, another
   session's live-browser entry, unrelated to D-023. The append-only record was not touched by this
   unit. Exactly right.

Separately, while running the harness I found a defect in it that is **not** this unit's
(ISS-175, low): `hook-fixtures.ps1:126` writes a double-quoted `qa\feedback-inbox.md`, so `\f`
becomes a formfeed, `Set-Content` throws `Illegal characters in path` twice on stderr — and the suite
still reports `ALL PASS` with exit 0. It is in the `mc-sessionstart` block, not the block the maker
added. Recorded because a fixture whose setup silently failed can only pass vacuously, and it was
only visible because I ran the harness instead of trusting the pasted result.

## Round cap (D-014)

ISS-172 is **security class** — it is the append-only DECISIONS wall, the repo's governance
enforcement — so the class-based cap does not apply and it opens a unit at any round count. It is
moot regardless: this seam has **zero** prior PASSed verdicts, cycle 1 having FAILed.

## Contract note

`qa/contracts/write-guard.md` remains `proposed`. I have made **no amendment** — [C3]'s divergence is
a CRITICAL amendment (removing a control) and belongs to the Approver, not to a checker holding a
pending verdict, and softening it here to reach a PASS is the one thing the criticality gate
absolutely forbids. Ratification and the [C3] rewrite should be decided together, per ISS-174.

## For the maker (cycle 3, and it should be small)

One code change carries [C1]: canonicalise `$pathNorm` once with
`[System.IO.Path]::GetFullPath(...)` (it works on paths that do not exist, unlike `Resolve-Path`),
trim trailing separators, and match only the canonical form. ISS-173 is a one-line widening of the
same block. **Per D-015, the regression evidence must re-run ISS-172's own four recorded
reproductions verbatim and report them by issue id** — not a corpus authored alongside the fix.
They belong in the `aios-write-guard` block of `hook-fixtures.ps1`, which today pins only canonical
spellings. ISS-174 is a HUMAN_GATE and ISS-175 is another repo's low; neither blocks cycle 3.


---

# Verdict — write-guard-enforcement-gaps · **Cycle checked: 3**

**Date:** 2026-09-09 · **Bound root:** `D:/KnowledgeBase` · **Contract:** `qa/contracts/write-guard.md` (proposed)
**Commit under check:** `59c121b` (KnowledgeBase) · artifact `D:/ai_os/.claude/hooks/aios-write-guard.ps1` @ `e3bf6f8` (ai_os)
**Note on cycle numbering:** an earlier cycle-3 run was killed and wrote no file. A run that wrote
no verdict is not a verdict, so nothing from it was carried forward — every result below was
re-derived in this run.

```
VERDICT: FAIL
SCOREBOARD: 4/7 criteria met, 4/4 invariants hold
FAILURES:
- [C1] sev: high · The deny wall is still bypassable, by the extended-length path prefix
  `\\?\D:\KnowledgeBase\docs\DECISIONS.md` -> SILENT — and unlike every earlier finding on this
  seam, this one's reachability is MEASURED, not assumed: the Write tool honours that prefix and
  the write lands on the real file. · Root cause is the existence probe, not the match: the regex
  matches, then `Test-Path -LiteralPath` returns False for a `\\?\` path under PS 5.1 and control
  falls to the "initial creation (file absent)" allow branch. Strip the prefix before Test-Path,
  or deny when existence is indeterminate on a DECISIONS-shaped path. · issue: ISS-180
- [C6] sev: high · The cycle-3 fixtures that pin the ISS-172 security fix are UNCOMMITTED in
  `D:/ai_os` (` M .claude/hooks/tests/hook-fixtures.ps1`, 24 insertions). ISS-166's failure class
  one layer up. · Commit the harness under a narrow pathspec. · issue: ISS-182
- [C3] sev: n/a (not scorable) · Unchanged from cycle 2: the criterion describes a control that was
  deliberately withdrawn. Per ISS-174 it counts as not met and no unit may score it until the
  Approver ratifies the amendment. Not a defect in this unit's work.
LIVE-BROWSER: not-applicable (changed paths: D:/ai_os/.claude/hooks/aios-write-guard.ps1,
  D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1 — no UI surface)
ISSUES-WRITTEN: ISS-180 (high), ISS-181 (low), ISS-182 (high); ISS-172 and ISS-173 marked fixed
EXPLANATION: ISS-172 and ISS-173 are genuinely fixed — every spelling those rows name now denies,
re-derived by my own probe suite and killed by independent mutants. But the hunt for a fifth
survivor found one, it reaches the `deny`, and it is the first defect on this seam whose
reachability has been demonstrated rather than assumed. Security class, uncapped. FAIL, which
under the re-dispatch terms means STALLED.
```

## 1. ISS-172 — fixed, and the fix is real

Every spelling in the issue's title and `fix_direction`, plus the two the maker added, re-probed
by me against the live guard (not read from the manifest):

| spelling | decision |
|---|---|
| `docs\DECISIONS.md` | deny |
| `docs\sub\..\DECISIONS.md` | deny |
| `docs\.\DECISIONS.md` | deny |
| `docs\..\docs\DECISIONS.md` | deny |
| `docs\\DECISIONS.md` | deny |
| `docs\DECISIONS.md\` (trailing sep) | deny |
| same path via `Edit` / `MultiEdit` | deny / deny |
| `docs\decisions.MD` (casing — my own) | deny |
| `docs\DECISIONS.md ` and `...md.` (Win32 trailing trim — my own) | deny / deny |

## 2. D-015 compliance — the maker's disclosure is honest, and I verified it

`qa/issues.jsonl` ISS-172 has **no `reproductions` field at all** (confirmed by parsing the row;
`fix_direction` and `title` are the only enumerations it carries). The maker's claim is therefore
accurate, and its substitute corpus is honest rather than convenient: it is the union of the
classes the row names, the three concrete spellings in the cycle-2 verdict, and two additions —
i.e. it is *wider* than the row, not narrower. Saying so explicitly instead of implying a recorded
corpus is exactly what D-015 asks for. **Credited in full.** My own additions above (casing,
trailing space, trailing dot, `Edit`/`MultiEdit`) all pass too.

## 3. Harness + my own mutation table

`powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` → **ALL PASS, 82 PASS / 0 FAIL,
exit 0.** Re-run by me.

I did not re-run the maker's mutation table. I wrote my own (D-020-compliant: sandbox **copy** in
the scratchpad so the live artifact is never touched, per-probe timeout, `finally` cleanup,
live-file SHA256 asserted before and after **every** mutant — `3c73b146…8598`, unchanged), driving
a **26-check suite I derived from the contract**, not from the maker's fixtures. All 26 pass on the
unmutated guard.

| mutation | result |
|---|---|
| **no-op control** | **clean** |
| drop the `GetFullPath` canonicalisation | killed (`docs\sub\..\` → silent) |
| **drop the trailing-separator trim** | **killed** (`docs\DECISIONS.md\` → silent) |
| narrow `.claude\hooks\` back to `*.ps1` direct children | killed (`hooks\x.mjs` → silent) |
| flip the DECISIONS wall `deny` → `ask` | killed |
| drop `settings.local.json` from the shape list | killed |
| drop the `append_decision.ps1` rule | killed |
| re-gate the shape block on the protocol root (ISS-165 regression) | killed |

The trim — which the maker discloses survived its first table — **is genuinely pinned now**, and
pinned independently: my suite kills it without using the maker's fixture. I found **no unpinned
line** among the seven I attacked. Recording the survivor rather than presenting a first-time-clean
table was the right call and it is what let me target that mutant specifically.

## 4. No regression, and the approval-fatigue win re-measured

All from my own suite, all green: `docs/DECISIONS.md` deny; `.claude/{settings.json,
settings.local.json,CLAUDE.md,rules/*}`, `CLAUDE.md`, `scripts/append_decision.ps1`,
`.claude/hooks/{*.ps1,x.mjs,lib/y.py}` **ask**; the nested ISS-165 class
(`sources/whatsapp_msg/.claude/settings.json`, `apps/api/.claude/hooks/h.ps1`,
`.claude/worktrees/lane-a/.claude/settings.json`) **ask**; I2 holds on a non-existent parent;
`~/.claude/settings.json` and `D:/ai_os/CLAUDE.md` **silent** (the cycle-2 withdrawal, upheld);
`qa/manifests/x.md`, `README.md`, `apps/api/src/search-store.ts` **silent**.

Approval fatigue, re-measured by walking the repo rather than quoted: **314 source files judged,
exactly 1 prompted** — `packages/ask/src/ask-v2.ts`, a true positive. Identical to the previous
measurement. [C4] holds.

## 5. Ruling on the five Known Gaps — including the invited FAIL on Gap 2

**Gap 2 does NOT fail this unit, on two independent grounds.**

*On the merits.* The burden runs the other way. The maker did not add a speculative control; it
closed a **demonstrated** bypass of a wall that had been matching a raw string. Requiring proof of
reachability before hardening would mean the safe state is the one where an attacker's input shape
is assumed impossible — and the entire history of this seam is defects found in shapes nobody
thought to name. A security-class fix may PASS on an assumed-reachable input when the alternative
is leaving a proven-defective match in place.

*And empirically, the assumption is now discharged.* Hunting the fifth survivor produced the
measurement the maker said it could not get without writing to `DECISIONS.md`. Through the tool
layer, on a harmless scratch file, `Write` to `\\?\C:\…\ads.txt` **landed on the real file** while
the guard returned silent for that same shape — so the harness demonstrably passes non-canonical
`file_path` values straight through to the hook. **Gap 2 is closed in the maker's favour.** It is
also, exactly, what turned the fifth survivor from a curiosity into a FAIL.

- **Gap 1** (relative paths resolved against the hook's CWD) — accurate, and harmless for the wall
  as argued, since any spelling ending in `\docs\DECISIONS.md` matches whatever it resolves
  against. Note only.
- **Gap 3** (`delivery-gate-stop.ps1` carries the generic-config route) — outside this unit. Not
  scored, per cycle 2.
- **Gap 4 / Gap 5** (ISS-174, ISS-168) — correctly left open, see §6.

## 6. The Approver's items — the maker stayed in its lane

Verified rather than taken on trust: `qa/contracts/write-guard.md`'s amendment log contains **only**
the START entry — [C3] is untouched, so no silent self-amendment. `qa/gates/d023-supersede.md`
exists, states both options and the exact command, and has **no `Answered:` line**. `docs/DECISIONS.md`
contains **no entry superseding D-023** (latest is D-026, unrelated). The maker wrote neither the
contract amendment nor the DECISIONS entry it needed. That is the correct behaviour and it is worth
saying plainly after three cycles of findings.

## 7. The fifth survivor, and why the class-based cap is doing its job

```
\\?\D:\KnowledgeBase\docs\DECISIONS.md   ->  SILENT     (want: deny)
```

The regex is not the problem — it still matches. Line 79's `Test-Path -LiteralPath $pathNorm`
returns **False** for a `\\?\` path under Windows PowerShell 5.1 (I verified this directly against
the real, 59,687-byte `docs/DECISIONS.md`), so the guard takes the `exit 0   # initial creation
(file absent)` branch and allows the write as though the file did not exist. `GetFullPath` does not
strip the prefix, and cycle 3's canonicalisation therefore never sees it.

Three cycles moved this wall from **position** → **shape** → **identity**, and each time the
remaining hole was in a different organ. This one is in the **existence probe** — the one line the
identity fix left alone.

Two smaller notes: NTFS stream spellings (`DECISIONS.md::$DATA`, `DECISIONS.md:x`) are also silent
at the guard, but `Write` cannot currently reach them because it writes through a `<path>.tmp.…`
sibling that a stream suffix makes illegal — filed **low** (ISS-181) with that evidence, not
promoted. 8.3 short names are a non-issue here: `D:\KNOWLE~1` does not resolve, so 8.3 generation is
off on this volume. `//localhost/D$/…` denies correctly.

**On the cap.** `.claude/CLAUDE.md`'s round cap is class-based precisely for this: this seam is well
past two PASSes, and a count-based cap would have closed it before round 5 — which is the same
arithmetic that would have shipped ISS-078. ISS-180 is security class, therefore uncapped, and it
opens a unit at any round count. This unit is at its cycle limit, so the correct disposition is
**STALLED with ISS-180 opening a new unit**, not a fourth cycle here.
