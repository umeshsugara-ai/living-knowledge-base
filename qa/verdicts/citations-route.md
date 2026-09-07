**VERDICT: PASS**

# Verdict — citations-route (plan §10 U0.8)

**Cycle checked: 1**
Contract: `qa/contracts/citations-route.md` (created and adopted by this checker in this same
action — the manifest deferred contract-writing per ISS-006 segregation-of-duties, so there was
no separate maker draft to react to).
Manifest: `qa/manifests/citations-route.md`

Fresh, isolated context. Nothing in the manifest was trusted without independent re-derivation —
every file was read directly, every command re-run from scratch, and a real mutation was applied
and reverted to prove the 404 test actually exercises the branch it claims to.

## 1. `apps/api/src/routes/citations.ts`

PASS. Read directly. `CitationsDeps.getCitation(tenantId, claimId)` is the sole injection point
(no `@lkb/db`/Mongo import in the file — matches `routes/brain.ts`'s pattern exactly, same
`requireScope`/`req.auth!.tenantId` shape). `if (!citation) { res.status(404)... }` — genuinely
404, not the stub's 501. Route requires the `citations` scope via `requireScope("citations")`.
`CitationEvidence.turn`/`.session` are typed `Turns | null` / `Sessions | null` with inline
comments stating each is independently nullable — never a fatal failure if one referenced row is
missing.

## 2. `apps/api/src/store.ts` — `createMongoCitationsDeps()`

PASS. Read directly (lines 104-125). `claimsColl(tenantId).findOne({_id: claimId})` for the
claim; if absent, returns `null` (→ 404 upstream). Otherwise resolves every `evidence[]` entry's
turn + session in parallel via `Promise.all(claim.evidence.map(...))`, each entry itself doing
`Promise.all([turnsColl.findOne, sessionsColl.findOne])` with `?? null` — real accessors
(`claims`/`turns`/`sessions` from `@lkb/db`), correctly parallel, correctly null-safe per item.

## 3. `apps/api/src/server.ts`

PASS. Read directly. `citations: CitationsDeps` added to `ServerDeps` (line 32).
`app.use(createCitationsRouter(deps.citations))` (line 62) mounted immediately after
`createBrainRouter`, before `createStubsRouter()` (line 69) — Express registration order means
the real route wins.

## 4. `apps/api/src/routes/stubs.ts`

PASS. Read directly. `STUB_ROUTES` now lists only `/search` and `/webhooks/register` —
`/citations/:claimId` is genuinely gone. Top comment updated: explicitly names
`/citations/:claimId` as un-stubbed to `routes/citations.ts` under plan §10 U0.8.

## 5. `apps/api/src/production.ts` and `apps/api/src/fixtures.ts`

PASS. `production.ts`: `createMongoCitationsDeps` imported and wired as `citations:
createMongoCitationsDeps()` in `buildProductionDeps()`. `fixtures.ts`: `fakeCitationsDeps()`
defined (lines 111-127) sharing `claim-1`/`t1`/`session-1` ids with `fakeBrainReadDeps()` as
claimed, wired into `buildTestDeps()` as `citations: fakeCitationsDeps()`.

## 6. Typecheck

PASS, re-run fresh:

```
$ pnpm --filter @lkb/api typecheck
> tsc --noEmit -p tsconfig.json
(clean)

$ pnpm -r typecheck
Scope: 10 of 11 workspace projects
... all 10 workspace projects: Done
```

## 7. `@lkb/api` test suite

PASS, re-run fresh: **80/80 pass.** Specifically confirmed via targeted grep on the run:

```
✔ GET /citations/:claimId with the citations scope returns claim + resolved evidence
✔ GET /citations/:claimId with an unknown id returns 404, not a stub 501
✔ GET /citations/:claimId without the citations scope returns 403, never a silent 200
✔ a valid key hitting a stub route gets 501 (authorized but not built), never 403 or 200
✔ a valid key lacking a stub route's scope still gets 403 there (scope check runs before the 501)
```

All 3 new citations tests pass; the pre-existing stub-501 test is unaffected, as claimed (it only
exercises `/search`/`/webhooks/register`).

## 8. Mutation test — independently reproduced, not trusted from the manifest

PASS. Backed up `citations.ts` to a scratch path first. Edited `if (!citation)` → `if (false)` in
`apps/api/src/routes/citations.ts`. Confirmed via `diff` against the backup that the file content
genuinely changed (one line: `if (!citation) {` → `if (false) {`). Re-ran
`node --test --import tsx apps/api/src/routes/citations.test.ts`:

```
✔ GET /citations/:claimId with the citations scope returns claim + resolved evidence
✖ GET /citations/:claimId with an unknown id returns 404, not a stub 501
  AssertionError: 200 !== 404
✔ GET /citations/:claimId without the citations scope returns 403, never a silent 200
tests 3, pass 2, fail 1
```

Exactly the "unknown id returns 404" test reddened — not a false green, not a different test
breaking. Restored the file from the pre-mutation backup, confirmed via `diff` the restore was
byte-identical to the original, re-ran the test file: **3/3 green.** Repo left unmutated.

## 9. Structure lint

PASS, re-run fresh:

```
$ pnpm lint:structure
lint-loc: OK (227 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (247 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1111 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
tracker-audit: OK (gate G1)
✔ no dependency violations found (249 modules, 741 dependencies cruised)
```

## 10. Catalogue score — independently re-derived, not trusted from the manifest

PASS. Ran `node scripts/catalogue-score.mjs` fresh: **21.9% adjusted / 30.7% machine-derived, 57
features** — matches the manifest's claimed figures exactly. Confirmed via `git status --porcelain
.goal/catalogue.json` and `git diff --stat .goal/catalogue.json` that the file is completely
untouched by this unit (no output from either command) — the score movement is purely the
route-scrape signal detecting the real new route, not a manual override.

## 11. Contract judgement

**Warranted — contract written.** This capability has real machine-checkable criteria distinct
from any existing contract: the 404-vs-501 distinction (a status-code collapse would be a silent
regression), per-evidence-item null-safety (a data-integrity signal that could silently disappear
into a 500), and the scope requirement. Wrote `qa/contracts/citations-route.md` following the
`tracker-integrity.md`/`knowledge-graph-accessors.md` pattern (checker-authored, adopted directly
per ISS-006 since the manifest explicitly deferred the draft) — 8 machine-checkable criteria and
3 invariants (evidence integrity always visible per-item, 404/501 must never re-collapse, route
stays read-only).

## Overall

**PASS.** All checks independently re-run and confirmed: injected-deps pattern matches
`routes/brain.ts`, real Mongo wiring in `store.ts` with correct parallel per-item null-safety,
correct mount order in `server.ts`, genuine stub removal in `stubs.ts`, real production/fixtures
wiring, clean typecheck (both scoped and repo-wide), 80/80 tests including all 3 new + the
unaffected stub test, a genuine mutation test that reddened exactly the expected test and was
cleanly restored, clean `lint:structure`, and an independently re-derived catalogue score matching
the claimed figures with `.goal/catalogue.json` confirmed untouched. Pure additive, honest change
as claimed.
