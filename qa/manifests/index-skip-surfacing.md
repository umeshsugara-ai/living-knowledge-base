# Manifest — index-skip-surfacing
**Contract:** qa/contracts/ingest-indexing-pipeline.md
**Goal task:** U1.0b (the second half of `qa/QUEUE.md` row 1)
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** ISS-116 (second defect — the concealment half)

## Why this unit exists

The sweep's queue row 1 named **two** defects in one unit, "because they are cause and
concealment". The `chunk-backfill` unit fixed the cause (Gemini's unbatched >100 call). This fixes
the concealment, which was still live at HEAD:

> `apps/api/src/indexing.ts` **discards** `writeSessionChunks`'s `{written, skipped}`, so
> `indexSession` reports success and no job row, session field or ledger records the loss.

That is precisely how three whole sessions — 790 of 2118 turns, **37% of the corpus** — stayed out
of the vector index while `status.index` said `"done"` for all 26. The only trace was a
`console.warn` nobody reads. A backfill script that happened to report per-session counts is not a
fix for that; the *pipeline* has to surface it.

## What changed

- `apps/api/src/indexing.ts` — `indexSession` now returns `IndexSessionResult`
  (`{sessionId, chunks: {written, skipped}}`) instead of `Promise<void>`, and no longer throws the
  chunk result away. Added `ChunkSkipReason`, which gains a third case: **`"no-embedder"`**, so an
  install with no embedding provider configured is distinguishable from one where embedding
  *failed*. Those need different human responses and previously looked identical (both: silence).
  **Returned, not thrown** — the degradation is deliberately non-fatal (an embedding outage must
  not cost the summary, claims and tree), so the caller needs a value to inspect, not an exception.
- `apps/api/src/indexing.ts` — `BoundIndexer` widened from `Promise<void>` to
  `Promise<IndexSessionResult>`, so the result survives the composition-root boundary rather than
  being erased by the type the ingest paths are wired through.
- `apps/api/src/ingest-store.ts` + `apps/api/src/whatsapp-store.ts` — both live ingest paths now
  inspect the result and warn explicitly that the session **"will not be reachable by vector
  search"**. This is the operator-facing surface; a return value alone would only help tests.
- `apps/api/src/indexing.test.ts` — 3 new tests asserting the result is surfaced for each of the
  three outcomes (failed / no-embedder / real write).

## How to verify (commands + expected)

- `pnpm --filter @lkb/api typecheck` → exit 0
- `pnpm --filter @lkb/api test` → exit 0, 124 pass (121 + 3 new)
- `pnpm -r typecheck` and `pnpm -r test` → exit 0
- structure gates individually by exit code (ISS-100 — the `&&` chain short-circuits)
- mutation: force `skipped` to `null` in the returned object → the 3 new tests must fail

## Actual outputs (from maker's own run)

```
pnpm --filter @lkb/api typecheck   exit=0
pnpm --filter @lkb/api test        ℹ tests 124  ℹ pass 124  ℹ fail 0
```

Mutation proof is recorded in the commit that follows this manifest (the file must be committed
before `scripts/lib/mutate.mjs` will arm it — it refuses to mutate anything not byte-identical to
HEAD, which is the guard added after a mutation was once found still applied to production source).

## Disclosed — the checker should press on these

1. **`BoundIndexer` is a widened public type.** Every consumer compiles, but a checker should
   confirm no caller silently depended on `Promise<void>` (e.g. in a union or a callback position).
2. **A `console.warn` is a weak surface and I am not claiming otherwise.** The sweep asked for the
   loss to be recorded "where an operator or a test can read it". The *test* half is now solid; the
   *operator* half is still only a log line. The genuinely durable options — a `jobs` ledger row, or
   a `gaps` row (that collection exists for exactly this), or a `sessions.status.vector` field —
   each need a schema change or a design decision, and I judged that out of scope for the
   concealment fix rather than smuggling a schema change into it. **If the checker disagrees, this
   is the right thing to FAIL me on**, and `gaps` is the option I would build next.
3. **This does not re-verify the corpus.** `chunk-backfill` already established 26/26 sessions on
   real rows; nothing here changes stored data, so I did not re-run the live probe and this unit
   should not be credited with it.
4. **`tracker-audit --gate g1` is still red at HEAD** (ISS-117, other lane's `U2.4` row), so
   `pnpm lint:structure` fails as a whole. Every other gate passes individually by exit code.

## Status: ready-for-check
