# Verdict — scoped-collection-updateOne

**Cycle checked:** 1
**Date:** 2026-09-07
**Checker mode:** Mode A (fresh context, re-ran everything myself, no builder reasoning trusted)

## What I re-ran myself

1. `grep -rn "\.raw\b" apps/api/src packages/db/src packages/index/src --include="*.ts"` — no
   output, matching the manifest's own claim exactly as scoped.
2. A repo-wide search for `.raw` (Grep tool, glob `*.{ts,tsx,js,mjs}`, then a broader ripgrep over
   the whole tree excluding `node_modules`) — found two unrelated hits (`recording.test.ts`'s
   literal string `"call.raw"`; `sources/whatsapp_msg/.../sessionManager.ts`'s own unrelated
   `session.raw` field for a Baileys socket, a different project's own governance) and **one real
   eighth call site**: `scripts/sync-real-turns.mjs:63-64`, `turns(tenantId).raw.countDocuments(...)`
   and `.raw.deleteMany(...)`.
3. Read `packages/db/src/lib/tenantScope.ts` in full — confirmed the `coll(tenantId)` return
   object exposes only `find/findOne/insertOne/insertMany/deleteMany/updateOne`; `raw` is not
   returned anywhere. So `turns(tenantId).raw` is `undefined`, and `.countDocuments`/`.deleteMany`
   on it throws immediately.
4. Confirmed `scripts/sync-real-turns.mjs` is real, live code, not dead/vestigial: ran
   `node scripts/sync-real-turns.mjs --dry-run` myself — it listed 19 real TOC sessions ready to
   sync. Did **not** run it without `--dry-run`: that path issues a real `deleteMany` against real
   `turns` data, and I will not run a destructive write just to watch it crash. The static read of
   `tenantScope.ts` already proves the break without needing to execute it.
5. Reproduced the mutation myself (my own wording, not copy-pasted): edited
   `packages/db/src/lib/tenantScope.ts`'s `updateOne` from
   `raw.updateOne(withTenant<T>(tenantId, filter), update)` to `raw.updateOne(filter, update)`,
   then ran `pnpm --filter @lkb/db test` and `pnpm --filter @lkb/api test`.
   - `packages/db`: 2 of the 10 tests went RED (`tenantScope.test.ts`'s two new `updateOne` tests —
     tenant-merge and override-resistance), matching the manifest's claimed 8/10.
   - `apps/api`: `indexing.test.ts`'s confinement assertion failed
     (`sessions.updateOne issued a query with no tenantId`), reddening the real caller's own suite,
     not just the accessor's package — confirming the seven migrated call sites genuinely exercise
     the shared path.
   - Reverted the mutation; re-ran both — `packages/db` 10/10, `apps/api` 77/77, clean.
6. `pnpm -r test` (fresh) — 346 total, 0 fail across all 9 test-bearing projects (core 7, ai 56,
   ingest 41, ask 32, index 43, meeting-bot 40, api 77, web 40, db 10).
7. `pnpm -r typecheck` (fresh) — 10 of 11 projects (the 11th has no typecheck script), all `Done`,
   exit 0.
8. `pnpm lint:structure` (fresh) — all six sub-checks OK/clean, `docs/SNAPSHOT.md` matches a fresh
   regeneration, dependency-cruiser clean.
9. Read `packages/db/src/collections/gaps.ts` and `meeting-candidates.ts` (the two named
   spot-check candidates) plus their claimed test coverage (`gap-tracking.test.ts`,
   `meeting-candidates.test.ts`). Both test files use in-memory fakes (`fakeStore()` /
   `fakeMeetingCandidatesDeps()`), never the real `scopedCollection`-backed module — so neither
   actually exercises the real `updateOne` call this unit introduced. This matches the manifest's
   own disclosed limitation ("no behavioural regression test exists for the six
   `packages/db/collections/*.ts` call sites beyond the shared accessor's own mutation coverage")
   — honestly stated, not a new finding, and low-risk since only the filter shape changed
   (hand-carried `tenantId` -> accessor-supplied one), not the behavior.

## Judgment

**Criterion evidence (this unit's own stated verify steps + the parts of contract 3a it touches):**

- Tenant-merged `updateOne` added to `tenantScope.ts`, mirroring `deleteMany`'s pattern: **met**.
- Seven named call sites (`indexing.ts` + six `packages/db/collections/*.ts`) migrated off
  `.raw.updateOne`, hand-carried `tenantId` dropped from each filter: **met**, read every one.
- Mutation reddens both `packages/db` and `apps/api` through the real callers: **met**, reproduced
  independently with my own mutation.
- Full suite / typecheck / lint clean: **met**, reproduced fresh.
- Spot-check of behavior-preservation for the six untested collection files: **partially met** —
  correctly and honestly disclosed as not independently pinned; the risk assessment (filter-shape
  only, behavior unchanged) holds up on reading the code.
- **"Removed `raw` entirely ... nothing legitimately needs it anymore" (What changed, item 1):
  false.** `scripts/sync-real-turns.mjs` — a real, currently-runnable T-003 phase-3 data-sync
  script, not dead code — still calls `turns(tenantId).raw.countDocuments(...)` and
  `.raw.deleteMany(...)`. `raw` no longer exists on the accessor, so this script now throws the
  moment anyone runs it without `--dry-run`. This wasn't caught by any of the manifest's own gates
  (`pnpm -r test`/`typecheck`/`lint:structure`) because `scripts/` sits outside every workspace
  project those commands touch — the manifest's grep in "Confirmed complete" was scoped to
  `apps/api/src packages/db/src packages/index/src`, which is exactly why it missed a real caller
  one directory up. The dispatch for this check specifically asked me to hunt for an eighth site
  beyond the seven named ones (ISS-065 named only `indexing.ts`; the manifest's own grep found six
  more; neither search covered `scripts/`) — this is that eighth site, and it is not hypothetical:
  I ran it in `--dry-run` mode myself and it is a live, current tool over the project's real TOC
  transcripts.

**Criterion 5 (was removing `raw` entirely the right call, vs narrowing its type or keeping it):**
the direction was right in principle — a write accessor that still has a fully-unscoped escape
hatch is exactly the ISS-060/ISS-065 shape repeating — but the execution was too aggressive for
what was actually checked: "nothing legitimately needs it" was asserted without a workspace-wide
search, only a three-tree one. The correct sequence would have been either (a) grep the *whole*
repo (not just the three trees the original issue's suspects lived in) before deleting `raw`, or
(b) keep `raw` until every caller is confirmed migrated, removing it as a follow-up once zero
callers remain by construction. Neither happened, so a real script is now silently broken pending
the next attempt to actually run it.

## Ledger

- ISS-065 (issues addressed by this manifest): its literal claim — `indexing.ts`'s
  `.raw.updateOne` with a hand-carried `tenantId` — is genuinely fixed; `apps/api/src/indexing.ts`
  now calls `sessionsColl(tenantId).updateOne(...)` through the real accessor, confirmed by
  reading the file. Marked `fixed` in the ledger.
- ISS-068 (new, filed by this check): the eighth call site regression described above. Severity
  **high** — it breaks a real, currently-runnable script, not a hypothetical or cosmetic gap, and
  the manifest's own completeness claim is what's wrong. Remedy: add a tenant-merged
  `countDocuments` to `scopedCollection` (parallel to how `updateOne` itself was just added),
  migrate `scripts/sync-real-turns.mjs` onto `coll(tenantId).countDocuments`/`.deleteMany`, then
  re-confirm `--dry-run` and treat `raw`'s removal as complete only after that.

```
VERDICT: FAIL
SCOREBOARD: 5/6 criteria met, 1/1 mutation-reproduction invariant holds
FAILURES:
- [What changed, item 1] sev: high · "raw removed entirely, nothing legitimately needs it" is false — scripts/sync-real-turns.mjs still calls turns(tenantId).raw.countDocuments/.raw.deleteMany, and raw no longer exists on the accessor, so the script throws the moment it's run without --dry-run · add a tenant-merged countDocuments to scopedCollection and migrate this script onto it before treating raw's removal as complete · issue: ISS-068
ISSUES-WRITTEN: ISS-068 (new, open, high); ISS-065 (existing, moved open -> fixed — its own literal claim about indexing.ts is genuinely resolved)
EXPLANATION: The core work is solid — updateOne added correctly, seven named call sites migrated and mutation-proven through their real callers, full suite/typecheck/lint clean, and the one disclosed test gap (six untested collections/*.ts files) is honest and low-risk. But the unit's central claim — that removing raw was safe because nothing else needs it — is disproven by a real, currently-runnable script one directory outside the three trees the manifest (and the original issue) searched. That is exactly the kind of self-scoped verification gap a checker exists to catch, not a nitpick: the fix works for every caller it looked for and breaks the one it didn't.
```
