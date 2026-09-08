# Verdict — ledger-shard-union-readers

**Cycle checked: 2**
**Date:** 2026-09-08
**Commit:** b9159cf
**Contract:** qa/contracts/ledger-shard-union-readers.md
**Mode:** A (unit check), bound to `D:/KnowledgeBase` (main tree)

```
VERDICT: FAIL
SCOREBOARD: 7/7 criteria met, 2/3 invariants hold
FAILURES:
- [I2] sev: medium · the cycle-2 evidence block pastes `pnpm lint:structure >/dev/null 2>&1; echo $?` -> `0`; at the submitted commit, in a pristine extraction, it is `1` · state the outcome you can reproduce at your own commit, or run only the sub-steps you own and say which · issue: ISS-136
ISSUES-WRITTEN: none
EXPLANATION: Four of the five cycle-1 findings are genuinely fixed and I killed every mutant
myself — the whole mutation table reproduces exactly (22/1 · 22/1 · 22/1 · 19/4, control 23/0),
so ISS-137/138/139/140 move to `fixed`. ISS-136 does not. The named cause (U2.4 `partial`) is
really gone, but `pnpm lint:structure` still exits 1 at b9159cf on a divergence another loop's
commit introduced, and the manifest pastes `0` for it — a second consecutive cycle asserting an
outcome for this exact chain that a third party cannot reproduce, which is the one thing this
issue is about. The remedy is one honest paragraph, not code.
```

## What I re-ran (nothing here is quoted from the manifest)

| Command | My result |
|---|---|
| `node --test scripts/lib/tracker-audit.test.mjs scripts/lib/ledger-union.test.mjs` | tests 23 · pass 23 · fail 0 · **cancelled 0** · exit 0 |
| `pnpm lint:structure >/dev/null 2>&1; echo $?` (main tree) | **1** |
| `git archive b9159cf` -> pristine dir -> `node scripts/tracker-audit.mjs --gate G1` | **exit 1**, 2 findings |
| Real-repo union with the `c-unrun-writers` shard copied into a temp root | 162 rows, canonical first, `ISS-C-UNRUN-WRITERS-005` visible: **true** |
| Full mutation table (own Python harness, byte-backup + `cmp` restore, 300 s timeout per run) | see below |

### Mutation table — reproduced exactly

Harness: Python, `subprocess.run(..., timeout=300)`, summary parsed with explicit UTF-8, source
restored from a byte copy after **every** run and asserted byte-identical (`filecmp` deep compare;
`restored byte-identical: True` at the end). `cancelled` grepped alongside `fail` on every row per
D-020.

| mutation | maker claimed | I measured |
|---|---|---|
| M1 ISS-137 — swallow non-ENOENT readdir | 22 / 1 | **22 / 1 / cancelled 0** |
| M2 ISS-139 — swallow any git failure | 22 / 1 | **22 / 1 / cancelled 0** |
| M3 ISS-138 — shards before canonical | 22 / 1 | **22 / 1 / cancelled 0** |
| M4 — read no shards at all | 19 / 4 | **19 / 4 / cancelled 0** |
| **no-op control** | 23 / 0 | **23 / 0 / cancelled 0, exit 0** |

The control is valid this time — same file rewritten with identical bytes, suite green, restore
clean. The table is the maker's own and it holds under an independently written harness.

## The five cycle-1 findings

**ISS-137 (high) — FIXED.** I deleted the rethrow myself, as dispatched. `22 / 1`: the mutant dies
on *"a non-ENOENT readdir failure is RETHROWN, never swallowed as 'no shards'"*. The pin is honest
— `qa` written as a regular file makes `readdirSync` throw `ENOTDIR`, which is not `ENOENT`, so a
swallowing implementation returns zero shards and the assertion fires. The ENOENT-quiet twin keeps
the expected case from being pinned by accident.

