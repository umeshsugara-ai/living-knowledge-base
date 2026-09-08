**VERDICT: PASS**

Cycle checked: 1

# Verdict — search-route

Fresh-context, independent re-verification of `qa/manifests/search-route.md` (un-stub `GET
/search` — plan §10 U0.7, second half). All claims independently reproduced except the live-Mongo
check, which could not run in this session for a network/environment reason unrelated to the
code — see item 11 below.

## Independent take on the two disclosed interpretive choices

1. **Turns-only scope, `session_pages` deferred.** Agree. Every other citable surface in this
   codebase (`citations.ts`'s evidence, `brain.ts`'s session detail) already resolves to
   turn-level granularity, so this keeps the new route's output shape consistent with what every
   downstream consumer already knows how to render. Scoring `session_pages` (LLM-generated summary
   prose) with the same bag-of-words overlap technique used here would conflate "the summary
   happens to mention this word" with "the transcript actually discusses this" — a different and
   arguably misleading signal that deserves its own scoring rationale, not a bolt-on. Deferring it
   as a named, disclosed follow-on is the right call, not scope-avoidance.
2. **"`/ask`'s citation shape" read as `citations.ts`'s `{turnId, sessionId, turn, session}`
   enrichment, not `AskResult.sources`'s tree-node shape.** Agree. `AskResult.sources` is
   `{node_id, evidence?}` — meaningless for a keyword search that never touches the tree. Reading
   the plan's actual intent (U3.1's "chip click → drill-down" flow; U3.2 explicitly builds "on
   U0.7 + U1.5") shows the real requirement is "a search hit must be clickable back to real
   evidence the same way a citation is" — exactly what the adopted shape delivers. A literal
   reading would have produced an unimplementable route.

Both choices are now recorded as the accepted tradeoffs in the new `qa/contracts/search-route.md`
(section "Debatable-but-accepted tradeoff"), not just silently accepted here.

## Evidence, independently reproduced

1. **`lexical.ts` read** — pure function, no imports beyond local types/interfaces; `score > 0`
   gate excludes zero-overlap turns entirely (never pushes a `score: 0` hit); score is
   `overlap / queryTokens.size` ∈ `[0,1]`; `.sort((a,b) => b.score - a.score).slice(0, k)` — sorts
   descending, caps at `k`. Confirmed at `packages/index/src/search/lexical.ts:35-47`.
2. **`search.ts` read** — `if (!q.trim())` → `400 {error:"bad_request",...}` before any scope of
   200/501 path; `k` = `Number.isFinite(kParam) && kParam > 0 ? Math.min(Math.floor(kParam), 50) :
   10` — default 10, max 50, confirmed at `apps/api/src/routes/search.ts:32-38`.
3. **`store.ts`'s `createMongoSearchDeps()` read** — `turnsColl(tenantId).find({}).toArray()`
   called exactly once; hit resolution uses a `Map` built from that single load (no second `turns`
   query); session ids collected via `[...new Set(scored.map(s => s.sessionId))]` before a single
   `Promise.all` fetch — confirmed at `apps/api/src/store.ts:277-295`. Matches the manifest's
   claim precisely: turns loaded once, sessions deduplicated.
4. **`stubs.ts` read** — `STUB_ROUTES` contains exactly one entry, `POST /webhooks/register`;
   `/search` is genuinely gone.
5. **Test-file fixes read** (`server.test.ts`, `pages.test.ts`) — diffed against `HEAD` (`git diff
   --stat`: 2 files, 14 insertions/13 deletions, no new or removed `test()` blocks in either file —
   confirmed by counting `^test(` occurrences before/after: `server.test.ts` 8→8,
   `pages.test.ts` 3→3). Each changed assertion is a direct, minimal consequence of `/search` no
   longer being a stub (retargeting the "hitting a stub gets 501" and "scope check before 501"
   tests to the sole remaining stub `/webhooks/register`; updating the rate-limit test's expected
   statuses from `501`→`400` since `/search` with no `q` now genuinely 400s; retargeting docs-ui's
   "lists a real + a still-stubbed route" example the same way). No scope creep, no paper-over.
