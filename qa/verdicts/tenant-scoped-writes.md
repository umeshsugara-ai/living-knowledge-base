# Verdict — tenant-scoped-writes

**Unit:** qa/manifests/tenant-scoped-writes.md
**Contract:** qa/contracts/ingest-indexing-pipeline.md
**Mode:** A (unit check), fresh context, no builder reasoning
**Project root:** D:\KnowledgeBase (bound)
**Date:** 2026-09-07
**Cycle checked:** 1
**Verdict:** PASS

```
VERDICT: PASS
SCOREBOARD: 5/5 applicable criteria met, 3/3 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-061, ISS-062, ISS-063, ISS-064, ISS-065 (all follow-up; none blocks this unit). ISS-060 -> fixed.
EXPLANATION: Every headline claim in this manifest reproduced exactly on evidence I produced
myself — all four mutations with occurrence counts asserted 1->0 before running, and a live
two-tenant run against the real database from a script I wrote rather than the maker's. ISS-060
is genuinely closed at the cause. I also found what the manifest invited me to look for: the new
confinement test cannot see an untenanted INSERT, so verify step 6's catch-all claim is
overstated — filed as ISS-061, not a failure of the fix. I ruled on tree_index (acceptable as an
interim boundary, not as an end state) and added the missing tenant-scoping criterion 3a to the
contract myself, which is the structural reason ISS-060 could exist inside a passing unit.
```

---

## What I re-ran myself

Nothing below is taken from the manifest. Every number is from my own run.

### Full suite — the 335 claim

| package | tests |
|---|---|
| packages/core | 7 |
| **packages/db** | **8** |
| packages/ai | 56 |
| packages/ingest | 41 |
| packages/index | 40 |
| packages/ask | 32 |
| packages/meeting-bot | 40 |
| apps/api | 71 |
| apps/web (vitest) | 40 |
| **Total** | **335, 0 fail** |

`pnpm -r test` exit 0. **`packages/db` genuinely runs now** — 8 tests, where the package
previously declared no `test` script and was silently skipped. The count of 335 is confirmed
(295 under `node --test` + 40 under vitest). `pnpm -r typecheck` — all 9 projects Done.

### The four mutations (manifest claim vs. my result)

Each applied by a harness that **asserts the occurrence count 1 -> 0 before running any test**,
and refuses to proceed otherwise. Files were restored from a pre-mutation backup and md5-verified
after every run, so the maker's uncommitted work was never at risk.

| mutation | manifest claimed | I measured | match |
|---|---|---|---|
| bypass `scopedCollection` for the claims delete (the ISS-060 hatch) | api 70/71 RED | api **70/71 RED** | ✅ |
| caller-supplied tenantId overrides the accessor's (`{tenantId, ...filter}`) | db 7/8 RED | db **7/8 RED** | ✅ |
| `deleteMany` stops merging the tenantId | db 5/8 + api 69/71 RED | db **5/8** + api **69/71 RED** | ✅ |
| the empty-tenantId refusal is removed | db 7/8 RED | db **7/8 RED** | ✅ |

All four reproduce exactly. The third is the one that matters and it holds: breaking the
primitive reddens tests in **both** the package that owns it and the caller that depends on it.
That is real coverage, not decorative.

A note in the maker's favour on instrument integrity: my harness refused one of my own
mutations (a self-containing replacement, count-after = 1) and I had to rewrite it. The
occurrence-count assertion is doing real work — it is exactly the check that distinguishes a
surviving mutant from a mutation that never applied.

### Live two-tenant proof — my own script, real database

I wrote `checker-live.ts` from scratch and did not read the maker's. Two scratch tenants
(`chk060-A-<run>`, `chk060-B-<run>`) share one UUID `sessionId`; only A is re-indexed; B's claim
carries `status: "verified"` so that destroying human-curated state is unambiguous. Cleanup runs
in `finally` and is **read back from the server**.

```
FIXED CODE
  CONNECTED db=lkb (mongodb://13.202.206.101:27017)
  SEEDED                          A=1  B=1
  HEALTHY  re-index of A only ->  A=1  B=1     <- B survives
  DEGRADED re-index of A only ->  A=1  B=1     <- ISS-056 guard still holds
  B's human-verified claim intact: true
  CLEANED (read back)             A=0  B=0

SAME SCRIPT, ISS-060 MUTATION APPLIED (occurrences 1 -> 0 asserted)
  SEEDED                          A=1  B=1
  HEALTHY  re-index of A only ->  A=1  B=0     <- B DESTROYED
  B's human-verified claim intact: false
  CLEANED (read back)             A=0  B=0
```

Cross-tenant destruction demonstrated, then demonstrated prevented, by one script against one
database. **The guard is doing the work, and that is measured, not inferred from the code.**