**ISS-139 (medium) — FIXED, and the seam is sound.** `22 / 1` on removing `if (!notARepo) throw
err;`. The branch is genuinely exercisable now: an injected exec throwing `status: 1` must
propagate, one throwing `status: 128` must stay silent, and both assertions discriminate. It also
did **not** weaken anything — see the ruling below. Worth recording that the maker reported its own
first attempt at this test as vacuous and rewrote it; that self-report is accurate, and catching it
before submission is the behaviour this unit is about.

**ISS-138 (low) — FIXED.** `22 / 1`. The replacement discriminates for a real reason: `issues.jsonl`
sorts *after* `issues.alpha.jsonl`, so "canonical first" can only hold by prepending, never by the
platform's readdir order. That is precisely what the cycle-1 test lacked.

**ISS-140 (low) — FIXED, and the retraction is correct on both counts.**
`scripts/lib/tracker-audit.test.mjs` was added in `40f0666`, well before this unit — it pre-existed.
`structure.config.json` sets `dirsize.overrides.scripts = 32`, not 31, against 30 files. Both
invented constraints, both correctly withdrawn.
On the further split into `scripts/lib/ledger-union.test.mjs`: **a real seam, not another
improvisation.** I measured it rather than taking the claim — `tracker-audit.test.mjs` is 285
non-blank lines against `loc.max` 300 (`.test.mjs` matches no entry in `loc.testPatterns`, so it
gets 300, not `testMax` 400), and the 112 union lines would land it near 397. The single file was
arithmetically impossible. The division — `ledgerFiles`/`readLedgerRows` answer *what is the
ledger*, the rest tests the gates that read it — is a division of subject, and `scripts/lib` went
14 → 15 against a budget of 30. [C6] has been clarified in the contract to say so; that
clarification passes nothing, since this cycle FAILs on other grounds.

**ISS-136 (medium) — NOT FIXED, and this is the FAIL.**
The cause really was fixed: `git archive f3ded7c` reproduces the U2.4 `partial` findings and
`b6d0e89` does not. But the chain still exits 1 at the submitted commit, now on
`G1 progress.done says 39, 40 tasks are done` / `progress.percent says 65%, the rows give 67%` —
introduced by `b6d0e89`, another loop's U2.1 close-out, one commit *before* this submission.
I verified by exit code and not by reading output, and twice: in the main tree (`EXIT=1`) and in a
pristine `git archive b9159cf` extraction where `.goal/goal.json` and `TASKS.md` are exactly HEAD's
— so this is not the dirty-tree confound cycle 1 already ruled out.

The maker did **not** stop quoting the command; it quoted it in the strengthened form the issue
asked for (`>/dev/null 2>&1; echo $?`), which is the right instrument. It then reported `0` for an
instrument that returns `1`. The G1 divergence is not this unit's fault and the contract's
out-of-scope section forgives it — what it does not forgive is [I2]: an evidence line a third party
cannot reproduce at the submitted commit. Two cycles running, the one document a checker is
entitled to trust has overstated this chain. Charging a fix cycle for a paragraph is harsh; leaving
it would make the strengthened form of the evidence line worth less than the weak one.

## The three judgement calls the dispatch asked for

**1. Is `audit(root, { exec })` an acceptable seam? — Yes, plainly.** Three reasons, each checked
rather than assumed. (a) *Blast radius*: the injected value reaches exactly one call,
`git log -1 --format=%cI` inside G3; it is not a general process runner threaded through the
module. (b) *Reachability*: the only production caller is `scripts/tracker-audit.mjs:16`, which
calls `audit()` with no second argument, so the default `execFileSync` is what ships; there is no
CLI flag, env var, or config key that reaches the parameter. (c) *The specific hole you named —
a fake that always succeeds* — **cannot weaken the gate**. A stub returning success returns an
unparseable date, `headAt` stays `NaN`, and `!Number.isNaN(headAt)` skips G3: the outcome is
silence, which is exactly the pre-existing behaviour, not a manufactured pass. There is no input to
`exec` that makes G3 report "fresh" when the sweep is stale; the staleness comparison is driven by
`qa/.last-sweep` and HEAD's real timestamp. The default path is also still exercised for real by
the non-repo fixture test, which hits git's actual exit 128. If I were to push on anything it is
that nothing asserts the default *is* `execFileSync` — but that is a note, not a hole, and I am not
filing it.

