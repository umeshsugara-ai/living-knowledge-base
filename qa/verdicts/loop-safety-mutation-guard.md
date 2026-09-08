# Verdict — loop-safety-mutation-guard

**Date:** 2026-09-08
**Cycle checked:** 1 (matches manifest `Fix cycle: 1 of max 3`)
**Contract:** `qa/contracts/loop-safety.md` — **authored by this check** (see §Contract judgment)
**Mode:** A, fresh context, bound to `D:/KnowledgeBase`
**Unit commit:** `917aa1b` (already committed at check time)

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 4/4 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-086
EXPLANATION: The mutation guard does what it claims and I re-derived all of it — the incident
reproduced end-to-end on the real repo, the hook's deny JSON captured from stdout, the
concurrency refusal exercised against the other session's genuinely dirty file. The one issue
filed is not a defect in the guard: D-014's own Result says .claude/CLAUDE.md's round-cap
paragraph is replaced, and it was not, so the rule the loop actually reads each tick is still
the count-based cap D-014 exists to kill. On the design question I was asked: the guard is worth
having, the ledger hole is not the hole that matters, and a tree-wide clean assertion would be
worse — reasoning below, recorded as [I3].
```

## Contract judgment (the checker owns this)

The manifest cited `qa/contracts/structure-lint.md` as "the closest existing" and asked me to judge
whether a new contract is warranted. **It is.** structure-lint governs LOC, dirsize, root-file
count, duplicate exports, migration placement and depcruise rules; none of its ten criteria or
three invariants touch mutation safety. Judging this unit against it would have credited it for
nothing it actually does — the imperfect fit was real, and correctly flagged rather than papered
over. This is **not** `CONTRACT_MISMATCH`: the work is coherent and the contract gap is the
maker's own honest report.

I authored `qa/contracts/loop-safety.md` (C1–C8, I1–I4). It introduces no new direction — every
criterion derives from **D-014** (`Approved-by: Umesh`) and the incident D-014 records — so I did
not re-ask the START gate, and I said so in the file's header. Umesh should ratify or amend it.

## What I re-ran myself (nothing below is the manifest's pasted output)

| check | my result |
|---|---|
| `node --test scripts/lib/mutate.test.mjs` | **5/5 pass**, 0 fail |
| `pnpm lint:structure` | **exit 0** — lint-loc 245 files, dirsize 75 dirs, root 15 loose, dupes 255 exports / 24 `$id`s, migrations 1164 scanned, SNAPSHOT fresh, tracker-audit G1 OK, depcruise **0 violations / 267 modules / 805 deps** |
| `pnpm -r typecheck` | **exit 0**, all packages Done |
| `pnpm --filter @lkb/api test` | **109/109 pass**, 0 fail |
| `pnpm test:lint` | **exit 1** — 2 failures, both in `catalogue-cli.test.mjs`, **not this unit's** (§3) |

**The incident, reproduced on the real repo** (I used `scripts/lib/walk.mjs`, not the shared-tree
hot file, and restored it — final `git status` is byte-identical to the state I found):

```
$ node scripts/lib/mutate.mjs apply scripts/lib/walk.mjs
MUTATION ARMED: scripts/lib/walk.mjs (restore with: mutate.mjs restore)
$ printf '\n// MUTANT\n' >> scripts/lib/walk.mjs
$ node scripts/lib/mutate.mjs assert-clean          → EXIT 1
MUTATIONS OUTSTANDING: 1 armed, 1 still differ from HEAD
  scripts/lib/walk.mjs -- modified (armed 2026-09-08T07:15:34.494Z)
$ node scripts/lib/mutate.mjs restore scripts/lib/walk.mjs
RESTORED: scripts/lib/walk.mjs (verified identical to HEAD)
$ node scripts/lib/mutate.mjs assert-clean          → EXIT 0
MUTATIONS CLEAN: none outstanding
$ ls qa/.mutations-active                           → ledger removed
```

**[C4] hook deny, captured from stdout with stderr split off** (my first attempt showed only the
reason text and I did not accept that as evidence — I re-ran with explicit redirection):

```
$ powershell -NoProfile -File .claude/hooks/mc-precommit.ps1 -InputJson '{"tool_input":{"command":"git commit -m x"}}' 1>out 2>err
PSEXIT=0
STDOUT: {"hookSpecificOutput":{"permissionDecision":"deny","hookEventName":"PreToolUse",
         "permissionDecisionReason":"BLOCKED: a mutation is still armed -- ..."}}
