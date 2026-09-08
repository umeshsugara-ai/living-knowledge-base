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
   issues **exactly one** `turns` query per request, builds a `Map` for O(1) hit resolution, and
   never issues a second `turns` query inside the per-hit mapping. Verified by reading
   `apps/api/src/search-store.ts`. *(Amended 2026-09-08 by the `search-prefilter` unit: the query
   was `find({})` and is now `find({ $or: <one regex clause per query token> })` — the
   "exactly once" substance is what this criterion protects, not the literal empty filter. The
   deps also moved from `store.ts` to `apps/api/src/search-store.ts`.)*
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
- **[I6] Any server-side candidate pre-filter must be a provable SUPERSET of the scoring set, and
  must derive its tokens from `lexicalQueryTokens` — the scorer's OWN tokenizer.** Added
  2026-09-08 with the `search-prefilter` unit. The argument, restated so a future editor cannot
  weaken it by accident: `lexicalSearchTurns` scores a turn above zero **only** when a query token
  appears as a **whole token** in `tokenize(turn.text)`; a **substring** filter over the *same*
  token list is strictly more permissive, so it necessarily returns a superset and the extras
  score 0 and are dropped by C2's `score > 0` gate. Every step of that chain is load-bearing:
  - **Same tokenizer, no filtering.** Any transformation of the token list that *removes* tokens
    (a length filter, a stopword list, a stemmer) breaks the superset property and silently loses
    real hits with no error — measured against real data: `length > 2` collapsed
    `"AI in counselling"` from 10 hits to 2, and reduced `"is it ok to go"` to zero tokens (an
    empty `$or`, which Mongo rejects outright). A token list *added to* is still safe; a token
    list *reduced* is a contract break. `lexical.test.ts`'s `PROPERTY:` test pins this for the
    pure layer. **It does NOT pin the store's consumption of it — see ISS-072.**
  - **Zero tokens must short-circuit to `[]`,** matching C5's own empty-query behaviour, never
    emit `$or: []`.
  - **Every token must be regex-escaped.** Verified complete for Mongo's PCRE dialect
    (`.*+?^${}()|[]\` — `-` and `#` are context-only and `/` is not a delimiter here, since the
    pattern is passed as a string). Belt-and-braces in practice: because `tokenize` splits on JS
    non-unicode `\W+`, tokens can only contain `[A-Za-z0-9_]`, none of which are metacharacters —
    but the escaping must stay, because it is what makes the property survive a future
    tokenizer change.
  - **What the current tests do and do NOT enforce here (added 2026-09-08, `search-prefilter-bypass-pin`
    cycle-1 check).** Three layers now guard this invariant — `lexical.test.ts`'s `PROPERTY:` test
    (the tokenizer), `search-prefilter.test.ts` (the derivation), and
    `search-prefilter-single-source.test.ts` (the delegation) — and a green suite must not be read
    as the invariant being enforced. Two structural gaps are measured and open:
    **(i) a source-text pin constrains the SOURCE TEXT of `search-store.ts`, never the FILTER
    OBJECT handed to `find()`** — everything between `buildTurnPrefilter`'s `return` and
    `turnsColl().find()` is unconstrained, so mutating the returned filter in place
    (`prefilter.$or = prefilter.$or.slice(0, 1)`), ignoring it and querying `{}`, or laundering a
    narrowing through a third module all satisfy every assertion and were **measured at 99/99 with
    `typecheck` exit 0** (ISS-076). **(ii) `search-prefilter.test.ts` is example-based over six
    hard-coded queries**, so a token-removing defect aimed at a token shape those six do not
    contain also passes 99/99 — and was measured against real Mongo to lose **6 of 20 real hits on
    `"2026 intake"`** (ISS-077). Consequence for a future editor and for U1.5: **do not add a
    fourth string assertion.** The only remedy that closes the class rather than the current
    instance is an injectable collection handle for `createMongoSearchDeps` (the shape
    `indexSession` gained for ISS-056) plus a structural assertion that the filter reaching Mongo
    equals `buildTurnPrefilter`'s own output. This clause adds a rule and weakens nothing.
  - **Bounded exception (ISS-073, severity low, zero live occurrences).** The guarantee assumes
    JS `toLowerCase()` and Mongo's ASCII-only `$options: "i"` agree. They diverge for the few
    characters whose lowercase mapping crosses into ASCII (`U+0130` → `i`+`U+0307`, `U+212A` →
    `k`): such a turn can be scored by the JS tokenizer yet missed by the regex. Verified
    read-only against the real `toc` tenant that **0 of 2118 turns** contain either character.
    Recorded as a known bound on I6, not a defect to fix today.

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

