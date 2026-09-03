# Verdict — T-004b tree-index-v2

**Cycle checked:** 1
**Date:** 2026-09-03
**Checker mode:** Mode A (unit check), fresh subagent, default coding adapter (no qa/adapter.json)
**Contract:** `qa/contracts/tree-index-v2.md` (maker-drafted; adopted this cycle via amendment-log
line — see contract's Amendment log section)
**Manifest:** `qa/manifests/T-004b-tree-index-v2.md`

## What I re-ran myself

- `pnpm --filter @lkb/index test` → 8/8 pass (3 regenerate cases, 1 real-data case, 4 original
  T-004/T-016 cases). Matches manifest's claimed output exactly.
- `pnpm -r typecheck` → all 9 workspace projects `Done`, 0 errors.
- `pnpm -r test` → all packages green (ingest 15/15, ask 18/18, apps/api 8/8, meeting-bot 19/19,
  index 8/8 as above; core/ai/db have no test script and are not claimed).
- `pnpm gen:types --check` → `OK: 19 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` → `PASS: 19 collection schema(s) validated correctly.`
- `pnpm lint:structure` → all sub-checks OK, `no dependency violations found (117 modules, 309
  dependencies cruised)`.
- Read `extract-topics.ts`, `build.ts` (full file + `git diff HEAD~1 -- build.ts`),
  `regenerate.ts`, `tree.test.ts` (unchanged — confirmed absent from the commit's diff stat),
  `regenerate.test.ts`, `tree-real-data.test.ts`, `schema/tree_index.schema.json` in full.
- Independently confirmed the C4 "New Zealand" cross-session claim: grepped
  `data/toc-migrated/2026-04-21-visa-blueprint-part2-italy-france-nz/session_page.json` and
  `data/toc-migrated/2026-07-30-in-focus-3/session_page.json` — "New Zealand" appears multiple
  times in both `summary` and `keyInsights` of each. Re-ran the real integration test myself
  (above) and read its assertions directly: it asserts `evidence.sessionRefs.length > 1` on at
  least one topic node built from the real 23-session data, not a synthetic fixture.

## Criteria judged

- **C1** (topic/org extraction, real heuristic, no LLM required): met. `extractTopicRefs` is pure,
  network-free, reads `summary`/`keyInsights`, produces real output verified against actual T-002
  data (not a stub).
- **C2** (tree gains topic/org levels, additive): met. `git diff HEAD~1 -- build.ts` confirms the
  4th param `extractFn` is optional with a default, existing 2-/3-arg call sites unaffected,
  `tree.test.ts` was not touched by the commit and its 4 original cases pass unmodified.
- **C3** (`regenerate`, incremental, untouched subtrees preserved): met on the contract's literal
  wording. C3's text requires only that untouched subtrees stay `tree`-byte-identical, tested via
  `===`/deep-equal on an untouched year — which `regenerate.test.ts` case 2 exercises directly and
  I re-ran. The two scope limitations `regenerate.ts` discloses (year-migration cleanup,
  cross-year topic-evidence refresh) are edge cases the literal criterion does not reach; they are
  honestly documented, not hidden. Judgment: not a C3 violation. Recorded as a routine amendment
  with a queued follow-up (T-004c) rather than a FAIL — see contract's Amendment log. Given T-002's
  current 23 sessions are all in a single year (2026), neither gap is reachable in the near-term
  use case, so low urgency is appropriate, not zero: flagged for whenever a second year of real
  data exists.
- **C4** (real integration test, 23 leaves, cross-session topic, schema-shape valid): met,
  independently verified (see above) — both the underlying data claim and the test's actual
  assertions were checked directly, not taken from the manifest's prose.
- **C5** (no regression across the 5 named gates): met, all 5 re-run clean by me.

No invariants (`[I*]`) are declared in this contract.

## Issues ledger

No issues opened or claimed-fixed by this unit. No `Issues addressed` section in the manifest to
cross-check.

## Contract maintenance

Amended `qa/contracts/tree-index-v2.md` this cycle: added an "Amendment log" section — (1) routine
adoption line for this maker-drafted contract (content verified faithful, no changes needed), and
(2) the C3 judgment above plus a queued follow-up task **T-004c** (year-migration cleanup +
cross-year topic-evidence refresh in `regenerate()`).

---

```
VERDICT: PASS
SCOREBOARD: 5/5 criteria met, 0/0 invariants (none declared)
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All 5 criteria independently re-verified with fresh command runs and direct reads of
extract-topics.ts, build.ts (diff), regenerate.ts, and both test files. The C4 "New Zealand"
cross-session claim was independently confirmed against the raw data files and the test's actual
assertions. C3's two disclosed scope gaps (year-migration cleanup, cross-year topic refresh) are
honest out-of-scope edge cases against the contract's literal wording, not violations — recorded
as a routine amendment with a queued follow-up (T-004c), not softened into the criterion itself.
No regressions across typecheck/test/gen:types/schema-validate/lint:structure.
```
