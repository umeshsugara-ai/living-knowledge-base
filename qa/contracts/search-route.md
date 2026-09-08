# Contract — search-route (plan §10 U0.7, second half)

> Ground truth for `GET /search` — `apps/api/src/routes/search.ts`, `lexicalSearchTurns` in
> `packages/index/src/search/lexical.ts`, `createMongoSearchDeps()` in `apps/api/src/store.ts`,
> and `fakeSearchDeps()` in `apps/api/src/fixtures.ts`. Created and adopted by /checker in the
> same action: the manifest explicitly deferred contract-writing to the checker per the project's
> segregation-of-duties rule (ISS-006) — this file *is* the first draft, written from the
> manifest's proposed criteria plus this checker's own independent read of the scorer, the route,
> the store wiring, `server.ts`, and `stubs.ts`, following the `citations-route.md`/
> `health-route.md` precedent from earlier the same session.
>
> **Why this contract exists:** this route un-stubs the last honestly-labeled `501` GET route and
> is explicitly named as the seam two future units reuse without re-review — U1.5's hybrid-merge
> scorer ("the hybrid merge reuses this lexical scorer") and the U3.2 search UI. A silent
> regression here (an unbounded `k`, a re-introduced per-hit query, a leaked zero-score hit) would
> propagate into both without either unit's own review catching it, because both are specified to
> trust this scorer's contract rather than re-derive it.

## Scope

`packages/index/src/search/lexical.ts` (`lexicalSearchTurns`, `LexicalHit`, `SearchableTurn`),
`apps/api/src/routes/search.ts` (`SearchHit`, `SearchDeps`, `createSearchRouter`),
`createMongoSearchDeps()` in `apps/api/src/store.ts`, `fakeSearchDeps()` in
`apps/api/src/fixtures.ts`, the route's mount position in `apps/api/src/server.ts`, and its
removal from `STUB_ROUTES` in `apps/api/src/routes/stubs.ts`. Out of scope: lexical search over
`session_pages` (a disclosed, deliberate follow-on — see Debatable-but-accepted tradeoff below),
the U1.5 hybrid-merge scorer itself (a separate future unit that only *consumes* this contract),
and the `turns`/`sessions` accessors' own correctness (governed by `packages/db`'s own tests).

## Criteria (each machine-checkable)

1. **[C1] `lexicalSearchTurns` is a pure function.** No I/O, no imports beyond `@lkb/core`-style
   types — verified by reading `lexical.ts`: the only imports are none beyond its own local
   interfaces. Same signature `(query: string, turns: SearchableTurn[], k: number) => LexicalHit[]`
   for every future caller (including U1.5) to rely on without re-reading the implementation.
2. **[C2] Zero-overlap turns are excluded entirely, never scored 0.** `score > 0` gates every
   push into the hits array. Machine-checked by `lexical.test.ts`'s "zero-overlap turn is
   excluded, not scored 0" test and the mutation test below.
