# Verdict — scoped-collection-updateOne

**Cycle checked:** 3
**Date:** 2026-09-07
**Checker mode:** Mode A (fresh context, re-ran everything myself, no builder reasoning trusted;
read both prior verdicts — cycle 1's original content recovered via `git show 85c6ed9` since
cycle 2 overwrote the file in place — to know exactly what each prior cycle found)

This is fix cycle 3 of 3, the maximum. No fourth cycle is available; if anything held back a PASS
here the unit would go to `STALLED`.

## What I re-ran myself

1. **Read `packages/db/src/lib/tenantScope.ts` and `tenantScope.test.ts` in full.** `countDocuments`
   (line 56) is present, tenant-merged, same construction as `deleteMany`/`updateOne`. The doc
   comment on the accessor itself (fixed in cycle 1) still correctly says it never returns `raw`,
   and `raw` is in fact gone from the returned object.
2. **`tenantScope.test.ts` now has 13 tests (was 10)** — `fakeDb()`'s mock (line 32) now
   implements `countDocuments`, and three new tests exist mirroring `updateOne`'s own coverage
   exactly as the manifest claims: tenant-merge (line 87), override-resistance (line 96), and an
   empty-filter case (line 102).
3. **Ran `pnpm --filter @lkb/db test` fresh: 13/13 pass.**
4. **Reproduced the `countDocuments` mutation myself** — edited line 56 from
   `raw.countDocuments(withTenant<T>(tenantId, filter))` to `raw.countDocuments(filter)`, re-ran
   `pnpm --filter @lkb/db test`. **Result: 10/13 pass, 3/13 FAIL** — the exact three new tests
   (tenant-merge, override-resistance, empty-filter), confirmed by reading the failure output
   (`AssertionError`, actual `{tenantId:'t2-victim'}`/`{}` vs expected `{tenantId:'t1'}`). This is
   the non-zero redden cycle 2 found missing (ISS-069) — now fixed. Reverted; re-confirmed 13/13
   clean, zero residual diff against the maker's own working-tree state.
5. **Reproduced the `updateOne` mutation myself too** (no regression check) — edited line 61 to
   drop the tenant merge, ran both `packages/db` (11/13 RED — the 2 `updateOne` tests) and
   `apps/api` (RED: `a DEGRADED run's writes are tenant-scoped too — the guard must not be a
   bypass`, asserting `undefined !== 't'` on `sessions.updateOne`). Both still redden exactly as
   cycle 1 established. Reverted; both packages clean again.
6. **TRUE repo-wide `.raw` search, my own** — Grep tool, pattern `\.raw\b`, glob
   `*.{ts,tsx,js,mjs,cjs}` (respects `.gitignore`), whole repo root. Exactly the same two matches
   as cycles 1 and 2, nothing new:
   - `packages/ingest/src/sources/recording.test.ts:24` — literal string `"call.raw"` in a test
     fixture, not a property access.
   - `sources/whatsapp_msg/src/wa/sessionManager.ts:83,129,169` — a WhatsApp socket's own `raw`
     field, in the separate git submodule this project's CLAUDE.md says not to govern here.
7. **`grep -rn "raw\." packages/db/src/collections`** — zero matches. All six collection files
   (`eval-runs.ts`, `gaps.ts`, `meeting-candidates.ts`, `trusted-senders.ts`,
   `watched-sources.ts`, plus the one I spot-checked below) confirmed clean of `.raw` calls.
8. **`node scripts/sync-real-turns.mjs --dry-run`** — listed 9 real TOC sessions, printed
   `No Mongo connection attempted (--dry-run).`, exited 0. Read the script in full: both Mongo
   calls (lines 63-64) go through `turns(tenantId).countDocuments(...)` /
   `.deleteMany(...)` — the real accessor, zero `.raw` references anywhere in the file.
9. **Spot-checked `packages/db/src/collections/gaps.ts`** against its real callers — `markReceived`
   / `markExpired` both call `gaps(tenantId).updateOne(...)` through the accessor, no hand-carried
   `tenantId`, matching the claimed migration pattern exactly. Also checked
   `apps/api/src/indexing.ts:149` — `sessionsColl(tenantId).updateOne({_id: sessionId}, ...)`, no
   `.raw` remaining, closing the ISS-065 gap the ledger already noted.
