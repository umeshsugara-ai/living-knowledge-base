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
