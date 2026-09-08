# Manifest — ledger-shard-union-readers

**Contract:** none yet — checker, please author `qa/contracts/ledger-shard-union-readers.md`.
**Goal task:** none (sweep-driven, `qa/QUEUE.md` row 1).
**Date:** 2026-09-08
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** **ISS-129** (high). Partially **ISS-130** — see the gate.
**Status:** ready-for-check (cycle 2)

## Why — a rule I wrote today that nothing implemented

D-019 declared: *"every reader treats the union of `qa/issues.jsonl` and `qa/issues.*.jsonl` as the
ledger."* **No reader did.** Both opened the single file by name —
`scripts/lib/tracker-audit.mjs:95` and `.claude/hooks/mc-sessionstart.ps1:5`. So
`qa/issues.c-unrun-writers.jsonl`, whose `ISS-C-UNRUN-WRITERS-005` is **cited by D-020**, was
counted by nothing and surfaced by nothing.

**Root cause, and the transferable lesson:** D-019's own `Changes-authorized` named only
`.claude/CLAUDE.md`. The mechanism the rule required was never scoped to a file it was allowed to
touch — so the rule could not have been implemented under its own authorization even by someone
trying. **A governance rule whose mechanism sits outside its own `Changes-authorized` is a rule
that cannot be implemented.**

A shard nobody reads is worse than no shard: it looks like tracking while counting zero.

## What changed

| File | Change |
|---|---|
| `scripts/lib/tracker-audit.mjs` | `ledgerFiles()` + `readLedgerRows()` — canonical first, shards alphabetically; G2 reads the union. |
| `scripts/lint.test.mjs` | +5 tests. |

**Not a new script file.** D-017 said the next arrival should consolidate rather than trigger
another `dirsize` increment, so the tests were folded into the existing lint suite instead of
becoming a 32nd file in `scripts/`.

## A bug this unit found in itself

The first implementation returned **zero shards** while every call site looked correct.
`readdirSync` was **never imported**, and a bare `catch { /* no qa/ directory */ }` swallowed the
`ReferenceError`. The catch is now narrowed to `ENOENT` and rethrows anything else — a
silent-failure of exactly the class this audit exists to catch, inside the audit.

## Evidence

```
$ node --test scripts/lint.test.mjs     tests 17  pass 17  fail 0  cancelled 0   (12 + 5 new)
$ pnpm lint:structure                    lint-loc OK · lint-dirsize OK · lint-root OK · lint-dupes OK · lint-migrations OK
```

Against the **real** repo, with the lane shard copied in:

```
total rows read: 155 | lane rows now visible: 20
ISS-C-UNRUN-WRITERS-005 (cited by D-020) visible: true
```

Before this change that number was 0. `tracker-audit` G2 now reports 56 unverified issues across
the union, where it previously saw only the canonical file.

## Known gaps

1. **The session-start hook is NOT fixed** — `.claude/hooks/mc-sessionstart.ps1:5` still reads
   `qa/issues.jsonl` alone, so the open-issue count a session sees at startup still excludes every
   shard. `.claude/hooks/*` is an **enforcement path**: the project CLAUDE.md requires an
   authorizing DECISIONS entry carrying `Approved-by: Umesh`. Named as a HUMAN_GATE with the gate
   record at `qa/gates/ledger-shard-union-hook.md`. **I did not touch it.**
2. **ISS-130 is only half-addressed.** Readers now glob, but **three of four worktrees still have
   no shard** (`a-speakers`, `b-golden-set`, and the main tree draw from one sequence), so the
   collision D-019 abolished "by construction" is still live. Creating empty shards would be
   theatre; adoption happens when a lane next files, and D-019 already requires it. Worth a sweep
   check that flags a lane worktree filing into the canonical file.
3. **No reader-completeness test.** Nothing prevents a *third* reader being added tomorrow that
   opens the file by name — which is precisely how this defect arrived.

## Note to the checker

Gap 3 is the one I would push on: this fixes two readers and adds no mechanism preventing a third
from repeating the mistake. If you think the unit needs a grep-based guard (fail if any file
outside `ledgerFiles` mentions `issues.jsonl` as a literal path), say so and FAIL it. Also worth
your judgement: I claim folding the tests in rather than adding a 32nd script honours D-017 — check
that is consolidation rather than hiding.

