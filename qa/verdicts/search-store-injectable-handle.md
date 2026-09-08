# Verdict — search-store-injectable-handle

**VERDICT: PASS**

**Cycle checked: 1**
**Date:** 2026-09-08
**Contract:** qa/contracts/search-route.md (invariant **[I6]**)
**Manifest:** qa/manifests/search-store-injectable-handle.md (Status `ready-for-check`, Fix cycle 1)
**Mode:** A (unit check), bound to `D:\KnowledgeBase`. Every path read or written resolves inside it.

```
VERDICT: PASS
SCOREBOARD: 15/15 criteria met, 6/6 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-078 (high), ISS-079 (medium), ISS-080 (medium), ISS-081 (low), ISS-082 (low)
ISSUES-CLOSED: ISS-076, ISS-077 (status open -> fixed). ISS-073 left open by design.
EXPLANATION: Everything the unit claims about the filter object is true and was re-derived, not
trusted: all three of the previous checker's bypasses (4A post-call mutation, 4B wrapper-module
laundering, 4C numeric-token removal in the builder) now redden the new object-level test, and the
unit's central contrast reproduced exactly — 4B passes search-prefilter-single-source.test.ts 3/3
while failing the object test. Live read-only parity against production Mongo COMPLETED on the real
getDb() path with NO injection (8 queries, 2118 turns, identical turnIds AND scores), so the new
default parameter is proven not to have changed production behaviour. BUT the maker's closure claim
is again too broad, for the fourth time: I found a FIFTH bypass INSIDE the claimed class — removing
`scopedCollection` from the turns handle strips `tenantId` from the very filter object this unit
pins, and leaves 102/102 green with typecheck exit 0 and lint:structure clean. Filed ISS-078 (high).
It does not block: the shipped code is correct and no contract criterion is unmet.
```

---

## 1. What I re-ran myself (nothing below is quoted from the manifest)

| Command | Result |
|---|---|
| `pnpm --filter @lkb/api test` | **102 / 102 pass, 0 fail** (baseline, and again after every restore) |
| `pnpm --filter @lkb/index test` | **59 / 59 pass** |
| `pnpm -r typecheck` | **exit 0**, all 10 projects Done |
| `pnpm lint:structure` | **clean** — lint-loc OK (242 files), lint-dirsize OK (75 dirs), lint-root OK (15 loose), lint-dupes OK (255 exports / 24 schema ids), lint-migrations OK (1147 files), `docs/SNAPSHOT.md` fresh at 116 lines, tracker-audit G1 OK, depcruise **0 violations across 264 modules / 793 dependencies** |
| Live Mongo parity, real `getDb()`, no injection | **RESULT PARITY ACROSS ALL QUERIES: YES** (detail in §4) |

Baseline file hashes, restored byte-identically after every mutation below:
`apps/api/src/search-store.ts` SHA256 `92370fdaa32854d02a5459a4bc9e8f1de3b5cd871ecd06f85e239de874747948`;
`apps/api/src/search-prefilter.ts` SHA256 `d2e7af0dbf7420013e28e7c9b6e50ba711d94a3c286670414e0c3b5980755d55`
(both re-confirmed identical pre- and post-mutation). `git status` after the session shows no mutation residue: the only touched
paths are this unit's own two files plus the pre-existing `.goal/goal.json`, `qa/.last-tick` and
`qa/evidence/.../preflight.json` modifications, which I did not touch.

## 2. Manifest checklist items 1–2 (read-level confirmations)

**Item 1 — `db` resolved per call, and `scopedCollection` not weakened. CONFIRMED, both halves.**

- `search-store.ts:58` — `const db = deps.db ?? getDb();` sits **inside** `async search(...)`, not in
  `createMongoSearchDeps`'s body. A construction-time default would capture `getDb()` at deps-build
  time. Per-call resolution is correct and is the safer shape.
