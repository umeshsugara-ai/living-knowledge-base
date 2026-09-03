# Verdict — T-018-schema-v2

**Date:** 2026-09-03
**Cycle checked:** 1
**Checker mode:** A (unit check, fresh subagent, re-ran every command myself)

## VERDICT: PASS

SCOREBOARD: 7/7 criteria met, 0/0 invariants (contract declares none separately from criteria)

## Evidence re-derived (not trusted from the manifest)

- **C1 (ADR-before-schema ordering):** `git log --oneline -- docs/adr/0001-schema-v2.md` shows
  only `5c6708c`. `git merge-base --is-ancestor 5c6708c a6a9238` exits 0 (5c6708c is an ancestor
  of a6a9238). `git show --stat 5c6708c` lists exactly one file, `docs/adr/0001-schema-v2.md`
  (57 lines) — no `schema/*.schema.json` in that commit. Read the ADR in full: cites Vexa
  (segment model, atomic/deduped, display-grouping computed not stored) and Onyx
  (document/chunk-by-reference, schema-per-tenant) with real repo/file paths, plus
  `pageindex-multi-source-merge` and `vectorless-rag`. States explicit decisions for (a)
  camelCase casing, (b) turns-by-id-only (no duplicated text) for media/chunks, (c) TS-level
  `coll(tenantId)` tenancy enforcement. Matches contract C1 exactly. **MET.**
- **C2 (camelCase evidence keys):** `grep -rn "turn_id\|session_id" schema/*.schema.json` →
  empty, exit 1. **MET.**
- **C3 (8 new collections + fixtures + validate.py):** `python schema/validate.py` → all 19
  schemas OK, `PASS: 19 collection schema(s) validated correctly.` Spot-checked required-field
  lists on all 8 new schemas: `programs` (tenantId, name), `media` (tenantId, sourceRef, kind,
  retention — retention requires `purgeAfterVerified`; kind enum includes `evidence-clip`),
  `chunks` (tenantId, sourceRef, turnRefs — no text field), `graph_edges` (from, to, type),
  `jobs` (tenantId, status, createdAt), `tenants` (only `_id`, `name` — no tenantId, as
  required), `api_keys` (tenantId, keyHash, createdAt), `consent_policies` (tenantId, mode).
  `sources.schema.json` confirmed to require `captureMode` with enum
  `{provided, public, notes, silent}`. **MET.**
- **C4 (schema/index.json):** read in full. Every collection leads with `tenantId` except
  `tenants` (keyed `_id`). `turns` has a `tenantId+sessionId` compound index. `claims` has a
  `tenantId+status` compound index. `jobs` has `tenantId+status+createdAt`. **MET.**
- **C5 (migrate-mongo):** `npx migrate-mongo status -f migrate-mongo-config.cjs` reproduced the
  same `MongoServerSelectionError: Socket 'connect' timed out after 5005ms` the manifest
  reported — no reachable Mongo in this environment, matching the contract's explicit fallback
  clause. Manifest states which fallback and why (config/migration-file-content) as required.
  `node -e "require('./migrate-mongo-config.cjs')"` and
  `node -e "require('./migrations/20260903100000-baseline.js')"` both load without error
  (CONFIG_OK / MIGRATION_SYNTAX_OK) — real, syntactically valid files, not placeholders.
  **MET.**
- **C6 (packages/db accessors + compile-time tenant enforcement):** `pnpm -r typecheck` → all 9
  workspace projects `Done`, including `packages/db`. Read
  `packages/db/src/collections/tenantScope.typecheck-test.ts` in full: 4 `// @ts-expect-error`
  lines on zero-arg calls to `sources()/sessions()/turns()/claims()`, plus a `validCalls()`
  export proving the one-argument form compiles. `tsc` passing with this file present is the
  proof (a real compile error anywhere in the file, or a missing expected error, fails `tsc`).
  **MET.**
- **C7 (no regression):** `python schema/validate.py` → 19/19. `pnpm gen:types -- --check` →
  `OK: 19 generated type file(s) + index.ts match schema/`. `pnpm -r test` → `packages/ask`
  6/6, `packages/index` 4/4, 0 failures. `pnpm lint:structure` → lint-loc/dirsize/root/dupes/
  migrations all OK, SNAPSHOT.md fresh, depcruise 43 modules/63 deps clean. **MET.**

## Issues ledger

No `Issues addressed` claimed by this manifest (none applicable). No new issues found — all
claims independently reproduced with no discrepancy between manifest-pasted output and this
checker's own re-run.

ISSUES-WRITTEN: none

## EXPLANATION

All 7 acceptance criteria are evidenced by commands this checker executed itself, not by
trusting the manifest's pasted output — every re-run matched the manifest exactly (same grep
emptiness, same 19/19 validate.py pass, same typecheck/test/lint results, same Mongo-timeout
reproduction for C5, same file contents for the ADR/index.json/new schemas/typecheck-test
file). The C1 ordering claim was independently verified via `git merge-base --is-ancestor` and
`git show --stat`, not just `git log`. No softened criteria, no partial credit needed — PASS.
