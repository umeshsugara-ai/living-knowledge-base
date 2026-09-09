# Manifest — write-guard-enforcement-gaps

**Contract:** none governs the machine-wide hook layer. Checker: author
`qa/contracts/write-guard.md` if you judge one is owed — this is the third unit to touch this seam.
**Goal task:** none (tier 2 — open high issue).
**Date:** 2026-09-09
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** **ISS-160** (high) · **ISS-165**, **ISS-166**, **ISS-167** (high) · **ISS-168**.
**Status:** ready-for-check (cycle 2)

## Why

`aios-write-guard.ps1` merged three PreToolUse hooks into one to kill approval fatigue (84 files
prompting → 0) and a ~5.1s-per-write PowerShell tax (4 spawns → 1). The Mode B sweep then found the
merge had left enforcement paths reachable **with no prompt at all** inside a Lab repo.

**I could not have found this from my own parity test, and that is the lesson.** My test named
three paths — `docs/DECISIONS.md`, `.claude/settings.json`, `.claude/hooks/*.ps1` — and all three
pass through CHECK 1, which I ported verbatim. The paths that fall through to CHECK 2 are exactly
the ones I did not think to name. D-023's Result says *"Protection is unchanged and was verified by
parity test"*; that sentence is true of the corpus I chose and false of the system. Same shape as
D-015: **a fix measured against a corpus its own author chose.**

## What the sweep got right, and what it got wrong

The sweep filed one finding. Probed against the old scripts, still on disk, it is **two findings
with different provenance** — and its stated cause is wrong:

| path | old stack | new (before this fix) | |
|---|---|---|---|
| `KB/.claude/CLAUDE.md` | silent | silent | **pre-existing gap, not caused by the merge** |
| `KB/CLAUDE.md` | silent | silent | pre-existing gap |
| `KB/.claude/settings.local.json` | silent | silent | pre-existing gap |
| `KB/.claude/rules/x.md` | **ask** | **silent** | **a real regression I introduced** |

The sweep wrote that the replaced `config-protection.ps1` *"matched both unconditionally"*. It does
not: `config-protection.ps1:33-40` walks up for `docs\DECISIONS.md` and `exit 0`s when a Lab root
owns the path, deferring to `decisions-append-guard.ps1`, whose enforcement list never named
`CLAUDE.md`. So inside a Lab repo the old stack was **already** silent there. A prior
`senior-software-engineer` review called this pre-existing and was right.

**But the sweep was right that protection weakened** — just on `.claude/rules/`, which it did not
name. Cause: `config-protection.ps1` gates its walk on `while ($dir -and (Test-Path $dir))`, so for
a path whose parent directory does not exist yet it finds **no** Lab root and asks. My
`Get-ProtocolRoot` walks up regardless, finds the root, and skips CHECK 2. That is precisely the
edge case the same review had flagged as an Open Question and marked *"low real-world likelihood,
not run/tested"*. It was neither unlikely nor untestable — it reproduces on the first probe.

## What changed

| File | Change |
|---|---|
| `D:/ai_os/.claude/hooks/aios-write-guard.ps1` | CHECK 1's Lab enforcement list gains `CLAUDE.md`, `.claude\CLAUDE.md`, `.claude\rules\*`, `.claude\settings.local.json`. |

Widening CHECK 1 rather than changing `Get-ProtocolRoot` is deliberate: inside a Lab root, CHECK 1
now covers every class CHECK 2 covers, so the existence-gated-walk difference can no longer produce
a silent allow on an enforcement path. It also gives those paths the **Lab** reason (an authorizing
DECISIONS entry with `Approved-by`) rather than the generic config reason, which is the correct one
in this repo — `.claude/CLAUDE.md` carries the D-013 backlog override and the D-014 round cap, and
the project rules say it changes only via `/compound` with the Approver's approval.

## How to verify

Probe the guard directly — it is read-only:
`echo '{"tool_name":"Write","tool_input":{"file_path":"<p>"}}' | powershell -NoProfile -File D:/ai_os/.claude/hooks/aios-write-guard.ps1`

