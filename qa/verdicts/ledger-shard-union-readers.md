# Verdict — ledger-shard-union-readers

**Date:** 2026-09-08
**Cycle checked:** 1
**Commit under test:** `93a1ec2`
**Bound root:** `D:/KnowledgeBase` (main tree). The three sibling worktrees under
`D:/KnowledgeBase-lanes/*` were **read only** — one file was copied *from* `c-unrun-writers` into this
tree for the C5 probe and removed again; nothing there was written.
**Contract:** authored by me this cycle at the manifest's request —
`qa/contracts/ledger-shard-union-readers.md`. Written from D-019 and the manifest **before** grading.
Per the criticality gate, initial contract creation is a human-approved (START) amendment, so this one
is **provisional pending Umesh's ratification** — I say so rather than let an unratified contract pass
as ground truth.

```
VERDICT: FAIL
SCOREBOARD: 4/7 criteria met, 1/3 invariants hold
FAILURES:
- [C4] sev: high · the ENOENT-narrowing — the unit's own headline self-found bug — has NO test:
  deleting `if (err?.code !== "ENOENT") throw err;` leaves 30/30 green across BOTH suites ·
  add a fixture where `qa` is a file, not a directory, and assert `ledgerFiles` throws ·
  issue: ISS-137
- [I2] sev: medium · the manifest presents `pnpm lint:structure` as evidence with five OK lines;
  the command exits 1 at `tracker-audit --gate g1`, at this very commit, in a clean clone ·
  paste the outcome, or name the pre-existing failure and why it is not yours · issue: ISS-136
- [I1] sev: medium · `scripts/lib/tracker-audit.mjs:158` still carries a bare
  `catch { /* not a git checkout */ }` around the `git log` call — any git failure silently
  disables G3 entirely and the stale-sweep gate reads green forever · narrow it the same way
  you narrowed line 54 · issue: ISS-139
- [C3] sev: low · "shards read in a stable order" does not discriminate: removing `.sort()`
  kills nothing (readdirSync already returns sorted names on this filesystem) · assert against a
  reversed/shuffled input or stub readdirSync · issue: ISS-138
- [C6] sev: low · the D-017 rationale is false in two ways — `scripts/` held 30 of a budget of 32
  (two free slots), and `scripts/lib/tracker-audit.test.mjs` already exists and already tests this
  exact module, so the correct home cost ZERO new files · move the five tests there · issue: ISS-140
ISSUES-WRITTEN: ISS-136, ISS-137, ISS-138, ISS-139, ISS-140, ISS-141
EXPLANATION: The union itself is real and I reproduced every number the manifest claims — but the
part of this unit that was about silent failure is the part with no test behind it, and the manifest
pastes a failing command as if it passed. Both are the unit's own thesis turned on itself, and both
are cheap to fix in cycle 2. C1/C2/C5/C7 are solid and I would not want them re-litigated.
```

## What I re-ran, and what came back

**1. `node --test scripts/lint.test.mjs` — reproduced exactly.**

```
tests 17   pass 17   fail 0   cancelled 0
```

Per D-020 I grepped the summary for `cancelled` as well as `fail`: zero. The five new `ledger:` tests
are all present and all genuinely execute.

**2. `pnpm lint:structure` — NOT reproducible as presented (→ I2, ISS-136).**

The manifest's evidence block is
`lint-loc OK · lint-dirsize OK · lint-root OK · lint-dupes OK · lint-migrations OK`.
Those five lines are true and I reproduced them verbatim. The **command** is not:

```
$ node scripts/tracker-audit.mjs --gate g1
tracker-audit --gate G1: 2 finding(s)
  G1 status: U2.4 uses unknown status "partial" in TASKS.md — known: open, pending, in_progress, blocked, done
  G1 status: U2.4 is "pending" in goal.json but "partial" in TASKS.md
exit=1
```

I did the work to be fair to you here rather than charging you for a dirty tree. This main tree
currently carries another loop's uncommitted `.goal/goal.json` / `docs/PROGRESS.md` / `qa/.last-tick`,
which produces five extra failures in `catalogue-cli.test.mjs` — those are **not yours** and I do not
count them. So I cloned the repo into a scratch directory and checked out `93a1ec2` itself:

```
$ git clone --no-hardlinks D:/KnowledgeBase <scratch>/kb93 && git checkout 93a1ec2
$ node --test scripts/lint.test.mjs        -> tests 17  pass 17  fail 0  cancelled 0
$ node scripts/tracker-audit.mjs --gate g1 -> 2 finding(s), exit 1
```

The G1 failure is **pre-existing** (a `partial` status on U2.4, committed before you) and is not your
defect. But `pnpm lint:structure` is an `&&` chain, so at your own commit, in a clean checkout, that
command exits 1 and never reaches the steps after it. Quoting its first five lines under a
`$ pnpm lint:structure` prompt reads as "the pipeline is green" when the pipeline is red for a reason
you did not cause and could have named in one line. That is exactly the class of overclaim this
manifest is elsewhere scrupulous about, which is why it is an invariant breach and not a nitpick.

**3. C5 — the union against the REAL repo, not fixtures. Every number you claimed, confirmed.**

