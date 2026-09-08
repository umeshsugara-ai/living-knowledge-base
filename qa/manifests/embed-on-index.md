# Manifest — embed-on-index

**Contract:** qa/contracts/ingest-indexing-pipeline.md (+ `schema-v2.md` **C8**, which the U1.2
verdict bound to this unit)
**Goal task:** **U1.3** (plan §10 Phase 1)
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — roadmap work. Closes contract **C8**'s write-side half.

## The design point, and it was already paid for once

`indexSession` writes claims with a **conditional delete**, because ISS-056 taught this codebase
that an unconditional `deleteMany` plus a conditional `insertMany` destroys real data the moment a
provider blips: a failed call returned an empty array indistinguishable from *"this transcript has
no claims"*, so a transient outage deleted every previously-extracted claim and wrote nothing back.

**Chunks carry the same shape with more force.** A vector index is expensive to rebuild and its
absence is **invisible** — a search does not error, it just quietly returns less. So the chunk
delete only ever runs with a replacement already in hand, and an embedding failure is caught,
logged, and left alone.

**It also must not take the rest of indexing down.** Rethrowing would turn *"no vectors this run"*
into *"no summary, no claims, no tree"* — trading a recoverable gap for a total one.

## What changed

1. **`apps/api/src/indexing.ts`** — `embed?: IndexEmbedFn` on `IndexSessionDeps`, **optional**: an
   install with no embedding provider must still summarize, extract claims and build a tree.
   Absent dep ⇒ chunks skipped entirely, every other stage unaffected. Chunks are built with
   `buildChunks`, embedded in one batch, and written delete-then-insert **only on success**.
2. **The write-time correlation assertion C8 needs.** The U1.2 verdict found that `vector` and
   `dims` are *independently optional* in JSON Schema, so `{vector: [3 items], dims: 99}` validates
   cleanly. JSON Schema cannot express the correlation; the write is the only place that sees both.
   Two refusals: wrong vector **count** for the chunk list, and any vector whose length contradicts
   the batch's `dims`.
3. **`apps/api/src/production.ts`** — `embed` wired **only when `chains.embedding` exists**.
   Passing an embedder unconditionally would break indexing on an install without one.
4. **`packages/index/src/index.ts`** — exports `buildChunks`.
5. **`TASKS.md`** — U1.2 flipped to `done`; see below.

## Evidence — by exit code, not by grepping output

| gate | result |
|---|---|
| `pnpm -r typecheck` | **EXIT 0** |
| `pnpm -r test` | **EXIT 0** — `@lkb/api` 109 → **117** (8 new) |
| `pnpm lint:structure` | **EXIT 0**, depcruise ran: **0 violations, 275 modules / 838 deps** |
| `python schema/validate.py` | **EXIT 0** |

The 8 tests are the failure modes, and the first two are the ones that matter:

- **a failed embed writes nothing at all to `chunks`** (the ISS-056 shape, on the collection where
  it would be hardest to notice);
- **a failed embed still leaves claims written and the tree updated** (no total-failure trade);
- no `embed` dep ⇒ chunks untouched, every other stage still runs;
- success ⇒ `deleteMany` **before** `insertMany`, so a re-index never doubles the corpus;
- rows carry a real `vector`, a matching `dims`, `turnRefs` — and assert **no `text`** (ADR-0001)
  and **no `embeddingRef`** (the retired pointer);
- the two C8 refusals; and every chunk write is **tenant-scoped**.

**A test bug I caught and fixed rather than weakening the assertion:** my first two refusal tests
passed a single-turn fixture, which yields one chunk — so neither mismatch could arise and both
"failed" with *"Missing expected rejection"*. The fix was to shape the fixtures so the condition is
actually reachable (2 vectors for 1 chunk; a 2-number vector against `dims: 3`), not to relax the
test.

## What is NOT verified, and it is the important half

**No live row has been written.** Mongo has been unreachable for four consecutive ticks
(`Server selection timed out`), so contract **C8**'s two row-level checks — *"chunks non-empty for
all 26 sessions"* and *"`vector.length === dims` for 100% of rows"* — are **UNVERIFIED**, not
passed. Everything above is fake-db evidence about write *decisions*.

I am flagging this rather than letting the unit read as complete: the U1.2 verdict moved those
checks here specifically so they would stop living in prose, and they cannot be discharged while
the database is down. **C8 should stay open until a live run.**

## Also in this commit, disclosed

`lint:structure` was exiting 1 on G1 — the U1.2 checker closed `goal.json` but not `TASKS.md`,
exactly as the U1.1 checker did an hour earlier. Flipped `TASKS.md` U1.2 to `done`. **Second
occurrence**, so it is logged as a pattern in `qa/feedback-inbox.md`: a gate that fires predictably
on every single PASS is one people learn to clear reflexively rather than read.

## How to verify (checker)

1. **Re-run every gate by exit code.** Two units ago I reported "clean" from a grep while the
   chain had short-circuited; do not repeat my mistake on my behalf.
2. **Attack the degrade-safe guard.** Make `embed` throw, reject, return `undefined`, hang — and
   confirm `chunks` sees **zero** operations in each case, while claims and tree still complete.
   The dangerous direction is a delete that runs anyway.
3. **Attack the C8 assertion.** Vectors of differing lengths, a `dims` that matches none of them,
   more/fewer vectors than chunks. Anything that reaches `insertMany` with an inconsistent
   `vector`/`dims` pair is a real finding — that combination validates against the schema.
4. **Confirm the tenant scoping** on the chunk `deleteMany` — an untenanted delete would reach
   another tenant's rows, which is the security-class failure this project has already paid for.
5. **If Mongo is up for you, run C8 for real** and say so; if not, record UNVERIFIED. Do not
   convert a timeout into a verdict in either direction.
6. Confirm `production.ts` passes `embed` only when a chain is configured, and that an install
   without one still indexes.
7. `ISSUES-WRITTEN: none` is a complete check.

## Risk / rollback

One optional dep, one guarded block, one config-conditional wiring. No existing stage's behaviour
changes when `embed` is absent, which is every current deployment until a chain is configured.
`git revert` is clean.

**Status: ready-for-check**
