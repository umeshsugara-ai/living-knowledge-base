# Verdict — assertAllCallsConfined-unset-coverage

**Date:** 2026-09-07
**Contract:** qa/contracts/ingest-indexing-pipeline.md, criterion 3a
**Manifest:** qa/manifests/assertAllCallsConfined-unset-coverage.md
**Cycle checked:** 1
**Mode:** A (fresh, no builder reasoning, own re-run)

## What I re-ran myself

1. **`$unset` mutation, my own wording.** Edited `apps/api/src/indexing.ts`'s only `updateOne`
   call to `{ $set: { "status.index": "done" }, $unset: { tenantId: "" } }`. `pnpm --filter
   @lkb/api test` went 69/71 RED with `AssertionError: sessions.updateOne's $unset strips
   tenantId — the document would carry no tenant at all (ISS-066)`. Reverted via `git checkout --
   apps/api/src/indexing.ts`; `git diff --stat` confirmed empty.
2. **An operator the manifest never exercises itself** — `$currentDate: { tenantId: true }`.
   69/71 RED: `AssertionError: sessions.updateOne's $currentDate reassigns tenantId — it can move
   a document into another tenant`. The generic scan caught an operator with no special case
   anywhere in the code, which is the actual test of "generic beats another special case." Reverted,
   diff empty again.
3. **Manifest's own three demonstrated mutations, reproduced with my own text, not copy-pasted:**
   - `$set` reassignment (`$set: { "status.index": "done", tenantId: "attacker-tenant" }`) — 69/71
     RED, `$set reassigns tenantId`.
   - `$rename` (`$rename: { tenantId: "oldTenantId" }`) — 69/71 RED, `$rename reassigns tenantId`.
   - (`$unset` already covered in step 1, same mutation family the manifest names.)
   All reverted; `git diff --stat apps/api/src/indexing.ts` empty after each.
4. **`indexing.ts` diff from HEAD:** `git diff --stat apps/api/src/indexing.ts` empty both before
   any mutation and after final revert — confirmed production code untouched by this unit.
5. **Disclosed dotted-path limitation, independently reproduced:** mutated the update to `{ $set:
   { "status.index": "done", "nested.tenantId": "attacker-tenant" } }` — suite stayed 71/71 GREEN,
   confirming the scan does not catch a `tenantId` buried at a dotted path. Judged: **acceptable
   scope boundary, not a blocker.** `indexSession`'s only real `updateOne` call sets a single
   literal field (`status.index`) and never touches `tenantId` via any dotted path; the manifest's
   own disclosure is honest and the gap is theoretical against current code, not live. Closing it
   now would be exactly the whack-a-mole this unit exists to stop generically — leave as a
   disclosed limitation, no new criterion needed today.
6. **Full suite + typecheck, fresh runs:**
   - `pnpm --filter @lkb/api test` — 71/71 pass (baseline, before/after all reverts).
   - `pnpm -r test` — 335 total, 335 pass, 0 fail (per-package: core 7, db 8, ai 56, ask 32, index
     40, ingest 41, meeting-bot 40, apps/api 71, apps/web (vitest) 40). Exit 0.
   - `pnpm -r typecheck` — all 10 workspace projects with a typecheck script report `Done`. Exit 0.

## Judgment against criterion 3a

The unit closes ISS-066: the `$unset` gap that survived the prior cycle's per-operator special
case is caught by the new generic `assertUpdateBodyConfined`, and so is an operator (`$currentDate`)
that received no special case at all — the actual evidence that "generic" generalizes rather than
being a third hand-written case in disguise. No production code changed; only the test helper was
rewritten. The disclosed dotted-path gap is real but out of scope for today's code (see above).

## Ledger

ISS-066 flipped `open → fixed` in `qa/issues.jsonl` (this checker's own prior finding; verifiably
closed by this unit's evidence, see the amended `evidence` field).

```
VERDICT: PASS
SCOREBOARD: 4/4 manifest verify steps met, 1/1 contract criterion (3a, update-body confinement) holds
FAILURES (if any): none
ISSUES-WRITTEN: none (ISS-066 flipped open->fixed, not a new issue)
EXPLANATION: The generic assertUpdateBodyConfined scan catches $unset (the ISS-066 gap), $set
reassignment, $rename, and an operator the manifest itself never exercised ($currentDate) —
all independently reproduced with my own mutation wording, all reverted clean, indexing.ts
untouched throughout. The disclosed dotted-path limitation is real (verified: stays green under
a nested.tenantId mutation) but matches no code path indexSession actually uses today, so it is
an acceptable, honestly-flagged scope boundary rather than a blocking gap. Full suite 335/335 and
typecheck clean across all 10 projects.
```
