# Manifest — claims-write-targeting
**Contract:** qa/contracts/tree-index-v2.md
**Goal task:** U2.1b
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** ISS-C-CLAIMS-TARGETING-001 (high)

## Why this unit exists, and why it is pulled now rather than later

The U2.1 cycle-3 checker PASSed the unit and then filed this with a **hard precondition: it must
close before U2.2/U2.3 enables any live entity backfill.** It is the top open high-severity item,
so it is tier 2 and it is next.

The finding: two mutations survived a fully green 139-test suite —
`.find({"evidence.sessionId": sessionId})` → `.find({})`, and `.updateOne({_id: c._id})` →
`.updateOne({})`.

**The pattern is worth naming, because this is the third time in one unit.** My nine writer tests
asserted the value each write *carries* and never the predicate that decides *which rows it
reaches* — and the second is where scoping lives. `fakeDb` had been recording the filters all
along; nothing read them. Worse, `fakeDb.find` **ignored its filter entirely**, so a scoping
regression was structurally invisible: widening the query returned the same rows either way.

My own clearing test made it concrete — it seeded a claim on session `"other"` and expected it
visited, **encoding unscoped behaviour as the expected behaviour.** It would have passed just as
happily against `.find({})`.

## What changed

- `apps/api/src/indexing/testutils.ts` — `fakeDb.find` now **honours the claims filter**. A fake
  that answers the same regardless of what it was asked cannot test what it was asked.
- `apps/api/src/indexing/promote-entities.test.ts` — the clearing test corrected to seed on the
  session actually being indexed, plus 3 targeting tests: the read is scoped to this session; each
  claim update targets one `_id`; topic/org upserts target their own `_id`.

No production code changed — the shipped filters were already correct. This unit closes the gap
that a future edit was undefended.

## How to verify

- `pnpm --filter @lkb/api test` → 142 pass
- mutation A: `.find({...})` → `.find({})` → must fail
- mutation B: `.updateOne({_id})` → `.updateOne({})` → must fail

## Actual outputs

```
MUTATION A: find scoped -> find({})            -> 141 pass / 1 fail
MUTATION B: updateOne({_id}) -> updateOne({})  -> 140 pass / 2 fail
RESTORED (verified identical to HEAD) · MUTATIONS CLEAN: none outstanding
clean                                          -> 142 pass / 0 fail
```

Both mutations that survived the previous cycle are now killed, at different counts — so the two
tests pin two distinct defects rather than both tripping on one symptom.

## Disclosed

1. **Fixture-level only.** No live write; `topics`/`orgs` remain 0 rows and `claims.topicRefs`
   empty. This unit does not change the U2.1 deferral.
2. **I fixed the fake, which is itself a test-infrastructure change.** A checker should confirm
   `fakeDb.find` now filtering does not quietly weaken any *other* test that relied on it returning
   everything.
3. **Still owed from U2.1 and not addressed here:** a contract for this writer (a checker has now
   graded this persistence layer against a plan bullet three times), and D-015 by-issue-id
   reproduction reporting (ISS-134).

## Status: ready-for-check
