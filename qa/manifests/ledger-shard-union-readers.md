# Manifest — ledger-shard-union-readers

**Contract:** none yet — checker, please author `qa/contracts/ledger-shard-union-readers.md`.
**Goal task:** none (sweep-driven, `qa/QUEUE.md` row 1).
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-129** (high). Partially **ISS-130** — see the gate.
**Status:** ready-for-check

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