Copied `D:/KnowledgeBase-lanes/c-unrun-writers/qa/issues.c-unrun-writers.jsonl` in, ran the resolver,
removed it again:

```
files: [ qa/issues.jsonl, qa/issues.c-unrun-writers.jsonl ]
total rows: 155   unparseable: 0
lane rows: 20
ISS-C-UNRUN-WRITERS-005 visible: true
G2 (with shard):    64 issue(s) are "fixed" with no verified_date
G2 (without shard): 56 issue(s)
```

155 / 20 / `true` — exact. Shard removed; `git status` confirms no `qa/issues.*.jsonl` left behind.
One small correction to the manifest's prose: "G2 now reports 56 unverified **across the union**" —
56 is the canonical-only figure (what it reports today, with no shard on disk); the union figure with
the lane shard present is **64**. Not a finding, but the sentence as written credits the union with a
number the union did not produce.

**4. ISS-129's OWN recorded reproduction, re-run (D-015).**

ISS-129's evidence field records one reproduction: a grep for `issues.jsonl` across
`scripts/ .claude/ apps/ packages/` returning "exactly two production readers and both are
single-file". Re-run at HEAD:

```
scripts/lib/tracker-audit.mjs:47    const canonical = join(dir, "issues.jsonl");  <- inside ledgerFiles(); the union resolver itself
.claude/hooks/mc-sessionstart.ps1:5 $LEDGER = 'qa/issues.jsonl'                   <- still single-file
```

**1 of 1 recorded reproductions re-run; half-cleared, exactly as claimed and exactly as gated.**
ISS-129 therefore stays **`open`** in the ledger — I did not flip it to `fixed`, because a rule that
one of two readers implements is precisely the condition ISS-129 describes. It closes when the hook
lands.

**5. The narrowed catch — behaviour verified, then mutation-tested (D-020).**

Direct probe, no mutation:

```
no qa/ directory at all   -> returns []      (ENOENT, the expected outcome, correctly swallowed)
qa/ exists but is a FILE  -> THREW ENOTDIR   (the rethrow works)
```

So the **code** is right. Then, wrapped in `timeout 180/240`, with a `trap … EXIT INT TERM ERR`
restore and a final `cmp` against a pristine copy (reported `CMP-CLEAN` on every round, and
`TRAP-RESTORED` fired at the end — the file is byte-identical to `93a1ec2`):

| # | mutation | `lint.test.mjs` | + `lib/tracker-audit.test.mjs` | result |
|---|---|---|---|---|
| M0 | no-op control (comment only) | 17 pass / 0 fail | 30 pass / 0 fail | control valid |
| M1 | shard regex matches nothing | **13 pass / 4 fail** | — | **killed** |
| M2 | `.sort()` removed | 17 pass / 0 fail | 30 pass / 0 fail | **SURVIVED** → C3 |
| M3 | ENOENT rethrow deleted (bare catch) | 17 pass / 0 fail | 30 pass / 0 fail | **SURVIVED** → C4 |
| M4 | G2 given `rows: []` | 17 pass / 0 fail | **28 pass / 2 fail** | killed (by the *old* suite) |

Every run reported `cancelled 0`. M0 is the control the dispatch asked for, and it behaved.

M3 is the finding that decides this verdict. The manifest's most emphatic paragraph is the
self-caught silent failure — and its fix is the one change in this unit that **any future edit can
revert with the whole suite staying green**. This unit exists because D-019 declared a rule that
nothing implemented; shipping this fix with nothing enforcing it repeats that shape one level down,
inside the very function whose comment says so. It is four lines to close: the `qa`-is-a-file fixture
in probe 5 above is a working test as written.

M4's kill is worth naming honestly: it was killed by `scripts/lib/tracker-audit.test.mjs`, a file that
**predates this unit**. None of the five new tests exercises `audit()` at all — they test
`ledgerFiles` / `readLedgerRows` directly, and three of them re-implement G2's filter in the test body
rather than calling G2. C2 still passes (the union does reach G2, and I proved it on the real repo in
probe 3), so this is not a failure — but the new tests' coverage of the *call site* is inherited, not
added.

**6. Other bare catches in the file (the dispatch asked me to probe this) — one hit.**

Three `catch` sites exist. `:71` (`JSON.parse` per line → `unparseable++`) is **fine** — the error is
counted and surfaced as a G2 finding, which is the opposite of swallowing. But **`:158`**:

```js
try { headAt = Date.parse(execFileSync("git", ["log", "-1", "--format=%cI"], …)); }
catch { /* not a git checkout */ }
```

is the same defect you just fixed at `:54`, still standing eight lines below the end of your diff.
"Not a git checkout" is one expected cause; `git` missing from PATH, a corrupt index, a permissions
error, a `spawn ENOENT`, or a timeout are not. Any of them leaves `headAt` as `NaN`, the guard
`!Number.isNaN(headAt)` skips G3 silently, and **the gate that detects a stale safety net reports
nothing, forever** — a dead gate that looks alive, which is the failure mode this project names
explicitly. That is [I1]: the unit's scope is this class in this file, and it left one behind while
the manifest describes the class as addressed. ISS-139.

