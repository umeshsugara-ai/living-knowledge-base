# Verdict — tenancy-filter-falsifiability

**Date:** 2026-09-09
**Cycle checked: 1**
**Commits under judgement:** `52bf9e8` (ISS-211 fix), `3225ae1` (ISS-210 manifest correction), `c8338b1` (manifest)
**Artifact:** `apps/api/src/indexing/promote-entities.test.ts` (the only source file changed)
**Contract:** none, deliberately. ISS-203 owns the missing vacuity criterion and the
`handshake-liveness` START is a pending HUMAN_GATE; my predecessor declined to open a third
contract home while a gate on the second is unanswered, and I am not overriding that. Judged
against ISS-210's and ISS-211's recorded fix directions (D-015).

```
VERDICT: PASS
SCOREBOARD: 2/2 issues' recorded fix directions satisfied, 4/4 non-vacuity properties re-derived
FAILURES: none
LIVE-BROWSER: not-applicable (apps/api/src/indexing/promote-entities.test.ts + two qa/manifests
  files; I compiled qa/ui-surfaces.json's own pattern and matched it myself — both False,
  apps/web/src/pages/AskPage.tsx True as a positive control)
ISSUES-WRITTEN: none. Ledger: ISS-210 open → fixed, ISS-211 open → fixed.
EXPLANATION: Both halves of the ISS-211 claim reproduce under my own mutant, which typechecks:
M-updateOne-filter-unscoped SURVIVES the ISS-202 test at 99ed8f3 and is KILLED at HEAD. The
ISS-210 dispute goes to the MAKER — I measured both body mutants at the true baseline a032a8f and
both were already dead there, so my predecessor's verdict is wrong to call M-topic-body a
first-kill by this test. Two low-severity notes below (a stale failure count, and a newly dead
disjunct) enter no backlog. THE SEAM CLOSES — see the ruling.
```

## What I re-ran (my own mutants, produced from the issue rows — not the maker's table)

Harness per D-020: `scripts/lib/mutate.mjs apply` (refuses an uncommitted file) → python edit →
`git diff --stat` asserted non-empty (mutant present on disk) → `pnpm --filter @lkb/{db,api}
typecheck` **before the run counts** → `timeout 600 pnpm --filter @lkb/api test` → restore in
`trap … EXIT INT TERM ERR`, restoring **only the paths I mutated**, then `git diff --quiet` +
`assert-clean`. Every batch carried a no-op control. Every run printed `RESTORE OK` /
`MUTATIONS CLEAN`. The tree at the time of writing is clean apart from `.goal/goal.json`, which I
did not touch.

| # | mutation | file | ISS-202 test | repo-wide fails |
|---|---|---|---|---|
| CONTROL | none, HEAD | — | pass | 173 pass / 0 fail / 0 cancelled |
| **M-updateOne-filter-unscoped @ `99ed8f3`** | `raw.updateOne(withTenant(…))` → `raw.updateOne(filter)` | `packages/db/src/lib/tenantScope.ts` | **SURVIVES** | 3 (ISS-154, session.test.ts ×2) |
| **M-updateOne-filter-unscoped @ HEAD** | same mutant, same file | same | **KILLED** | 4 (the ISS-202 test + the same 3) |
| CONTROL | no-op, test file restored to `a032a8f` | — | pass | 173 / 0 / 0 |
| **M-topic-body @ `a032a8f`** | drop `tenantId` from TOPIC `$set` | `promote-entities.ts` | *(not present)* | **1 — `ISS-126: … UNIONED sessionRefs`** |
| **M-org-body @ `a032a8f`** | drop `tenantId` from ORG `$set` | `promote-entities.ts` | *(not present)* | **1 — `ISS-156: the ORG body carries tenantId too`** |
| M-idIsNamespaced-always-false @ HEAD | the new READ disjunct forced false | the test file | pass | **0 — the disjunct is never reached** |

`a032a8f` is the parent of `99ed8f3`, and `git diff a032a8f HEAD` is **empty** for both
`promote-entities.ts` and `tenantScope.ts` — so the baseline differs from HEAD only in the test
file, which is what makes the body-mutant measurement above a clean read of the baseline.

## ISS-211 — the fix is real, and the split is not itself vacuous

**Before/after reproduce exactly as claimed, and the direction matters more than the numbers.** At
`99ed8f3` a write whose filter has lost its tenant walks past a test whose name is *"every write is
tenant-scoped **on filter** and body"*. At HEAD it does not. That is the first genuine first-kill in
this thread, as the maker says.

Three follow-up probes the dispatch asked for:

1. **Is the write branch load-bearing, or does the read branch leak back into it?** Load-bearing.
   `hasTenantField` is the sole gate for `topics.updateOne` and `orgs.updateOne`, and removing the
   tenant from the write filter now reddens this test specifically.
