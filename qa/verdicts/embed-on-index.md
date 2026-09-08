# Verdict — embed-on-index

**Date:** 2026-09-08
**Cycle checked:** 1
**Contract:** `qa/contracts/ingest-indexing-pipeline.md` + `qa/contracts/schema-v2.md` **C8**
**Manifest:** `qa/manifests/embed-on-index.md` (`Fix cycle: 1`, `Status: ready-for-check`)
**Bound to:** `D:/KnowledgeBase`
**Code under check:** `11a90b0 feat(api): embed chunks on index, degrade-safe (U1.3)` (working tree
clean for `apps/api/` at check time and again after every probe/mutation below).

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met on this unit's scope (ingest-indexing-pipeline C1–C7 no-regression +
  schema-v2 C8 WRITE-side), 4/4 invariants hold (degrade-safety · delete-only-with-replacement ·
  tenant scoping · optional dep). schema-v2 C8 ROW-side (a)(b)(c) = UNVERIFIED, stays OPEN.
FAILURES: none
ISSUES-WRITTEN: ISS-112 (medium), ISS-113 (medium, tracking)
EXPLANATION: The degrade-safe guard is real and I could not break it — across nine independent
attack shapes (throw, reject, undefined, malformed, wrong count either direction, dims matching
nothing, an empty vector among good ones, ragged vectors) the `chunks` collection saw ZERO
operations every single time, with claims written in all nine. The tenant filter on the chunk
deleteMany is genuine and pinned: mutating it to the raw handle reddens exactly one test. C8's
write-time correlation assertion fires on every inconsistent pair I could construct. What I am NOT
passing: C8's row-level half — Mongo is still down for me too (independently confirmed with the
real driver, not a ping), so "chunks non-empty for all 26 sessions" and "vector.length === dims for
100% of rows" remain UNVERIFIED and C8 stays OPEN against a live run (ISS-113). One real defect
found, not blocking: the C8 assertion throws OUTSIDE the try/catch, so a malformed embedder result
skips chunks correctly but also skips tree_index and the status.index flip (ISS-112).
```

## What I re-ran myself (exit codes, not greps)

Per the manifest's own step 1, every gate was captured as `cmd >log 2>&1; echo $?` — no grepping
of output, no `&&` chain that could short-circuit.

| gate | my exit code | corroboration |
|---|---|---|
| `pnpm -r typecheck` | **0** | all packages `Done` |
| `pnpm -r test` | **0** | `apps/api` **117** tests (manifest claims 117 — matches); `packages/index` 165 |
| `pnpm lint:structure` | **0** | depcruise **did** run: `no dependency violations found (275 modules, 838 dependencies cruised)`; `tracker-audit: OK (gate G1)` |
| `python schema/validate.py` | **0** | `PASS: 24 collection schema(s) validated correctly.` |

The manifest's four gate claims reproduce exactly, including the 275-module / 838-dep depcruise
figures — this is the check the maker asked me to be strict about, and it holds.

## Attack 1 — the degrade-safe guard (the whole unit)

Checker-authored probe (`apps/api/src/_chk_u13_probe.test.ts`, temporary, **deleted**; tree
verified clean afterwards). It imports the **real** `indexSession`, not a replica, with its own fake
db recording every collection op, and a 12-turn fixture so the chunker genuinely emits **12 chunks**
(the maker's own disclosed test bug was a 1-chunk fixture that made two conditions unreachable — I
did not want to inherit it). `rest()` records whether claims / tree_index / sessions.updateOne ran.

| probe | embed behaviour | chunk ops | claims | tree | status flip | threw out of `indexSession` |
|---|---|---|---|---|---|---|
| P1 | throws synchronously | **[]** | yes | yes | yes | no |
| P2 | returns a rejected promise | **[]** | yes | yes | yes | no |
| P3 | resolves `undefined` | **[]** | yes | yes | yes | no |
| P4 | resolves `{dims:3}` — no `vectors` key | **[]** | yes | **no** | **no** | `TypeError: Cannot read properties of undefined (reading 'length')` |
| P5 | 2 vectors for 1 chunk | **[]** | yes | **no** | **no** | `embedder returned 2 vector(s) for 1 chunk(s)` |
| P6 | 1 vector for 12 chunks | **[]** | yes | **no** | **no** | `embedder returned 1 vector(s) for 12 chunk(s)` |
| P7 | `dims: 99`, every vector length 2 | **[]** | yes | **no** | **no** | `chunk 0 has 2 dims, batch reports 99` |
| P8 | an EMPTY vector at index 1, rest fine | **[]** | yes | **no** | **no** | `chunk 1 has 0 dims, batch reports 3` |
| P9 | ragged (5-long at index 1, dims 3) | **[]** | yes | **no** | **no** | `chunk 1 has 5 dims, batch reports 3` |

**The claim under check holds without exception: `chunkOps === []` in all nine.** Not one attack
reached `deleteMany`. The ISS-056 shape — delete runs, insert does not — is genuinely impossible
here, because the delete is inside the `if (embedded)` block and every refusal is raised before it.
That is the correct structure, and it is the reason I could not break it: the guard is positional,
not a check someone has to remember to write.

The "hang" case is not in the table because it is a non-event for the collection: an `embed` that
never settles simply never reaches the chunk block, so chunk ops stay `[]` — but `indexSession`
never returns either. There is no timeout on the `embed` call. I am NOT filing that: `complete()`
one screen above has the same shape, this is a background indexing path called from a
fire-and-forget site that already swallows rejections, and a timeout policy belongs at the transport
layer for every job kind at once rather than being bolted onto one call. Noted here so the next unit
that touches transport timeouts knows this call site exists.

### The one real defect: the C8 assertion is outside the try/catch (ISS-112, medium)

Rows P4–P9 above. `apps/api/src/indexing.ts:156-163` catches only the `deps.embed(...)` call. The
count assertion (`:169`) and the per-chunk dims assertion (`:176`) sit **after** the catch, so they
propagate out of `indexSession` — past `tree_index` (`:199-216`) and past
`sessions.updateOne({"status.index": "done"})` (`:218`), neither of which runs. The caller
(`ingest-store.ts` / `whatsapp-store.ts`, contract C4) logs and swallows, so nothing surfaces: the
session is left **permanently `status.index: "pending"`** and absent from the Brain tree, with
nothing in the system that ever retries it.

This is precisely the trade the code comment at `:157-158` and the manifest both say they refuse —
*"failing the whole call would turn 'no vectors this run' into 'no summary, no claims, no tree'"* —
and for a malformed batch that is exactly what happens. Two of the eight new tests assert the
refusals via `assert.rejects`, which pins the throw but reads the collateral as acceptable.

**Why medium and not high, stated honestly:** I chased reachability rather than filing on the shape
alone. Both configured providers already validate before returning — `packages/ai/src/providers/
gemini.ts:117-139` and `ollama.ts:98-118` each refuse a wrong count, an all-empty set, and a ragged
set, throwing **inside** `deps.embed`, where the catch does handle them (that is P1/P2, which pass
cleanly). So with `config/ai-routing.yaml`'s current `embedding: [gemini, ollama]` this path is not
live-reachable today; it is defence-in-depth whose failure mode is worse than the thing it defends
against. It becomes reachable the moment a third provider is added, or a router path returns a
result the providers did not construct. Fix direction is one line of scope: move the two assertions
inside the same `try`, or wrap the doc-building block, so a refusal degrades to "chunks skipped"
like every other embed failure instead of aborting the function.

## Attack 2 — the C8 write-time assertion

Covered by P5–P9. Every inconsistent `vector`/`dims` pair I could construct was refused **before**
`insertMany`: wrong count in both directions, a `dims` matching no vector at all, a zero-length
vector hidden among good ones, and genuinely ragged vectors where the first one matches `dims` (P9
— the nastiest shape, since a `vectors[0]`-derived check would pass it; the per-chunk loop catches
it at index 1). P11 inspected all 12 docs that reach a *successful* `insertMany`: `vector.length ===
dims` on every one, plus no `text` (ADR-0001) and no `embeddingRef`. **Nothing inconsistent reached
`insertMany` in any probe.** The U1.2 verdict's finding — that `{vector: [3], dims: 99}` validates
against JSON Schema — is genuinely closed on the write side.

## Attack 3 — tenant scoping on the chunk deleteMany

Observed filter: `{"sourceRef":"s1","tenantId":"t"}`; every inserted doc carries `tenantId: "t"`.

Not taken on trust — mutated. Replacing `chunksColl(tenantId).deleteMany(...)` with a raw
`db.collection("chunks").deleteMany(...)` (`indexing.ts:193`) and re-running `apps/api`'s suite:
**16 pass / 1 fail**, the failure being exactly *"every chunk write is tenant-scoped — the same
guard the claims path needed"*. File restored via `git checkout --`; `git status` clean. The guard
is real and it is pinned.

One observation, not a finding: the general *"EVERY query AND every write indexSession issues is
confined to its own tenant (ISS-060, ISS-061)"* test survived that mutation, because it calls
`indexSession` **without** `embed`, so no chunk op exists for it to inspect. The dedicated chunk
test covers the gap, so coverage is complete — but the test whose name promises "EVERY write" does
not see this collection. If a future unit adds another optional-dep-gated write, that test will read
as protecting it while not executing it.

## Attack 4 — C8's row-level half: UNVERIFIED, and C8 stays OPEN

I did not take the maker's word for the outage, and I did not use a `ping` (a host can drop ICMP
and still serve Mongo). Real driver, real connection attempt, from `apps/api`:

```
$ node _chk_mp.mjs            # MongoClient("mongodb://13.202.206.101:27017", serverSelectionTimeoutMS: 8000)
MONGO DOWN: Server selection timed out after 8000 ms
```

(`.env` confirms `MONGODB_URL=mongodb://13.202.206.101:27017`; `ping` separately 100% loss. Probe
file deleted.)

