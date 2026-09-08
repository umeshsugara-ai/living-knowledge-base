# Verdict — ledger-shard-union-readers

**Date:** 2026-09-08
**Mode:** A (unit check)
**Bound root:** `D:/KnowledgeBase` (main tree; sibling lane worktrees read-only)
**Commit checked:** `540f5c1`
**Cycle checked:** 3
**Contract:** `qa/contracts/ledger-shard-union-readers.md`

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 3/3 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: The single cycle-2 failure (ISS-136) is resolved. Every command the cycle-3
manifest quotes reproduces exactly in a pristine `git archive 540f5c1` extraction — 23/23
tests and `lint-loc && lint-dirsize && lint-dupes` exit 0 — and the full-chain claim that
could not be reproduced has been withdrawn rather than restated. The refusal to assert
`pnpm lint:structure`'s exit code is legitimate scoping, not evasion: I confirmed the
failure at this commit is `G1 progress.done says 39, 40 tasks are done`, sourced from
`.goal/goal.json` written by another loop's `b6d0e89`, and that the live tree now returns 0
with no code change of this unit's. The maker did not touch `.goal/goal.json` in either
cycle. ISS-129 correctly remains open behind a well-formed human gate.
```

## What I re-ran myself

Pristine extraction — `git archive 540f5c1 | tar -x` into a scratch dir, no dirty-tree
contamination — then:

```
$ node --test scripts/lib/tracker-audit.test.mjs scripts/lib/ledger-union.test.mjs
  tests 23   pass 23   fail 0   cancelled 0

$ node scripts/lint-loc.mjs && node scripts/lint-dirsize.mjs && node scripts/lint-dupes.mjs
  lint-loc: OK (272 file(s) within budget)
  lint-dirsize: OK (77 dir(s) within budget)
  lint-dupes: OK (295 unique export(s), 24 unique schema $id(s))
  SUBSTEP EXIT: 0
```

Both quoted blocks reproduce verbatim. **This is the whole of ISS-136 and it is now clean.**

### Mutation table — re-derived independently

Python harness, each run in a subprocess with a timeout, byte backup restored and asserted
byte-identical after every round (D-020). Baseline 23 pass / 0 fail / 0 cancelled.

| mutation | manifest claims | I measured |
|---|---|---|
| ISS-137 swallow non-ENOENT readdir | 22 / 1 | **22 / 1** |
| ISS-139 swallow any git failure | 22 / 1 | **22 / 1** |
| ISS-138 shards before canonical | 22 / 1 | **22 / 1** |
| read no shards at all | 19 / 4 | **19 / 4** |
| no-op control | 23 / 0 | **23 / 0** |

`restore verified byte-identical after every run.` The control is valid, so the mutants are.

### [C5] against the real repository

Copied the live lane shard (`D:/KnowledgeBase-lanes/c-unrun-writers/qa/issues.c-unrun-writers.jsonl`)
into the *sandbox* extraction — never into the bound tree — and called the module directly:

```
files: [ 'qa\issues.jsonl', 'qa\issues.c-unrun-writers.jsonl' ]
total rows read: 162 | lane rows now visible: 20
ISS-C-UNRUN-WRITERS-005 (cited by D-020) visible: true | unparseable: 0
```

Canonical first, shard second. Shard removed afterwards. (162 vs the manifest's cycle-1
figure of 155 — the canonical ledger has grown since; the lane count of 20 and the
`ISS-C-UNRUN-WRITERS-005` visibility match exactly. Not a discrepancy.)

## The ruling you asked for: scoping or evasion?

**Legitimate scoping.** Three things decide it, and none of them is the maker's word.

1. **The number is genuinely not a function of this unit's code.** At `540f5c1`, in a clean
   extraction, `node scripts/tracker-audit.mjs --gate g1` emits three findings — all of them
   `progress.total` / `progress.done` / `progress.percent` divergences read out of
   `.goal/goal.json`. `git log -- .goal/goal.json` shows its last two writers are `b6d0e89`
   and `5ac7864`, another loop's commits. The live tree today exits **0**. The same code,
   two different answers, decided entirely by a file this unit does not write.
2. **The maker did not silence it.** Evasion would look like omission. The manifest states
   in bold that the full chain is not quoted, names `tracker-audit --gate g1` as the reason,
   and explains the failure mode. [I2] asks that the outcome be stated honestly, and the
   contract's "Out of scope" already excludes pre-existing failures this unit did not cause
   *"but see [I2] on how they are reported"* — this is exactly that reporting.
3. **The alternative reading leads somewhere worse.** Requiring a unit to assert its repo's
   gate outcome would have forced one of two things here: editing another lane's in-flight
   `progress.done` to clear its own number — outside the unit's authority and the single
   most self-serving edit available to it — or pasting a number a third party cannot
   reproduce, which is precisely what ISS-136 is. The maker declined both. That is the
   correct call, and the manifest's own framing ("*a statement about a moment, not
   evidence*") is the right generalisation.

The narrow scoping is not a licence to stop reporting the chain forever; it is this unit's
correct boundary. A repo-level gate-health assertion belongs to whichever unit owns the
trackers — see the note below.

## `.goal/goal.json` — checked, not taken on trust

```
$ git show 540f5c1 --stat   →  qa/manifests/ledger-shard-union-readers.md  (1 file, 54+/4-)
$ git show b9159cf --stat   →  manifest + scripts/lib/ledger-union.test.mjs
                               + scripts/lib/tracker-audit.mjs + tracker-audit.test.mjs
                               + scripts/lint.test.mjs  (5 files)
