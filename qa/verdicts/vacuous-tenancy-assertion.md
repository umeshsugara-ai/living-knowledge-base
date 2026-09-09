# Verdict — vacuous-tenancy-assertion

**Date:** 2026-09-09
**Cycle checked: 1**
**Commit under judgement:** `99ed8f3`
**Artifact:** `apps/api/src/indexing/promote-entities.test.ts` (the only source file the commit touched)
**Contract:** none directly governs this. Judged against **ISS-202 item 3's recorded reproduction**
(D-015), as the dispatch and ISS-203 both require.

```
VERDICT: PASS
SCOREBOARD: 3/3 ISS-202-item-3 hatches closed, 4/4 non-vacuity properties hold
FAILURES: none
LIVE-BROWSER: not-applicable (apps/api/src/indexing/promote-entities.test.ts + qa/manifests/…md;
  I ran qa/ui-surfaces.json's own pattern against both paths myself — both False, AskPage.tsx True
  as a positive control)
ISSUES-WRITTEN: ISS-210, ISS-211 (both medium, both about the manifest's evidence claims, neither
  about the fix). Ledger updates: ISS-156 open → fixed.
EXPLANATION: Every hatch ISS-202 item 3 records is genuinely closed, and I re-derived each kill
myself rather than reading the maker's table. The new test is NOT vacuous on the body half or the
read half — I could not construct a mutation that lets it pass while nothing is written, and the
claims-read filter assertion is load-bearing (M-find-unscoped kills it). It IS unfalsifiable on one
half it does not disclose: the WRITE filter, because the `_id.includes(tenant)` disjunct absorbs
every entity write filter, so removing tenantId from the write filter survives this test (ISS-211).
That is covered elsewhere and is not a suite gap.
```

## What I re-ran (my own mutations, not the maker's)

Harness: `scripts/lib/mutate.mjs apply` (refuses an uncommitted file) → python edit → **`git diff`
asserted non-empty (mutant present on disk)** → **`pnpm --filter @lkb/{api,db} typecheck`, a
non-compiling mutant discarded as a fake kill** → `timeout 300 pnpm --filter @lkb/api test` →
restore in a `trap … EXIT INT TERM ERR` (`mutate.mjs restore` + `git checkout` + `git diff --quiet`
verification + `assert-clean`). Every run printed `RESTORE OK` / `MUTATIONS CLEAN`; the tree is
clean at the time of writing apart from `.goal/goal.json`, which I did not touch. D-020 satisfied.

| # | mutation | target | ISS-202 test | other killers | maker's claim |
|---|---|---|---|---|---|
| CONTROL | none | — | pass | 173 pass / 0 fail / 0 cancelled | **confirmed** |
| M-org-body | drop `tenantId` from ORG `$set` | promote-entities.ts | **KILLED** | ISS-156 test | confirmed, but see ISS-210 |
| M-topic-body | drop `tenantId` from TOPIC `$set` | promote-entities.ts | **KILLED** | ISS-126 sessionRefs test | **confirmed** |
| M-org-filter | `_id: entityId(t,o._id)` → `_id: o._id` | promote-entities.ts | survives | ISS-C-TARGETING, C6-orgs | **confirmed exactly**, incl. which two tests |
| **M-updateOne-filter-unscoped** | `raw.updateOne(withTenant(...))` → `raw.updateOne(filter)` — **the tenant removed from the WRITE FILTER only** | tenantScope.ts | **SURVIVES** | ISS-154 filter test, session.test.ts ×2 | not run by the maker |
| M-find-unscoped | `raw.find(withTenant(...))` → `raw.find(filter)` — unscoped READ (the ISS-078 shape) | tenantScope.ts | **KILLED** | 10 others | not run by the maker |
| M-withtenant-all | `withTenant` stops merging entirely | tenantScope.ts | **KILLED** | 11 others | not run by the maker |
| M-no-topic-writes | topics loop iterates `[]` — promotion writes less | promote-entities.ts | **KILLED** | 8 others | not run by the maker |

## Direct answer: is the NEW test itself vacuous?

**On three of the four attacks, no — and I tried to break it, not to confirm it.**

1. **Can it pass while `promoteAndPersistEntities` writes nothing?** No. `M-no-topic-writes` kills it.
   Three independent guards stand in the way and each is reachable: `scoped.length > 0`,
   `scoped.some(coll)` for topics **and** orgs, and the closing `writeCount > 0`. The last is
   redundant given the first two, which is belt-and-braces, not a defect.