**Ruling — C8 stays OPEN.** Its write-side half `(b)`-as-asserted is discharged by this unit and
recorded above. Its row-level halves are not, and cannot be by any amount of fake-db evidence:

- **(a) `chunks` non-empty for all 26 sessions** — UNVERIFIED. Requires a live re-index.
- **(b) `vector.length === dims` for 100% of real rows** — UNVERIFIED as *rows*. The write path now
  makes a violating row unwritable, which is a strong prior but is not the measurement C8 asks for;
  pre-existing rows (if any) are unaffected by a new write guard.
- **(c) every `turnRefs` id resolves to an existing `turns` row** — UNVERIFIED, and note this one is
  not even asserted at write time. `turnRefs` comes from `buildChunks(turns)` where `turns` was just
  read from the tenant-scoped collection, so it is structurally sound, but no probe of mine could
  observe it against real rows.

This is tracked as **ISS-113** so it survives the manifest being closed out, which is the whole
reason the U1.2 checker moved these clauses out of prose and onto disk in the first place. I am
explicitly **not** converting a timeout into a verdict in either direction: not failing the maker
for an outage it does not control, and not blessing three row-level assertions nobody has run.

The maker flagged this itself, prominently, under a heading saying it is the important half. That is
the behaviour to keep.

## Attack 5 — the optional dep and the production wiring