3. **[C3] Score scale is `[0, 1]`, matching every other heuristic scorer in this codebase**
   (`score.ts`'s `heuristicScore`, `eval/heuristic-retriever.ts`, `extract-topics.ts`). Machine-
   checked by `lexical.test.ts`'s score-range test.
4. **[C4] Results are sorted descending by score and capped at `k`.** Machine-checked by
   `lexical.test.ts`'s sort-order and k-limiting tests.
5. **[C5] Empty/whitespace-only query never matches everything.** `tokenize(query).size === 0`
   short-circuits to `[]` before scoring any turn. Machine-checked by `lexical.test.ts`'s empty-
   query test.
6. **[C6] Route: empty/missing `q` is `400`, never a silent `200` or the removed `501`.** The
   guard trims `q` before checking emptiness (`" "` counts as empty). Machine-checked by
   `search.test.ts`'s "no q param" test and the mutation test below.
7. **[C7] `k` defaults to 10, clamps to a max of 50, floors non-integer input, and ignores
   invalid input (falls back to the default) rather than erroring.** Verified by reading
   `search.ts`: `Number.isFinite(kParam) && kParam > 0 ? Math.min(Math.floor(kParam), MAX_K) :
   DEFAULT_K`. This is the resource-exhaustion guard for an otherwise-arbitrary authenticated
   caller — no test currently exercises `k > 50` or a negative/NaN `k` directly (a real gap, see
   Invariants I2), but the code path is unambiguous on inspection.
8. **[C8] `search` scope required.** Mounted behind `requireScope("search")`; a key lacking that
   scope gets `403`, never a silent `200`. Machine-checked by `search.test.ts`'s scope test.
9. **[C9] Turns are loaded once per request, never re-queried per hit.** `createMongoSearchDeps()`
   calls `turnsColl(tenantId).find({}).toArray()` exactly once, builds a `Map` for O(1) hit
   resolution, and never issues a second `turns` query inside the per-hit mapping. Verified by
   reading `store.ts`.
10. **[C10] Session lookups are deduplicated.** Session ids are collected into a `Set` before
    fetching — one `findOne` per *distinct* session id, not per hit, even when multiple hits share
    a session. Verified by reading `store.ts`: `[...new Set(scored.map((s) => s.sessionId))]`
    followed by one `Promise.all` over that deduped array.
11. **[C11] Per-hit null-safety.** A hit whose turn or session document is missing (e.g. deleted
    between the initial load and resolution, though the current single-pass design makes this
    effectively impossible for `turn`; theoretically possible for a concurrently-deleted
    `session`) resolves to `null`, never throwing or omitting the hit. Verified by reading
    `store.ts`'s `?? null` fallbacks, same pattern as `citations-route.md`'s C4.
12. **[C12] Real route wins over the removed stub.** `/search` is absent from `STUB_ROUTES` in
    `stubs.ts`, and `createSearchRouter` is mounted in `server.ts`. Machine-checked by
    `server.test.ts`'s retargeted stub tests (now `/webhooks/register`-only) and
    `pages.test.ts`'s docs-ui test.
13. **[C13] Build stays green.** `pnpm -r typecheck`, `pnpm --filter @lkb/index test`, and
    `pnpm --filter @lkb/api test` all pass.
14. **[C14] Mutation-provable, both layers.** (a) Removing the route's empty-`q` `400` guard must
    redden exactly the "no q param returns 400" test in `search.test.ts` and no other test in that
    file. (b) Removing the scorer's `score > 0` filter must redden exactly the "zero-overlap
    excluded" and "scores are in [0,1]" tests in `lexical.test.ts` and no others in that file.
    Independently reproduced by this checker (2026-09-08): (a) 3/4 pass, exactly the 400 test
    reddened (`200 !== 400`); (b) 4/6 pass, exactly those two tests reddened. Both restored to
    byte-identical originals and re-confirmed green (4/4, 6/6).
15. **[C15] Structure budget.** `pnpm lint:structure` exits 0 with these files tracked in git.

## Invariants

- **[I1] The scorer stays pure.** `lexicalSearchTurns` must never gain an I/O dependency (a
  database call, a network fetch) — U1.5's hybrid merge and any other future caller are entitled
  to assume this function is safe to call synchronously-in-spirit and test without fakes. A future
  edit that makes it async or I/O-bound is a contract break requiring a new manifest, not a
  drive-by change here.
- **[I2] `k` bounds must never be removable without a replacement guard.** `MAX_K` exists
  specifically because `/search` has no pagination and an authenticated-but-arbitrary caller could
  otherwise request the entire `turns` collection scored and returned in one response. Any edit
  that removes or raises this cap without a documented reason (and a corresponding test) is a
  contract break even if it typechecks and existing tests pass — current tests do not directly
  exercise `k > 50`, so "tests still pass" is not sufficient evidence of safety here (same
  reasoning as `health-route.md`'s I1).
- **[I3] Turns-loaded-once and session-deduplication must not regress into per-hit queries.** This
  is a real performance/cost invariant, not a style preference — the tenant's *entire* `turns`
  collection is loaded per search request already (see Debatable-but-accepted tradeoff); a
  regression to N+1 session queries would compound that cost linearly with hit count for no
  benefit. A future edit reintroducing a per-hit `findOne` is a contract break.
- **[I4] `400`/`403`/`501`(now retired)/`200` must never collapse.** Same reasoning as
  `citations-route.md`'s I2 — an empty `q` must never look like "not built" (`501`, now
  impossible since the stub entry is removed) or a silent success, and a missing scope must never
  look like a valid empty result.
- **[I5] The route stays read-only.** No write path is added to `SearchDeps` under this contract.

## Debatable-but-accepted tradeoff (recorded, not silently agreed)

**This checker's own read of the two scoping/interpretation choices the manifest disclosed:**

1. **Turns-only scope, `session_pages` deferred.** Agreed as a reasonable reading. Every other
   citable surface in this codebase (`citations.ts`'s evidence, `brain.ts`'s session detail)
   already resolves to turn-level granularity, so a turn-level search result is the shape every
   downstream consumer (a citation chip, a drill-down link) already knows how to render.
   `session_pages` is LLM-generated summary prose, not verbatim transcript — scoring it with the
   same bag-of-words overlap technique would silently conflate "the summary happens to use this
   word" with "the transcript actually discusses this," a materially different and arguably
   misleading signal if shipped without its own scoring rationale. Deferring it as a named,
   disclosed follow-on rather than bolting it on with the same scorer is the correct call, not
   scope-avoidance. **Not adopting a strict interpretation** — this contract's C1-C15 apply to the
   `turns` path only; a future `session_pages` search needs its own manifest and its own amendment
   or new contract, not a silent extension of this one's criteria.
2. **"`/ask`'s citation shape" read as `citations.ts`'s `{turnId, sessionId, turn, session}`
   enrichment, not `AskResult.sources`'s tree-node shape.** Agreed. `AskResult.sources` is
   `{node_id, evidence?}` — a tree-index concept with no meaning for a keyword search that never
   touches the tree. The plan's actual concern, read in context (U3.1's "chip click → drill-down"
   flow, U3.2's "search page ... on U0.7 + U1.5"), is that a search hit must be clickable back to
   real evidence the same way a citation is — which is exactly what the adopted shape delivers.
   Reading "citation shape" as the literal `AskResult.sources` type would have produced a
   nonsensical, unimplementable route; the maker's interpretation is the only one that survives
   contact with what the plan is actually trying to unblock (U1.5, U3.2). No amendment needed.

A separate, unrelated tradeoff worth recording: **loading the entire tenant's `turns` collection
into memory on every search request** (no index, no streaming) is a real scalability ceiling —
fine at the current ~2100-turn `toc` tenant scale, not fine at 10-100x that. This is the same
"brute-force is fine until it isn't" tradeoff the plan itself names for the vector-search seam
(§10, "a vector DB becomes worth it only when brute-force p95 exceeds ~500ms"). Not a contract
violation today; flagged so a future perf unit doesn't have to rediscover it from scratch.

## Out of scope / ignore

- Lexical search over `session_pages`: not built, not claimed by this unit (see tradeoff above).
- The U1.5 hybrid-merge scorer and its reciprocal-rank fusion: a separate future unit that
  consumes I1-I3 above as its contract with this code, not built here.
- The U3.2 search UI: not built, not claimed by this unit.
- Direct test coverage of `k > 50` / negative / NaN `k` inputs: a real, disclosed gap (see C7) —
  the code is unambiguous on inspection but not machine-proven by a dedicated test today. A future
  cycle adding `search.test.ts` coverage for boundary `k` values would close I2's blind spot
  without needing a contract amendment.

## Amendment log
- 2026-09-08 · routine · Contract CREATED and ADOPTED by /checker in the same action on the
  `search-route` cycle-1 check, from the manifest's proposed criteria (deferred per ISS-006
  segregation-of-duties) plus this checker's own independent verification of `lexical.ts`,
  `search.ts`, `store.ts`'s `createMongoSearchDeps()`, `server.ts`'s mount order, `stubs.ts`'s
  removed entry, fresh mutation tests on both layers (route guard removed: confirmed via backup-
  diff the file genuinely changed, 3/4 pass with exactly the 400 test reddening, restored to
  byte-identical, 4/4 green; scorer filter removed: confirmed via backup-diff — the file is new/
  untracked so `git diff` against HEAD shows nothing, backup-file diff used instead — 4/6 pass
  with exactly the exclusion + score-range tests reddening, restored to byte-identical, 6/6
  green), independently re-derived `pnpm -r typecheck` (10/10 clean), `pnpm --filter @lkb/index
  test` (49/49), `pnpm --filter @lkb/api test` (89/89, arithmetic re-derived from source diffs:
  `server.test.ts`/`pages.test.ts` have identical test-block counts before/after, so all +4 growth
  is `search.test.ts`'s new tests — 89 - 4 = 85 pre-existing, matching the manifest), and
  `pnpm lint:structure` + `catalogue-score.mjs` (24.6%/33.3%, 57 features, both reproduced).
  **The live-Mongo reproduction (checklist item 11) could NOT be completed** — this checker's
  environment has no network path to the configured `MONGODB_URL` host (`13.202.206.101:27017`):
  both a Node/mongodb-driver connection attempt and a raw OS-level TCP/ping test to that host:port
  timed out from this sandbox. This is judged an environment/network constraint on this checker's
  session, not a code defect — every other check (unit tests exercising the identical code path
  with realistic fixture data, mutation tests proving those tests are meaningful, a full source
  read of `createMongoSearchDeps()`) independently supports the manifest's claim, but the specific
  live-database claim (real relevant hits against the real `toc` tenant, zero hits on a nonsense
  query) remains UNVERIFIED by this cycle and should be re-attempted by a session with real network
  access to that host before this specific sub-claim is treated as independently confirmed. START
  stands on plan §10 U0.7 (second half).