- `KB/.claude/CLAUDE.md`, `KB/CLAUDE.md`, `KB/.claude/rules/x.md`, `KB/.claude/settings.local.json` → **ask**
- `KB/docs/DECISIONS.md` → **deny**
- `KB/.claude/settings.json`, `KB/.claude/hooks/mc-precommit.ps1`, `KB/scripts/append_decision.ps1`,
  `D:/ai_os/CLAUDE.md`, `~/.claude/settings.json` → **ask**
- `KB/apps/api/src/search-store.ts`, `KB/qa/manifests/x.md`, `KB/README.md` → **silent**

## Actual outputs

```
--- the two holes                        OLD       NEW
KB/.claude/CLAUDE.md                     silent    ask
KB/CLAUDE.md                             silent    ask
KB/.claude/rules/x.md                    ask       ask
KB/.claude/settings.local.json           silent    ask
--- must not regress
KB/docs/DECISIONS.md                     deny      deny
KB/.claude/settings.json                 ask       ask
KB/.claude/hooks/mc-precommit.ps1        ask       ask
KB/scripts/append_decision.ps1           ask       ask
D:/ai_os/CLAUDE.md                       ask       ask
~/.claude/settings.json                  ask       ask
--- must stay silent
KB/apps/api/src/search-store.ts          ask       silent
KB/qa/manifests/x.md                     silent    silent
KB/README.md                             silent    silent
```

## Known gaps

1. **No test pins any of this.** Three units have now touched this guard and its only verification
   is a hand-run probe table. A `.test.ps1` (or a node harness driving the hook) belongs here, and
   its absence is why two of the three defects were found by other people rather than by a suite.
   I did not add one in this cycle because the guard lives outside any repo with a test runner —
   which is an argument for moving it in, not for leaving it untested.
2. **`Get-ProtocolRoot` still differs from the original's existence-gated walk.** I made the
   difference unreachable for enforcement paths rather than removing it. If a future edit narrows
   CHECK 1, the hole reopens silently.
3. **D-023's Result sentence is now inaccurate** — it claims protection was unchanged and verified.
   DECISIONS is append-only, so it cannot be edited; a superseding entry is the only correction
   path. I have not written one, because whether this rises to a superseding entry is the
   Approver's call, not mine.
4. **The machine-wide half still has no contract and no unit history.** Only the in-repo
   `.claude/settings.json` line was ever governed (D-023).

## Note to the checker

Gap 3 is the one I would push on: a DECISIONS entry now states something measurably false about
protection, and I have left it standing. If you judge that a superseding entry must land before
this unit can PASS, FAIL it — I would rather be told than decide my own record is close enough.


---

# Fix cycle 2 — three highs, and the target moved mid-cycle

FAILed 4/7. Every finding was real and I have taken all of them.

## ISS-165 (high) — my fix closed four paths; the defect was a CLASS

The checker found six reproductions I had not thought to probe, including
`sources/whatsapp_msg/.claude/settings.json` — a submodule with **its own Lab Protocol repo** — and
the `.claude/worktrees/lane-*` paths D-019 actually uses. Cause: CHECK 1 matched on the path's
position *relative to the Lab root*, so any `.claude/` directory **below** the root fell out of it,
while CHECK 2 stayed unconditionally skipped whenever a Lab root owned the path.

**This is the third consecutive time this defect class was found by someone other than me, each
time on a path I had not named.** So the fix stops naming paths: CHECK 1 and CHECK 2 are now one
block matching on **shape**, with the protocol-root walk choosing only the *reason*, never whether
to ask. That also discharges **I2** — the decision no longer varies with whether a parent directory
happens to exist, because nothing about the walk gates the ask any more.

## ISS-166 (high) — the live guard was untracked

`aios-write-guard.ps1` was registered in `~/.claude/settings.json` while existing only in the
working tree. One `git clean` would have deleted the enforcement and left settings.json pointing at
a missing file — which **fails open, silently**. Committed as `371d3b3` in `D:/ai_os`.

## ISS-167 (high) — my Gap 1 was false, and the checker proved it

