# Verdict — catalogue-cli-clean-check

**Contract:** qa/contracts/catalogue-progress-score.md (the "leaves the repo clean" invariant
established by ISS-046, extended here to cover a gap in its own enforcement)
**Manifest:** qa/manifests/catalogue-cli-clean-check.md
**Cycle checked:** 1
**Date:** 2026-09-07
**Mode:** A (unit check, direct invocation — fresh context, no builder reasoning trusted)

## What I re-ran myself (nothing pasted was trusted)

1. Read `qa/issues.jsonl` ISS-064: filed as `open`, evidence matches the manifest's "Why"
   section exactly — `pnpm test:lint` left `M docs/PROGRESS.md` where there had been none,
   root cause is the "leaves the repo clean" test computing `dirty` over all three watched
   paths but asserting `contentChanged` over only two, silently excluding `docs/PROGRESS.md`
   from the actual pass/fail check.
2. Read `git diff -- scripts/catalogue-cli.test.mjs` in full. Confirmed:
   - A new `watchedInputsClean()` function exists (lines ~30-44 of the new file), running
     `git diff --quiet HEAD --` over **all three** `RESTORE_WATCHED` paths
     (`docs/PROGRESS.md`, `.goal/catalogue.json`, `apps/web/src/App.tsx`).
   - The existing `"the suite leaves the repo clean"` test now calls `watchedInputsClean()`
     instead of re-deriving its own inline two-path check.
   - A new regression test, `"the cleanliness check itself catches a dirtied
     docs/PROGRESS.md (ISS-064 regression)"`, deliberately dirties `docs/PROGRESS.md`,
     calls the SAME `watchedInputsClean()` (not a separate inline git command), and asserts
     `clean === false`; restores the file in a `finally`.
   - A suite-level `after()` hook exists: `RESTORE_WATCHED` paths are snapshotted into
     `PRE_SUITE_SNAPSHOT` at module load (before any test runs) and force-restored
     unconditionally in `after()`.
3. Ran `node --test scripts/catalogue-cli.test.mjs` myself: **13/13 pass.**
4. **Independent mutation test** (not trusting the manifest's claim):
   - Backed up `scripts/catalogue-cli.test.mjs` to scratchpad first.
   - Edited `watchedInputsClean()`'s `contentChanged` git-diff call to drop
     `docs/PROGRESS.md`, reverting to the old two-path list
     `[".goal/catalogue.json", "apps/web/src/App.tsx"]`.
   - Confirmed via `diff` against the backup that the file content genuinely changed (one
     line, the intended mutation only).
   - Re-ran the suite: **exactly 12/13 pass**, with only `"the cleanliness check itself
     catches a dirtied docs/PROGRESS.md (ISS-064 regression)"` reddening —
     `AssertionError: a dirtied docs/PROGRESS.md must be caught... true !== false`. No other
     test affected — a real catch, not a false green.
   - Restored the file exactly from the backup, re-ran: **13/13 green again.**
   - `git status --porcelain` after restore shows only the expected pre-existing
     `M scripts/catalogue-cli.test.mjs` (the uncommitted fix itself) — no residual mutation.
5. Ran `pnpm test:lint` (the full chain): **54/54 pass.** Checked `git status --porcelain`
   immediately after — identical to the pre-run set (`.goal/goal.json`, `qa/.last-tick`,
   `qa/evidence/live-.../preflight.json`, `scripts/catalogue-cli.test.mjs` modified;
   `qa/manifests/catalogue-cli-clean-check.md` untracked). **No new dirtying of
   `docs/PROGRESS.md` or any other tracked file** — this reproduces the *absence* of the
   original ISS-064 symptom, not just a green unit test.
6. Ran `pnpm lint:structure`: all gates clean (`lint-loc OK`, `lint-dirsize OK`, `lint-root OK`,
   `lint-dupes OK`, `lint-migrations OK`, snapshot fresh, `tracker-audit: OK (gate G1)`,
   depcruise "no dependency violations found").
7. Ran `node scripts/catalogue-score.mjs`: wrote `docs/PROGRESS.md` (20.2%/28.9%, 57
   features) — `git diff --stat -- docs/PROGRESS.md` shows **no content diff** afterward.

## Criteria judged

| # | Criterion (manifest "How to verify") | Result |
|---|---|---|
| 1 | `watchedInputsClean()` exists, checks all three paths, both tests call the shared fn | MET |
| 2 | suite-level `after()` restore hook exists, snapshots before any test runs | MET |
| 3 | `node --test scripts/catalogue-cli.test.mjs` 13/13 green | MET |
| 4 | mutation (drop docs/PROGRESS.md from path list) reddens exactly the new regression test, restore returns to 13/13 | MET |
| 5 | `git status` clean of `docs/PROGRESS.md` diff before and after the full suite | MET |
| 6 | ledger: ISS-064 → `fixed` with `fixed_date`, citing this manifest | to be applied by this verdict |

No FAILURES found. No duplicated/false-green check found on independent mutation testing.

```
VERDICT: PASS
SCOREBOARD: 6/6 criteria met, 0/0 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: Independently re-read the diff, re-ran the unit suite (13/13), and personally
performed the mutation test end-to-end (backup -> mutate -> confirm genuine content change via
diff -> re-run -> confirm exactly the new ISS-064 regression test reddens at 12/13 -> restore
from backup -> confirm 13/13 green, git status shows no residual mutation). Also reproduced the
original bug's absence directly: ran the full pnpm test:lint chain (54/54) and confirmed via
git status immediately after that docs/PROGRESS.md was not left dirty. pnpm lint:structure and
node scripts/catalogue-score.mjs both clean with no diff to docs/PROGRESS.md. Fix is genuine,
not a false green.
```