**2. Is ISS-129's OPEN status honest? — Yes, and it is the most creditable line in the manifest.**
One of the two readers implements D-019; `.claude/hooks/mc-sessionstart.ps1:5` still reads
`$LEDGER = 'qa/issues.jsonl'` alone. I confirmed the hook is untouched by this cycle (`git show
--stat b9159cf` lists five files, none under `.claude/`). The gate record at
`qa/gates/ledger-shard-union-hook.md` is well-formed: it names the question in one line, the exact
change, why it needs the Approver, and two options — including the honest option B, retiring D-019
rather than leaving a union only half of its readers implement. A unit that fixes half the readers
and says so is doing the thing this whole unit is about; a unit that fixed half and claimed the
rule was implemented would be ISS-129 all over again. [C7] met.

**3. Did this cycle introduce a NEW instance of the class it is fixing — a declared behaviour with
nothing enforcing it?** In the **code**, no. I read every catch site in the touched file: `:59`
narrowed and now pinned, `:71` counts and surfaces via a G2 finding (the opposite of swallowing),
G3 narrowed and now pinned. Every behaviour this diff declares has a mutant that dies. In the
**manifest**, yes — and it is ISS-136 itself: "the chain now exits 0, verified by exit code, not by
reading" is a declared behaviour with nothing enforcing it, asserted in the very section retracting
the same mistake. That is why this is a FAIL rather than a note.

## Criteria and invariants

| id | verdict | evidence |
|---|---|---|
| C1 union resolution, deterministic order | met | `ledgerFiles` = canonical prepended + `/^issues\..+\.jsonl$/` sorted; M3/M4 both die |
| C2 G2 audits the union | met | `readLedgerRows(root)` drives G2; the shard-unverified test discriminates |
| C3 order tested discriminatingly | met | M3 22/1 |
| C4 narrowed catch tested discriminatingly | met | M1 22/1, deletion performed by me |
| C5 verified against the real repo | met | 162 rows with the real `c-unrun-writers` shard, canonical first, `ISS-C-UNRUN-WRITERS-005` visible, temp root removed |
| C6 no new file in `scripts/`, tests with their module | met | new file is in `scripts/lib`, not `scripts/`; split forced by a measured 300-line budget (see ISS-140 above) |
| C7 hook untouched + well-formed gate | met | `.claude/` absent from the commit; gate record carries question, exact change, options |
| I1 no unreported error-swallowing in the touched file | holds | all three catch sites read; two narrowed and pinned, one counting |
| **I2 evidence reproducible and outcome stated honestly** | **fails** | `lint:structure` exit 1 vs the pasted 0, twice, one in a pristine extraction |
| I3 enforcement paths / DECISIONS / contracts / ARCH §2 unmodified | holds | commit touches 5 files, none of them |

## Ledger

- ISS-137, ISS-138, ISS-139, ISS-140 → `fixed` (2026-09-08), each with my own mutation evidence appended.
- ISS-136 → stays `open`, re-check evidence appended.
- ISS-129 → stays `open`, correctly, behind `qa/gates/ledger-shard-union-hook.md`.
- ISS-141 → stays `open` (blocked behind the same gate, per cycle 1's ruling).

## What cycle 3 needs

Only this: replace the `pnpm lint:structure … echo $?` line with what the command actually returns
at your commit, and name the `progress.done` divergence as pre-existing and not yours — or run only
the linters you own and say which. No code change is required; `git archive` your own commit into a
scratch dir and run it there before pasting. If cycle 3 arrives with that paragraph corrected and
nothing else touched, it PASSes.
