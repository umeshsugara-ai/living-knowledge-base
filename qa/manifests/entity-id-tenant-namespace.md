# Manifest — entity-id-tenant-namespace
**Contract:** qa/contracts/entity-promotion.md
**Goal task:** U2.1c
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** contract C6 (security/tenancy class — never round-capped)

## This is the second time I have shipped this exact bug

C6 was derived by the checker **while writing the contract**, from the code and the ISS-121
precedent, and stated honestly as *believed unmet, not live-reproduced*. **I reproduced it live
before fixing anything:**

```
tenant A upsert {_id:"uk"}  -> OK
tenant B upsert {_id:"uk"}  -> E11000 duplicate key ... index: _id_ dup key: { _id: "uk" }
cleanup deleted: 1 | leftover: 0
```

`scopedCollection` merges `tenantId` into the **filter**, but Mongo's `_id_` index is unique per
**collection**. So tenant B's upsert of a slug tenant A already holds matches nothing, attempts an
insert, and is rejected.

**ISS-121 was the same bug, in `recordVectorGap`, fixed by me one unit earlier** with
`vectorGapId(tenantId, sessionId)`. I wrote that fix, wrote a comment explaining why the id must
carry the tenant, and then did not carry the lesson one file across.

**And it is worse here than it was there.** ISS-121's throw stranded one session loudly enough that
a checker found it. This one sits inside the never-throws `catch` (C2) that I also added — so
tenant B would lose **all** entity promotion, silently and permanently, while the log reads
`promotion-failed` and every status field says done.

## What changed

- `apps/api/src/indexing/promote-entities.ts` — exported `entityId(tenantId, slug)`. Both the
  `topics` and `orgs` upserts use it.
- **`claims.topicRefs` is namespaced through the SAME helper.** If the rows carried a tenant and
  the refs did not, every ref would point at an id that does not exist — two conventions that agree
  until one is edited. One function, not two.
- 3 tests: two tenants + same slug produce different ids (topics and orgs), and a `topicRef`
  equals the id actually written.

## No migration — verified, not assumed

`topics` and `orgs` are still 0 rows (the U2.1 deferral holds), and `claims.topicRefs` is empty on
all 81 claims, so no stored id carries the old shape. Both scratch probes cleaned up and were read
back at 0 leftover.

## How to verify

- `pnpm --filter @lkb/api test` → 159 pass
- mutation: `entityId` → `return slug` → must fail
- live: two tenants upserting the same slug must both succeed

## Actual outputs

```
MUTATION: entityId -> bare slug        -> 155 pass / 4 fail
RESTORED (identical to HEAD) · MUTATIONS CLEAN: none outstanding
live, WITH the fix: BOTH tenants upserted OK; rows: 2; cleanup deleted 2, leftover 0
live, BEFORE the fix: tenant B -> E11000 duplicate key on index _id_
```

## Disclosed

1. **The `_id` shape is now `<tenantId>:<slug>`**, so `topicRefs` values carry a tenant prefix. That
   is deliberate — a ref must resolve to a real `topics._id` — but it is a visible convention change
   and a checker should confirm nothing else parses these ids expecting a bare slug.
2. **The pure `promoteTreeEntities` still returns bare slugs.** Namespacing happens at the write
   boundary only, which keeps the pure function tenant-agnostic and testable. A checker should
   decide whether that split is right or whether the tenant belongs in the pure layer.
3. **Contract C6 says "either tenant-namespace the `_id`, or carry a compound unique index".** I
   took the first, matching the ISS-121 precedent. A compound `(tenantId, slug)` unique index would
   be the more database-native answer and would keep ids readable; I did not take it because it
   needs a migration and an index assertion at boot, and this project has no live rows to justify
   that yet.
4. **This does not change the U2.1 deferral.** `topics`/`orgs` remain 0 rows; C8's precondition
   still holds.

## Status: ready-for-check