**Update 2026-09-08 (`search-prefilter` unit) — the ceiling moved, it did not go away.** The
unbounded fetch is now a `$or` regex pre-filter (I6). Measured by this checker against real
Mongo, 7 interleaved runs per path, tenant `toc`, 2118 turns, query
`"visa student university funding"`: **new median 708ms vs old median 852ms (~17% faster)**. The
maker's manifest reports 993ms vs 1422ms (~30%) from its own session; both runs agree on the
*direction* and on the *character* of the win, but the magnitude is not a stable constant —
treat "~30%" as one session's figure, not a property. The complexity claim is confirmed exactly
as stated: `db.collection('turns').indexes()` returns **only** `_id_`, `tenantId_1`,
`tenantId_1_sessionId_1` — no text index — so this remains an unindexed O(corpus) scan and a
constant-factor win. Plan §10's Phase-1 retrieval layer is still the real fix.

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
- 2026-09-08 · routine · `search-prefilter-bypass-pin` cycle-1 check (PASS). **[I6] gains one
  clause** recording what the three test layers do and do not enforce, with the two measured
  structural gaps (ISS-076: a source-text pin cannot constrain the filter object — three bypass
  routes measured green at 99/99 with typecheck exit 0; ISS-077: the `PROPERTY:` test is
  example-based over six queries — a numeric-token-dropping defect measured green at 99/99 and
  measured to lose 6 of 20 real hits on `"2026 intake"` against live Mongo). A **tightening**:
  it adds a rule a future edit can be judged against and explicitly directs the next unit away
  from a fourth string assertion toward an injectable collection handle; nothing is removed and
  no criterion is softened. All criteria re-derived this cycle by the checker:
  `pnpm --filter @lkb/api test` 99/99, `pnpm --filter @lkb/index test` 59/59, `pnpm -r typecheck`
  exit 0 (10 projects), `pnpm lint:structure` clean (depcruise 0 violations / 263 modules,
  SNAPSHOT fresh at 116 lines, tracker-audit G1 OK), both manifest bypasses replayed with the
  predicted signatures (97/99 with tests 1+2 red; 98/99 with only test 3 red — confirming the
  three tests discriminate), every mutation confirmed changed by backup-diff and restored
  SHA256-identical, and — unlike the previous cycle, which could not reach the host — **the live
  read-only Mongo parity run COMPLETED this cycle**: tenant `toc`, 2118 turns, 9 queries (the
  manifest's 6 plus a single-short-token, a zero-hit and a numeric-token query), IDENTICAL on
  turnIds AND scores, `RESULT PARITY: YES`. ISS-073's premise independently re-verified live: **0
  occurrences of U+0130/U+212A in 2118 turns** — the bound stands and stays open. ISS-075's
  brute-force claim independently reproduced (0 non-word tokens across codepoints 0x0000–0x2FFF)
  and its keep-the-code decision endorsed. **No latency figure added to this contract this cycle**
  — the manifest's refusal to quote a headline number is judged correct, not evasive: four
  measurements span 9.8%–30% because the metric is network-dominated (transfer 1064ms vs compute
  38ms) and the magnitude is not a stable constant, while the direction and the mechanism are.
- 2026-09-08 · routine · `search-prefilter` cycle-1 check. (a) **C9 reworded** — its substance
  ("exactly one `turns` query per request") is unchanged and still holds; only the literal
  `find({})` text and the `store.ts` file reference went stale when the unit replaced the
  unbounded fetch with a `$or` regex pre-filter and extracted the deps to
  `apps/api/src/search-store.ts`. Not a weakening: the criterion protects query *count*, not the
  filter's emptiness. (b) **[I6] ADDED** — the superset/same-tokenizer invariant the pre-filter's
  correctness rests on, with its three load-bearing sub-clauses (no token removal, empty-token
  short-circuit, mandatory regex escaping) and its one recorded Unicode bound (ISS-073). This is
  a *tightening*: it converts an argument that lived only in a manifest into a rule a future
  edit can be judged against. (c) **Tradeoff section updated** with this checker's own measured
  numbers (708ms vs 852ms, ~17%, 7 interleaved runs each) and the independently re-derived index
  list, deliberately recording that they do NOT reproduce the manifest's ~30% figure. All
  criteria re-derived this cycle by the checker: `pnpm -r typecheck` exit 0 (10 projects),
  `pnpm --filter @lkb/index test` 59/59, `pnpm --filter @lkb/api test` 89/89,
  `pnpm lint:structure` clean (lint-loc OK 238 files, SNAPSHOT fresh at 116, depcruise 0
  violations across 260 modules), the maker's mutation reproduced (7/9, both target tests red,
  restored 9/9), a checker-original mutation on `search-store.ts` that nothing catches
  (ISS-072), and a live read-only parity run against real Mongo over 9 queries — the maker's 6
  plus three checker-added adversarial ones — all IDENTICAL in turnIds AND scores.
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