Two corrections to the record, both in the maker's favour and one against it:

- **Mongo is reachable, and the manifest is right to have corrected the earlier claim.** I
  connected on the first attempt. The prior unit's "100% packet loss" conclusion was an ICMP
  artefact.
- **The maker's script ran against db `test`; the code's real default is `lkb`**
  (`apps/api/src/index.ts:20`, `MONGODB_DB ?? "lkb"`). I ran against **`lkb`** — the database the
  application actually uses — so this result is strictly stronger than the manifest's. Worth
  knowing for future live proofs: a pass in `test` would not have exercised the real database.

---

## Rulings the manifest asked for

### 1. `tree_index` — the headline question. Interim: acceptable. Permanent: no.

Verified as a schema fact, not taken on trust: `schema/tree_index.schema.json` declares
`node_id, title, level, summary, evidence, children` and **no `tenantId`**. So `TreeIndexNode`
cannot satisfy `scopedCollection`'s `T extends {tenantId: string}`, and a `{tenantId}` filter
would match zero rows. The maker's account is exactly correct.

**Ruling: the maker was right on both counts, and I am not asking for the schema change in this
unit.** Refusing a schema migration (migration + `gen:types` + fixtures) inside a bug-fix unit is
correct scope discipline, and doing it unilaterally is the drift this project exists to prevent.
Escalating it here instead of deciding it alone is the ISS-006 behaviour generalised for the
second time in two units, and it is the right instinct.

The prefix convention is acceptable **as an interim boundary** because the risk shape is
materially different from the claims defect:

- `node_id` functions as a **primary key**; tenant separation by prefixed primary key is a
  legitimate, widely-used pattern, not a shortcut.
- `tree_index` takes **no destructive multi-document operation** — only `findOne` and a
  single-document `replaceOne` upsert. ISS-060 was catastrophic specifically because
  `deleteMany` can be widened to match everything. Nothing here can.
- Both call sites in `indexing.ts` now share one `treeIndexRootFilter()` and are pinned by
  `indexing.test.ts:102`.

It is **not** acceptable as an end state: it leaves two classes of collection with different
enforcement properties, and that asymmetry is precisely what produced ISS-060. So I have not left
the ruling as prose — I bounded it in the contract. New **criterion 3a** permits the exception
only while (i) every `tree_index` access goes through a single shared filter definition and
(ii) no `deleteMany` is ever issued against `tree_index`. The schema decision is tracked as
**ISS-062** as its own unit.

**`store.ts:51` and `:107` — filed, not waived (ISS-063).** Leaving them out of this unit was the
right call, but the consequence is that a security-relevant filter the compiler cannot check now
has **three** independent hand-written copies, and the two in `store.ts` are pinned by no test.
`store.ts:51` already carries a comment recording that this exact query was got wrong once and
caught live on 2026-09-04 — which is the argument for consolidating it.

### 2. Does a tenant-scoping criterion belong in the contract? Yes — I have added it.

The maker is right that criterion 3 describes the writes without requiring them to stay inside a
tenant, and right that contracts are checker-owned. **This is the most important structural
finding of the check:** it is the reason a cross-tenant delete could sit inside a unit the
contract read as fully satisfied. A contract that never required the boundary could never have
caught its breach.

I added **criterion 3a** to `qa/contracts/ingest-indexing-pipeline.md` with an amendment-log row.
It requires `turns`/`sessions`/`session_pages`/`claims` through `scopedCollection` and never the
raw handle, requires the accessor's `tenantId` to win over any caller-supplied one, and states
the `tree_index` exception with the two conditions above. Tightening only, no criterion weakened
— routine under the criticality gate. Decided on the pre-fix evidence: the rule was missing
before this unit existed. The unit under check satisfies it.

### 3. Nothing was weakened.

- **`withTenant` still spreads `tenantId` last** — `{ ...filter, tenantId }`
  (`tenantScope.ts:18`). Verified by reading *and* by mutation: reversing the spread reddens
  `packages/db` 7/8. A caller-supplied `tenantId` cannot win.
- **The empty-tenantId refusal is live** — removing it reddens db 7/8.
- **`raw` — ruling: not a defect today, but it should not stay as-is (ISS-065).** It is currently
  safe: `indexing.ts:134`'s `sessionsColl(tenantId).raw.updateOne({_id: sessionId, tenantId}, …)`
  does carry its tenantId, and it *is* pinned — the confinement test records `updateOne`'s filter
  and asserts it. But `raw` re-opens by design the exact hatch ISS-060 came through, and the
  maker's stated reason for omitting `replaceOne` ("an unused method is untested surface") does
  not apply to `updateOne`, which has a live caller. Remedy: add a tenant-merged `updateOne`,
  move `:134` onto it, narrow or drop `raw`. Follow-up, not a blocker.

