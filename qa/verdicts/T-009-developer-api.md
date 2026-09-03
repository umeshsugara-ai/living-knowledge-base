# Verdict — T-009 developer-api

**Cycle checked:** 1
**Date:** 2026-09-03
**Checker:** fresh subagent, Mode A unit check, bound to `D:/KnowledgeBase`

## Re-run evidence (all re-executed by this checker, not trusted from the manifest)

```
$ cd apps/api && npx tsc --noEmit -p tsconfig.json
(no output — exit 0)

$ cd apps/api && npx node --test --import tsx "src/**/*.test.ts"
tests 8, pass 8, fail 0

$ pnpm -r typecheck
9 projects, all "Done", exit 0

$ pnpm -r test
packages/ai: 23 pass · packages/index: 4 pass · packages/ingest: 15 pass ·
packages/ask: 18 pass · packages/meeting-bot: 19 pass · apps/api: 8 pass
= 87 pass, 0 fail (matches manifest's claimed 87)

$ pnpm gen:types --check
OK: 19 generated type file(s) + index.ts match schema/

$ python schema/validate.py
PASS: 19 collection schema(s) validated correctly.

$ pnpm lint:structure
lint-loc / lint-dirsize / lint-root / lint-dupes / lint-migrations: all OK
SNAPSHOT.md matches fresh regen; depcruise: no dependency violations (113 modules, 290 deps)
```

All verify commands green, independently reproduced.

## Criteria (read against `qa/contracts/developer-api.md`)

- **C1** `server.ts` — DONE. Read in full: 33 LOC (budget ≤80), `createServer(deps)` +
  `startServer(deps, port?)`, JSON body parsing → auth → rate limit → ask router → stub router.
  Injectable, no forced bind.
- **C2** Auth middleware — DONE. `auth.ts` read in full: `requireAuth` 401s on missing/malformed
  header and on invalid/revoked key (store returns null); `requireScope` is a *separate*
  middleware that 403s — the two failure modes never collapse into one status. `ApiKeyStore.verify`
  is injected; production impl (`store.ts`) hashes via `sha256Hex` (`node:crypto`) and compares
  `keyHash`, never a raw key.
- **C3** `POST /ask` real wiring — DONE, with one disclosed scoping judgment call (below).
  `routes/ask.ts` calls `askV2` with an injected `TreeStore`/`askDeps`; `production.ts` supplies
  the *real* `treeSearchFn` (`@lkb/index`'s `treeSearch`) and the *real* `complete`
  (`@lkb/ai`'s `routeComplete` via `parseRoutingYaml(config/ai-routing.yaml)`, `ask: [gemini,
  claude-code]` — confirmed this jobKind did not exist before this unit and now does). Tests use
  fakes exclusively (`fixtures.ts`), confirmed by reading `server.test.ts` in full — no real
  network/CLI call in the suite.
- **C4/C5** Stub routes incl. webhooks — DONE. `routes/stubs.ts` read in full: `requireScope`
  runs before the `501` handler for all five routes (`/sources`, `/sessions`, `/search`,
  `/citations/:claimId`, `/webhooks/register`), exact message shape
  `{error:"not_implemented", message:"<label> is planned, not yet built — see TASKS.md"}`.
- **C6** Rate limiting — DONE. `rate-limit.ts` read in full: `express-rate-limit@8.6.2` (matches
  `sources/whatsapp_msg/package.json`'s existing dependency, reused not hand-rolled), keyed on
  verified `tenantId` with `ipKeyGenerator` fallback for pre-auth traffic, `429` +
  `Retry-After` header set explicitly in the handler.
- **C7** Tests — DONE. `server.test.ts` read in full (146 lines, 8 tests): 200/AskResult shape,
  401 (no header), 401 (invalid key), 403 (missing scope on `/ask`), 501 (stub route, valid key),
  403 (stub route, missing scope — proves scope check precedes the 501, not after), 429 with
  `Retry-After` (3rd request against `max:2`), fixtures sanity. **Status-code matrix verified
  correct on read, not just re-run green:** no-header → 401 `unauthorized`; unknown/invalid key →
  401 `unauthorized`; valid key wrong scope → 403 `forbidden` (both on `/ask` and on a stub route,
  confirming scope-check ordering); valid key + correct scope on unbuilt route → 501
  `not_implemented`; over rate limit → 429 `rate_limited` + `Retry-After` present. No case where
  401/403 are swapped or where a stub route silently returns 200/403 instead of 501.
- **C8** No regression — DONE, all six commands independently re-run above, all clean, counts
  match the manifest's claims.

## Judgment call: C3 scoreFn scoping (ruled on)

The manifest discloses `apps/api/src/score.ts`'s `heuristicScore` (deterministic keyword-overlap)
stands in for a real LLM-based judge in production. Read `packages/ask/src/evaluator.ts:20`:
`export type ScoreFn = (query: string, node: TreeIndexNode) => ScoreResult;` — synchronous, no
`Promise`. An LLM-based scorer is necessarily async and cannot satisfy this signature without a
breaking interface change.

Read contract C3's actual text (`qa/contracts/developer-api.md`, "POST /ask" bullet): it requires
a real `treeSearchFn` sourced from `packages/index`'s `treeSearch`, and separately, "On the LLM
`complete` dependency: inject T-019's real provider `complete` function." **`scoreFn` is not named
anywhere in C3** — the criterion is scoped to `treeSearchFn` and `complete` only. Requiring a real
LLM `scoreFn` now would be inventing a new criterion after the fact, not enforcing the one that
exists. This is a legitimate scoping boundary, not a gap that should block PASS: the interface
constraint (`ScoreFn` sync) is real, pre-existing (T-005), genuinely out of this unit's stated
scope, and disclosed rather than hidden (comment block in `score.ts`, called out explicitly in the
manifest).

Ruling: **accepted as scoped**, not a PASS blocker. Recorded as a routine contract amendment (see
`qa/contracts/developer-api.md` amendment log, 2026-09-03) rather than left as an undocumented
verbal exception, with an explicit follow-up: **T-009b — make `ScoreFn` async, wire a real
LLM-based scorer.** This should be added to `qa/QUEUE.md` / considered for the next goal task.

## VERDICT

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 0/0 invariants (contract names none as [I*]) hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All C1-C8 verified on fresh re-run of every command in the manifest plus direct
reading of every source/test file named. Status-code matrix (401 vs 403 vs 501 vs 429) is
correctly implemented and tested with no swaps. C3's disclosed scoreFn heuristic is a legitimate
scoping boundary per the contract's own text (only treeSearchFn + complete named as needing real
wiring) — recorded as a routine amendment with an explicit T-009b follow-up rather than silently
accepted or used to block PASS.
```
