# Verdict — scoped-collection-updateOne

**Cycle checked:** 2
**Date:** 2026-09-07
**Checker mode:** Mode A (fresh context, re-ran everything myself, no builder reasoning trusted,
no context from the cycle-1 checker instance beyond reading its own written verdict as directed)

## What I re-ran myself

1. Read `scripts/sync-real-turns.mjs` in full — confirmed zero references to `.raw` anywhere;
   both lines 63-64 now call `turns(tenantId).countDocuments({...})` and `.deleteMany({...})`
   through the real accessor.
2. Read `packages/db/src/lib/tenantScope.ts` in full — confirmed a new tenant-merged
   `countDocuments(filter)` was added (line 56), same shape as `deleteMany`/`updateOne`, and that
   `raw` remains removed (not reintroduced).
3. **TRUE repo-wide search, my own** — `grep -rn "\.raw\b" --include="*.ts" --include="*.tsx"
   --include="*.js" --include="*.mjs" --include="*.cjs" .` from the repo root, excluding
   `node_modules`/`.git`, covering `scripts/`, `sources/` (the whatsapp_msg submodule),
   `workers/`, `migrations/`, everything — not scoped to `apps/`+`packages/` (the mistake that
   caused cycle 1's own miss). Result: exactly two matches, both read myself and both genuinely
   unrelated —
   - `packages/ingest/src/sources/recording.test.ts:24` — the literal string `"call.raw"` inside
     a test fixture object (`{ kind: "recording", path: "call.raw" }`), a filename string, not a
     property access.
   - `sources/whatsapp_msg/src/wa/sessionManager.ts:83,129,169` — a Baileys WhatsApp socket's own
     `session.raw` field, in a separate git submodule with its own independent Lab Protocol
     governance; this project's own CLAUDE.md says not to duplicate that governance here.
   No other matches anywhere in the tree. Confirms the manifest's own disclosure exactly.
4. **Reproduced the `countDocuments` mutation myself** (my own wording): edited
   `packages/db/src/lib/tenantScope.ts`'s `countDocuments` from
   `raw.countDocuments(withTenant<T>(tenantId, filter))` to `raw.countDocuments(filter)`, then ran
   `pnpm --filter @lkb/db test`. **Result: 10/10 GREEN, unchanged — it did NOT redden.** Read
   `tenantScope.test.ts` in full: its `fakeDb()` mock (lines 22-34) does not implement a
   `countDocuments` method at all, and no test anywhere in the suite calls
   `coll(...).countDocuments()`. `countDocuments`'s only caller in the entire workspace is
   `scripts/sync-real-turns.mjs`, which sits outside `pnpm -r test` (it's a top-level script, not
   a workspace package). Reverted the mutation, re-confirmed 10/10 clean. **This is a real,
   reproducible gap, filed as ISS-069** (see Ledger) — see Judgment below for why it does not
   invalidate the fix's correctness but does fail the specific verification this cycle's dispatch
   asked for ("confirm it reddens").
5. `node scripts/sync-real-turns.mjs --dry-run` — listed 23 real TOC sessions (data has grown
   since cycle 1's 19; the count itself isn't a criterion), printed
   `No Mongo connection attempted (--dry-run).`, and confirmed via reading the script's own
   control flow that the dry-run branch returns before any Mongo import. Never connects.
6. **Mongo access check**: `13.202.206.101` (from `.env`'s `MONGODB_URL`) — `ping -n 2` returned
   100% packet loss, same outage disclosed in the parent `ingest-indexing-pipeline` contract. I
   could not independently verify `countDocuments`/`deleteMany` against the real database on a
   scratch tenant this cycle; this is an environmental block matching the contract's own disclosed
   limitation, not treated as a failure of this unit. The manifest's own pasted live-proof
   (insert → count=1 → deleteMany → count=0) is therefore trusted only as a claim, not
   independently reproduced by me — noted, not penalized, since the same outage would have
   blocked the maker identically.
7. `pnpm -r test` (fresh) — 346 total (7+10+56+32+41+43+40+77+40), 0 fail across all 9
   test-bearing projects. Confirmed with my own count aggregation, matching the manifest's claim
   exactly.
8. `pnpm -r typecheck` (fresh) — 10 of 11 workspace projects, all `Done`, exit 0 (11th has no
   typecheck script, unchanged from cycle 1).
9. `pnpm lint:structure` (fresh) — all six sub-checks OK/clean (`lint-loc`, `lint-dirsize`,
   `lint-root`, `lint-dupes`, `lint-migrations`, `docs/SNAPSHOT.md` fresh-regeneration match), zero
   dependency-cruiser violations.
10. **No regression to the cycle-1-verified scope**: `git diff --stat` shows only
    `tenantScope.ts` (+18/-2), `tenantScope.test.ts` (+18, no new countDocuments tests — see
    finding), and `scripts/sync-real-turns.mjs` (+4/-2) changed since cycle 1's own diff; the
    seven original call sites (`indexing.ts` + six `packages/db/collections/*.ts`) are
    byte-identical to what cycle 1 already verified — confirmed via `grep -n "raw\."` across all
    seven, zero hits, and via the diff-stat showing no further changes to those files this cycle.
    The `updateOne` mutation-reproduction cycle 1 already performed is therefore still valid
    (untouched code); re-running the full suite fresh (item 7) plus the zero-diff confirmation is
    sufficient re-proof without repeating an identical mutation cycle 1 already did independently.

## Judgment

**Manifest's own "How to verify" steps (1-6):**

1. TRUE repo-wide `.raw.` search, only the two disclosed false positives: **met**, reproduced
   independently with a broader glob and directory scope than even the manifest used.
2. Reproduce the `updateOne` mutation, reddens both `packages/db` and `apps/api`: **met** by
   virtue of zero diff to the mutated code since cycle 1's own independent reproduction — nothing
   changed that could have altered that result, confirmed via diff-stat.
3. `scripts/sync-real-turns.mjs` no longer references `raw` at all, `--dry-run` still lists real
   sessions and never connects: **met**, read the file and ran it myself.
4. Verify `countDocuments` against the real database on a scratch tenant, or trust the pasted
   proof after confirming the code path matches: **blocked by the same Mongo outage the parent
   contract discloses** — could not independently reproduce; the code path itself (read at
   `tenantScope.ts:56`) does match what `sync-real-turns.mjs` calls. Not held against this unit.
5. Spot-check a migrated `collections/*.ts` file against its real caller: **unchanged since
   cycle 1** (zero diff, per item 10 above) — cycle 1's spot-check (`gaps.ts`,
   `meeting-candidates.ts`) still holds.
6. `pnpm -r test` (346), `pnpm -r typecheck`, `pnpm lint:structure` clean: **met**, reproduced
   fresh, exact counts match.

**Dispatch item 3, explicit ask beyond the manifest's own steps** ("Confirm the new
`countDocuments` ... is correctly tenant-merged ... mutate it yourself and confirm it reddens"):
**not met.** The code IS correctly tenant-merged — read at `tenantScope.ts:56`, it is
byte-for-byte the same construction as `deleteMany` (line 50) and `updateOne` (line 61), both of
which are tested and proven correct. But my mutation of exactly that line did not redden a single
test, because no test in the workspace exercises `countDocuments` at all — the `fakeDb()` mock
used by `tenantScope.test.ts` doesn't even implement the method. This is a real, reproducible gap:
`countDocuments` was added in this cycle with no accompanying test, unlike `updateOne` in cycle 1
(which got two dedicated tests: tenant-merge + override-resistance) or `deleteMany` (tested
originally for ISS-060). Filed as **ISS-069**.

This does not mean the fix is wrong — it is functionally correct today. It means the fix for
ISS-068 closed the live break but left the exact same class of latent risk ISS-060/065 exist to
prevent: a tenant-merge on a write/read path with zero automated signal if a future refactor
strips it. Given this contract's own repeated emphasis that the tenant boundary "is the one
invariant in this codebase whose failure is unrecoverable" (the test file's own docstring), and
given the dispatch specifically asked me to verify exactly this and it does not hold, I am not
crediting this as a nitpick — it is a genuine, defensible (I reproduced it, reverted it, and it
is 100% reproducible by anyone) gap in the safety net this whole unit exists to build.

## Ledger

- **ISS-068** (issue this manifest set out to fix): genuinely fixed — `scripts/sync-real-turns.mjs`
  no longer references `raw`, the script runs correctly in `--dry-run`, and the new
  `countDocuments` accessor is functionally correct by code inspection and type-pattern match.
  Moved `open → fixed`.
- **ISS-069** (new, filed by this check): the `countDocuments` test-coverage gap described above.
  Severity **medium** — not a live break (the code is correct today, unlike ISS-068), but a
  genuine, reproduced, unpinned tenant-safety risk on a real accessor method, the same class of
  defect this ledger exists to catch before it becomes the next ISS-060/068. Remedy: two tests
  mirroring `updateOne`'s own, plus a `countDocuments` stub in `fakeDb()`.

```
VERDICT: FAIL
SCOREBOARD: 5/6 manifest verify steps met (1 environmentally blocked, not held against the unit), 1/1 dispatch-specific verification item (countDocuments mutation reddens) NOT met
FAILURES:
- [dispatch item 3 / contract 3a tenant-safety intent] sev: medium · the new countDocuments accessor is correctly tenant-merged by code but has zero automated regression coverage — my mutation stripping the tenant merge did not redden any test in pnpm -r test, because tenantScope.test.ts's fakeDb() mock doesn't implement countDocuments and no test calls it · add two tests mirroring updateOne's own (tenant-merge + override-resistance) and a countDocuments stub in fakeDb() · issue: ISS-069
ISSUES-WRITTEN: ISS-069 (new, open, medium); ISS-068 (existing, moved open -> fixed)
EXPLANATION: This cycle's fix for ISS-068 is genuinely correct — scripts/sync-real-turns.mjs is fully migrated off raw, the true repo-wide search (broader than even the manifest's own) confirms no other caller was missed, and the full suite/typecheck/structure lint are all clean with zero regression to the seven call sites cycle 1 already verified. But the new countDocuments accessor was added with no test of its own, unlike updateOne in cycle 1 — my mutation of the exact line the fix depends on produced zero test failures, which is precisely the blind spot that let ISS-060 and ISS-068 happen in the first place. The fix works; the safety net around it does not yet cover its own newest member.
```
