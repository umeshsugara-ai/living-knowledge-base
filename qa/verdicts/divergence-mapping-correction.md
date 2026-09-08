# Verdict — divergence-mapping-correction

**Cycle checked:** 1
**Date:** 2026-09-09
**Commit under check:** `e34ddce`
**Bound root:** `D:/KnowledgeBase`
**Contract:** none exists for the gate corpus. See "Contract question" below — I am **not** creating one.
**Mode:** A (unit check), fresh context, no access to the maker's reasoning.

---

## VERDICT: PASS

**SCOREBOARD: 8/8 verification items met, 3/3 invariants hold**

Invariants held: (I-a) no id renumbered in `qa/issues.jsonl`; (I-b) the gate's original table
preserved byte-intact per D-019; (I-c) no row other than the two claimed was semantically changed.

---

## The adjudication the dispatch asked for

The maker claims the previous Mode B sweep got **both** of its proposed corrections wrong. I
re-derived all three points from `qa/issues.jsonl`, from the originating commits, and from the lane
worktrees, using **my own script** (not the maker's module) so the result is not a re-run of the
thing under test.

### 1. `ISS-093 -> ISS-104` — **the maker is right, the sweep is wrong.**

Commit `2a44b7e` ("checker: FAIL speaker-verbatim-token-boundary (cycle 2) + ISS-093/094") allocated
`ISS-093` with the title:

> The cycle-2 naming-cue rule does not close C2b: a cue phrase adjacent to ANY capitalised non-name
> still ships a fabricated person. 20/20 checker attacks resolved, incl. person:everyone from
> "Welcome Everyone to the session."

Master's `ISS-104` at `e34ddce` carries that title **character-for-character**. The mapping is
evidenced, not "unevidenced". The sweep compared the gate table's *paraphrase* ("the 20-case
fabrication corpus") against ISS-104's *title* and concluded they were different findings. They are
one finding described two ways — the maker's diagnosis of the sweep's error is itself correct.

A complication the maker did not mention, which strengthens rather than weakens its case: `ISS-093`
was allocated **twice** on different branches — also at `a1fa870` (golden-set lane) as *"the
golden-set post-filter's pin criterion ... is near-arbitrary in practice"*. That second allocation
is the id's meaning on master and is exactly what the gate's original table records in its middle
column. Restricting the derivation to `speaker` checker commits is what disambiguates them, and it
does so correctly.

### 2. `ISS-097 -> ISS-108` — **the maker is right; the sweep inverted it.**

Master `ISS-108`:

> One of the four "gazetteer-class, unreachable by pattern" residues is in fact reachable by
> pattern: "English speaking students may apply." ships person:english ...

That is lane-A's `ISS-097` — the gate's own original table names lane ISS-097 as *"English speaking
students"*. The sweep called ISS-108 "the gazetteer-reachability residue, an unrelated finding":
the residue **is** the finding, not an unrelated one. Its proposed replacement `ISS-097 -> ISS-111`
is wrong on the other half too — master `ISS-111` is *"The test that claims to pin the `speaking`
branch's fall-through does not exercise it"*, which belongs to lane `ISS-100`, not `ISS-097`.

So the sweep's correction would have deleted the one row the table had right and substituted a
wrong one. The maker's claim that transcribing it would have made the record worse is **verified**.

### 3. `ISS-101` / `ISS-111` "byte-identical" — **the maker is right on the letter; the sweep was right on the substance.**

Directly measured at `e34ddce`:

```
byte-identical titles?                       false
identical after stripping " [RENUMBERED"?    true
ISS-101 carries the [RENUMBERED ...] suffix: true
ISS-111 carries it:                          false
```

The sweep's word "byte-identical" is false. But this was an *observation*, not one of its two
proposed corrections, and its conclusion — that these are duplicate rows for one finding, left
behind by the gate's own row-1 remedy — is correct and the maker adopts it. The maker's manifest is
precise about this distinction ("both of its proposed **corrections**"), and that precision holds.

**Net: the maker overturns the checker on both proposed corrections, and I uphold the maker on all
three points.** This is a maker correctly overruling a sweep, and the reason it can be trusted is
that it stopped arguing from careful reading and produced a derivation instead.

### Independent verification of the whole table

Not just the disputed rows. My own script rebuilt the ledger union at `e34ddce`
(`qa/issues.jsonl` + `qa/issues.c-unrun-writers.jsonl`), walked every commit that ever touched
`qa/issues.jsonl` on any branch, recorded each id's first allocation per commit, filtered to
`speaker` commits, and asserted canonical-title identity against the claimed target:

```
ISS-091 -> ISS-102: VERIFIED      ISS-097 -> ISS-108: VERIFIED
ISS-092 -> ISS-103: VERIFIED      ISS-098 -> ISS-109: VERIFIED
ISS-093 -> ISS-104: VERIFIED      ISS-099 -> ISS-110: VERIFIED
ISS-094 -> ISS-105: VERIFIED      ISS-100 -> ISS-101/ISS-111: VERIFIED
ISS-095 -> ISS-106: VERIFIED      ISS-102 -> ISS-114: VERIFIED
ISS-096 -> ISS-107: VERIFIED      ISS-103 -> ISS-115: VERIFIED

12/12 claimed pairs independently verified by title identity
```

The gate's corrected table is correct, and the claim that the original recorded four of twelve
displacements is correct.

---

## The requested verification items

### V1. `node --test scripts/lib/id-divergence.test.mjs` — re-run by me

```
tests 9 | suites 0 | pass 9 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 1284.5
```

**Explicitly: `cancelled 0`.** No test timed out behind a green `fail 0`.

### V2. The 9 tests are non-vacuous — mutation-tested

Per D-020: worktree-scoped path, byte backup taken first, `timeout 120` on every run, restore in a
trap firing on `EXIT INT TERM ERR`, each restore verified by `cmp` **and** SHA256 against the
baseline `fc47cc90d15e0039ac1650f1a6245e7cd8add49da0e93a9fad7efdb76c191d02`.

| Mutant | Result |
|---|---|
| **CONTROL** — no-op comment insertion | **rc=0 (green)** — the harness is not killing everything |
| M1 `canonicalTitle` stops stripping the `[RENUMBERED` suffix | rc=1, **3 tests red** |
| M2 ignore the parent-commit allocation check | rc=1, red |
| M3 `duplicated` collapsed to `displaced` | rc=1, red |
| M4 `absent` branch dropped (finding silently discarded) | rc=1, red |
| M5 always report divergent | rc=1, red |
| M6 union reads the canonical file only, not lane shards | rc=1, **1 test red (the D-019 union test, and only that one)** |
| M7 `rowsAt` rethrows instead of returning empty | rc=1, red |
| M8 `checkerCommits` drops the `checker:` filter | rc=1, red |

**8/8 mutants killed, control green, file restored SHA256-identical after every run.** The two
spot-checks confirm the kills are *specific*, not blanket crashes: M6 reddens exactly the union test
(pass 8 / fail 1); M1 reddens exactly the suffix test, the `duplicated` test and the real-repo test
(pass 6 / fail 3). The suite is genuinely load-bearing, including the 8 injected-`exec` tests.

### V3. Gate diff is additions-only

`git diff e34ddce~1 e34ddce -- qa/gates/ledger-id-divergence.md`: **68 insertions, 0 deletions.**
Every hunk line is a `+`. Not one line of the original gate — including the wrong original table and
the sweep's wrong corrections — was removed or altered. **D-019 satisfied.**

### V4. Nothing renumbered; the `duplicate_of` flag is contained

Parsed both ledger versions and compared row-by-row:

```
rows old 143, new 143
id sequence identical: true
duplicate ids: none
semantically changed rows: 2
  ISS-111  duplicate_of: undefined -> "ISS-101";  note: (added, cites ISS-132 and D-019)
  ISS-132  status: "open" -> "fixed"
```

**No renumbering. No other row's meaning changed.** The `duplicate_of` flag touched exactly one row.
`ISS-132` (the issue this unit addresses) is correctly moved to `fixed` and the fix is real — I
re-derived it above rather than trusting the flag.

### V5. `pnpm lint:structure` — exit 0

12/12 structure tests pass, `tracker-audit: OK (gate G1)`, dependency-cruiser clean
(301 modules, 918 dependencies, no violations).

### V6-V8. Manifest claims vs reality

The manifest's "Actual outputs" reproduce under my own re-run. The `What changed` table is accurate
**except** for one undisclosed change — see ISS-144 below.

---

## The four Known Gaps, judged on the merits

The maker invites a FAIL on gap 3. I have judged it on the argument, not the invitation, and it does
not earn one.

**Gap 3 — "nothing re-runs this; the gate's table is still a hand-pasted copy."** The maker's thesis
is that hand-maintained records rot silently, and it is right. But the remedy shipped is not "a
second careful reading". The twelve pairs are pinned in `id-divergence.test.mjs`, which runs in the
suite: if the ledger changes, or the derivation changes, **the test goes red**. The failure mode
this unit exists to kill is *silent* rot, and silent rot is now impossible without someone
deliberately editing the pinned expectation. That is a real, enforced improvement, and it is the
same pin-test pattern this repo uses elsewhere.

What genuinely remains is narrower than the maker states: the pinned truth lives in the **test**,
and the gate file holds a **copy** of it, so those two can drift from each other — the gate table
could be corrupted with the suite still green. That is a residual gap, not a failed unit. Under this
repo's severity gate it is a **medium**: the gate file is a historical record whose own header says
it "blocks nothing today", and the authoritative derivation is one command away. Filed as **ISS-145**,
to be verified inside the next unit that touches the gate. The maker's stated reason for not wiring
it into `lint:structure` — that the gate is shared mutable state a sweep already flagged as
ownerless — is a defensible deferral, disclosed rather than hidden.

FAILing a unit whose disclosed limitation is a medium-severity residual, when its stated objective
(correct the record, and make the correction derivable) is fully met and independently verified,
would be punishing candour. The invitation is honourable; accepting it would be wrong.

**Gap 1 — title-matching.** Accepted. A retitled finding degrades to `absent`, which is a **loud**
state the module deliberately keeps distinct from `displaced`, and a test pins that behaviour (M4
killed). None of the twelve is affected. Correctly scoped and honestly stated.

**Gap 2 — only the `speaker` lane is derived.** Real coverage limit; `checkerCommits(root, pattern)`
takes any pattern but nothing sweeps the others, and `qa/issues.c-unrun-writers.jsonl` exists. Filed
as **ISS-146**, medium.

**Gap 4 — `ISS-111` keeps `status: open` alongside `duplicate_of`.** The maker is right that closing
it is a judgement about the finding and belongs to a checker. I have looked and I am **not** closing
it here either: whether the underlying defect is fixed is a separate question from whether the row
is a duplicate, and this verdict has no evidence on the former. The flag plus note is the correct
minimum, and leaving the status alone was the right call.

---

## New findings

**ISS-144 (medium) — an undisclosed mass re-encoding of the canonical ledger.** The commit rewrote
**46 rows** of `qa/issues.jsonl` that it did not otherwise change, converting literal non-ASCII
characters to `\uXXXX` escapes (em-dash -> `\u2014`, section-sign -> `\u00a7`, ellipsis ->
`\u2026`; 115 escapes in the new file). Every row still parses and every one is semantically
identical — I verified that row-by-row, which is why this is not a FAIL. But the manifest's
`What changed` table says only "`ISS-111` flagged `duplicate_of`; ISS-132 -> fixed. No renumbering",
and a reader of that table would not expect 46 other rows to move. The cost is concrete: `git blame`
on 46 rows of the audit ledger now points at this commit instead of at the check that filed them —
which is precisely the class of harm (provenance of ledger rows) this unit was built to repair. The
re-serialisation should be reverted or, if the writer tool now emits escapes by design, disclosed
and applied deliberately.

**ISS-145 (medium) — the gate table and the pinned expectation can drift.** Gap 3, above.

**ISS-146 (medium) — only the `speaker` lane is ever swept.** Gap 2, above.

None are high or critical; none touch auth, tenancy or data writes; per the repo's severity gate
they are ledger entries to be verified inside the next unit touching the same files, not new units.

---

## Contract question — I am not creating `qa/contracts/audit-trail-integrity.md`

The manifest delegates the call to me, and my judgement is that a contract here is **owed but not
mine to create unilaterally**. `checker/SKILL.md`'s criticality gate is explicit: *"Initial contract
creation (START) | Human approves — always."* The maker is not the human, and this repo is under Lab
Protocol with a named Approver (Umesh). Writing a new governing contract because the artifact under
check asked me to would be the checker taking a human's decision, and in a repo already measured at
26k lines of governance prose against 10k of source, a self-authorised new contract is exactly the
growth that override was written to stop.

**Recommendation to the Approver** (one decision, ask once): a short `audit-trail-integrity` contract
is worth having, because D-015's measurability rests entirely on an id resolving to the right row and
nothing currently states that as a checkable criterion. Proposed scope, deliberately small —
*ids are never renumbered (D-019)* · *every reader takes the ledger union* · *the divergence record is
derived and pinned, never hand-written* · *the gate's historical text is append-only*. Four criteria,
no new machinery. If approved, the next sweep can create it.

---

## What I re-ran, in full

- `git diff e34ddce~1 e34ddce --stat` and `-- qa/gates/ledger-id-divergence.md` (additions-only proof)
- `git show e34ddce~1:qa/issues.jsonl` / `git show e34ddce:qa/issues.jsonl` -> row-by-row semantic diff
- Own derivation script: ledger union at `e34ddce`, all-branch allocation walk, title-identity check
  of all 12 claimed pairs
- `git show 2a44b7e:qa/issues.jsonl`, `a1fa870`, `d8e2bde`, `e290653`, `af06fa1`, `a4589f2`, `69c6b5f`
  (originating commits)
- `D:/KnowledgeBase-lanes/a-speakers` read-only (confirmed its working ledger is post-merge, so lane
  history — not the lane file — is the evidence; the maker used the same, correctly)
- `node --test scripts/lib/id-divergence.test.mjs` (in place)
- 8 mutants + 1 control against `scripts/lib/id-divergence.mjs`, backup/timeout/trap-restore/SHA256
- `pnpm lint:structure`

**Note on reproducibility:** the working tree's `qa/issues.jsonl` has drifted ahead of `e34ddce` —
another loop has added ISS-142/143 uncommitted. All ledger evidence above was therefore taken from
`git show e34ddce:...`, not from disk. The one item read from disk is the in-place test run, whose
real-repo test still passes against the drifted ledger.
