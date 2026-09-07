# Verdict — claims-degradation-honesty

**VERDICT: PASS**
**Cycle checked: 1**
**Date:** 2026-09-07
**Checker:** /checker Mode A, fresh subagent, bound to `D:\KnowledgeBase`
**Contract:** qa/contracts/ingest-indexing-pipeline.md (adopted + amended this cycle — see §1)
**Manifest:** qa/manifests/claims-degradation-honesty.md (`Fix cycle: 1`, `Status: ready-for-check`)

```
VERDICT: PASS
SCOREBOARD: 9/9 dispatch items verified, 4/4 touched criteria met, 3/3 mutations caught (+1 checker mutation survived → ISS-060)
FAILURES: none
ISSUES-WRITTEN: ISS-056 (medium→HIGH, open→fixed), ISS-058, ISS-059, ISS-060
EXPLANATION: The maker asked to be judged on three things it deliberately did not do unilaterally —
amend a contract it contradicts, change summarize.ts, and relax a checker-owned lint gate — and was
right to escalate all three. Criterion 2 was wrong and is amended (a tightening, decided on pre-fix
evidence). The severity claim is confirmed and understated: driving the pre-fix path against the
REAL database destroyed a human-`verified` claim, 1 → 0. Mongo turned out to be reachable (ICMP is
blocked; the TCP port opens), so the live proof the manifest listed as missing is now done — through
the real indexSession, both directions, cross-tenant probe included, cleanup read back. Both listed
mutations redden a test with the edit's application asserted by occurrence count. My own third
mutation also reddens; my fourth — stripping tenantId from the claims deleteMany — survives the
whole suite and typecheck and provably destroys another tenant's claims, so it is filed HIGH as
ISS-060. It is not a failure of this unit: the pre-fix code had the identical escape hatch, and
tenant scoping was verified NOT weakened.
```

---

## 1. RULING on the contract contradiction (the first job)

**The code is right; the contract was wrong. Criterion 2 is AMENDED, not the code rejected.**