10. **Mongo connectivity check**: `13.202.206.101` (from `.env`'s `MONGODB_URL`) — `ping -n 2`
    returned 100% packet loss, same disclosed outage as cycles 1-2 and the parent
    `ingest-indexing-pipeline` contract. Could not independently run the live scratch-tenant proof
    this cycle either; this is an environmental block matching the contract's own disclosed
    limitation, not treated as a failure of this unit. The manifest's pasted live-proof (cycle 1's
    identical result, re-asserted as "identical" this cycle) is trusted only as a claim for the
    Mongo-write half, same as cycle 2's treatment — nothing about that changes the fact that both
    tenant-merge mutations reddened tests I ran myself, independent of Mongo being reachable.
11. **`pnpm -r test` (fresh)**: `packages/core` 7, `packages/db` 13, `packages/ai` 56,
    `packages/ingest` 41, `packages/index` 43, `packages/ask` 32, `packages/meeting-bot` 40,
    `apps/api` 77, `apps/web` (vitest) 40. **Total: 349/349 pass, 0 fail** — exact match to the
    manifest's claim.
12. **`pnpm -r typecheck` (fresh)**: 10 of 11 workspace projects in scope, all `Done`, exit 0
    (11th has no typecheck script, unchanged from prior cycles).
13. **`pnpm lint:structure` (fresh)**: `lint-loc`, `lint-dirsize`, `lint-root`, `lint-dupes`,
    `lint-migrations` all OK, `docs/SNAPSHOT.md` matches a fresh regeneration, dependency-cruiser
    clean (242 modules, 712 dependencies, zero violations).

## Judgment against the manifest's "How to verify" (1-7)

1. TRUE repo-wide `.raw.` search, only the two disclosed false positives: **met**, reproduced
   independently, nothing new appeared.
2. Reproduce both mutations, `countDocuments` reddening non-zero specifically: **met** — 3/13 RED
   for `countDocuments` (the exact class of test cycle 2 found absent), `updateOne` still reddens
   both packages with no regression.
3. `sync-real-turns.mjs` no longer references `raw`, `--dry-run` still lists real sessions: **met**.
4. Verify `countDocuments` against the real database on a scratch tenant if Mongo answers:
   **blocked by the same outage as cycles 1-2** — not held against the unit; the code path is
   confirmed correct by inspection and by the passing unit-test suite.
5. Spot-check a migrated `collections/*.ts` file against its real caller: **met** (`gaps.ts`,
   plus `indexing.ts`'s own `updateOne` call).
6. `pnpm -r test` (349), `pnpm -r typecheck`, `pnpm lint:structure` clean: **met**, all reproduced
   fresh, exact counts match.
7. "If anything real is still wrong, say so plainly": nothing found. The specific gap cycle 2
   filed (ISS-069 — zero coverage on `countDocuments`) is now closed with real, reproduced
   coverage; no new gap of the same shape was found on this pass (I checked `deleteMany`,
   `updateOne`, and `countDocuments` all have dedicated tenant-merge + override-resistance tests
   now — the accessor's full write/count surface is covered).

## Ledger

- **ISS-065**: re-confirmed fixed this cycle via my own mutation reproduction (no regression) —
  moved `fixed → verified`.
- **ISS-068**: re-confirmed fixed this cycle via my own repo-wide search + `--dry-run` run — moved
  `fixed → verified`.
- **ISS-069** (this cycle's target): genuinely fixed — three new tests added to
  `tenantScope.test.ts`, `fakeDb()` gained a `countDocuments` stub, and my own mutation of the
  exact line the fix depends on now reddens 3/13 tests (was 0/10 before this cycle). Moved
  `open → fixed`.

```
VERDICT: PASS
SCOREBOARD: 6/6 manifest verify steps met (1 of 6 environmentally blocked by a disclosed, pre-existing outage — not held against the unit), 0/0 open failures
FAILURES (if any): none
ISSUES-WRITTEN: none new; ISS-069 moved open -> fixed; ISS-065 and ISS-068 moved fixed -> verified (all three re-derived by my own reproduction this cycle, not asserted)
EXPLANATION: Cycle 3's fix closes exactly the gap cycle 2 found — countDocuments now has three dedicated tests (tenant-merge, override-resistance, empty-filter) and my own mutation of its tenant-merge line reddens 3/13 tests, where before this cycle the identical mutation reddened zero. I independently reproduced both mutations (countDocuments and updateOne), the true repo-wide .raw search (still only the two disclosed false positives), sync-real-turns.mjs --dry-run, a collections/*.ts spot-check, and the full suite/typecheck/lint (349 tests, 10 typecheck projects, lint:structure all clean, fresh runs). The only unverified item is the live scratch-tenant Mongo proof, blocked by the same disclosed, pre-existing host outage as cycles 1 and 2 — not a new or unit-specific gap. Nothing else was found wrong across three cycles of scrutiny; the unit earns PASS on its last chance.
```