I wrote that no test could pin this "because the guard lives outside any repo with a test runner."
`D:/ai_os` is a git repo, and `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` — an 18.5 KB harness
with a `RunHook` JSON-piping helper and a Lab-root fixture already built — was sitting **in the
same directory as the artifact**. I asserted an absence I had not checked.

16 checks added, pinning classes rather than paths, committed as `ac9e2e7`. Non-vacuous:

| mutation | result |
|---|---|
| drop the nested `.claude/hooks` shape rule | **killed** |
| drop the `CLAUDE.md` shape rule | **killed** |
| DECISIONS wall: `deny` to allow | **killed** |
| anti-drift never flags | **killed** |
| remove `.work\` from the scratch allowlist | **killed** |
| **no-op control** | **clean** |

## ISS-168 — Gap 3 is now a gate, not a manifest bullet

The checker ruled a superseding DECISIONS entry is **not** a PASS blocker, because appending to an
Approver-governed append-only record is the human's act — but that it cannot live in a manifest,
which gets closed out while the decision log is read forever. Written as
`qa/gates/d023-supersede.md`, with the two options and the exact command.

## The target moved mid-cycle, and I did not fight it

While this cycle was running, **another session edited the guard on your direct feedback** —
*"meri need nhi honi chaiye naa, like there should be maker checker validation instead of human
approval"* — and removed the **generic** config ask, replacing it with a CONFIG predicate in
`delivery-gate-stop.ps1` that refuses to end the session until `/aios-config-auditor` has run over
the config files the transcript shows were touched. Checker, not doorman.

I have **kept that change** and recorded the feedback verbatim in `qa/feedback-inbox.md`. Its
argument is one I proved by accident all session: this hook only sees `Write|Edit|MultiEdit`, so
every Bash heredoc edit I made — including the edits to the guard itself — walked straight past it.
A gate with a second route around it buys the interruption without the safety.

**So two rows of my cycle-1 probe table are withdrawn**, not fixed: `~/.claude/settings.json` and
`D:/ai_os/CLAUDE.md` are now *intentionally* silent. The Lab Protocol ask is deliberately kept —
it enforces a named Approver, which is a protocol requirement rather than friction.

## Evidence

```
$ powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1   -> ALL PASS (16/16 in this block)

Probe table, current intended behaviour                      NOW      EXPECTED
KB/docs/DECISIONS.md                                         deny     deny
KB/.claude/settings.json .claude/CLAUDE.md .claude/rules/*    ask      ask
KB/scripts/append_decision.ps1                                ask      ask
KB/sources/whatsapp_msg/.claude/{settings.json,CLAUDE.md}     ask      ask   <- ISS-165
KB/apps/api/.claude/hooks/h.ps1                               ask      ask   <- ISS-165
KB/.claude/worktrees/lane-a/.claude/settings.json             ask      ask   <- ISS-165
~/.claude/settings.json, AIOS/CLAUDE.md                       silent   silent <- withdrawn
KB/apps/api/src/search-store.ts, KB/README.md                 silent   silent
                                                              13 / 13 PASS
```

## Known gaps

1. **The generic-config route is now enforced by a Stop hook I did not write or verify.** Its
   correctness is another session's unit. If that predicate is wrong, config edits outside a Lab
   root have no control at all — the guard no longer provides one.
2. **`Get-ProtocolRoot` still differs from the original's existence-gated walk.** It now affects
   only the wording of the reason, never the decision, so it is no longer a correctness risk —
   but it is still a difference, undocumented in the original.
3. **The harness runs only on demand.** Nothing in any session or commit path invokes
   `hook-fixtures.ps1`, so it pins behaviour only when someone remembers to run it.
4. **ISS-168 is open** and needs the Approver.

## Note to the checker

Gap 1 is the one I would push on. I removed nothing, but I have accepted a state where a control I
was asked to strengthen is now carried by a hook outside this unit's scope and outside my
verification. If you think this unit cannot PASS while its own stated protection depends on an
unverified component, FAIL it and say what evidence would suffice.
