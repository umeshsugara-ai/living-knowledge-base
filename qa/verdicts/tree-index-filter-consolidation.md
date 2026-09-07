# Verdict — tree-index-filter-consolidation

**Date:** 2026-09-07
**Contract:** qa/contracts/ingest-indexing-pipeline.md, criterion 3a
**Manifest:** qa/manifests/tree-index-filter-consolidation.md
**Cycle checked:** 1
**Checker mode:** Mode A (fresh subagent, no builder context)

## What I re-ran myself

1. `pnpm -r test` — 343/343 pass (per-package: core 7, db 8, ai 56, ingest 41, ask 32, index 42,
   meeting-bot 40, api 77 = 303 + apps/web 40 = 343). Confirmed independently, not pasted.
2. `pnpm -r typecheck` — 10/10 projects `Done`, zero errors.
3. `npx depcruise --config .dependency-cruiser.cjs packages apps workers` — clean, 242 modules,
   712 dependencies, no violations.
4. Read `packages/index/src/tree/build.ts`, `packages/index/src/index.ts`, `apps/api/src/store.ts`,
   `apps/api/src/indexing.ts`, `apps/api/src/tree-index-root-filter-single-source.test.ts`,
   `packages/index/src/tree/tree.test.ts` in full.
5. **Mutation 1 (manifest's own):** reintroduced the exact hand-written filter
   (`{ node_id: \`tenant:${tenantId}\`, level: "tenant" }`) at `createMongoTreeStore.load` in
   `store.ts`. Ran `npx tsx --test src/tree-index-root-filter-single-source.test.ts` from
   `apps/api`: RED — `AssertionError: must not hand-write the node_id shape again`. Reverted,
   `grep -c "treeIndexRootFilter(tenantId)" store.ts` back to 2.
6. **Mutation 2 (my own, adversarial — probing the ISS-038 regex blind spot):** rewrote the same
   call site as `const nodeId = "tenant:" + tenantId; ... findOne({ node_id: nodeId, level:
   "tenant" })` — no backtick, no template literal, deliberately shaped to evade
   `HAND_WRITTEN_FILTER = /node_id:\s*\`tenant:\$\{/`. Ran the test again: RED — but via the
   **count assertion**, not the regex (`actual: 1, expected: 2`, "a count of 1 means one of the
   two regressed back to a hand-written filter"). This is the load-bearing finding: the test's
   real defense against a differently-formatted regression is the exact-two-calls-to-the-shared-
   function assertion, which is format-agnostic, not the literal-pattern regex, which is only a
   secondary, narrower check. That is categorically different from the ISS-038
   `/process\.exit\(2\)/` failure (a pattern-match standing in for the whole assertion, with
   nothing behind it) — here the pattern match is redundant with a structural invariant that
   still holds when the pattern is dodged. Reverted; confirmed `git diff -w store.ts` back to
   exactly the maker's own uncommitted before→after diff (36 changed lines, all attributable to
   the manifest's described change, not to my mutation testing).
7. **Mutation 3:** broke `buildTree`'s own root-node construction in `build.ts`
   (`node(treeIndexRootFilter(tenantId).node_id, ...)` → `node(\`tenant-${tenantId}\`, ...)`,
   colon→hyphen). Ran `npx tsx --test src/tree/tree.test.ts` from `packages/index`: RED —
   `AssertionError: 'tenant-toc' !== 'tenant:toc'` on "treeIndexRootFilter's node_id matches
   buildTree's own root node_id exactly". Confirms this test is a real drift-catcher, not a
   tautology (it does not simply assert `treeIndexRootFilter` equals itself — it independently
   derives a tree via `buildTree` and compares). Reverted; full suite re-run green (343/343,
   typecheck clean, depcruise clean) to confirm no lingering mutation state.
8. Checked `qa/issues.jsonl`: ISS-063 was `open`, ISS-062 remains `open` (correctly untouched).
   Flipped ISS-063 `open → fixed` (fixed_date 2026-09-07) per this unit's verified evidence.

## Criterion-by-criterion (contract 3a, the single-shared-filter bound)

- **Single source of the `tenant:<id>` convention**: `treeIndexRootFilter(tenantId)` defined once
  in `packages/index/src/tree/build.ts`, exported via `packages/index/src/index.ts`. — MET
- **`buildTree`'s own root construction uses it** (closes the "fourth hand-written copy in the
  file that defines the convention" gap): confirmed at `build.ts:109`. — MET
- **`apps/api/src/indexing.ts` uses it, not a local copy**: confirmed at `indexing.ts:21,46` (import
  + `loadTreeRoot`) and `indexing.ts:137` (`replaceOne` filter). — MET
- **Both `store.ts` call sites use it**: `createMongoTreeStore.load` (line 52) and
  `createMongoGraphReadDeps.loadGraph` (line 108), both confirmed, both pinned by the new
  source-scan test with a call-count assertion that survived my adversarial reformatting attempt. — MET
- **No dependency-cruiser violation from the added import**: `store.ts` already imported
  `flattenTreeToGraph, type Graph` from `@lkb/index`; the diff only adds `treeIndexRootFilter` to
  the existing import statement — no new module edge. Depcruise confirms clean. — MET

## Scope split (ISS-063 vs ISS-062)

Legitimate. ISS-062 is a schema migration touching a field with no compiler-checkable analogue
today (`tree_index.schema.json` has no `tenantId`), requiring `gen:types`, a real `migrations/`
entry, and a decision about the tree already sitting in the live database — a different risk
class from consolidating three call sites of a filter function, none of which changes what gets
written or read. Bundling them would make this unit unreviewable for no safety gain; deferring the
migration as its own unit (already what the checker's own ISS-062 ruling anticipated) is correct.

## Other manifest claims checked, not just accepted

- **`store.ts` has no injectable db handle → source-scan test is the right instrument, not a
  cut corner**: confirmed by reading `store.ts` — every store closes over module-level `getDb()`
  directly, unlike `indexing.ts`'s `IndexSessionDeps.db` seam. A real behavioural test would need
  a DI refactor that is explicitly out of scope and separately disclosed. The chosen instrument
  (source-scan + call-count) is proportionate and, per mutation 2 above, not vacuous.
- **343/0, typecheck 10/10, depcruise clean**: all reproduced fresh, not pasted.

## Disclosed limitations — accepted as stated

Both disclosed limitations (`store.ts` still has no real behavioural test; ISS-062 untouched) are
accurate and scoped correctly; neither is a contract gap for this unit's actual criterion (3a's
bound is specifically about the shared-filter single-sourcing, which is fully satisfied).

VERDICT: PASS
SCOREBOARD: 5/5 criteria met, 1/1 invariant holds
FAILURES (if any):
- none
ISSUES-WRITTEN: none (ISS-063 flipped open→fixed on existing evidence; no new issues found)
EXPLANATION: All three call sites now route through one exported `treeIndexRootFilter`, including
`buildTree`'s own root construction. The consolidation is pinned by a source-scan regression test
whose real defense is a format-agnostic call-count assertion — verified by both the manifest's own
mutation and a harder adversarial rewrite designed to dodge its regex, both caught. `tree.test.ts`'s
new drift test is a genuine independent check, not a tautology. Scope split from ISS-062 is
justified by real risk-class difference. Full suite, typecheck, and dependency graph all
independently reproduced green.