2. **Is `idIsNamespaced` reachable?** **No — it is dead in practice**, and I measured that rather
   than reasoned it: forcing it to `false` leaves the suite at **173/173**. The only captured READ
   is `claims.find {"evidence.sessionId":"s1","tenantId":"tenant-a"}`, which already satisfies
   `hasTenantField`, so the disjunct short-circuits away every time. This is the *same shape* as the
   `|| false` branch my predecessor found — ISS-211's own fix_direction asked the maker to "drop the
   `|| false` dead branch's implied claim that this function discriminates cases it does not reach",
   and the split replaced one unreachable branch with another. **Low severity, and I am filing no
   issue** (this repo's verdict rule: low observations go in the explanation, not the backlog).
   It weakens nothing — the assertion is strictly stronger with the disjunct removed than with it
   present — and the comment above it is honest about what it is for.
3. **Does requiring `tenantId` on writes over-constrain?** **No, and it is not an over-fit to
   today's three ops.** The constraint is a property of the *wrapper*, not of the captured set:
   every write in `promote-entities.ts` goes through a `scopedCollection` handle, and
   `tenantScope.ts:66-67` merges `tenantId` into the filter via `withTenant` unconditionally. A
   legitimate future write therefore *cannot* arrive filtered on a namespaced `_id` alone unless it
   bypasses `withTenant` — which is precisely the ISS-065/ISS-078 defect class this assertion
   exists to catch. The only way to fail this test honestly is to reintroduce the escape hatch.

**One correction to the manifest's own table, low severity, no issue filed.** The cells read
"SURVIVES — **0 failures**" and "KILLED — **2 failures**". Neither count is right repo-wide (3 and
4); under the narrower reading "failures inside `promote-entities.test.ts`" the second is right but
the first is **1**, not 0 — `ISS-154` reddens at the baseline too. The *verdicts* SURVIVES/KILLED
are correct and independently reproduced, so nothing turns on it. It is worth naming only because
it is the exact habit ISS-210 exists to fix, recurring inside the unit that fixes it.

## ISS-210 — the dispute, ruled: **the maker is right and my predecessor's verdict carries an error**

I did not take either account. I restored the test file to `a032a8f`, applied each body mutant,
typechecked, and read the failure list:

```
M-topic-body @ a032a8f -> 1 fail: "ISS-126: the written topic carries the UNIONED sessionRefs …"
M-org-body   @ a032a8f -> 1 fail: "ISS-156: the ORG body carries tenantId too …"
```

**Both body mutants were already dead at the baseline the unit branched from.** So:

- The manifest's original `before: survived` was wrong for **both** rows, not one — the maker's own
  correction, made against its own interest, is the accurate account.
- `qa/verdicts/vacuous-tenancy-assertion.md` marks the maker's M-topic-body claim
  "**confirmed**" and its explanation calls that mutant a kill by the new test. That is an
  **error in the predecessor verdict**, recorded here. It is a partial error, not a reversal: the
  predecessor named `ISS-126 sessionRefs` in its own "other killers" column, so it had the fact and
  drew the wrong conclusion from it. The PASS it issued still stands — the three ISS-202 hatches are
  genuinely closed, which I am not relitigating.
- The one true first-kill in the thread is `M-updateOne-filter-unscoped`, exactly as the manifest
  now says.

A maker that measures a result contradicting its checker, and reports it against itself, is the
behaviour D-015 was written to produce. Credited.

## Ruling on the seam: **CLOSE IT.**

The dispatch asked for this plainly, so here it is plainly. **`promote-entities.test.ts`'s assertion
strength is closed to further units.** Reasoning, in the terms `.claude/CLAUDE.md` sets:

1. **These are not security-class findings, despite the vocabulary.** The class-based exemption
   exists because ISS-078 — a real cross-tenant disclosure — surfaced at round 5. Rounds 3 and 4
   produced nothing of that kind. ISS-211's own row says it: *"NOT A SUITE GAP … coverage is
   complete at the suite level, so nothing is exposed"*, and I confirmed that independently — the
   write-filter mutant was killed by `ISS-154` and two `session.test.ts` tests **at the baseline**,
   before this unit existed. Nothing shippable was ever at risk in rounds 3–4. What these rounds
   fixed was **which test carries the guarantee its name advertises** — that is test-quality and
   evidence-accuracy, and the 2-PASS cap applies to it. Two PASSes now exist
   (`vacuous-tenancy-assertion`, this one). The cap is met.
2. **The remaining finding is strictly cosmetic and already demonstrates the diminishing return.**
   Round 4's fix swapped an unreachable `|| false` for an unreachable `idIsNamespaced`. A round 5
   on that would change no behaviour, kill no mutant, and by the same logic invite a round 6.
3. **The opportunity cost is now the dominant term.** ISS-202 items 1+2 (`vacuous-evidence-probes`,
   including a QA probe whose right answer may be deletion, and a web test needing a real click),
   the `handshake-liveness` contract START HUMAN_GATE, and the roadmap tier are all open while this
   file is being polished. Tier 3 of this repo's backlog priority — *"the next unblocked roadmap
   task … this tier is not optional and not last"* — was written for exactly this situation.

**Operative rule going forward:** a further finding on this file's assertion strength is
`file-don't-fix` and does **not** become a unit. The exemption survives narrowly and precisely — if
a mutant demonstrates an **actually unscoped operation reaching production code** (an op bypassing
`withTenant`, an unscoped `find`, a filter without a tenant discriminator that no test kills), that
is the ISS-078 class, it is uncapped, and it opens a unit at any round count. Wording of a comment,
reachability of a disjunct, and accuracy of a mutation table's counts are not that.

## Ledger movements

- **ISS-210** `open → fixed`. Its fix_direction was a habit fix — *"a before/after mutation table's
  'before' column must be measured at the commit the unit branches from … never copied from the
  issue row"*. The unit did that, at `git show a032a8f:<path>`, and the measurement corrected the
  checker as well as the maker. Verified by my own re-run at the same baseline.
- **ISS-211** `open → fixed`. Its fix_direction offered options (a) and (b) and said *"Do NOT do
  both by adding a third test."* The unit took (a), added no test, and I reproduced both halves of
  the before/after myself. The one instruction not fully honoured — dropping the dead-branch claim —
  came back as a *new* dead branch rather than being removed; noted above, not charged, not filed.
- No new issues.
