# Verdict — T-012 compete-screen

- **Contract:** `qa/contracts/compete-screen.md`
- **Manifest:** `qa/manifests/T-012-compete-screen.md`
- **Date:** 2026-09-03
- **Cycle checked: 1**

## Contract adoption

Contract adopted as-is (faithful, maker-drafted, first check). It explicitly scopes to
internal-tier only (D-007/grill Q2) — verified that `schema/eval_runs.schema.json`'s
`credibility` enum still lists `internal|independent-human|calibrated-llm` (correctly permissive
at the schema level, since the shared collection may host later units), and that
`apps/api/src/routes/compete.ts` line 85 hardcodes `credibility: "internal"` with no code path to
set anything else — this unit can never write a non-`internal` row. No amendment needed.

## Verify commands re-run myself (not trusted from manifest)

- `pnpm -r typecheck` → all 8 packages + apps/api "Done", matches manifest.
- `pnpm -r test` → apps/api 14/14 pass (6 new compete tests + 8 pre-existing), full monorepo
  suite (core/ai/db/index/ask/ingest/meeting-bot/api) all green, 0 failures anywhere.
- `pnpm gen:types --check` → `OK: 21 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` → `PASS: 21 collection schema(s) validated correctly.` (eval_runs
  fixtures pass/reject correctly).
- `pnpm lint:structure` → lint-loc/dirsize/root/dupes/migrations OK, SNAPSHOT.md fresh, depcruise
  clean (126 modules, 341 deps, 0 violations).

All outputs reproduced independently; matched the manifest's pasted transcripts (migration file
count 656→657 is a benign 1-file drift from this run's own working tree, not a failure).

## C3/C4 deep verification (per dispatch instruction)

- **`apps/api/src/routes/compete.ts`** read in full: `askV2` is imported at line 12 as
  `import { askV2 } from "@lkb/ask";` — traced to `packages/ask/src/index.ts:15`
  (`export { askV2 } from "./ask-v2.js";`) and `packages/ask/src/ask-v2.ts:51`, the real
  production composition. `/compete/start` calls it with `(question, tree, { ...deps.askDeps,
  tenantId })` — the same shape `AskRouteDeps` already declares, no reimplementation, no fake
  baked into production code. Fakes (`fakeEvalRunStore`, fake ask deps) live only in
  `apps/api/src/fixtures.ts` / `compete.test.ts`, never in the route file.
- **`apps/api/src/routes/compete-page.ts`** read in full: `GET /compete` is mounted in
  `server.ts` via `createCompetePageRouter()`, reachable because `requireAuth` is applied
  globally (`app.use(requireAuth(deps.keyStore))`) before any router mount — no
  auth-exempt special case. The page's two `fetch` calls target `/compete/start` and
  `/compete/${evalRunId}/score` (the real routes, not stubs) with
  `authorization: "Bearer " + key()` wired on both, `key()` sourcing from a password-type input
  backed by `localStorage`. Confirmed against `compete.test.ts`'s "GET /compete serves the plain
  HTML form" test, which asserts the served text matches `/\/compete\/start/`.
- **C2 dupe check re-run myself**, not trusted from the manifest: `packages/db/src/index.ts`
  re-exports `./collections/gaps.js` (bare `create`) and `./collections/eval-runs.js`
  (`createEvalRun`, `recordScore`, `listByCredibility`) — read both files in full, confirmed no
  name collision. `pnpm lint:structure`'s `lint-dupes: OK (161 unique export(s), 21 unique schema
  $id(s))` re-run above corroborates it independently of the manifest's narrative.

## Criteria

| # | Criterion | Verdict |
|---|---|---|
| C1 | `schema/eval_runs.schema.json` + fixtures, 20→21 in validate.py | Met — read schema in full, `validate.py` confirms 21/21 |
| C2 | `packages/db/src/collections/eval-runs.ts` (coll/create/recordScore/list) | Met — `createEvalRun`/`recordScore`/`listByCredibility` present, no dupe with `gaps.ts` |
| C3 | `POST /compete/start` + `POST /compete/:id/score`, reusing real askV2 | Met — traced import to production `askV2`, no fake in route code |
| C4 | `GET /compete` plain HTML+JS form, real routes + Authorization wired | Met — reachable behind global auth, both fetches target real routes with Bearer header |
| C5 | `compete.test.ts`, in-process, matching `server.test.ts` pattern | Met — 6/6 tests pass, re-run myself |
| C6 | No regression across typecheck/test/gen:types/validate.py/lint:structure | Met — all re-run clean |

No criterion unmet.

VERDICT: PASS
SCOREBOARD: 6/6 criteria met, 0/0 invariants (contract defines none as [I*]; scope/non-goals honored)
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All six criteria verified on evidence produced by this checker (re-run commands,
full reads of compete.ts/compete-page.ts/eval-runs.ts/compete.test.ts/eval_runs.schema.json).
askV2 traced to the real production composition, no fake in production code. Dupe-check
re-derived independently, no collision. credibility is hardcoded 'internal' with no code path to
anything else, honoring the internal-tier-only scope. Full monorepo test/typecheck/lint suites
clean.
