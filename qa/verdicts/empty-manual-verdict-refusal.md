# Verdict — empty-manual-verdict-refusal

**Date:** 2026-09-07
**Contract:** qa/contracts/ingest-indexing-pipeline.md (catalogue-progress-score "manual may only
lower, never bypass" invariant — the I3 lineage ISS-031 established)
**Manifest:** qa/manifests/empty-manual-verdict-refusal.md (Status: ready-for-check, Fix cycle: 1 of max 3)
**Cycle checked: 1**
**Checker:** /checker Mode A, fresh subagent, bound to D:\KnowledgeBase. Re-ran every command
myself (did not trust the manifest's pasted output) and independently mutation-tested rather
than just re-reading the manifest's mutation claim.
**Issues addressed:** ISS-036

## Re-run (my own execution, not the maker's paste)

1. **Ledger cross-check**: `qa/issues.jsonl` ISS-036 `fix_direction` = "Test f.manual for a
   'verdict' KEY rather than a truthy value: if the key is present, run it through the
   vocabulary check unconditionally..." — matches the manifest's "What changed" section exactly.

2. **Diff** (`git diff -- scripts/lib/catalogue.mjs scripts/catalogue.test.mjs`):
   - `scripts/lib/catalogue.mjs` line ~193: guard changed from `if (f.manual?.verdict)` to
     `if (f.manual && "verdict" in f.manual)` — a key-presence test, not a truthy-value test.
     Comment explains the ISS-036 rationale in place.
   - `scripts/catalogue.test.mjs`: one new test, "an empty-string manual verdict is refused, not
     silently ignored (ISS-036)" — asserts a catalogue with `manual: { verdict: "", reason:
     "cleared" }` scores `MISSING` and appears in `s.upgrades` matching `/not one of/`.
   - Confirmed: no other branch touched, matching the manifest's "one-line guard fix" claim.

3. **`node --test scripts/catalogue.test.mjs`**: 22/22 pass, including
   `✔ an empty-string manual verdict is refused, not silently ignored (ISS-036)`.

4. **Independent mutation test** (not trusting the manifest's account):
   - Edited `scripts/lib/catalogue.mjs` to revert the guard to `if (f.manual?.verdict) {`,
     removing the ISS-036 comment.
   - `git diff -- scripts/lib/catalogue.mjs` after the revert showed **zero diff** — i.e. the
     mutated file was byte-for-byte identical to HEAD's pre-fix version, proving the mutation
     genuinely reproduced the original bug rather than some other change.
   - Re-ran `node --test scripts/catalogue.test.mjs`: **21 pass, 1 fail** — exactly and only
     `an empty-string manual verdict is refused, not silently ignored (ISS-036)` reddened:
     `AssertionError: an empty string must be refused with the same message as any other bad
     value` (`actual: undefined`, expected `/not one of/`). No other test was affected — a real
     isolated redden, not a false green.
   - Restored the fix by copying back the pre-mutation backup (taken before the mutation).
     `git diff -- scripts/lib/catalogue.mjs` after restoring showed the diff was byte-identical
     to the diff observed in step 2 (same guard, same comment).
   - Re-ran `node --test scripts/catalogue.test.mjs`: 22/22 green again.

5. **`node scripts/catalogue-score.mjs`**: `wrote docs/PROGRESS.md — 20.2% adjusted / 28.9%
   machine-derived, 57 features`, exit 0. `git status --short docs/PROGRESS.md` showed no diff
   before or after the run — the fix does not change today's real score (no empty-string manual
   verdicts exist in the live catalogue), matching the manifest's claim.

6. **`pnpm lint:structure`**: clean — `lint-loc: OK (218 file(s))`, `lint-dirsize: OK (74
   dir(s))`, `lint-root: OK (15 loose root file(s))`, `lint-dupes: OK`, `lint-migrations: OK
   (1093 file(s))`, `docs/SNAPSHOT.md matches a fresh regeneration`, dependency-cruiser `0
   violations (242 modules, 712 dependencies)`.

## Criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Guard tests key presence, not truthiness | MET | `if (f.manual && "verdict" in f.manual)` at catalogue.mjs |
| 2 | Empty-string verdict refused with the same vocabulary message | MET | new test passes; upgrade message matches `/not one of/` |
| 3 | Mutation-test isolates the fix (revert reddens exactly this test) | MET | independently reproduced: 21/22 pass, only ISS-036 test fails on revert |
| 4 | No regression to today's real score | MET | `docs/PROGRESS.md` unchanged by `git status` before/after |
| 5 | Structural lint still clean | MET | `pnpm lint:structure` all green |

Invariant I3 ("manual may only lower, never bypass"): holds — verified by re-derivation, not
by trusting the manifest's narrative.

## Issues

- ISS-036 (claimed addressed): fixed by this unit — ledger `open → fixed` (this manifest +
  independent re-check).

```
VERDICT: PASS
SCOREBOARD: 5/5 criteria met, 1/1 invariant holds
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: Independently reproduced every claim in the manifest rather than trusting it —
diff confirmed the guard is now a key-presence test with a matching new test; 22/22 green on a
fresh run; my own mutation (reverting the guard, confirmed byte-identical to pre-fix HEAD via
git diff) reddened exactly and only the ISS-036 test, and restoring returned to 22/22 green;
catalogue-score.mjs produces no diff to docs/PROGRESS.md; pnpm lint:structure is clean.
ISS-036 open -> fixed.
```
