# Manifest — embed-provider-seam

**Contract:** qa/contracts/ai-provider-seam.md
**Goal task:** **U1.1** (plan §10 Phase 1) — the first roadmap-tier unit this loop has reached.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none — roadmap work, not a defect.

## Why this unit, and why now

Backlog tiers 1–2 are empty for the first time (0 open critical/high), so D-014's priority reaches
**tier 3, the roadmap**. `U1.1` is its head: `U1.2`–`U1.5` (chunking, embed-on-index, cosine
retrieval, hybrid merge) all block on it, and `packages/index/src/vector/` does not exist.

## What changed

1. **`packages/ai/src/provider.ts`** — `EmbedJob` / `EmbedResult`, and `embed?()` on `Provider`.
   **Optional, deliberately.** claude-code runs a CLI and Anthropic ships no embedding API;
   requiring it would force four adapters to implement a method that throws, which is a worse lie
   than not implementing it. Plus `canEmbed()` so callers test capability instead of duck-typing.
2. **`providers/gemini.ts`** — `batchEmbedContents` over the **existing** `Transport`, so this is
   one more HTTP shape rather than a second SDK, and the existing fake covers it.
   `RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT` by `purpose`.
3. **`providers/ollama.ts`** — `/api/embed`, same seam. This is the member that keeps `goal.md`'s
   *"never leak the corpus into a public model"* reachable: chunking the whole transcript corpus is
   the largest volume of Vidysea text that would ever leave the building, and here it need not.
4. **`router.ts`** — `embed(jobKind, job, config)`, same chain and ledger as `complete`, one
   difference: a provider without `embed()` is **skipped, not failed**.
5. **`config/ai-routing.yaml`** — `embedding: [gemini, ollama]` (D-005 Gemini-first, D-b chain).

## The two failure modes I coded against

Both corrupt a similarity search *silently*, which is what makes them worth refusing rather than
tolerating:

- **A short response.** Two texts, one vector. Zipping those by index attaches chunk B's meaning to
  chunk A's id, and every later search is subtly wrong with nothing to show for it. Both adapters
  throw instead.
- **A ragged response.** Differing lengths cannot be compared by cosine at all, so `dims` would be
  a fiction. Both adapters throw.

And at the router: **no capable provider is an error, not an empty result.** Returning zero vectors
would look exactly like a corpus with nothing in it — an index build that *succeeds* while
producing nothing is the hardest failure to notice.

## Evidence

**Live, against the real API** (the plan's "one real call per configured provider recording actual
dims"):

```
LIVE gemini embed: 2 vectors | 3072 dims | model gemini-embedding-001 | 0.8s
query purpose    : 3072 dims
cosine(doc0,doc1): 0.8178   (<1, so distinct sentences give distinct vectors)
```

**11 new tests, all attacks on the contract** — batching (2 texts ⇒ 1 call), order preservation,
`taskType` switching, short-response refusal, ragged refusal, empty batch costs **no call**,
`canEmbed` discrimination, router skip-not-fail, router fallback past a throwing provider, and
"no capable member ⇒ throws".

`pnpm -r test` — **380 passing, 0 failing** across all 8 packages (`@lkb/ai` 56 → **67**).
`pnpm -r typecheck` exit 0 · `pnpm lint:structure` clean, depcruise **0 violations / 269 modules**.

## What this does NOT do

- **No vectors are stored.** `chunks` still has no `vector` field — that is `U1.2`, which must edit
  `schema/chunks.schema.json` (today it holds `embeddingRef`, a *string pointer*, which
  brute-force cosine cannot use).
- **Nothing calls `embed()` in production yet.** Wiring it into `indexing.ts` is `U1.3`.
- **Ollama's live path is untested.** The daemon is reachable here, but `nomic-embed-text` may not
  be pulled; the adapter is covered by fake-transport tests only. Stated rather than implied — the
  last unit's lesson was that "all paths tested" claims must name the path that wasn't.

## How to verify (checker)

1. `pnpm -r test`, `pnpm -r typecheck`, `pnpm lint:structure`.
2. **Attack the batching claim**: confirm N texts produce exactly ONE transport call, and that an
   empty batch produces **zero** (an empty array must never hit a paid endpoint).
3. **Try to make a wrong pairing survive.** Return fewer/more vectors than texts, or mixed lengths,
   and confirm both adapters refuse. If you can get a plausible-but-mispaired result through, that
   is a real finding.
4. **Reproduce the live call** and record the dims you observe — 3072 is a claim about the API, not
   a constant in our code, and it is the number `U1.2`'s schema will have to match.
5. **Judge `embed` being optional.** The alternative is a required method that throws on four
   adapters. Is skip-not-fail right, or does it hide a misconfigured chain?
6. Confirm nothing claims a vector index exists — this is the seam only.
7. `ISSUES-WRITTEN: none` is a complete check.

## Risk / rollback

Additive: one optional interface method, two adapter methods, one router function, one config line.
No existing behaviour changed; no product code calls any of it yet. `git revert` is clean.

**Status: ready-for-check**