2. **Is `filterIsScoped` load-bearing?** **Yes on reads, no on writes.** `M-find-unscoped` — an
   unscoped `claims.find`, precisely the ISS-078 disclosure shape — is killed by this test, and it
   is killed *because* the maker refused the reflex of narrowing the loop to writes. That design
   call is vindicated by measurement, not by argument. But `M-updateOne-filter-unscoped` **survives**:
   the topic/org write filters are `{_id: "tenant-a:…", tenantId: "tenant-a"}`, so the
   `_id.includes("tenant-a")` disjunct still matches with `tenantId` gone. The manifest's sentence
   *"it fails a filter carrying no `tenantId` at all"* is therefore **true of the read and false of
   the writes** — filed as **ISS-211**. The maker was scrupulous about the `_id`-collision mutant it
   does *not* guard and over-general about the one it does; the disclosure is close but not exact.
3. **Is the `|| false` dead branch's "sessionId is not enough" rule enforced anywhere?** Yes —
   by *omission*, which is the correct construction. A filter carrying only
   `{"evidence.sessionId": "s1"}` matches neither disjunct and fails. `M-find-unscoped` proves
   this empirically: that is exactly the filter the mutant produces, and the test reddens. The
   `|| false` is comment-bearing dead code; harmless, and I am not filing it.
4. **Does read/write partitioning leave any op checked by neither?** No. I instrumented the fixture
   and enumerated every captured op: **`topics.updateOne`, `orgs.updateOne`, `claims.find` — three,
   nothing else.** Writes get filter + body; the read gets the filter. There is no third bucket.
   (`claims.updateOne` only appears when claims are seeded, which is other tests' fixture.)

## The maker's account of M-org-filter — verified, and it is not self-serving

I did not take the printed filters on trust; I re-derived them through the real fixture:

```
topics updateOne {"_id":"tenant-a:visa-rules","tenantId":"tenant-a"}
orgs   updateOne {"_id":"tenant-a:acme","tenantId":"tenant-a"}
claims find      {"evidence.sessionId":"s1","tenantId":"tenant-a"}
```

Byte-for-byte what the manifest claims. `scopedCollection` does merge `tenantId` into every filter,
the mutant's filter does stay tenant-scoped, its real harm is the cross-tenant `_id` collision, and
the two tests the maker names are exactly the two that kill it — I ran it and read the failure list.
A convenient claim that survives independent re-derivation is evidence, and this one did.

## Mode D — the manifest's reasoning is right

I did not accept the prose. I loaded `qa/ui-surfaces.json`, compiled its `pattern`, and matched it
against the changed paths in the hook's own line shape:
`apps/api/src/indexing/promote-entities.test.ts → False`, the manifest → `False`,
`apps/web/src/pages/AskPage.tsx → True` (positive control, so the pattern is live rather than
inert). The `apps/api/src/(server|production|ask-arms|search-store|store|ingest-store|whatsapp-store).ts`
alternative is an explicit file list and does not reach `indexing/`. Not UI-touching; no browser owed.

## On splitting ISS-202 rather than closing it in one unit

**Splitting was right, and for a reason stronger than "one unit per cycle."** The three items share a
*shape*, not a *risk class* or a file: item 3 is a tenancy assertion in `apps/api` — the security
class this repo never round-caps — while item 1 is a QA probe under `qa/evidence/` whose correct
remedy may be **deletion** (it is evidence for a claim it cannot support), and item 2 is a web test
needing a click. Bundling an uncapped security fix with a possible artifact deletion would have put
one verdict across three unrelated blast radii and made a FAIL on any of them burn a fix cycle for
all three. QUEUE row 2 (`vacuous-evidence-probes`) carries the remainder and ISS-202 stays **open**
until it lands — which is the correct ledger state, not an oversight.

## Ruling on whether a contract is needed here

**No new contract, and I am declining to author one — that decision is not mine to make.** ISS-203
already names this exact gap and rules that a vacuity criterion may not be bolted onto
`qa/contracts/loop-safety.md`, because a checker that widens its own mandate by writing a contract
is the C7/C8 self-certification path D-022 had to ratify after the fact. The `handshake-liveness`
contract START is already a HUMAN_GATE at `qa/gates/handshake-liveness-contract-start.md`. Opening a
**third** home for the same criterion while a gate on the second is pending would be the same error
with an extra branch. ISS-202's instances are ordinary units judged against their recorded
reproductions until the human answers ISS-203 — which is what I did here, and it was sufficient:
the reproduction was specific enough to mutate against, and the mutations decided the verdict.

## Ledger movements

- **ISS-210** (new, medium) — the manifest's `before: survived` for M-org-body is not measured at
  this unit's baseline.
- **ISS-211** (new, medium) — `filterIsScoped`'s `_id` disjunct makes the WRITE-filter assertion
  unfalsifiable; the manifest over-generalises the guard.
- **ISS-156** `open → fixed`. Its `fix_direction` read *"extend the 'every write is tenant-scoped on
  filter and body' assertion to walk the orgs write as well as the topics write … verified inside
  the next unit that touches promote-entities.test.ts."* This is that unit, it does exactly that,
  and I reproduced the kill myself (M-org-body, 2 failures).
- **ISS-202** stays **open** — item 3 is closed and verified; items 1 and 2 are QUEUE row 2.