### 4. A query the new test does not cover — found (ISS-061).

The manifest invited this and the claim does not fully survive it. `indexing.test.ts:100` skips
every recorded call with no filter (`if (call.filter === undefined) continue;`), and inserts are
recorded with documents, never a filter. I added a cross-tenant raw insert to `indexSession`
(occurrence count asserted 1 -> 0):

```ts
await db.collection<Turns>("turns").insertOne({ _id: "EVIL", tenantId: "other-tenant", sessionId: "s1" } as never);
```

**Result: apps/api 71/71 GREEN, `typecheck` exit 0.** The same insert aimed at `claims` *is*
caught — but only incidentally, by the two claims op-name tests, not by the confinement test.

So verify step 6's claim ("the test iterates every recorded call … so a *new* untenanted query
fails it") holds for filter-carrying queries and **does not hold for inserts**. That matters
because an insert going *around* the accessor is the ISS-060 bypass shape in its insert form. The
in-test rationale ("inserts carry documents, covered by `tenantScope.test.ts`") covers inserts
made *through* `scopedCollection`, not ones that bypass it. Medium severity: `tenantId` in
`indexSession` is server-derived, so this is a latent coverage hole rather than a live
vulnerability — which is exactly what ISS-060 was before someone changed a line.

### 5. The `test:lint` self-correction — verified, and the maker under-reported nothing.

I ran `pnpm test:lint` three times. All three: **42/45, 3 failures**, and every failure names the
in-flight uncommitted files as the cause (`REFUSED: … is not what the repository holds`) — that
is ISS-058, already open, explicitly out of scope, and unavoidable for any unit under check.
`pnpm lint:structure` fails for the same single reason; every real structure lint (loc, dirsize,
root, dupes, migrations, SNAPSHOT) passes.

I could not reproduce 45/45 on a clean tree without stashing the maker's uncommitted work, which
I will not do — but the failure messages are self-explaining and conclusive. **The maker's
account is accurate and the self-correction is honest.** Declining to report a number it had not
actually measured is the right call and the opposite of the failure mode it names.

**The "small real thing underneath it" is real — I reproduced it and filed it (ISS-064, low).**
Running `test:lint` on the dirty tree left `M docs/PROGRESS.md` where there had been none; I
restored it with `git checkout -- docs/PROGRESS.md`. A lint that mutates tracked files when it
fails is precisely how one run's residue gets misread as the next run's finding — which is the
44/45 near-miss the maker described. One observation is enough for a low-severity row.

---

## Criteria judged

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 3 | `indexSession` writes `session_pages`/`claims`, updates `tree_index`, flips `status.index` | **met** | live run on `lkb`: healthy + degraded both correct, B untouched |
| 3a | every query tenant-confined (added this check) | **met** | 4 mutations RED; live proof; `tree_index` exception within its stated bounds |
| 6 | no regression — typecheck, `pnpm -r test`, `lint:structure` | **met** | 9/9 typecheck Done; 335/335; `lint:structure` fails only on ISS-058's uncommitted-file guard, pre-existing and out of scope |
| 7 | real unit-test coverage | **met** | +8 `packages/db` (first ever runtime tests for the primitive), +2 `apps/api`; all genuinely reddened by mutation |
| — | ISS-060 actually closed | **met** | fixed at the cause; reproduced destruction and prevention live |

Criteria 1/1a/2/2a/4/5/8 belong to prior units and were not re-litigated here.

**Invariants:** accessor's `tenantId` wins (holds) · empty `tenantId` refused (holds) · no
destructive multi-document op outside `scopedCollection` on a `tenantId`-bearing collection
(holds).

---

## Why PASS despite five new issues

None of the five is a defect in this unit's fix. ISS-061 is a gap in a *new* test's reach that
the manifest itself asked me to hunt for; ISS-062/063 are scope calls the maker made correctly
and disclosed; ISS-064/065 are follow-ups it explicitly handed me. The unit set out to close
ISS-060 at the cause and it did — proven by mutation and by an independent live run, not by
assertion. Filing the follow-ups is the checker doing its half, not the maker failing its own.

Two things this manifest did that I want on the record, because they are the behaviours this
project has been trying to install: it **corrected its own prior evidence** (Mongo reachability)
rather than letting a convenient error stand, and it **refused to report a failure it had not
characterised** rather than padding the findings list. Both cost it something and both were right.

*Verdict written before returning. Ledger updated: ISS-060 -> fixed; ISS-061..065 opened.
Contract amended: criterion 3a added with amendment-log row.*