The maker flagged that this unit contradicts criterion 2 ("a rejected `complete()` … yields `[]`,
an honest 'nothing extracted yet'") and did **not** edit the contract, explicitly citing the
reopened ISS-006. That is the correct escalation and the behaviour to generalise — the same call
`qa/manifests/tracker-honesty.md` made. Credit where due; it is also why I could rule on this
cleanly instead of discovering a silently-rewritten rule.

Applied to `qa/contracts/ingest-indexing-pipeline.md`:

- **Criterion 2 amended** — `extractClaims` returns `{claims, degraded}`; `degraded: null` is
  reserved for extractions that genuinely ran, *including* genuinely-empty and
  all-dropped-by-the-evidence-check. "Never throws" is preserved: that was the criterion's real
  intent and the code honours it.
- **Criterion 2a added** — the caller's claims delete and insert must be governed by the *same*
  condition. A conditional insert paired with an unconditional delete is now explicitly forbidden.
- **Criterion 1a added** — see §8.
- **An amendment log was added** (this contract had none), opening with a `/checker` **adoption**
  entry. That closes this contract's share of the reopened **ISS-006** and of **ISS-055**.

**Criticality gate:** routine, applied without a human gate. This *adds* a data-safety invariant
and weakens nothing — it is a tightening, not a goal-direction reversal and not the removal of a
safety invariant. It is also decided **independently of this verdict**: the superseded rule was
wrong before this unit existed, and the evidence for that is pre-fix behaviour, not this unit's
artifact. The "never soften a criterion because an artifact is failing it" absolute is not engaged
in either direction.

## 2. The severity claim — CONFIRMED, and the original filing understated it

Read at HEAD (`9c6ff41`), pre-fix:

```ts
// apps/api/src/indexing.ts (HEAD)
await getDb().collection<Claims>("claims").deleteMany({ tenantId, "evidence.sessionId": sessionId });
if (extractedClaims.length > 0) { … insertMany … }

// packages/index/src/pipeline/claims.ts (HEAD)
} catch { return []; }
```

The delete is unconditional, the insert conditional, and the `catch` makes a provider failure
indistinguishable from an empty transcript. The maker's reading is exactly right. I filed ISS-056
myself as an *observability* gap ("downstream claim counts silently understate"); that was wrong,
and it is now **medium → HIGH**. This was destructive, not ambiguous — see §6 for the live
demonstration on a real database.

## 3. Mutations — each proven to have applied before the result was read

Occurrence counts asserted in-process before and after every edit; both files restored from
byte-backups afterwards and the restoration verified against `git diff --stat`.

| # | Mutation | Applied (asserted) | Result |
|---|---|---|---|
| A | revert `if (claimsDegraded)` to the unconditional `deleteMany` | `if (claimsDegraded)` count **1 → 0** | **RED** — apps/api 68/69, `a DEGRADED claims extraction must NOT delete the session's existing claims` |
| B | `extractClaims` catch returns `degraded: null` | target return string **1 → 0** | **RED in BOTH packages** — packages/index 39/40 and apps/api 68/69 |
| C | *(checker-added)* final return reports `degraded` whenever `claims.length === 0` | target return **1 → 0** | **RED, 2 tests** — both `…genuinely nothing citable is NOT degraded` and `claims dropped for fabricated evidence leave a NON-degraded empty result` |
| D | *(checker-added)* strip `tenantId` from the claims `deleteMany` filter | filter string **1 → 0** | **SURVIVED** — 69/69 green, typecheck exit 0 → **ISS-060** |

Mutation B reddening in *both* packages is worth noting on its own: it proves `apps/api` resolves
the live `@lkb/index` source rather than a stale build, so the cross-package evidence in this unit
is real.

Mutation C is the one the manifest did not list, and I chose it to attack §4 rather than to pad the
count: it is the mutation that would pass if the "both directions" property were merely asserted in
prose. It reddens two tests.

## 4. The distinction holds in BOTH directions — verified three ways

The risk the maker names is real (a guard that never lets claims be replaced trades one bug for
another), so I did not take the tests' word for it:

1. **Tests exist and are honest** — `claims.test.ts` pins genuinely-empty (`completion("[]")`) and
   all-dropped-by-evidence-check (`turnIds: ["nope"]`) as `degraded === null`.
2. **Mutation C proves they bite** (above).
3. **Live** (§6) — the healthy re-index *did* replace the pre-existing claim with the freshly
   extracted one. Stale claims remain clearable against a real database, not just a fake.

Reading the code, `degraded` is set only in the two failure paths (rejected `complete()`,
non-array response). The `turns.length === 0` short-circuit and the evidence-filter drop path both
return `degraded: null`. Correct.

## 5. The injected-db refactor did NOT weaken tenant scoping

- `scopedCollection` still builds **all three** of its accessors — `turns`, `sessions`,
  `session_pages` — now from the injected handle (`indexing.ts:54-56`). Its tenant-forcing
  signature (`packages/db/src/lib/tenantScope.ts:26-42`) is untouched, and `db as never` is a type
  cast only; nothing but `.collection` is called on the handle at runtime.
- Every raw query still carries its `tenantId`: session_pages delete `{tenantId, sessionId}`,
  claims delete `{tenantId, "evidence.sessionId"}`, both inserts stamp `tenantId`, `tree_index`
  keys on `tenant:${tenantId}`, and the status flip is
  `sessionsColl(tenantId).raw.updateOne({_id, tenantId})`.
- **Attacked, per the dispatch.** I could not construct a cross-tenant query against the shipped
  code, and the live run confirms it: a second tenant's claim sharing the same `sessionId` survived
  **both** the degraded and the healthy re-index (`otherTenant: 1` throughout), including the run
  where the `deleteMany` actually executed.
- **Diff-checked against HEAD:** the pre-fix code reached those same three collections through the
  raw `getDb().collection(...)` with the same hand-written `tenantId`. The refactor swapped the
  handle, not the scoping. **Not weakened.**

**But the invariant is unpinned (ISS-060, high).** Mutation D removes `tenantId` from that filter
and the entire suite plus typecheck stay green; run live against two scratch tenants it took both
from **1 → 0**. The root cause is that claims/session_pages/tree_index use the raw handle, so
`scopedCollection`'s compile-time protection never applies to them. This is a pre-existing gap and
not chargeable to this unit — but this unit is what made it cheap to close, since the fake db it
added need only record filters as well as op names.

## 6. The live proof the maker could not do — **DONE, not inconclusive**

**Mongo is reachable.** The manifest's evidence was a false negative: ICMP is blocked
(`ping` → 100% loss, reproduced), but TCP 27017 opens immediately. Worth flagging as a lesson —
`ping` has now under-reported this host's availability across several units.

Checker-authored script (not the maker's), scratch tenants, bounded and named per Mode C, driving
the **real `indexSession`** through this unit's own db injection:

```
degraded_before  { mine: 1, otherTenant: 1 }
degraded_after   { mine: 1, otherTenant: 1 }        ← claims SURVIVED a throwing provider
degraded_claim_text  "PRE-EXISTING REAL CLAIM - human reviewed."   (status: "verified")
degraded_status_index "done"
healthy_after    { mine: 1, otherTenant: 1 }
healthy_claim_text   "A freshly extracted claim."   ← stale claims still replaced
cleanup_readback { mine: 0, otherTenant: 0, sessions: 0, tree: 0 }   ← read back from the server
```

And the same seed run through the **pre-fix** code path:

```
prefix_before 1  →  prefix_after 0     ← a human-"verified" claim DESTROYED, nothing written back
```

That settles §2 by execution: real data loss, on real data, not ambiguity. `console.warn` fired
live with the reason attached.

*(One aborted first run crashed in `buildTree` on `session.date.slice`. That was **my fixture**,
which omitted a schema-required field — `date` is in `sessions.schema.json`'s `required` and both
ingest adapters write it. Not a defect; recorded so the next checker does not re-chase it.)*

## 7. RULING on the workflow finding — **I13/I14 UPHELD; the packaging complaint SUSTAINED**

The maker raised this in `qa/feedback-inbox.md` instead of touching a checker-owned invariant.
Right call again. Ruling, recorded in the `catalogue-progress-score` amendment log:

**The invariant does not move.** The maker's substantive premise — that for scraped *source* the
protection is "arguably already the EDITED-SINCE-COMMIT banner plus the staleness check" — is
refuted by that contract's own cycle-5 measurement. ISS-047 tested exactly that case: one untracked
route file plus 13 `<Route>` lines in `App.tsx`, **nothing committed**, moved the headline
20.2% → 30.7% with `--check` exit 0, `lint:structure` exit 0, 23/23 green and **"no banner of any
kind"**. Scraped source is not the lesser input; it is the input that was silently inflatable, and
I14 exists because of it.

**The cited ruling does not transfer.** "A gate that blocks every commit until someone else acts is
a gate people delete" (ISS-053) turns on *someone else acting*. This gate is cleared by the author
committing their own work — the very next step. That is the same distinction ISS-053 itself drew
when it **kept** G1 in the chain as "fully in the authors' control and always clearable in-commit".

**But the complaint is sustained on its facts**, and the evidence is the maker's own: this unit's
`lint:structure` refused on four in-flight files while every other structure check passed and the
score was unchanged. A chain that is red for legitimate reasons during normal work trains people to
stop reading it — which is the deletion risk, arriving by a different road. The defect is
*composition*, not strength: a score-**reproducibility** check is only meaningful about committed
state, so running it pre-commit asks a question that cannot yet have a good answer.

**Remedy (ISS-058, medium):** split `catalogue-score --check` out into `lint:score` on the
commit/CI path; leave `lint:structure` runnable at any moment. The refusal itself is not touched.
The maker was correct not to change I13/I14, and correct that something here is broken.

*Note:* I have **not** marked the inbox entry folded. `qa/feedback-inbox.md` is uncommitted
in-flight maker work and editing it would drag the builder's tree into my commit. The entry is
**judged** — this verdict, the amendment log and ISS-058 are the record; the next sweep may mark it
folded once the maker's work lands.

## 8. RULING on `summarize.ts` — leaving it was right; it IS the same bug wearing a label

Both halves of the maker's framing are correct, and they are not in tension:

- **Right not to act.** The contract did require that fallback. Changing behaviour the ground truth
  mandates, without the contract's owner, is precisely the ISS-006 pattern. Correct escalation.
- **Right that it is the same bug.** `summarize.ts:80-89` has no degraded signal *at all*, so
  `indexing.ts:71-84` cannot decline: the `session_pages` `deleteMany` is unconditional and the
  fallback is inserted whenever `turns.length > 0`. A degraded re-index of an already-summarized
  session replaces a real summary with a 500-char transcript slice, degrading that session's
  `tree_index` entry and `/ask` answers until someone re-indexes. I saw it happen in §6's live run.

**The resolution is that the contract was ambiguous, and that is my fault to fix, not the maker's.**
It required the fallback to **exist**; it never required it to **replace** a good page. Criterion 1a
now says so: the labelled fallback is for a session with no page yet. Filed as **ISS-059, medium** —
lower than the claims defect because it is labelled rather than silent, destroys no human-curated
review state, and is regenerable from the retained turns. **Not a failure of this unit**; it was
correctly scoped out and correctly disclosed.

## 9. Suites and typecheck — re-run by me, not read from the manifest

```
$ pnpm -r test
core 7/7 · ai 56/56 · ask 32/32 · ingest 41/41 · index 40/40 · meeting-bot 40/40 · apps/api 69/69
0 fail

$ pnpm -r typecheck
all 9 projects Done, exit 0
```

`apps/api` **69** and `packages/index` **40** match the manifest exactly.

`pnpm lint:structure` exits 2, on the `catalogue-score --check` refusal only — every other check
passes (lint-loc 216, lint-dirsize 74, lint-root, lint-dupes 240, lint-migrations 1066, snapshot
`--check`, depcruise clean). That is §7's finding, not a defect of this unit, and it clears on
commit.

## What the maker got right, on the record

The manifest's §"The reason for (3)" is the most valuable thing in this unit. The maker found its
own first fix was untested **by mutation-testing its own work**, and then fixed the *cause* — made
the code injectable — rather than disclosing the gap for a fourth time. That is the correct
response to ISS-030/038/048, and my ISS-060 exists only because that seam now exists to build on.
Three escalations instead of three unilateral edits, in a project whose reopened ISS-006 is about
exactly that. Nothing in this check had to be taken on trust, which is the point.

## Follow-ups queued

| Issue | Sev | What |
|---|---|---|
| **ISS-060** | high | Pin the `tenantId` in indexSession's raw queries — record filters in the fake, or give `scopedCollection` the write ops |
| **ISS-059** | medium | `summarize.ts` preserve-on-reindex, now authorized by criterion 1a |
| **ISS-058** | medium | Split `catalogue-score --check` out of `lint:structure` into `lint:score` |
| ISS-056 | high | **fixed** — moves to `verified` on a later re-check, per ledger rules |
