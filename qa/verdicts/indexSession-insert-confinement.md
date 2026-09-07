# Verdict — indexSession-insert-confinement

**Contract:** qa/contracts/ingest-indexing-pipeline.md, criterion 3a
**Manifest:** qa/manifests/indexSession-insert-confinement.md
**Cycle checked:** 1
**Date:** 2026-09-07
**Mode:** A (unit check), fresh context, no builder reasoning available

## What I re-ran myself (nothing taken on trust)

1. **`git diff --stat -- apps/api/src/indexing.ts` against HEAD → empty**, both before and after
   my own mutation experiments (reverted each time). Confirmed: production code untouched by this
   unit — a pure test-coverage fix, as claimed.

2. **ISS-061 mutation, reproduced independently, own wording** — planted a raw untenanted
   `db.collection("turns").insertMany([{_id:"CHK-EVIL-1", sessionId, text:"planted by checker"}])`
   right after turns load (occurrence count confirmed 0→1 via grep before running). Result:
   `apps/api` went 71/71 GREEN → **69/71 RED**, both tenant-confinement tests failing with
   "turns.insertMany wrote a document with no tenantId — it can be written into another tenant's
   data (ISS-061)". Reverted; confirmed `git diff` on `indexing.ts` returns to empty and suite
   returns to 71/71.

3. **Second (`$set`-reassignment) mutation, reproduced independently, deliberately different shape
   from the manifest's** — the manifest used a `$set` shape; I used a **raw replacement-style
   update body with no `$set` wrapper**: `updateOne({_id, tenantId}, {"status.index":"done",
   tenantId:"checker-other-tenant"})`. Result: 71/71 GREEN → **69/71 RED** — "sessions.updateOne's
   update body reassigns tenantId — it can move a document into another tenant". This confirms the
   fix is not narrowly matched to the maker's exact `$set` string; it also catches the raw-document
   variant, exactly as the manifest claims (`assertAllCallsConfined` checks both `call.update.$set`
   and a bare `call.update.tenantId`).

4. **Vacuity guard** — suppressed both real inserts (`sessionPagesColl(...).insertOne(page)` and
   `claimsColl(...).insertMany(claimDocs)`, replaced with `void`) in a healthy run. Result: the
   confinement test **fails**, not passes — it does not silently pass with zero documents
   inserted. (It fails on the upstream `writes.length >= 4` assertion at line 134 before reaching
   the dedicated "must actually insert at least one document" assertion at line 136, because
   suppressing both inserts also drops the write count below 4 — but this is still failing for a
   real, non-accidental reason tied to the missing writes, not a false pass. I did not find a
   configuration that isolates the line-136 assertion alone without changing write count, but the
   guard's stated purpose — a future refactor that stops inserting anything cannot make this test
   pass — is confirmed true.) Reverted; 71/71 clean again.

5. **`tree_index` exception (criterion 3a bound)** — read `indexing.ts` directly: the only
   `tree_index` calls are `findOne` (`loadTreeRoot`) and `replaceOne` (the write, with `upsert:
   true`) — no `deleteMany`, no insert of any kind against that collection. The test's exception
   (`indexing.test.ts:96-101`) correctly skips document-confinement checks only for `tree_index`
   and still asserts its filter's `node_id` matches `tenant:<id>`. Matches criterion 3a exactly —
   the exception is not wider than what's bounded.

6. **Hunt for another gap (as the manifest's own verify step asked)** — found one. Widened the
   real `sessions.updateOne` call to add `$unset: { tenantId: "" }` alongside the existing `$set`.
   Result: **71/71 GREEN even with tenantId stripped from the document** — `assertAllCallsConfined`
   inspects `call.update.$set` and a bare `call.update.tenantId`, but never `call.update.$unset`.
   A write that *removes* the tenant marker (rather than reassigning it to another tenant's value)
   is invisible to this check. Filed as **ISS-066** (medium — latent, not live: `indexSession` has
   no `$unset` call today). This does not invalidate the unit's own claim: ISS-061 (the insert
   blind spot) and the `$set`-reassignment gap are both genuinely closed; ISS-066 is a distinct,
   new call-shape gap in the same family, not a hole in what this unit set out to fix.
   I did not find a bulkWrite/findOneAndUpdate/aggregate gap — `indexSession`'s real code issues
   none of those shapes today, and the fake db's `collection()` stub has no such methods, so any
   future addition of one would throw at test time (fail loud) rather than silently pass.

7. **Full suite + typecheck**, fresh runs:
   - `pnpm -r typecheck` → all 10 workspace projects `Done`, exit 0.
   - `pnpm -r test`: core 7/7, db 8/8, ai 56/56, ingest 41/41, ask 32/32, index 40/40,
     meeting-bot 40/40, apps/api **71/71**, apps/web (vitest) 40/40 → **335/335 total, 0 fail**,
     matching the manifest exactly.

## Ledger

- **ISS-061**: `open → fixed` (verifiably fixed this unit, my own independent reproduction —
  see #2 above). Per protocol, a later re-check would move it `fixed → verified`; this is the
  first real check (the prior dispatch terminated before writing any verdict, so no cycle was
  consumed and this is legitimately cycle 1).
- **ISS-066** (new): filed — `$unset`-stripping-tenantId blind spot in `assertAllCallsConfined`,
  severity medium, does not block this unit.
- The second gap (the `$set`-reassignment blind spot the terminated dispatch's dying words
  reported) was never formally filed in the ledger before this unit closed it, so there is nothing
  to flip to `fixed` for it — it's folded into this unit's own fix, evidenced above (#3).

## Judgment against criterion 3a

Criterion 3a requires every query `indexSession` issues to be tenant-confined via
`scopedCollection`, with the `tree_index` exception bounded to no destructive multi-document op
and a single shared filter. This unit's actual change is scoped narrower — it hardens the *test*
that verifies that confinement, closing two independently-reproduced blind spots (untenanted
insert; `$set`-reassignment) without touching production code, which was already correct per last
cycle's fix. Both closures verified by me directly, not accepted from the manifest's paste.

VERDICT: PASS
SCOREBOARD: 4/4 criteria met, 0/0 invariants blocked (manifest's own scope: insert blind spot closed, $set-reassignment blind spot closed, no production-code change, vacuity guard real; tree_index exception unchanged and correctly bounded)
FAILURES (if any): none
ISSUES-WRITTEN: ISS-066 (new, medium, non-blocking); ISS-061 status updated open→fixed
EXPLANATION: Independently reproduced both closed gaps with my own mutation wording/shapes (not the maker's), confirmed the vacuity guard genuinely fails when nothing is inserted, confirmed indexing.ts has zero diff from HEAD, and confirmed the full suite (335/335) and typecheck (10/10) are clean. Went hunting for a further gap per the manifest's own ask and found one ($unset stripping tenantId is invisible to assertAllCallsConfined) — filed as ISS-066, non-blocking since it's a distinct call shape this unit never claimed to cover.
