# Manifest — issue-ref-disambiguation

**Contract:** none governs the citation corpus. The `divergence-mapping-correction` checker
declined to author `qa/contracts/audit-trail-integrity.md` unilaterally and recommended one to the
Approver; if that contract lands, this unit belongs under it.
**Goal task:** none (tier 2 — open high issue).
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-142** (high), **ISS-144** (medium).
**Status:** ready-for-check (cycle 1)

## Why

Merging `lane/c-unrun-writers` brought **96 bare `ISS-NNN` references** onto master that now resolve
to unrelated canonical rows. One lane manifest closes "021" and "022" meaning its own lint-red and
test-count findings, while the canonical rows at those numbers are verdict-wording standardisation
and a T-010 goal-status row — and both exist. Nothing was corrupted — every citation simply started
pointing somewhere else.

This is the same defect `divergence-mapping-correction` just repaired in the gate table, committed
by me, in the same session, in the merge commit that followed. **D-015 makes a fix measurable only
if the id it cites resolves to the right row**, so this is not cosmetic.

## What changed

| File | Change |
|---|---|
| `scripts/lib/tracker-audit.mjs` | **G4** — a new gate; `filterByGate` now takes `--gate g1,g4`. |
| `scripts/lib/ledger-union.test.mjs` | +8 G4 tests (15 total), two for the `(canonical)` escape. |
| `scripts/lib/tracker-audit.test.mjs` | +1 multi-gate test (17 total). |
| `package.json` | `lint:structure` gates on `g1,g4`, not `g1` alone. |
| `qa/manifests/{guarded-fetcher,watched-sources-run,watched-sources-url-normalisation}.md` | 30 refs qualified. |
| `qa/issues.jsonl` | ISS-144: 42 rows restored to their original bytes. |

## The scoping decision, which is the whole of the design

**The obvious rule is wrong, and I shipped it first.** "Flag every bare `ISS-NNN` that a lane shard
also numbers" reported **58 files** — almost all historical documents written long before any lane
existed, whose bare references correctly mean the canonical row. A gate that fires on correct usage
is one people learn to ignore, which is how G2's dead-gate problem started.

So a file is judged **only if it already uses the qualified form somewhere**. Mixing
`ISS-C-UNRUN-WRITERS-017` and a bare three-digit reference to the same finding in one document is an
inconsistency its own author owns, and the rule cannot misfire on a document that predates lane ids.
Measured: 58 → **3**, and the three are exactly the manifests I wrote.

### The gate fired on this manifest, and that earned it an escape hatch

Writing the above, `--gate g1,g4` went red on **this file** — for citations that were *correct*: a
document explaining the ambiguity necessarily quotes the ambiguous numbers. A true positive by the
rule and a false positive in meaning, which is exactly the limit recorded as gap 3 below, arriving
before the unit had even shipped.

So a bare reference written `ISS-0NN (canonical)` is accepted. That is deliberately not an
auto-detection: the gate is title-blind and cannot tell an ambiguous *number* from a wrong
*meaning*, so the escape makes the author **state** the judgement rather than have the gate guess
it — and makes a careless blanket qualification visibly wrong instead of silently wrong.

**Verdicts are checker-owned and I did not touch them.** 66 of the 96 refs live in
`qa/verdicts/`; a maker rewriting a verdict is the self-certification this pair exists to prevent.
Those four files are named in `G4_FROZEN` — the debt is *frozen and visible* rather than tolerated:
any **new** ambiguous ref anywhere fails, and the list can only shrink. A checker that rewrites its
own verdict deletes its own line.

**G4 gates commits, G2/G3 still do not.** G1's stated criterion for gating is that it is fully in
the author's control and clearable in the same commit. G4 meets it exactly. G2 and G3 depend on
someone else acting later, which is why they stay out.

## ISS-144 — my own undisclosed damage, repaired