- `search-store.ts:59-60` — `scopedCollection<Turns>(db as never, "turns")` and the sessions
  equivalent still wrap the **injected** handle. The injection stops *inside* `scopedCollection`'s
  `db.collection(name)` call; it does not step around it. **Tenant scoping was NOT weakened to gain
  testability** — this is the point I was asked to confirm independently, and I confirmed it two ways:
  by reading `packages/db/src/lib/tenantScope.ts:36-39` (`find` calls `withTenant(tenantId, filter)`,
  which spreads `{...filter, tenantId}`), and **empirically**, by driving `createMongoSearchDeps({db})`
  with my own capturing handle and printing the captured object:
  `CAPTURED FILTER KEYS: ["$or","tenantId"]`, `CAPTURED tenantId: "tenantA"`.
  So the fake's semantics DO match real Mongo on tenant merging — the answer to the dispatch's
  "does `scopedCollection` actually merge `tenantId` into the captured filter?" is **yes**.
  See §5 / ISS-078 for what the test then does with that fact.

**One correction to the code comment, not to the code (ISS-082, low).** `search-store.ts:56-57` states
the per-call resolution exists "because production builds these deps at boot, before `connect()`."
That is inverted for the only entrypoint that exists: `apps/api/src/index.ts:20-21` **awaits
`connect(...)` first**, then calls `buildProductionDeps()` at line 21, and `production.ts:64` is its
sole caller (`grep` over `apps/`, `scripts/`, `workers/` finds no other). A construction-time default
would in fact work today. The **decision is still right** — per-call resolution matches the shape
`indexSession` gained for ISS-056 and survives a future entrypoint reordering — only the stated reason
is factually wrong. This repo has an exact precedent for filing that (ISS-075: a docstring claiming a
guard was load-bearing for a reason that was not true), so it is filed the same way.

**Item 2 — the asserted filter is the object passed to `find()`, and `derivedQueries()` generates.
CONFIRMED.**

- `search-store.test.ts:36-43` — `capturingDb()` pushes the **`find()` argument itself** into `filters`;
  the assertion at line 82 runs `prefilterMatches(filter, turn.text)` where `filter` comes from
  `filters[0]`. Nothing re-derives an expectation from `buildTurnPrefilter` — the expected set is the
  independently-computed `lexicalSearchTurns(q, CORPUS, CORPUS.length)` output. This is genuinely an
  object-level assertion, not a restatement of the builder.
- `derivedQueries()` (lines 57-62) enumerates the corpus's own vocabulary (`split(/\W+/)` over all five
  fixture texts) into singles + adjacent pairs. I confirmed the guard rails fire on the real run:
  `queries.length > 40` (44 generated) and the numeric-token assertion at line 67 both pass, and the
  corpus genuinely contributes `2026`, `2` and `5` — **the exact token class ISS-077 was lost on.**
  The generator-weakening guard is real: it is an assertion, not a comment.

## 3. Item 3 — all three bypasses replayed, plus the central contrast

Every mutation was applied to disk, **confirmed changed by `diff` against a byte-backup**, run, and
restored to a SHA256-identical file.

| # | Mutation (verbatim) | `search-prefilter-single-source.test.ts` | Full `@lkb/api` suite |
|---|---|---|---|
| **4A** | `prefilter.$or = prefilter.$or.slice(0, 1);` inserted after the `null` guard | green (unaffected) | **101/102 — only** "the filter sent to Mongo is a superset … DERIVED from the corpus" red |
| **4B** | new `search-prefilter-wrapper.ts` exporting `narrow()`; store calls `narrow(buildTurnPrefilter(query))` | **3/3 PASS — blind to it** | **101/102 — only the object-level test red** |
| **4C** | `lexicalQueryTokens(query).filter((t) => !/^\d+$/.test(t))` in `search-prefilter.ts` | green (unaffected) | **101/102 — only the object-level test red** |