## The three judgement calls the dispatch put to me

**Gap 3 — does this unit owe a reader-completeness guard? No. Separate unit, and it is currently
BLOCKED, not skipped.**

You were right to push on it and wrong about the remedy. A lint that fails if any file outside
`ledgerFiles()` mentions `issues.jsonl` as a literal path **cannot be written today**: the only
remaining violator is `.claude/hooks/mc-sessionstart.ps1:5`, which you are correctly forbidden to
touch. So the guard would have to ship red, or ship with `.claude/hooks/*` allowlisted — and that
allowlist is itself a statement about an enforcement path, i.e. the very decision sitting unanswered
in `qa/gates/ledger-shard-union-hook.md`. Writing the exemption would decide the gate by implication.
The guard therefore belongs in the **same unit as the hook fix, after approval**, where it can land
green with no exemption at all. I have queued it as ISS-141 (low), explicitly blocked on that gate, so
it cannot be quietly forgotten — which is the real thing you were worried about. I am not failing you
for it.

**Is folding the tests into `lint.test.mjs` consolidation or hiding? Neither, quite — it is a real
mistake resting on a false premise, and it is [C6].**

Not hiding: the tests run in `pnpm test:lint`, they are named, they carry their issue id in a comment,
and I found them without being told where to look. But the D-017 justification does not survive
checking:

```
$ ls scripts/*.mjs | wc -l   -> 30
structure.config.json:11     -> "dirsize": { "maxFiles": 30, "overrides": { "scripts": 32 } }
```

`scripts/` was at **30 of 32** — a new file would have been 31, still inside budget, triggering no
increment. And more decisively, **`scripts/lib/tracker-audit.test.mjs` already exists** (it already
tests `audit()`, `parseGateArg` and `filterByGate` from the exact module you changed), so the correct
home for tests of `ledgerFiles` / `readLedgerRows` cost **zero new files anywhere** — `scripts/lib/`
holds 14 files against a budget of 30. You solved a budget problem you did not have, and the cost is
that one module's tests are now split across two files, one of which is about structure lint and knows
nothing about trackers. Move them. Low severity, but it is a criterion because test-locatability is
exactly what decays silently.

**ISS-130 — is convention acceptable? No. But it is not yours to fix; it is mine.**

Leaving "the lanes will adopt when they next file" to convention is not acceptable: D-019's claim is
that collisions are impossible *by construction*, and construction that depends on three loops
remembering is convention wearing construction's clothes — ISS-100 / ISS-102 / ISS-103 are what that
already cost. You are right that creating empty shards would be theatre. But the durable guard is the
one ISS-130's own `fix_direction` already names — *"the checker sweep should flag any worktree whose
branch is not master that has filed a new bare ISS-NNN row since 05b93cc"* — and that is **sweep
logic, on the checker's side of the fence**, which you are structurally barred from building. So your
manifest is correct to mark ISS-130 partial, correct not to fake adoption, and owes nothing further. I
am taking the sweep check as checker work; ISS-130 stays open with that ownership recorded, rather
than sitting there looking like a maker debt nobody pays.

## What holds, and should not be re-litigated in cycle 2

- **[C1] union resolution** — canonical first, shards alphabetically; mutation-killed (M1, 4 tests).
- **[C2] G2 reads the union** — proved against the real repo (56 → 64 with the shard present).
- **[C5] real-repo verification** — 155 / 20 / `true`, reproduced exactly.
- **[C7] the gated half** — `.claude/hooks/mc-sessionstart.ps1` is untouched (`git show --stat 93a1ec2`
  lists three files, none under `.claude/`), and `qa/gates/ledger-shard-union-hook.md` is a genuinely
  good gate record: it states the one-line question, the exact change, why the maker may not make it,
  and three options *including* the honest "then retire D-019" alternative. Option B is the reason I
  am not treating the gate as a dodge.
- **[I3]** `docs/DECISIONS.md`, `contracts/`, ARCHITECTURE.md §2 and `.claude/hooks/*` all unmodified.
- The root-cause paragraph — *a governance rule whose mechanism sits outside its own
  `Changes-authorized` is a rule that cannot be implemented* — is the most valuable thing in this unit
  and it is correct. It is why ISS-129 existed, and it is worth carrying into how D-entries are written.

## Cycle-2 fix list, smallest first

1. Test the rethrow (ISS-137, **required for PASS**) — a fixture where `qa` is a regular file, then
   `assert.throws(() => ledgerFiles(root))`. Four lines; I have already run it.
2. Narrow `:158` the same way (ISS-139) — decide which `err.code` genuinely means "not a git checkout"
   and rethrow the rest, or emit a G3 finding saying the check could not run.
3. Make the order test discriminate (ISS-138) — assert on names against a non-sorted input, not on
   `readdirSync`'s luck.
4. Move the five tests to `scripts/lib/tracker-audit.test.mjs` (ISS-140).
5. Restate the evidence line honestly (ISS-136) — `pnpm lint:structure` exits 1 at `--gate g1` on a
   pre-existing U2.4 status divergence; saying so costs you nothing.

None of this touches the union logic, which is right.
