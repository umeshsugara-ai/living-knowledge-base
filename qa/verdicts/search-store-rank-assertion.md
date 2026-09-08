# Verdict — search-store-rank-assertion

**Date:** 2026-09-08
**Mode:** A (unit check)
**Contract:** qa/contracts/search-route.md (invariant [I6], plus C9/C10/C13/C15 and [I2]/[I3]/[I7])
**Manifest:** qa/manifests/search-store-rank-assertion.md
**Cycle checked: 1** (matches the manifest's `Fix cycle: 1 of max 3`)
**Bound to:** `D:/KnowledgeBase` — every path read or written this cycle resolves inside it.
**Dual check:** no (primary verdict path).

```
VERDICT: PASS
SCOREBOARD: 15/15 criteria met, 7/7 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-085 (medium, new — filed, not chased); ISS-083 + ISS-084 moved open -> fixed
EXPLANATION: Both mutations the manifest claims were replayed by this checker and each reddens
exactly one test — critically, the ISS-084 rotation leaves the OLDER ISS-080 self-consistency test
green, which is the direct proof the new test sees something the previous round could not. The
live-Mongo check the manifest honestly disclosed as inconclusive COMPLETED here on the real
getDb() path with no injection: 2118 turns, 8 queries, 0 score / 0 pair / 0 count mismatches. On
the stopping question I agree with the maker and close the seam — my own eighth-bypass hunt did
find one more gap (ISS-085), but it is medium, cost-only, and closable by two lines inside an
existing test, which is exactly the "file it and leave it" case the manifest itself defined.
```

---

## What I re-ran myself (nothing below is taken from the manifest)

| check | my measured result |
|---|---|
| `pnpm --filter @lkb/api test` | **109 tests / 109 pass / 0 fail** (2.31s) |
| `pnpm --filter @lkb/index test` | **59 / 59 pass** (0.59s) |
| `pnpm -r typecheck` | **exit 0**, all 10 workspace projects |
| `pnpm lint:structure` | **clean** — lint-loc OK (242 files), lint-dirsize OK (75 dirs), lint-root OK (15 loose), lint-dupes OK (255 exports / 24 schema $ids), lint-migrations OK (1152 files), SNAPSHOT fresh at 116 lines (budget 200), tracker-audit G1 OK, depcruise **0 violations / 264 modules / 793 deps** |

Every manifest figure reproduced exactly (109/109, 59/59, exit 0, 264 modules). No discrepancy.

## Mutation replay — both the manifest's, executed by me

Backup taken first; base file SHA256 `92370fdaa32854d02a5459a4bc9e8f1de3b5cd871ecd06f85e239de874747948`.

| # | mutation (`apps/api/src/search-store.ts`) | diff confirmed | full suite | reddened |
|---|---|---|---|---|
| A (ISS-083) | line 78 `score: hit.score,` → `score: 0.5,` | yes (1-line diff shown) | **108/109** | **exactly** `hit.score matches what the scorer independently computes for that turn (ISS-083)` |
| B (ISS-084) | final `scored.map` rewritten to take `turnId`/`sessionId`/`turn`/`session` from `scored[(i+1) % scored.length]` while keeping position `i`'s original `score` | yes (7-line → 10-line diff shown) | **108/109** | **exactly** `each hit's (turnId, sessionId) pair matches what the scorer actually ranked at that position (ISS-084)` |

Restored byte-identically after each (SHA256 re-verified equal to the base, and `git status --short apps/api/src/search-store.ts` returns empty — the file matches HEAD). Final suite re-confirmed 109/109.

**The discriminating observation, which is the actual reason this unit earns its PASS.** Under
mutation B, the pre-existing `each hit carries ITS OWN turn and session, not another hit's
(ISS-080)` test stays **green** — every hit is still internally self-consistent — and only the new
ISS-084 test fails. That is a *measured* demonstration that round 7's test is not a restatement of
round 6's, which is the claim a checker should be most sceptical of on a seventh consecutive round
against the same file. It holds.

## Reading the two new tests (manifest verify step 1)

Both cross-check against a **separately computed** `lexicalSearchTurns` call over `OWN`, not
against the store's own output:

- `search-store.test.ts:179` builds `new Map(lexicalSearchTurns(q, OWN, OWN.length).map((h) => [h.turnId, h.score]))` and compares `h.score` to it — a score the store copied from itself cannot satisfy this, because the expected value is derived from the corpus constant, not from the store.
- `search-store.test.ts:193-198` compares **position by position** against `lexicalSearchTurns`' own rank order (`hits[i].turnId === independent[i].turnId`) and resolves `sessionId` through `bySessionId`, a map built from `OWN` — **not** the store's internal `turnById`/`sessionById`. It also pins `hits.length === independent.length`, which is why a truncating or padding defect cannot hide inside it.

Confirmed: no re-derivation of the store's logic in either test. The manifest's description is accurate.

## Live-Mongo check — COMPLETED (the manifest's disclosed gap is now closed)

The manifest did **not** claim a live result; it disclosed a timeout and deferred to this dispatch.
That disclosure is the correct behaviour and is credited as such. I ran my own check.

Method: a throwaway checker-only script, **read-only**, exercising the **real production path** —
`createMongoSearchDeps()` with **no injection**, after `connect()`, so the default `deps.db ??
getDb()` branch is the one under test. Independent ground truth came from a *separate* full-corpus
fetch scored by `lexicalSearchTurns` directly. Script deleted immediately after the run; it was
never committed and `git status` shows no residue.

```
connected in 180ms
full corpus fetch: 2118 turns in 375ms
q="visa"                    hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...visa-blueprint-part2...-t002@1
q="2026 intake"             hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...visa-blueprint-part2...-t188@1
q="AI in counselling"       hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...uniaccess-leeds-arts-university-t020@1
q="education loan funding"  hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...funding-dreams-loans-forex-t001@1
q="student university"      hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...visa-blueprint-part2...-t022@1
q="is it ok to go"          hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...visa-blueprint-part2...-t061@0.8
q="zzzznonsensequery"       hits=0  indep=0  countOK=true scoreBad=0 pairBad=0
q="2.5"                     hits=10 indep=10 countOK=true scoreBad=0 pairBad=0 top=...visa-blueprint-part2...-t279@1

SCORE MISMATCHES: 0 · PAIR/SESSION MISMATCHES: 0 · COUNT MISMATCHES: 0
LIVE RANK PARITY: YES
```

Tenant `toc`, 2118 turns — matching the count recorded in the dispatch and in prior cycles. The
query set deliberately includes the adversarial shapes prior cycles established as load-bearing: a
zero-hit query (`zzzznonsensequery` → 0 hits, and the prefilter's `null` short-circuit means it
issued no scan), an all-short-token query (`is it ok to go`, the one a `length > 2` filter was
measured to destroy), a numeric-token query (`2026 intake`) and a decimal (`2.5`). Every hit also
had `turn.tenantId === "toc"` asserted inline — 0 violations, so [I7]'s tenant merge is confirmed
live on the uninjected path, not only in the fake.

**So ISS-083 and ISS-084 are verified against real data, not only fixtures** — which is a stronger
result than the manifest itself claimed, and it is the reason the two ledger rows move to `fixed`
rather than staying open on fixture-only evidence.

## Criterion-by-criterion

| | criterion | evidence this cycle |
|---|---|---|
| C1 | scorer is pure | `lexical.ts` re-read; no imports beyond local types; signature unchanged. Unaffected by this unit. |
| C2 | zero-overlap excluded, never 0 | `@lkb/index` 59/59; live `zzzznonsensequery` returned 0 hits, not 0-scored hits. |
| C3 | score scale [0,1] | live top scores 1 and 0.8, all within range across 8 queries; index suite green. |
| C4 | sorted desc, capped at k | live `hits=10` for `k=10` on every matching query; **and the new ISS-084 test now pins rank order position-by-position against the scorer** — this criterion is better evidenced this cycle than in any prior one. |
| C5 | empty/whitespace query → `[]` | index suite green; `a query with no usable tokens issues no database query at all` green. |
| C6 | empty `q` → 400 | `search.test.ts` green in the 109. |
| C7 | `k` default 10 / clamp 50 / floor / ignore invalid | source re-read at `search.ts`; unchanged by this unit; the `k is honoured` store test green. |
| C8 | `search` scope required | scope test green in the 109. |
| C9 | turns loaded once, never re-queried per hit | source re-read: single `turnsColl(tenantId).find(prefilter)` at `search-store.ts:65`, `turnById` built from that array at :71. **Correct in the shipped code — but see ISS-085: no test enforces it.** Criterion met on inspection, which is what C9's own wording asks for. |
| C10 | session lookups deduplicated | `search-store.ts:72` `[...new Set(scored.map((s) => s.sessionId))]`; `sessions are fetched once each` test green. |
| C11 | per-hit null-safety | `?? null` at :79-80 intact. |
| C12 | real route wins over stub | `server.test.ts` / `pages.test.ts` green in the 109. |
| C13 | build green | 109/109 + 59/59 + typecheck exit 0, all re-run above. |
| C14 | mutation-provable, both layers | index-layer mutations stand from prior cycles; **this cycle's two store-layer mutations replayed above**, each reddening exactly one test. |
| C15 | structure budget | `pnpm lint:structure` clean, re-run above. |

| | invariant | holds? |
|---|---|---|
| I1 | scorer stays pure | yes — untouched; no production code changed at all this unit. |
| I2 | `k` bounds not removable without a guard | yes — `k is honoured` test still green and now reinforced by ISS-084's length assertion. |
| I3 | turns-loaded-once + session dedup, no per-hit queries | **holds in the shipped code**; the session half is machine-enforced, the **turns half is not** (ISS-085). Not a break — the artifact is correct — but recorded as a coverage gap, exactly as [I6]'s existing clauses record theirs. |
| I4 | 400/403/501/200 never collapse | yes — route tests green. |
| I5 | route stays read-only | yes — no write path; my live run was read-only. |
| I6 | prefilter is a superset, tokens from the scorer's own tokenizer | yes — derived-query superset test green over 40+ generated queries; live parity 0 mismatches over 8 queries including the short-token and numeric shapes. |
| I7 | every handle via `scopedCollection`, tenant survives the seam | yes — `assertAllCallsConfined` green; live run confirmed every returned `turn.tenantId === "toc"` on the uninjected production path. |

`Issues addressed` reconciled against the ledger: ISS-083 and ISS-084 are both genuinely closed by
this unit and by my replay, so both move `open → fixed`. Neither is marked `verified` — that stays
for a later re-check, per protocol.

## The stopping question — my explicit call

**I agree with the maker. This is the last round on `search-store.ts`'s test coverage, and I am
closing the seam.** The reasoning, stated so a future session can overturn it on evidence rather
than on mood:

1. **The severity trend is real and I re-derived it rather than accepting the table.** Round 6 was a
   cross-tenant disclosure of verbatim transcript text — a genuine spike, and the reason continuing
   past it was right. Round 7's two findings are both cost/integrity-of-a-field issues with **no
   security consequence and no live reproduction**, and my own live run confirms the shipped code is
   correct on both against 2118 real turns.
2. **The remaining surface is now structurally, not incidentally, guarded.** The decisive shift
   happened at `search-store-injectable-handle`: assertions moved from *source text* to the *object
   that reaches `find()`* and to the *values that come back*. Rounds 6 and 7 have been filling in
   dimensions of that object (tenant, then score, then pairing). That is a **finite** list, and it is
   now substantially enumerated: filter identity, tenant confinement, `k`, hit resolution, session
   dedup, score fidelity, rank pairing.
3. **I ran an eighth-bypass hunt anyway rather than deferring to the maker's recommendation, and I
   did find one** — ISS-085 below. I am filing it and *not* opening round 8, because it satisfies
   the maker's own stated bar in the negative: medium, cost-only, no live-data or security
   consequence. Manufacturing a manifest for it would be the "eighth round by inertia" the manifest
   correctly warns against.
4. **The maker has been wrong before about the class being closed, and I have not simply taken its
   word.** Every claim above is re-derived; ISS-085 is direct proof I hunted rather than deferred.

**What would legitimately reopen this seam** (stated so the bar is not re-litigated from scratch):
a bypass with a tenant/security consequence, a live-Mongo reproduction of wrong data, or a
production behavioural bug. A ninth mutation class at low/medium with no live consequence should be
filed to the ledger and left there.

### ISS-085 — the eighth bypass I found (filed, not chased)

Replaced `const turnById = new Map(turns.map((t) => [t._id, t]));` with a `Promise.all` over
`scored` issuing `turnsColl(tenantId).findOne({ _id: s.turnId })` **once per hit** — the initial
prefiltered `find()` still issued, its result discarded. Measured: **109/109 green, typecheck exit
0.** Nothing reddened. Restored byte-identically.

It survives because the suite counts **session** lookups only (`search-store.test.ts:207`) and
nothing anywhere counts calls where `coll === "turns"`; the mutated query is still tenant-scoped, so
`assertAllCallsConfined` passes, and every returned value is still correct, so all ten object-level
tests pass.

This one is worth naming precisely because it is **a contract break the contract names in advance**
— C9 ("never issues a second `turns` query inside the per-hit mapping") and [I3] ("A future edit
reintroducing a per-hit `findOne` is a contract break"). Its live cost is bounded and non-security:
up to `k` (≤50) extra round trips on a collection whose single fetch already dominates the request
at 375ms measured this cycle. **Remedy is two lines inside the existing session-dedup test**, which
already holds `calls`:

```ts
assert.equal(calls.filter((c) => c.coll === "turns" && c.op === "find").length, 1);
assert.equal(calls.filter((c) => c.coll === "turns" && c.op === "findOne").length, 0);
```

Fold it into whatever unit next touches this file. It does not deserve a manifest of its own, and
saying so plainly is the point of this verdict.

## Contract amendment

**None this cycle.** [I6]'s existing closure clause already records the pattern "a green suite must
not be read as the invariant being enforced," and ISS-085 is a further instance of it now living in
the ledger where it belongs. Adding a fourth prose clause enumerating it would repeat what the
ledger says without giving a future edit any rule it does not already have — [I3] already forbids
the per-hit `findOne` in as many words; what was missing is a test, not a rule. Nothing softened,
nothing removed. Consistent with the amendment log's own standard from the previous two cycles
(record the follow-on as an issue, not as a manifest and not as contract churn).

## Notes / open questions (below the >80% bar — not failures)

- The manifest's "9 pass / 1 fail" figures describe the store test file in isolation; I measured the
  full suite (108/109) instead. Same substance, different denominator — not a discrepancy, recorded
  so a future reader does not think the numbers disagree.
- ISS-082 (the inverted boot-order rationale in the `search-store.ts` comment) remains **open** and
  untouched by this unit, correctly — it is comment-only and this unit changed no production code.
- The unindexed-scan ceiling stands: full corpus fetch measured **375ms** this cycle (vs 341ms in
  the dispatch's note), consistent with prior measurements and still network-dominated. Unchanged
  judgment: no headline latency figure belongs in the contract; ISS-081 holds the follow-on.
