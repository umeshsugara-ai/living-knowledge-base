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