- `apps/api/src/production.ts:60-62`: `embed: chains.embedding ? (job) => routeEmbed(...) : undefined`.
  Conditional on the parsed routing config, not on an env var read at call time — an install with no
  `embedding` chain passes `undefined`, never a broken embedder.
- Absent dep ⇒ chunks skipped with no error: reproduced (P3 and the maker's own test) — `chunkOps`
  `[]`, `session_pages`/`claims`/`tree_index`/status flip all still run.
- `config/ai-routing.yaml:16` currently declares `embedding: [gemini, ollama]`, so this deployment
  *is* wired — which is what makes ISS-112's path worth recording rather than dismissing.

## Issues addressed

Manifest claims `none` (roadmap work). Correct — no open ledger row was in scope, and none is
closed by this unit.

## Ledger

- **ISS-112** (medium, `ingest-indexing-pipeline`) — the C8 assertions throw outside the try/catch;
  a malformed embed result skips `tree_index` and the `status.index` flip, leaving the session
  permanently `pending`. Not live-reachable with today's two providers.
- **ISS-113** (medium, `schema-v2`, tracking) — C8 (a)(b)(c) row-level checks UNVERIFIED; C8 stays
  OPEN pending a live run against a reachable Mongo.

Note on ids: this repo has already had two ISS-id collisions from concurrent lanes today
(ISS-109/110/111 carry `id_collision` recovery notes). 112/113 were allocated from a ledger of 111
lines at check time; if a concurrent lane took them, these two rows renumber and this verdict's
citations stand as the source.

---

# Verdict — embed-on-index (fix cycle 2)

**Date:** 2026-09-08
**Cycle checked:** 2
**Contract:** `qa/contracts/ingest-indexing-pipeline.md` + `qa/contracts/schema-v2.md` **C8**
**Manifest:** `qa/manifests/embed-on-index.md` (`Fix cycle: 2`, `Status: ready-for-check`)
**Bound to:** `D:/KnowledgeBase`
**Code under check:** `a684736 fix(api): move the C8 assertions inside the embed try (ISS-112)`
(working tree clean for `apps/api/` before, and again after every probe and mutation below).

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met on this unit's scope (ingest-indexing-pipeline C1–C7 no-regression +
  schema-v2 C8 WRITE-side), 5/5 invariants hold (degrade-safety · delete-only-with-replacement ·
  tenant scoping · optional dep · NEW: a refusal degrades to "chunks skipped", never to a skipped
  tree/status). schema-v2 C8 ROW-side (a)(b)(c) = UNVERIFIED, stays OPEN (ISS-113).
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: ISS-112 is genuinely closed, re-derived rather than read. Across all nine attack
shapes the `chunks` collection saw ZERO operations AND `tree_index.replaceOne` ran AND
`sessions.updateOne({"status.index":"done"})` ran — the six shapes that skipped the last two in
cycle 1 now complete them. The two rewritten tests are a real regression guard, not documentation:
with the defect reintroduced under `mutate.mjs`, both FAIL, and they are the only two that do.
Folding the fix into this unit rather than opening a new one was the right call and skipped no
ceremony — a new numbered cycle, a fresh checker, no new scope. C8's row-level half remains
UNVERIFIED: Mongo is still down for me too, independently confirmed with the real driver, so
ISS-113 and C8 both stay OPEN.
```

## Gate re-run — by exit code, captured individually (no `&&` chain that could short-circuit)

| gate | my exit code | corroboration |
|---|---|---|
| `pnpm -r typecheck` | **0** | all packages `Done` |
| `pnpm -r test` | **0** | every package `Done`; `apps/api` includes the two rewritten ISS-112 tests |
| `pnpm lint:structure` | **0** | depcruise **did** run: `no dependency violations found (275 modules, 838 dependencies cruised)`; `tracker-audit: OK (gate G1)`; `SNAPSHOT.md matches a fresh regeneration` |
| `python schema/validate.py` | **0** | `PASS: 24 collection schema(s) validated correctly.` |

Unlike cycle 1, G1 (`tracker-audit`) was already green — no `TASKS.md` clean-up was needed this
cycle, so the feedback-inbox pattern the maker logged did not recur here.

## Press 1 — the nine attack shapes, re-run against the fixed code

Checker-authored probe (`apps/api/src/_chk2_probe.test.ts`, temporary, **deleted**; `git status`
clean afterwards). Real `indexSession`, my own fake db recording every collection op, 12-turn
fixture.

**A correction to my own cycle-1 record, disclosed.** I reported that the 12-turn fixture yields
"12 chunks". It does not — `buildChunks` packs those turns into **3** chunks. My cycle-2 probe
asserted `docs.length === 12`, failed on my own bad assertion rather than on the code, and I
relaxed it to `> 1` (which is what actually matters: index-1 shapes must be reachable). The
cycle-1 conclusions are unaffected — 3 chunks still make every P5–P9 condition reachable, including
the ragged-at-index-1 shapes — but the "12 chunks" figure in the cycle-1 verdict and in ISS-112's
evidence is wrong and should be read as 3. I would rather correct my own number than leave a
checker's figure standing unexamined.

| probe | embed behaviour | chunk ops | claims | **tree_index** | **status flip** |
|---|---|---|---|---|---|
| P1 | throws synchronously | **[]** | yes | **yes** | **yes** |
| P2 | returns a rejected promise | **[]** | yes | **yes** | **yes** |
| P3 | resolves `undefined` | **[]** | yes | **yes** | **yes** |
| P4 | `{dims:3}`, no `vectors` key | **[]** | yes | **yes** | **yes** |
| P5 | 2 vectors for 3 chunks | **[]** | yes | **yes** | **yes** |
| P6 | 1 vector for 3 chunks | **[]** | yes | **yes** | **yes** |
| P7 | `dims: 99`, every vector length 2 | **[]** | yes | **yes** | **yes** |
| P8 | an EMPTY vector at index 1 | **[]** | yes | **yes** | **yes** |
| P9 | ragged (5-long at index 1, dims 3) | **[]** | yes | **yes** | **yes** |
| P10 | happy path | `["deleteMany","insertMany"]` | yes | yes | yes |
| P11 | no `embed` dep at all | **[]** | yes | yes | yes |

`11 tests, 11 pass, 0 fail`. **The cycle-1 defect is gone in all six shapes that had it (P4–P9),
and nothing that previously held has regressed.** No probe reached `deleteMany` on `chunks` except
the happy path, where the two ops are in the right order.

P10 additionally re-confirms the write-side C8 guarantee on the rows that DO land: `vector.length
=== dims` on every doc, `tenantId: "t"` on every doc, the `deleteMany` filter carrying
`tenantId: "t"` (the security-class check this project has already paid for), `turnRefs` non-empty,
and **no `text`** (ADR-0001) and **no `embeddingRef`**.

The manifest's press 2 — "the assertions are inside the `try` and the `catch` genuinely catches
them" — is not taken from reading the file; it is what rows P4–P9 above measure. The `catch` now
names ISS-112 explicitly, so the comment and the line numbering finally agree.

## Press 2 — are the rewritten tests a regression guard, or documentation?

**They are a real guard.** Verified by reintroducing the defect, not by reading the assertions.

```
$ node scripts/lib/mutate.mjs apply apps/api/src/indexing.ts
MUTATION ARMED: apps/api/src/indexing.ts (restore with: mutate.mjs restore)
```

The mutation states the ISS-112 shape minimally: the `catch` re-narrowed with
`if (err instanceof Error && err.message.startsWith("indexSession:")) throw err;` — provider
failures stay caught (as they always were), the **C8 assertions escape**, which is exactly what
"the assertions sit outside the try" produced.

```
$ node --test --import tsx "src/indexing.test.ts"
ℹ tests 17   ℹ pass 15   ℹ fail 2
✖ REFUSES to write a vector whose length contradicts dims, and still finishes indexing (ISS-112)
✖ REFUSES a batch with the wrong NUMBER of vectors, rather than pairing by index (ISS-112)
```

**Both rewritten tests redden, and they are the only two in the file that do.** My own probe
reddened on 5 of 11 in the same state (P5–P9; P4's `TypeError` carries no `indexSession:` prefix,
so my mutation correctly left it caught).

This is the point I most want on record, because it is the one the maker got right and the cycle-1
code got wrong: `assert.rejects` pinned the *throw*, which was the defective behaviour. A test that
pins a defect protects the defect. Asserting the guarantee instead — zero chunk ops **and**
`tree_index` **and** the status flip — is a test that can actually fail when the guarantee breaks,
and it now demonstrably does.

```
$ node scripts/lib/mutate.mjs restore apps/api/src/indexing.ts
RESTORED: apps/api/src/indexing.ts (verified identical to HEAD)
$ node scripts/lib/mutate.mjs assert-clean
MUTATIONS CLEAN: none outstanding
```

## Press 3 — ruling on folding the fix into this unit rather than opening a new one

**Ruled: folding was correct. This is not a PASSed unit being reopened to dodge ceremony.**

The severity gate says a medium is verified inside *the next unit touching the same file*. The
maker's reading is the literal one: this **is** a unit touching that file, and nothing else was
scheduled to touch `indexing.ts`. Deferring would have parked the medium against a unit that does
not exist, which is how a medium becomes permanent.

What actually matters is whether any ceremony was skipped, and none was:

- **The maker did not certify its own fix.** The manifest returned to `ready-for-check` at
  `Fix cycle: 2` and a fresh checker re-derived it. The PASS monopoly is intact — that is the thing
  the gate exists to protect, and it held.
- **The verdict carries a matching cycle number.** The handshake is files, and both halves moved. A
  sweep reading disk sees `Fix cycle: 2` answered by `Cycle checked: 2`, not a stale PASS.
- **The audit trail is additive, not rewritten.** Cycle 1's verdict is byte-intact above this
  section; the manifest appended a cycle-2 section rather than editing its cycle-1 claims.
- **The evidence bar rose rather than dropped.** Cycle 1 PASSed with two `assert.rejects` tests that
  pinned the wrong behaviour. Cycle 2 PASSes with those tests proven to fail under a mutation.

The one real cost is that `checked-PASS` briefly meant something later amended — but that cost is
paid by the *defect*, not by the fold, and the alternative (a stated-and-false guarantee sitting in
`indexing.ts` awaiting a unit nobody has scheduled) is strictly worse. The maker's stated reason is
the right one: reachability is why this is a medium, but a comment that contradicts its own line
numbering is a hazard to the next reader regardless of reachability.

**Where I would draw the line for next time,** so this does not become a general licence: folding
is right when the fix is the *same file and the same guarantee*, the manifest opens a *new numbered
cycle*, and a *fresh checker* re-derives it — all three hold here. It would be wrong if used to
slip **new scope** into an already-PASSed unit, since that lets work reach `checked-PASS` on a
verdict that never saw it. Nothing new entered this unit's scope in cycle 2: the diff is the
assertion block's scope and two test bodies.

## Press 4 — ISS-113 / C8 row-level: still UNVERIFIED, C8 stays OPEN

I did not take the manifest's word, and I did not use a `ping`. Real driver, from `apps/api`,
`MongoClient(serverSelectionTimeoutMS: 8000)`, against the URL read from the repo's own `.env`:

```
URL: mongodb://13.202.206.101:27017
MONGO DOWN: Server selection timed out after 8000 ms
```

The probe was written to run the real C8 measurement had it connected — `sessions`/`chunks` counts,
plus an aggregation counting rows where `vector.length !== dims`. It never got to run. Probe file
deleted; `git status` clean.

**Sixth consecutive tick.** So, unchanged from cycle 1, and explicitly NOT converted into a verdict
in either direction:

- **(a)** `chunks` non-empty for all 26 sessions — **UNVERIFIED**.
- **(b)** `vector.length === dims` for 100% of real rows — **UNVERIFIED as rows.** The write path
  makes a violating row unwritable (re-confirmed across six shapes this cycle), which is a strong
  prior and not the measurement C8 asks for; pre-existing rows are untouched by a new write guard.
- **(c)** every `turnRefs` id resolves to an existing `turns` row — **UNVERIFIED**, and still **not
  asserted at write time at all**. P10 confirms `turnRefs` is present and non-empty on every written
  doc, which is one notch better than nothing, but presence is not resolution.

**ISS-113 stays open. C8 stays OPEN.** It is a deferred measurement, not a defect, and it closes
only on a live run.

## Ledger

- **ISS-112** → **`fixed`** (2026-09-08). Not `verified`: the ledger rule reserves that for a later
  re-check. The evidence on the row is the nine clean shapes plus the mutation proving the guard.
- **ISS-113** → unchanged, **`open`**. Nothing this cycle could move it.
- **ISSUES-WRITTEN: none.** I looked for a third-cycle finding and found nothing I would defend at
  >80% confidence. Two things I considered and am deliberately NOT filing, recorded as questions
  rather than failures: (i) there is still **no timeout on the `embed` call**, so a hang stalls
  `indexSession` — unchanged from cycle 1, and still a transport-layer concern for every job kind at
  once rather than this unit's; (ii) the general *"EVERY query AND every write is tenant-confined"*
  test still runs without `embed`, so its name over-promises — cycle 1 recorded this, coverage is
  complete via the dedicated chunk test, and renaming a test is not worth a fix cycle.

## Goal

`U1.3` was already closed by the cycle-1 PASS. This cycle does not reopen it, and no goal state
changed.