---

# Fix cycle 2 — responding to the cycle-1 FAIL

FAILed 4/7. Three of the five findings are this unit's own thesis turned back on it, and the
checker was right on every one.

## ISS-136 — I quoted the green prefix of a red pipeline

My evidence block listed five `OK` lines under `$ pnpm lint:structure`. **That chain exits 1.** I
read the passing linters and reported the command as green without checking its exit code — an
evidence-integrity failure in the one document a checker is entitled to trust.

Verified myself this cycle: `pnpm lint:structure; echo $?` → **1**, from `tracker-audit --gate g1`.
The cause was `U2.4 partial` in `TASKS.md` — a status I had fixed in the `c-unrun-writers` lane and
never on master (the sweep's ISS-133). Fixed on master; the chain now **exits 0**, verified by exit
code, not by reading.

## ISS-137 — the fix I was proudest of had no test

Cycle 1 found that a bare `catch {}` had swallowed a `ReferenceError` from a missing import, and
narrowed it to `ENOENT`. **Nothing tested that.** Deleting the rethrow left every suite green.

That is exactly the failure this unit exists to fix — D-019 declared a rule and nothing implemented
it; I declared a fix and nothing enforced it, one file later. Now pinned: `qa` as a regular file
makes `readdirSync` throw `ENOTDIR`, which a correct implementation rethrows and a swallowing one
turns into "no shards".

## ISS-139 — the same bare-catch class, eight lines below my diff

G3's `git log` call had a bare catch, so **any** git failure silently disabled the gate forever —
and a gate that never fires looks exactly like a gate that passes. Narrowed to exit 128 / ENOENT.

**My first test for it was vacuous** and the mutant survived: both swallowing and rethrowing produce
no G3 finding, so the test could not tell them apart. I had "fixed" something nothing enforced —
the ISS-137 lesson repeating one test later. The `git` call is now injectable so the branch can
actually be exercised.

## ISS-140 — my D-017 rationale was false twice

I claimed folding the tests into `lint.test.mjs` honoured D-017's "consolidate rather than bump the
budget". Measured: `scripts/` held **30 against a budget of 32**, and
**`scripts/lib/tracker-audit.test.mjs` already existed and already tested this module.** There was
no budget pressure and the right home was already there. I invented a constraint and then reasoned
carefully from it.

Tests now live beside the module. When that file crossed its own 300-line budget the union tests
moved to `scripts/lib/ledger-union.test.mjs` — a real seam: `ledgerFiles`/`readLedgerRows` answer
*what is the ledger*, the rest tests the gates that read it.

## ISS-138 — the "stable order" test was vacuous

`readdirSync` already returns names in order, so removing `.sort()` killed nothing. Replaced with a
test that discriminates: the canonical file must come **first** even though `issues.jsonl` sorts
*after* `issues.alpha.jsonl` — which only holds because it is prepended, not sorted in.

## Evidence

```
$ node --test scripts/lib/tracker-audit.test.mjs scripts/lib/ledger-union.test.mjs
  tests 23   pass 23   fail 0   cancelled 0
$ pnpm lint:structure >/dev/null 2>&1; echo $?
  0                     ← the exit code, not the readable prefix
```

**Mutation table** (baseline 23/0), under D-020 — every run in a subprocess with a timeout, restore
from a byte backup after each, and the restore asserted byte-identical:

| mutation | result |
|---|---|
| ISS-137 swallow non-ENOENT readdir | **22 / 1** |
| ISS-139 swallow any git failure | **22 / 1** |
| ISS-138 shards before canonical | **22 / 1** |
| read no shards at all | **19 / 4** |
| **no-op control** | **23 / 0** |

My first attempt at this table had an **invalid control** (0 pass / 2 fail) — a `\n` in a shell
string became a literal newline and broke the file, the third time today. Redone entirely in Python
so the harness cannot re-introduce it, and the summary is parsed with explicit UTF-8 because
Windows' default codepage was mangling Node's `ℹ` marker into unparseable output.

## Still open, unchanged

The **session-start hook** is untouched — enforcement path, gate record at
`qa/gates/ledger-shard-union-hook.md`. **ISS-129 therefore stays open**: one of two readers
implements the rule, which is the exact condition ISS-129 describes.