**The unit's core claim is reproduced.** 4B was run twice: once with the source pin in isolation
(`node --test --import tsx apps/api/src/search-prefilter-single-source.test.ts` → `tests 3 / pass 3 /
fail 0`) and once against the full suite (101/102, the object test red). The source pin passes cleanly
on a filter that has been narrowed to one clause; the object-level test catches it. That is exactly
the structural difference the manifest asserts, demonstrated rather than argued.

Worth recording: on 4C, `search-prefilter.test.ts` also stayed green — so the *new* file is the only
thing catching a numeric-token-dropping builder defect. That independently re-confirms ISS-077's
finding and confirms this unit closes it.

Restores verified: 4A/4B → `search-store.ts` back to `92370fda…` and `search-prefilter-wrapper.ts`
deleted; 4C → `search-prefilter.ts` back to its baseline hash. `pnpm --filter @lkb/api test`
**102/102** re-confirmed after all restores; `git status` carries no mutation residue.

## 4. Item 5 — live parity, reproduced by me, on the REAL `getDb()` path

Throwaway script at `apps/api/src/_temp-check.mjs`, run with `npx tsx`, **deleted immediately** (the
post-run `git status` above is the evidence). Read-only: `find` / `findOne` / `countDocuments` only,
no write of any kind. Tenant `toc`, **2118 turns**, `MONGODB_URL` read from `.env`, db `lkb`.

The comparison is `createMongoSearchDeps()` **constructed with no argument** — so `deps.db` is
`undefined` and the real `getDb()` branch executes — against a full `find({tenantId})` scan scored by
the same `lexicalSearchTurns`. This is the direct proof that the new default parameter did not change
production behaviour.

```
IDENTICAL  prefiltered=50 fullscan=50  q="visa student university funding"
IDENTICAL  prefiltered=50 fullscan=50  q="AI in counselling"
IDENTICAL  prefiltered=50 fullscan=50  q="is it ok to go"
IDENTICAL  prefiltered=34 fullscan=34  q="2026 intake"
IDENTICAL  prefiltered=31 fullscan=31  q="scholarship"
IDENTICAL  prefiltered=40 fullscan=40  q="ai"                         <- single short token
IDENTICAL  prefiltered=0  fullscan=0   q="zzzqqqxxnonsensetokenvalue" <- zero-hit
IDENTICAL  prefiltered=50 fullscan=50  q="loan interest rates 2.5"    <- decimal token
RESULT PARITY ACROSS ALL QUERIES: YES
```

Parity is on **turnIds AND scores** (each hit compared as `turnId:score.toFixed(6)`, order-sensitive),
not merely on hit counts. The dispatch's two required additions — a short-token query and a zero-hit
query — are both present and both identical. `"2026 intake"` returns 34 hits here (the previous cycle
measured 20 with `k` capped differently); the point that matters is that the prefiltered and full-scan
paths agree exactly.

## 5. THE PRIMARY ASK — the fifth-bypass hunt. **I found one inside the claimed class, and four more outside it.**

Six original mutations, all **executed** (not reasoned about), each diff-confirmed and restored.

| # | Mutation | Caught? | Full suite |
|---|---|---|---|
| **5A** | **`scopedCollection` removed from the turns handle** — `const turnsColl = (_tid: string) => db.collection<Turns>("turns");` | **NO** | **102/102 green**, `pnpm -r typecheck` **exit 0**, `pnpm lint:structure` **clean** |
| **5B** | `k` ignored — `lexicalSearchTurns(query, …, turns.length)` | **NO** | 102/102 green |
| **5C** | every hit gets the wrong session — `session: sessions[0] ?? null` | **NO** | 102/102 green |
| **5D** | every hit gets the wrong turn — `turn: turns[0] ?? null` | **NO** | 102/102 green |
| **5E** | duplicate results — `[...scored, ...scored].map(…)` | **YES** | 101/102, "results still resolve … end to end" red |
| **5F** | session dedup removed — `const sessionIds = scored.map((s) => s.sessionId);` | **NO** | 102/102 green |

