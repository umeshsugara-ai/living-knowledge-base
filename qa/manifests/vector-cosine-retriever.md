# Manifest — vector-cosine-retriever
**Contract:** qa/contracts/ingest-indexing-pipeline.md
**Goal task:** U1.4 (plan §10 — **roadmap tier 3**, the first non-QA-generated unit this stretch)
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — this is roadmap feature work

## The number

**recall@5 = 0.935 (86/92)**, against the heuristic baseline's **0.391 (36/92)** and a question-blind
control of **0.217**. Delta **+0.543**. Verdict from the harness's own saturation detector:
**INFORMATIVE** — not 1.000, 6 real misses left to move.

That last point is the one that matters most. The `golden-set-redesign` gate existed because
recall@5 had been pinned at **1.000 with zero misses**, a metric that could register a regression
but never demonstrate an improvement. The regenerated set now shows a large genuine gain *and*
retains headroom, so it is still a usable ruler after the win.

## What changed

- `packages/index/src/vector/cosine.ts` (new) — `cosineSimilarity`, `rankByCosine`,
  `rankSessionsByCosine`. Pure, no I/O. Brute force per **D-a**: Atlas Vector Search does not exist
  on a self-hosted Mongo reached by raw IP (no `+srv`), and at 1452 × 3072 an exhaustive scan is
  milliseconds and **exact**, where an ANN index would be approximate and slower to build.
- `packages/index/src/vector/retriever.ts` (new) — `createVectorRetriever`, satisfying the existing
  `RetrieveFn` so it drops into the recall harness with **no change to the harness**.
- `scripts/eval-recall.mjs` — extended in place with `--retriever vector` (no new script file;
  `scripts/` is at its D-018 budget). Also fixed two real defects found by running it, below.
- `packages/index/src/index.ts` — exports.

## Three design decisions worth the words

1. **`RetrieveFn` is synchronous and I did not change it.** Vector retrieval needs the question
   embedded, which is I/O. Making the seam async would have touched every existing retriever and the
   harness for one caller's benefit. Instead the embedding is hoisted *out* of the hot path:
   `createVectorRetriever` takes questions already embedded. That also turns 92 requests into one
   batched call. The retriever's real job is ranking, and ranking is pure.
2. **A missing question embedding THROWS.** Returning `[]` would be indistinguishable, to the
   harness, from "the retriever ran and found nothing" — a plumbing failure would be scored as a
   retrieval miss and silently depress recall. A metric that reports a wiring bug as a quality
   regression is worse than no metric.
3. **Sessions are deduped BEFORE the top-k cut.** The chunker deliberately overlaps turns, so
   neighbouring chunks are near-duplicates; ranking chunks and truncating would let one long session
   occupy every slot and push the correct answer out. There is a dedicated test for exactly that.

## Two real defects the run exposed (neither found by reasoning)

- **`eval-recall.mjs` never loaded `.env`**, so `connect()` silently fell back to
  `localhost:27017` and failed against a host that was never the target. One line, but it would
  have made the vector mode unusable for anyone but me.
- **The vector run overwrote `recall-report.json` — the heuristic baseline its own delta is
  measured against.** I caught this only after the first successful run. Reports are now written
  per-retriever (`recall-report.json` / `recall-report-vector.json`), the baseline was restored
  from git, and the measurement was re-run to confirm both numbers now coexist on disk. **A unit
  whose entire purpose is a delta had been destroying its own comparand.**

## How to verify (commands + expected)

- `pnpm --filter @lkb/index test` → exit 0, 194 pass (16 new)
- `pnpm -r typecheck` / `pnpm -r test` → exit 0
- `node scripts/eval-recall.mjs --retriever vector` → recall@5 ≈ 0.935, writes the vector report
- `node scripts/eval-recall.mjs` → the heuristic baseline, 0.391, untouched
- every structure gate individually by exit code (ISS-100)

## Actual outputs (from maker's own run)

```
recall@5 = 0.935 (86/92 hits)
control (question-blind) = 0.217 | chance floor = 0.217
VERDICT: INFORMATIVE — 0.935 vs a 0.217 question-blind control (+0.717), 6 miss(es) left to move

BOTH ON DISK (re-run after the clobber fix):
  heuristic: 0.391 | 36/92
  vector   : 0.935 | 86/92
  delta    : +0.543
  retriever: vector (brute-force cosine, gemini-embedding-001, 1452 chunks)

@lkb/index  tests 194  pass 194  fail 0
pnpm -r typecheck = 0 · pnpm -r test = 0
```

## Disclosed — the checker should press on these

1. **The residual misses are NOT random, and this bounds the result.** Four of the six involve
   `uniaccess-*` sessions (`atlas-skilltech` ×2, `cept-university`, `ashoka-university`). That is
   precisely the **sibling-session ambiguity** flagged as unresolved precondition 4 of the
   `golden-set-redesign` gate: seven identically-formatted `uniaccess-*` sessions where several can
   legitimately answer the same question. So an unknown share of those 6 "misses" may be
   **mislabelled ground truth rather than retrieval failures** — which means 0.935 is arguably a
   *floor*. I am not claiming the higher number; I am flagging that the gate's open precondition
   directly limits how precisely this result can be read.
2. **Single measurement, one embedding model.** No repeat run, no seed variation, no second
   provider. The ranking is deterministic (there is a test), but the *embedding* is a live API call
   and I have not verified run-to-run stability.
3. **Not wired into `/ask`.** This is the retriever only. `vectorSearchFn` injection at the
   composition root and the hybrid merge are U1.5, deliberately not smuggled in here.
4. **No latency measurement.** The plan asks for p95. I measured correctness, not speed; 1452 × 3072
   was visibly fast but I did not instrument it, so I make no performance claim.
5. **The dedupe-before-truncate behaviour changes what "k" means** versus a chunk-level ranking.
   That is intentional and tested, but it is a semantic choice a reviewer should agree with rather
   than inherit.

## Status: ready-for-check