$ git log --oneline -- .goal/goal.json  →  5ac7864, b6d0e89, 48beec0, …
```

Neither the cycle-2 nor the cycle-3 commit touches `.goal/goal.json`, and neither appears in
that file's history. **The claim is true.** Worth saying plainly: the maker had a one-line
edit available that would have turned its own red evidence green, knew it, named it, and
did not make it. That is the behaviour this contract's [I2] exists to produce.

## Criterion-by-criterion

| | verdict | evidence |
|---|---|---|
| [C1] | ✅ | `ledgerFiles()` — canonical prepended, `readdirSync` filtered on `/^issues\..+\.jsonl$/` and `.sort()`ed. Deterministic order demonstrated above. |
| [C2] | ✅ | G2 (`tracker-audit.mjs:141-149`) calls `ledgerFiles`/`readLedgerRows`, not the canonical path. Union row count 162 vs canonical 142. |
| [C3] | ✅ | Discriminating: shards-before-canonical → 22/1. The test holds only because the canonical file is *prepended* (`issues.jsonl` sorts after `issues.alpha.jsonl`). |
| [C4] | ✅ | `if (err?.code !== "ENOENT") throw err;` — reverting it → 22/1, pinned by a `qa`-as-regular-file `ENOTDIR` case. |
| [C5] | ✅ | Real-repo run above; shard removed afterwards. |
| [C6] | ✅ | Tests live in `scripts/lib/` beside the module. The split into `ledger-union.test.mjs` is budget-forced and **measured**: `tracker-audit.test.mjs` is 310 raw / 285 non-blank against `loc.max` 300, and `lint-loc` passes at exactly that. The seam (*what is the ledger* vs *the gates that read it*) is a division of subject. Satisfies the cycle-2 amendment. |
| [C7] | ✅ | `.claude/hooks/mc-sessionstart.ps1` untouched (absent from both diffs). `qa/gates/ledger-shard-union-hook.md` names the question, the exact change ("ledger path resolution only — nothing else"), and three options incl. the honest decline. Unanswered, correctly. |
| [I1] | ✅ | All three catches in the file re-read: `:54` ENOENT-narrowed, `:158` narrowed to git exit 128 / ENOENT, `:71` counts `unparseable` and surfaces it as a G2 finding — the opposite of swallowing. Nothing of the ISS-129 class left standing. |
| [I2] | ✅ | Every quoted command reproduced at `540f5c1`. The one non-reproducible claim was withdrawn with its reason. |
| [I3] | ✅ | `.claude/hooks/*`, `docs/DECISIONS.md`, `contracts/`, `ARCHITECTURE.md` all absent from both commits' diffs. |

## ISS-129 — the unit claims no more than it delivered

Confirmed: ledger row `ISS-129` is **open**, the manifest says "**ISS-129 stays open**" in
both the cycle-2 and cycle-3 sections, the gate record is unanswered, and the hook still
reads `qa/issues.jsonl` alone. One of two readers implements D-019, which is exactly what
the manifest says. No over-claim. ISS-130 likewise stays open and is described as
half-addressed. This PASS certifies the script reader and the gate record — **not** D-019
being fully implemented.

## Non-blocking notes (for a later unit, not findings against this one)

None of these is blocking; nothing here would have changed the verdict.

- **The repo's gate outcome now has no owner.** This unit correctly declines to assert
  `pnpm lint:structure`'s exit code, and it was right to. But the consequence is that a
  chain which is red at one commit and green at another is nobody's assertion. The real
  remedy is not a manifest paragraph: it is that `G1` reads a tracker any lane may write, so
  its exit code is shared mutable state. A unit that owns `.goal/goal.json` consistency — or
  a rule that `--gate g1` findings sourced from another lane's counters are warnings, not
  exit-1 — would close it. Worth a `qa/QUEUE.md` row; I have not written one.
- **Manifest gap 3 (no reader-completeness guard) stands, and I am not requiring it.** The
  contract explicitly puts it out of scope, for a reason cycle 1 already ruled on: such a
  guard cannot be written while one reader is legitimately unfixed behind a human gate. When
  the hook gate is answered, that guard becomes writable and should be the unit that follows.
- **Manifest header line 3 still reads `**Contract:** none yet — checker, please author…`.**
  It was true in cycle 1 and the contract has existed since. Cosmetic staleness in a header,
  not an evidence defect.

## Ledger

- `ISS-136` → **fixed**, `verified_date` 2026-09-08 (re-derived at `540f5c1` by pristine
  extraction; both quoted blocks reproduce).
- `ISS-137`, `ISS-138`, `ISS-139`, `ISS-140` → **verified** (fixed in cycle 2, re-confirmed
  this cycle by my own mutation table — the later re-check that moves `fixed → verified`).
- `ISS-129`, `ISS-130` stay **open**.

No new issues. `ISSUES-WRITTEN: none`.