**5A is the fifth bypass, and it is the one that matters.** The maker's claim is: *"Closes: any bypass
that corrupts the filter object reaching Mongo, regardless of where the corruption happens."* The
`tenantId` key **is part of the filter object reaching Mongo** — I proved that in §2 by printing the
captured object's keys. Dropping it is a corruption of that exact object, in that exact place, and it
is invisible: 102/102, typecheck exit 0, depcruise clean. Live consequence: `/search` would score and
return **every tenant's** turns to any authenticated caller — a cross-tenant read disclosure of
verbatim transcript text. `packages/db/src/lib/tenantScope.test.ts:2-4` calls the tenant boundary
"the one invariant in this codebase whose failure is unrecoverable."

What makes this a *fair* finding rather than a stretch: the unit **built the instrument that would
catch it and then did not point it at this**. The capturing handle already records the whole filter;
`asPrefilter()` (test line 49-51) deliberately narrows to `captured.$or` and discards the rest. Two
lines — `assert.equal(filters[0].tenantId, "toc")` on the turns filter, and the same on the sessions
`findOne` — close it. The repo already has the precedent: `apps/api/src/indexing.test.ts:141`
`assertAllCallsConfined(calls, tenantId)` does exactly this for `indexSession`, the very function this
unit says it copied its shape from. The shape was copied; the tenant assertion that came with it was not.