The `divergence-mapping-correction` commit silently re-encoded ledger rows to backslash-u escapes:
Python's `json.dumps` defaults to `ensure_ascii=True`. Semantically null, but it repoints
`git blame` on those rows at my commit rather than at the checks that filed them — the same
provenance harm that unit existed to repair.

Measured at `e34ddce`: 48 raw lines differed, **2 semantically** (the intended ISS-111/ISS-132
edits) and **42 by re-encoding alone**. Restored by re-emitting each row whose parsed form is
unchanged in its original bytes: 135 rows byte-restored, 9 legitimately re-emitted with
`ensure_ascii=False`, one row (`ISS-109`) still carrying an escape **because it always did**.

## How to verify

- `node scripts/tracker-audit.mjs --gate g1,g4` → `OK (gate G1,G4)`, exit 0.
- `node --test scripts/lib/ledger-union.test.mjs` → 15 pass / 0 fail / 0 cancelled.
- `node --test scripts/lib/tracker-audit.test.mjs` → 17 pass / 0 fail / 0 cancelled.
- `pnpm lint:structure` → exit 0.
- Parse all 148 ledger rows: **0 rows added or removed, 0 duplicate ids**; the diff is
  serialisation only.
- `ISS-136` / `ISS-137` are still bare in `qa/manifests/watched-sources-run.md` — those are genuine
  canonical citations and qualifying them would have broken them.

## Actual outputs

```
$ node scripts/tracker-audit.mjs --gate g1,g4      tracker-audit: OK (gate G1,G4)   exit=0
$ node --test scripts/lib/ledger-union.test.mjs    tests 15  pass 15  fail 0  cancelled 0
$ node --test scripts/lib/tracker-audit.test.mjs   tests 17  pass 17  fail 0  cancelled 0
$ pnpm lint:structure                              exit 0
$ (G4 findings before / after qualification)       3 / 0        (naive rule: 58)
$ (ledger rows / duplicate ids)                    148 / 0
```

**Mutation table** (D-020: `timeout=600`, restore in a `finally`, each restore asserted
SHA256-identical before the next mutant):

| mutation | result |
|---|---|
| G4 never flags anything (`if (false)`) | **killed** |
| drop the qualified-form scope guard (the 58-file version) | **killed** |
| ignore `G4_FROZEN` and judge verdicts too | **killed** |
| drop the lane-number filter (flag every bare ref) | **killed** |
| `--gate g1,g4` honours only the first gate | **killed** |
| the `(canonical)` escape mutes the whole file rather than one reference | **killed** |
| **no-op control** | **clean** |

## Known gaps

1. **66 refs in checker-owned verdicts are still ambiguous.** Frozen and named, not fixed. They can
   only be corrected by a checker, and I would rather leave visible debt than edit a verdict.
2. **The two lanes without shards are the live version of this bug.** `a-speakers` and
   `b-golden-set` still draw from master's sequence; the sweep measured `a-speakers`' next
   allocation (ISS-104) as colliding with **38** existing master rows. G4 catches the citations
   *after* such a merge; nothing prevents the collision itself. That is ISS-130, still open.
3. **G4 is title-blind.** It flags an ambiguous *number*, not a wrong *meaning*. A doc citing a bare
   id that genuinely means the canonical row, in a file that also uses lane ids, is flagged and
   would be wrongly "fixed" by a careless author. `ISS-136`/`ISS-137` are exactly that case here; I
   checked each of the 30 rewrites against both ledgers by hand, and the gate cannot do that for
   the next person.
4. **ISS-144's repair is not pinned by a test.** Nothing stops the next `json.dumps` from
   re-escaping the ledger. A byte-stability check belongs in G2's neighbourhood; I did not add one.

## Note to the checker

Gap 3 is the one I would push on: this gate tells an author "these ids are ambiguous" and an author
who mechanically qualifies all of them would corrupt any that genuinely meant the canonical row.
The gate makes a *human* judgement cheaper to find, not unnecessary — and this manifest could be
read as claiming more. If you think that makes G4 net-negative, FAIL it.
