# Verdict — browser-profile-privacy (T-011)

**Result: PASS**
Cycle checked: 1
Manifest commit: `59dc2db`
Checked: 2026-09-03, fresh shell, independent re-run of every command (nothing trusted from the
manifest's pasted output).

## Criterion-by-criterion

### 1. `resolveProfileDir` — deterministic, isolation-safe, traversal-rejecting
PASS. Read `packages/meeting-bot/src/profile/user-profile.ts` in full.
- `assertSafeSegment` runs on the RAW `value` parameter — confirmed by reading the code (no
  `normalize()` call anywhere before the check) and by re-deriving the bug narrative myself:
  `path.normalize("toc/../other")` really does collapse to `"other"`, which would have hidden a
  multi-segment `tenantId` from a normalize-then-check implementation. The manifest's disclosed
  bug is genuine, not decorative — the fix (checking `/`, `\`, `".."`, `isAbsolute()` on the raw
  string) is real and correctly placed before any path construction.
- Defense-in-depth `relative(baseDir, resolved).startsWith("..")` check read and confirmed present
  and independent of the per-segment check.
- My own adversarial run (throwaway `tsx` script, deleted after, not committed) against the
  current code:
  - `"a/b"`, `"a\b"`, `"..\.."`, `""`, `".."`, `"./a"`, `"a/../b"`, `"toc/../other"` → all throw,
    all with a clear message.
  - **Gap found, judged non-blocking:** `userId = "."` does NOT throw and resolves to
    `<baseDir>/<tenantId>` (the tenant dir itself, since `node:path.join` drops a bare `.`
    segment). This is not a `baseDir` escape and does not collide with any *other* valid
    `(tenantId, userId)` pair's directory (nothing else naturally resolves there), so it does not
    violate either literal criterion in the contract ("no traversal escape", "two distinct pairs
    never collide"). It is a real edge case worth a follow-up test/fix (reject bare `.` alongside
    `..`) but is outside what this contract's wording obligates — flagging for the maker to pick
    up opportunistically, not blocking this unit.
- Determinism and distinctness re-verified directly via the existing test suite (see below) and
  spot-checked interactively — same inputs always produce the same string; distinct
  `(tenantId, userId)` pairs (including same-userId-different-tenant) produce distinct paths.

### 2. `excludePrivateSegments` — overlap semantics, new array, no mutation
PASS. Read `packages/meeting-bot/src/live-monitor.ts` in full.
- `overlaps()` is `turn.tStart < window.tEnd && turn.tEnd > window.tStart` — strict inequalities
  on both sides, which is the correct "any overlap counts, touching does not" semantics.
- Verified this reasoning myself with a throwaway script (deleted after, not committed) against
  two exact-boundary cases the shipped test suite does **not** explicitly cover:
  - `turn(30,40)` vs window `{0,30}` (turn starts exactly when window ends) → **survives**
    (correct: `30 < 30` is false).
  - `turn(0,10)` vs window `{10,20}` (turn ends exactly when window starts) → **survives**
    (correct: `10 > 10` is false).
  Both match the contract's "overlaps" (not "touches") wording. This is a coverage gap in the
  committed test file (no dedicated exact-boundary test), but the implementation itself is
  correct, which is what the contract requires.
- New-array guarantee: confirmed `Array.prototype.filter` always returns a new array in the
  non-empty-windows path, and `[...turns]` in the empty-windows path; verified interactively that
  the returned array is a different reference from the input in both cases (contract only
  requires "not necessarily reference" for the empty case, so the stricter behavior here is fine,
  not a problem).
- No-mutation: dedicated test `does not mutate the input array` read and confirmed it does what it
  says (deep-equals the original array against a pre-call copy).

### 3. Tests exist and pass
PASS. Read both test files in full (`user-profile.test.ts` — 7 tests, `live-monitor.test.ts` — 6
tests). They test exactly what the contract lists: distinct-dir, determinism, cross-tenant
distinctness, traversal-throws (`../../etc`, `..`), separator-in-tenantId-throws, absolute-path-
throws, empty-throws; and for live-monitor: fully-inside-dropped, fully-outside-survives,
straddle-dropped-not-truncated, empty-no-op, multiple-non-overlapping-windows, no-mutation.
Re-ran `pnpm --filter @lkb/meeting-bot test` myself: **40/40 pass** (27 pre-existing + 13 new),
output matches the manifest's claimed count and matches the actual full listing (names spot-
checked against the two new test files — no phantom/renamed tests).

### 4. No regression
Re-ran every command myself, fresh shell, `cd /d/KnowledgeBase`:
- `pnpm -r typecheck` → clean, all 9 workspace projects (`Done`), matches manifest.
- `pnpm --filter @lkb/meeting-bot test` → 40/40, matches manifest exactly.
- `pnpm -r test` → core 7, index 19, ai 23, ingest 34, ask 30, meeting-bot 40, apps/api 18 — all
  green, matches manifest exactly.
- `pnpm gen:types --check` → `OK: 22 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` → `PASS: 22 collection schema(s) validated correctly.`
- `pnpm lint:structure` → all sub-checks OK (loc, dirsize, root, dupes, migrations, snapshot,
  depcruise `152 modules, 428 dependencies`, no violations). Minor immaterial count drift vs. the
  manifest (`721` vs `720` files scanned by lint-migrations, `13 loose root file(s), 1 gitignored
  excluded` vs plain `13`) — background-process noise between the maker's run and mine, not a
  regression; both are green.

### Diff / file list
`git show 59dc2db --stat` → exactly the 7 files the manifest lists: `index.ts`,
`live-monitor.test.ts`, `live-monitor.ts`, `profile/user-profile.test.ts`,
`profile/user-profile.ts`, `qa/contracts/browser-profile-privacy.md`,
`qa/manifests/browser-profile-privacy.md`. Confirmed `packages/meeting-bot/src/index.ts` exports
both new modules (`export * from "./profile/user-profile.js"` and `export * from
"./live-monitor.js"`).

## Non-blocking findings for a future cycle (not this unit's contract)
1. `resolveProfileDir("toc", ".", baseDir)` silently collapses to the tenant directory instead of
   throwing — worth adding `value === "."` to `assertSafeSegment`'s reject list.
2. `live-monitor.test.ts` has no dedicated exact-boundary-touch test (`tStart === window.tEnd` /
   `tEnd === window.tStart`); implementation is correct (verified independently above) but the
   test suite doesn't pin it down.

## Scope note on task-tracking flip
`TASKS.md` T-011 ("Phase-B per-user browser profile bot + live monitor") is flipped to `done`
below — its wording matches what this unit actually delivers (the two primitives), and the
contract's own Non-goals section already discloses that real Playwright wiring / live-monitor UI
are separate follow-ups needing no new contract.

`.goal/goal.json`'s `T-011` entry ("Meeting bot (auto-join, consent, live capture)", note "needs
Q4 consent decision") is a **broader** feature than this contract — it covers real auto-join,
consent, and live capture, none of which this unit builds (explicitly out of scope). I am
**not** marking it done; marking it done would overstate what shipped. Flagging this scope
mismatch for Umesh/the maker rather than silently complying with the generic instruction to mark
"a T-011 entry" done wherever found.