**5B/5C/5D/5F are real too, but the manifest predicted them.** Its checklist item 4 names precisely
this surface ("can you corrupt results while keeping the captured filter a valid superset — e.g. by
corrupting `k`, the scoring call, or the turn/session resolution *after* the fetch?"). Credit where
due: the maker called its own blind spot correctly and I confirmed all four of its guesses are live.
5B additionally makes contract **[I2]**'s `MAX_K` guard inert — the route clamps to 50 and the store
then ignores it entirely, returning the whole prefiltered set. 5C/5D are answer-corruption: hits carry
the wrong transcript and the wrong session, which is worse than a missing hit because it is
*plausible*. 5F reintroduces the N+1 session query **[I3]** exists to forbid.

**Why 5C/5D survive is a fake-semantics divergence, and it is worth naming since the dispatch asked.**
`capturingDb()`'s `findOne` returns the same `SESSION` object for *every* `_id` and its `find` returns
the whole `CORPUS` regardless of filter. So id-keyed resolution cannot be falsified by that fake, and
test 3 (`"visa"` → exactly one hit) samples the one case where a broken `Map` lookup and a correct one
agree. A two-hit query spanning two sessions with distinct titles would kill 5C and 5D outright.

**What I tried that did NOT work** (recorded because a failed attack is evidence too): 5E — returning
each hit twice — is caught by test 3's `assert.equal(hits.length, 1)`. And every attempt to corrupt
the `$or` branch itself (4A/4B/4C plus the narrowing wrapper) is now caught. The *token* half of the
filter object is genuinely closed; the *tenant* half is not.

## 6. Item 6 — keep both defences, or delete the source pin? **KEEP BOTH — but the maker's stated reason for keeping it is wrong.**

The manifest justifies the source pin with "it still covers abandoning `createMongoSearchDeps`
entirely, which the object test cannot see." I checked that claim rather than accepting it, and it
holds only in one of its two shapes:

- **A new file replacing `search-store.ts`** — the pin's `readFileSync(\`${HERE}search-store.ts\`)` at
  line 24 throws, and the suite fails loudly. The pin genuinely covers this. The object test would
  keep passing against a now-dead function.
- **`production.ts` quietly re-pointed at a different deps factory while `search-store.ts` stays put** —
  **neither** defence sees it. Both tests keep passing on code nobody calls. The manifest's claim is
  too generous to the pin here; that gap belongs to neither test and is uncovered today.

Independent of that, the pin retains real narrow value: it is the only thing constraining *architecture*
(delegate, don't re-derive) rather than *behaviour on a five-document fixture corpus*. A hand-rolled
inline filter that happens to be a superset over those five documents but diverges on a shape the
corpus cannot sample passes the object test and fails the pin.

**Ruling: keeping both is correct, and the maker reached the right answer.** The pin is cheap, green,
and non-overlapping at the edges. But its role has changed from "the defence" to "a hygiene rail," and
the file's own docstring (lines 10-16) now misdescribes the situation — it says "`createMongoSearchDeps`
calls `turnsColl()` with no injectable handle, so its query cannot be pinned by exercising real
behaviour without a live Mongo." That sentence became false the moment this unit landed. Filed as part
of ISS-081. It is not redundant dead weight; it is correctly-kept defence with a stale rationale.

## 7. Item 7 — the latency stance. **Fair, not dodging — with one condition.**

Five measurements spanning ~9.8%–30% on a metric the maker itself decomposed (transfer 1064ms vs
compute 38ms) is not a property, it is a network sample. My own previous cycle measured 17% against
the maker's 30% and recorded the disagreement rather than averaging it. **Refusing to quote a headline
figure is the honest reading of that data**, and quoting one would be the actual failure — a number in
a contract acquires authority it did not earn. This unit changes one optional parameter and adds a test
file; it moves no perf-relevant code, so declining to produce a sixth measurement is also correct rather
than lazy. I did not measure latency this cycle for the same reason.

Flagging the previous checker's "commit to a floor — never slower on the same query" suggestion as a
follow-on **rather than silently adopting it** is exactly right: a floor needs its own measurement
design (how many runs, interleaved or not, what counts as "the same query", what happens when the
corpus grows) and adopting it as prose in a manifest would create a commitment nobody could verify.

**The condition:** a follow-on that lives only in a manifest is a follow-on that dies. I have filed it
as **ISS-081** so it survives in the ledger, which is the thing the sweep actually reads. With that,
the stance is fair.

## 8. Ledger actions

- **ISS-076 → `fixed`** (`fixed_date: 2026-09-08`). The object-vs-source-text gap is genuinely closed
  for the `$or` dimension: both routes this row records (4A post-call mutation, 4B third-file
  laundering) now redden the new test, replayed by me. Bounded by ISS-078 — the *other* key in that
  same filter object is still unasserted.
- **ISS-077 → `fixed`** (`fixed_date: 2026-09-08`). The query set is now derived from the corpus (44
  queries) with an explicit assertion that numeric tokens appear; 4C, this row's exact mutation, now
  reddens.
- **ISS-073 → left `open`** by design, as instructed and as the manifest states.
- **ISS-078 (high)** — tenant scoping is unasserted by the very test that captures the filter.
- **ISS-079 (medium)** — `k` is unasserted; [I2]'s `MAX_K` guard can be made inert silently.
- **ISS-080 (medium)** — post-fetch resolution (turn/session mapping, session dedup) is unasserted,
  and the fake's id-blind `findOne` is why.
- **ISS-081 (low)** — two carried-forward items: the latency-floor follow-on, and the now-stale
  docstring in `search-prefilter-single-source.test.ts`.
- **ISS-082 (low)** — `search-store.ts:56-57`'s stated reason for per-call `db` resolution is inverted
  relative to `index.ts:20-21`.

## 9. Contract amendment

`qa/contracts/search-route.md` amended (routine, auto-gate — a **tightening**, nothing softened):
[I6] gains a clause recording that its two structural gaps are now closed and by what, and a new
**[I7]** records the tenant-scoping invariant that 5A proved is unguarded. No criterion was weakened
and no failing artifact caused a rule to move.

## 10. Notes on scope

- `.goal/goal.json` and `qa/evidence/live-2026-09-07-01-58-41/preflight.json` were **not touched**, as
  instructed. The manifest records "Goal task: none (ledger-driven)", so no `/goal` close applies and
  no dashboard refresh was run — both would have written into `.goal/`.
- `qa/.last-tick` was already modified before this check began; left as found.
- Production Mongo access was read-only throughout (`find` / `findOne` / `countDocuments`). No write of
  any kind was issued.