6. **`pnpm -r typecheck`** — re-run, all 10 workspace projects clean.
7. **`pnpm --filter @lkb/index test`** — re-run, 49/49 (43 pre-existing + 6 new `lexical.test.ts`).
8. **`pnpm --filter @lkb/api test`** — re-run, 89/89. Arithmetic independently re-derived from the
   source diffs (not just trusted from the final count): `server.test.ts`/`pages.test.ts` have
   identical `test()` block counts before and after (no additions/removals, only content changes),
   so the entire +4 net growth is `search.test.ts`'s 4 new tests → 89 − 4 = 85 pre-existing,
   matching the manifest exactly.
9. **Mutation test A (route)** — removed the empty-`q` `400` guard in `search.ts`; `git diff`
   confirmed the file genuinely changed; re-ran `search.test.ts` in isolation: **3/4 pass, exactly
   "GET /search with no q param returns 400, not a stub 501" reddened** (`200 !== 400`). Restored
   to the byte-identical original (`git diff` empty); re-ran: 4/4 green.
10. **Mutation test B (scorer)** — removed the `score > 0` filter in `lexical.ts`; since this file
    is new/untracked (`git diff` against `HEAD` shows nothing for untracked files), confirmed the
    change via a pre-mutation backup-file diff instead; re-ran `lexical.test.ts` in isolation:
    **4/6 pass, exactly "a turn with zero query-term overlap is excluded, not scored 0" AND
    "scores are in [0, 1]..." reddened**. Restored from backup, confirmed byte-identical via
    `diff`, re-ran: 6/6 green. No mutation left in the repo (verified: current `lexical.ts` content
    matches the pre-mutation backup exactly, and `search.ts` matches `git diff` = empty).
11. **Live database check — NOT independently reproduced this cycle.** Wrote a throwaway script
    (`apps/api/src/_temp-check.mjs`, deleted immediately after) importing the real
    `createMongoSearchDeps()` and calling `.search("toc", "visa student university", 5)` /
    `.search("toc", "xqzflorbnonsensewordzzz", 5)`, following the exact connect-pattern
    `scripts/seed-demo-server.mjs` uses. It could not connect: both the Node/mongodb-driver
    connection attempt and a raw OS-level `Test-NetConnection` to `13.202.206.101:27017` timed out
    from this checker's sandbox (`ETIMEDOUT`, ping also failed). This reads as a network/egress
    restriction specific to this checker's environment, not a code defect — `createMongoSearchDeps`
    itself was read line-by-line (item 3 above) and is structurally sound, and the identical query
    logic (`lexicalSearchTurns`) is directly unit-tested with realistic multi-turn fixtures. But I
    could not personally confirm the manifest's pasted live-hit output is real and not fabricated
    or stale — that specific sub-claim is UNVERIFIED, not confirmed, by this cycle. Recorded as
    such in the new contract's amendment log with a recommendation to re-attempt from a
    network-capable session.
12. **`pnpm lint:structure`** — re-run, clean (235 files in budget, 257 modules/768 dependencies,
    0 violations, gate G1 OK).
13. **`node scripts/catalogue-score.mjs`** — re-run, reproduces exactly: 24.6% adjusted / 33.3%
    machine-derived, 57 features.

## Contract

**Written**: `qa/contracts/search-route.md`, following the `citations-route.md`/`health-route.md`
checker-authored pattern (ISS-006 segregation of duties — the maker deliberately did not draft
one). Warranted for the same reason those two were: this route un-stubs a load-bearing seam two
future units (`U1.5`'s hybrid-merge scorer, `U3.2`'s search UI) are specified to reuse without
re-deriving its behavior, so its invariants (pure scorer, `k` bounds, turns-loaded-once/
session-deduplication, the 400/403/200 split) need a frozen reference independent of this one
session's memory. The contract records both interpretive choices as accepted tradeoffs (not
silent agreement), plus a disclosed-but-unenforced scalability ceiling (whole-tenant `turns`
collection loaded per request) worth flagging for whoever eventually revisits it, and a real,
disclosed test-coverage gap (`k` boundary values are correct on inspection but not machine-proven
by a dedicated test).

## Disposition

PASS. The one incomplete item (live-Mongo reproduction) is an environment/network limitation on
this checker's session, not a defect in the code or a gap in the maker's testing — every other
independent check (source reads, full-suite re-runs, both mutation tests reproduced from scratch,
lint/score reproduction) supports the manifest's claims at the same or higher rigor the manifest
itself used. Flagging the live check as unverified rather than silently treating the manifest's
pasted transcript as confirmed, per the instruction not to trust it uncritically — a future
session with real network access to `13.202.206.101:27017` should re-run this specific check
before treating it as independently closed.
