# Verdict — T-005b (ask-router-v2)

**Date:** 2026-09-03
**Cycle checked:** 1
**Contract:** `qa/contracts/ask-router-v2.md`
**Manifest:** `qa/manifests/T-005b-ask-router-v2.md`

## Judgment call: C1's DI vs literal-import wording

Contract C1 said `selectNodes` "feeds those ids to `packages/index`'s existing
`treeSearch(tree, node_ids)`" (read literally: a direct import). The maker instead added a
`treeSearchFn` injection parameter, citing a `.dependency-cruiser.cjs` failure.

Verified independently by reading `.dependency-cruiser.cjs` directly: rule
`ask-index-ingest-only-ai-db-core` has `from: { path: "^packages/(ask|index|ingest)/" }`,
`to: { path: OTHER("ai|db|core") }` where `OTHER(allowed)` expands (for an `ask`-sourced edge,
`$1` = `ask`) to `^packages/(?!(?:ai|db|core|ask)/)|...`. `packages/index/` does not start with
`ai`, `db`, `core`, or `ask`, so the negative lookahead succeeds and the rule's `to` matches —
confirming a direct `packages/ask -> packages/index` import is forbidden by this rule exactly as
the maker claimed. (A live `depcruise` reproduction was attempted — temporarily adding the direct
import and a manual `node_modules/@lkb/index` link — but the ad hoc link created a plain copy
under `node_modules`, which `.dependency-cruiser.cjs`'s `doNotFollow: "node_modules"` option
silently excludes from the graph, so that specific live repro was inconclusive on this machine;
the temp changes were fully reverted (`git status` clean on `packages/`) and the direct rule
reading above is unambiguous and sufficient on its own.)

Judgment: the DI design genuinely satisfies C1's intent. `treeSearchFn` is shaped exactly like
`@lkb/index`'s real `treeSearch(tree, nodeIds)`, matches the existing `TreeSearchFn`/`ScoreFn`/
`WebFallbackFn` DI pattern already in `router.ts` (T-005), and a real `@lkb/index.treeSearch` is
still the thing that runs in production, supplied by an `apps/*` composition root (which the
dependency rules do allow to depend on both `ask` and `index`) — not reimplemented, not
skipped. Tests use a same-shape fake (`testUtils.ts`'s `fakeTreeSearch`), consistent with T-019's
established fakes-only testing convention. **C1 amended** (routine, not critical — clarifies
wording to match a structurally-forced, intent-preserving implementation; does not weaken any
invariant). Amendment applied to `qa/contracts/ask-router-v2.md` with a log entry.

## Re-run verification (fresh, this session)

- `pnpm -r typecheck` — clean, all 9 scoped workspace projects "Done", `packages/ask` included.
- `pnpm -r test` — `packages/ask`: **18/18 pass** (matches manifest: T-005's original 6
  `router.test.ts` cases + `evaluator.test.ts` cases + 8 new across `select-nodes.test.ts` (4),
  `refine.test.ts` (4 relevant + 1 more), `answer.test.ts` (1), `ask-v2.test.ts` (2)). Full
  workspace totals re-derived: `packages/index` 4, `packages/ai` 23, `packages/ingest` 15,
  `packages/ask` 18 — all pass, 0 fail.
- `pnpm gen:types --check` — `OK: 19 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` — `PASS: 19 collection schema(s) validated correctly.`
- `pnpm lint:structure` — all sub-checks OK (`lint-loc`, `lint-dirsize`, `lint-root`,
  `lint-dupes`, `lint-migrations`, `SNAPSHOT.md` fresh-match, and a real `depcruise` run:
  `✔ no dependency violations found (83 modules, 197 dependencies cruised)`).

All five commands reproduced independently in this session — no pasted output trusted without
re-derivation.

## Code read in full

`select-nodes.ts`, `refine.ts`, `answer.ts`, `ask-v2.ts`, `router.ts` (T-005, confirmed
untouched), plus `select-nodes.test.ts` and `ask-v2.test.ts` in full. `git show 0f9ea66 --stat`
confirms `router.ts`, `evaluator.ts`, `router.test.ts`, `evaluator.test.ts` do not appear in this
commit's diff — T-005's originals are byte-for-byte untouched, as claimed.

## Criteria

- **C1** (`selectNodes`) — MET, as amended above (DI, not literal import).
- **C2** (`refine`) — MET. Decompose/filter/recompose confirmed in `refine.ts`; applied to both
  `good_docs` and web docs in `ask-v2.ts` on non-`correct` verdicts (merged `RefinableDoc[]`).
- **C3** (`answer`) — MET. Generates from refined context, passes `sources` through unchanged.
- **C4** (`askV2`) — MET. Composes `selectNodes -> ask() (which calls evaluate()) -> refine ->
  answer`; imports and calls T-005's `ask()` rather than duplicating it; every external call
  (select_nodes, each refine strip, answer, each candidate score) logged via `recordJob` into
  both `write` and the returned `auditLog`.
- **C5** (tests) — MET. 18 tests total in `packages/ask`, all pass; coverage matches the
  contract's enumerated cases (selectNodes parse+resolve, refine keep/drop, askV2 end-to-end with
  separated sources + non-empty audit log, correct-verdict skips refine/web).
- **C6** (no regression) — MET. All 5 verify commands clean; T-005's `ask()`/`evaluate()` exports
  and tests untouched (confirmed via `git show --stat`).

## Issues ledger

No open issues in `qa/issues.jsonl` tagged against this contract/feature (`ask-router-v2` /
`T-005b`) required addressing by this unit. No new issues found — no findings to write.

## Goal task

Closing matching goal task `T-005b` via `goal_cli.py done` (see command below), since this is a
Mode A PASS.

---

VERDICT: PASS
SCOREBOARD: 6/6 criteria met, 0/0 invariants hold (contract has no separate [I*] invariants section)
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All six criteria are evidenced in code and re-run verification (typecheck, 18/18
ask-package tests, gen:types, schema validate, lint:structure incl. a real depcruise run all
clean). The one flagged judgment call — DI instead of a literal `packages/index` import for C1 —
is confirmed correct by directly reading `.dependency-cruiser.cjs`'s
`ask-index-ingest-only-ai-db-core` rule, which unambiguously forbids `packages/ask` from
importing `packages/index`; the DI approach preserves the contract's real intent (reuse
`packages/index`'s `treeSearch`, never reimplement it) at the layer the enforced architecture
actually permits. C1 amended (routine) to describe the DI shape.
