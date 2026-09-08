# Manifest — roadmap-tracker-reconciliation

**Contract:** qa/contracts/tracker-integrity.md
**Goal task:** none (D-014 backlog tier 3; plan "MAKE THE MAKER-CHECKER LOOP WORK PROPERLY" step 5)
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none filed — closes a structural gap, not a ledger row.

## Why

D-014 made the roadmap backlog **tier 3**, so the loop can finally pull features instead of its own
findings. But the tier was pointing at a tracker that could not answer it correctly:

1. **The real roadmap was invisible.** Plan §10's units (`U0.5 … U4.2`) existed **only in the plan
   file**. `.goal/goal.json` held 35 `T-###` foundation rows and not one U-unit. `U3.1` — the Ask
   page, in flight in the concurrent session right now — was untracked entirely.
2. **The tracker advertised gate-blocked work as ready.** `T-021`/`T-022` showed `pending` with all
   deps `done`, so a readiness computation returned them as the next pull. They are in fact blocked
   by the open `qa/gates/golden-set-redesign.md`: the recall@5 metric is saturated at 1.000, so
   neither can be honestly completed. The first thing the new tier would have pulled was unfailable
   work.

## What changed

1. **`scripts/lib/tracker-audit.mjs`** — the G1 row regex accepted only `T-[0-9]+[a-z]?`, so U-ids
   parsed from neither file. Widened to `(T-[0-9]+[a-z]?|U[0-9]+\.[0-9]+)`. **This was load-bearing,
   not cosmetic:** without it, importing the U-units would have reported all 21 as "in goal.json but
   not TASKS.md" and failed the `lint:structure` commit gate.
2. **`.goal/goal.json` + `TASKS.md`** — 21 U-unit rows added to **both** (G1 compares row-sets *and*
   normalised status, so one without the other fails). Statuses were **verified on disk, not copied
   from the plan** — see below.
3. **`T-021`/`T-022`** → `status: blocked` with `blocked_by: qa/gates/golden-set-redesign.md`, in
   both trackers.
4. **`scripts/lib/tracker-audit.test.mjs`** — 2 tests: U-ids parse and normalise across both files;
   and a genuine U-unit drift is *still* caught, proving the widened regex did not weaken G1.

## Statuses verified on disk, not assumed

| Unit | Evidence | Status |
|---|---|---|
| U0.7 / U0.8 | `STUB_ROUTES` now contains only `POST /webhooks/register` | done |
| U0.9 | `packages/db/src/collections/` has topics, speakers, decisions, orgs, graph-edges | done |
| U1.1 | `packages/ai/src/provider.ts` exists, **zero** `embed` references | pending |
| U1.2 | `packages/index/src/vector/` **absent** | pending |
| U2.1 | no `topics()` writer anywhere in `packages/index/src` or `apps/api/src` | pending |
| U3.1 | `apps/web/src/pages/AskPage.tsx` + `api/ask.ts` exist (concurrent session) | in_progress |

## Evidence

| check | result |
|---|---|
| `node scripts/tracker-audit.mjs --gate g1` | **OK**, exit 0 |
| `node --test scripts/lib/tracker-audit.test.mjs` | **7/7** (5 pre-existing + 2 new) |
| `pnpm lint:structure` | clean — loc 245, dirsize 75, dupes 255, SNAPSHOT fresh, G1 OK, depcruise 0/267 |

**The unit's actual purpose, demonstrated.** Readiness recomputed from the updated tracker:

```
READY:   T-007, T-011, T-013, T-015, T-028, U1.1, U2.1, U3.1 (in flight), U4.1
BLOCKED: T-021 -> qa/gates/golden-set-redesign.md
         T-022 -> qa/gates/golden-set-redesign.md
```

The tier now returns real feature work (`U1.1` embed seam, `U2.1` topic promotion, `U4.1` upload →
transcribe) and no longer returns the two gate-blocked rows.

**The headline percent moved and I am flagging it rather than burying it: 74% (26/35) → 55%
(31/56).** Nothing regressed. The denominator grew because genuinely remaining work is now tracked
instead of living in a plan file. A number that rises when you write work down is the number that
was wrong before. It is still *not* comparable to the catalogue score (24.6%), which measures
shipped product features, not tasks.

## What I deliberately did NOT do

The last sweep escalated a good idea: re-express `T-021`'s unfailable `recall@5 >= 0.85` as
"baseline verdict is `informative`" via the shipped `assessBaseline`, which is a property of the
*instrument* and therefore correct under every option A–D of the open gate. **I did not build it**,
for two reasons, and I want the checker to rule on whether that restraint was right:

1. A typed `done_check` of kind `cmd` is an execution surface. `/goal`'s security invariant says it
   is **allowlisted at task creation and reviewed by the human, never introduced free-form
   mid-run by an auto-tick.** Arming one silently is exactly that.
2. The gate asks the human how to fix the saturated metric. Re-expressing the criterion myself
   answers part of that question on their behalf, however defensible the reasoning.

Marking the tasks `blocked` achieves the honest half — the tracker stops lying about readiness —
without pre-empting the decision.

## How to verify (checker)

1. `node scripts/tracker-audit.mjs --gate g1` and `pnpm lint:structure` yourself.
2. **Revert the regex to `T-[0-9]+[a-z]?` and confirm G1 fails with 21 `onlyGoal` rows** — that
   proves the change is load-bearing rather than decorative. Restore it
   (`node scripts/lib/mutate.mjs apply/restore` — the guard shipped this session).
3. **Spot-check at least three status claims in the table above against the actual files.** I
   verified them, but the whole point of this unit is that the tracker stopped matching reality
   once; take none of it on my word.
4. Recompute readiness and confirm `T-021`/`T-022` are excluded and at least one U-unit is offered.
5. **Rule on the restraint in "What I deliberately did NOT do".** Was leaving the `done_check`
   unbuilt correct, or is it the maker declining work it should have done? Either answer is fine —
   I want it decided rather than left implicit.
6. `ISSUES-WRITTEN: none` is a complete check. Do not hunt a finding to justify the check.

## Risk / rollback

Tracker rows, one regex, two tests. No product code touched — `apps/`, `packages/` unchanged except
`scripts/lib`. Fully reversible by `git revert`.

**Status: ready-for-check**