```
Well-formed JSON, on stdout, exit 0. With nothing armed the same invocation emits only the
pre-existing `WARN maker-checker: 1 unit(s) still awaiting /checker verdict` line — no deny. I
also confirmed the hook is really wired: `.claude/settings.json` PreToolUse matcher
`Bash|PowerShell` → `mc-precommit.ps1`. No `"allow"` appears anywhere in the file.

**[C5] concurrency refusal, exercised against real foreign dirt** — `.goal/goal.json` is modified
in this tree by the *other* maker session right now:

```
$ node scripts/lib/mutate.mjs apply .goal/goal.json     → EXIT 1
MUTATE REFUSED: .goal/goal.json is 'modified', not 'committed'. ... would otherwise destroy
uncommitted work (possibly a concurrent session's).
```
That is the claim proven on the live hazard, not on a fixture. `mutate.test.mjs` (a) and (b) cover
the fixture cases.

**[C6] non-vacuous** — the tests drive the shipped CLI via `execFileSync` in a real `git init`
sandbox, so they test the artifact rather than a re-implementation, and `test:lint` includes
`scripts/lib/mutate.test.mjs` (package.json:19). Confirmed by reading both.

## The design question — a real answer

I was asked to attack the maker's judgment that the ledger hole is acceptable. I did, and the
judgment holds — but the manifest **mis-locates its own weakest point**, and that is worth saying.

**1. The ledger hole is not the hole that matters.** Test (c) frames the gap as "you can clear
`qa/.mutations-active` by hand and commit a mutated file." True, and it is a *deliberate-evasion*
threat model. Nothing local survives that bar: `git commit --no-verify` walks past the hook, and a
human typing `git` in a terminal never enters the Claude Code PreToolUse path at all. The 2026-09-08
incident was **not** evasion — it was a checker who believed a restore that had not held. Against
forgetting, which is the actual failure mode, the ledger fails closed. Judging this guard by
whether it stops an adversary is judging it against a threat it never claimed.

**2. The maker undersells its own design.** The safety property is not the ledger and not the deny
— it is the `apply` precondition. Because a file must equal HEAD before it can be armed,
`git checkout -- <path>` becomes an *authoritative* restore, which structurally deletes the
failure mode ("restore reported success, restore did not hold"). That property is established at
arm time and survives the ledger being deleted afterwards. The ledger and the deny are a second,
weaker belt. I recorded this as **[I1]** so a future edit that lets a non-`committed` file be armed
reads as a contract break even if every test stays green.

**3. Would tree-wide be better? No — and I'll give the honest counter-argument first.** Tree-wide
*does* catch the one class the ledger cannot: a mutation applied without ever calling `apply`.
That is exactly the 2026-09-08 incident, since no `apply` existed then. So the case for it is not
frivolous. It still loses, on evidence rather than taste:

- **It is unsatisfiable here.** Two maker loops legitimately share this tree; `.goal/goal.json` and
  `qa/evidence/live-2026-09-07-01-58-41/preflight.json` are dirty from the other session *as I
  write this*, and were before I started. A gate that refuses ~100% of commits gets switched off,
  and a disabled gate is strictly worse than a narrow live one.
- **It is the wrong signal.** Dirtiness is not mutation. Tree-wide converts a precise gate into a
  noise generator, and the noise trains the operator to dismiss it — the same dynamic that let
  four consecutive PASSes precede ISS-078.

**4. The right upgrade is narrower than tree-wide: per-unit close-out.** The checker that mutates
asserts that *the files it armed* are identical to HEAD before writing its verdict — a bounded set,
independent of the other session's dirt. That catches the unarmed-mutation class without the
unsatisfiability, and it is procedure (a dispatch-prompt line), not code. I wrote it as **[C7]**
and the tree-wide rejection as **[I3]**, reversible only via a CRITICAL amendment. So: keep the
guard, keep the deny narrow, close the remaining gap in the procedure.

I also record that the manifest's **[I2]** honesty — "it does not enforce use" — is the accurate
statement of the residual risk, and it is a bigger gap than the ledger hole it foregrounds.

## §3 — the two `catalogue-cli.test.mjs` failures: whose fault?

I was told not to let this unit take the blame and not to let it hide behind the excuse. I traced
the mechanism rather than accepting either story. **Verdict: not this unit's fault — but the
manifest's stated reason is wrong, and one of its predictions is falsified.**

- Before I ran anything, `git status --porcelain` showed **only** `.goal/goal.json` and
  `qa/evidence/.../preflight.json`. `docs/PROGRESS.md` was **clean**, contradicting the manifest's
  claim that it "was dirty from another session at tick start."
- `node scripts/catalogue-score.mjs --check` → `STALE`. I regenerated to compare and the entire
  diff is one banner line the *committed* file carries and a fresh run removes:
  `> **EDITED SINCE COMMIT — .goal/catalogue.json no longer matches the version in git...**`.
  `.goal/catalogue.json` is clean now. So `docs/PROGRESS.md` was committed while
  `.goal/catalogue.json` was dirty, baking a stale banner into the tracked file.
- `git log --oneline -5 -- docs/PROGRESS.md` → that commit is **`fbbafc0`** ("chore(catalogue):
  downgrade C2/C3 to PARTIAL"), which is **two commits before** this unit's `917aa1b`. The unit's
  commit touched no catalogue file.

So the failure **pre-dates the unit** and belongs to the other session's `fbbafc0` — the
conclusion the manifest reached, by the wrong route. Two corrections to the manifest's §4 note:
its mechanism (working-tree dirt at tick start) is not what happens; and its instruction to
"confirm they pass once committed" is **falsified** — the unit *is* committed and they still fail.
I restored `docs/PROGRESS.md` after my diff; the suite self-cleans and the tree is as I found it.
I did not file this as a new issue: it is a known artifact of `fbbafc0`, owned by the session that
made it, and filing it here would be the ledger-inflation habit D-014 names.

## Issues

- **ISS-086 (high, open)** — D-014's stated `Result` did not land: `.claude/CLAUDE.md:108-115`
  still carries the count-based "PASSed twice ⇒ CLOSED" cap with no security-class carve-out, and
  lines 79-82 still assert the `checker/SKILL.md:127` root cause D-014 itself retracts. D-014's
  `Changes-authorized` + `Approved-by: Umesh` already permit the edit, so this needs no new gate —
  only doing it. This is why I made it **[C8]**: an append-only entry whose Result is unfulfilled
  is a rule that exists in history and not in force, and the operative file is what a tick reads.
- Manifest's `Issues addressed: none filed` — accurate; verified nothing in `qa/issues.jsonl`
  claims this unit as its fix.
- **No bypass hunt was performed.** Per the manifest's §6 and D-014, a correct implementation
  yielding nothing is the expected outcome, and I would not have defended a manufactured finding
  at >80%. ISS-086 is a read of a file, not a hunted mutation.

## D-014's class-based cap — judged against the history

Sound, and the correction is load-bearing rather than cosmetic. `qa/verdicts/` and the ledger show
the search seam ran to round 5+ and ISS-078 (cross-tenant read disclosure — any authenticated
caller reading every tenant's verbatim transcript text) surfaced *at* round 5, after four
consecutive PASSes and past 102 green tests and a clean typecheck. D-013's count cap would have
closed that seam at round 4. A cap that assumes severity decays with round count is refuted by the
one case in this repo where it mattered; keying the exemption on *class* (tenancy, auth,
cross-tenant read, data write, credential handling) rather than on count keeps D-013's real benefit
— it still stops the seven-round grind on unasserted test fields, of which ISS-085 is the current
example, correctly filed rather than chased. D-014's second correction is also verifiably right:
`checker/SKILL.md` line 127 is the output field `ISSUES-WRITTEN: <ISS-ids | none>`, which permits
`none` explicitly. No rule ever demanded issues.

**The cap is now recorded in two places that disagree.** That is ISS-086.
