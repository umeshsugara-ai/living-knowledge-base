# Verdict — embed-provider-seam

**Contract:** qa/contracts/ai-provider-seam.md
**Manifest:** qa/manifests/embed-provider-seam.md
**Goal task:** U1.1 (plan §10 Phase 1)
**Cycle checked:** 1
**Date:** 2026-09-08
**Checker:** Mode A unit check, fresh context, bound to `D:\KnowledgeBase`
**Commit under check:** 3bacdaa `feat(ai): embed() on the provider seam (U1.1)`

```
VERDICT: PASS
SCOREBOARD: 8/8 contract criteria met, 3/3 invariants hold (7/7 manifest verification items reproduced)
FAILURES: none
ISSUES-WRITTEN: ISS-096 (medium), ISS-097 (low) — neither breaks a criterion or a manifest claim; both are forward-facing notes for U1.2/U1.3.
EXPLANATION: I attacked the seam with my own probe rather than re-running the maker's tests, and
could not make a wrong pairing survive: nine mispairing attacks across both adapters (fewer, more,
ragged, a missing `values` field, an absent `embeddings` key) all threw with a specific message.
Batching is exactly one transport call for N texts and exactly ZERO for an empty batch, on both
adapters and through the router. I reproduced the live Gemini call with a transport I wrote myself
and independently observed 3072 dims from `gemini-embedding-001` — the manifest's number is
correct. The `embed?()`-optional design does NOT hide a misconfigured chain: a typo'd provider name
throws in `route()` before capability is ever consulted, and a chain of entirely incapable providers
throws `AllProvidersFailedError` naming every skip. Every "what this does NOT do" claim checked out,
including the one the maker did not have to make.
```

## What I re-ran myself

| Check | Result |
|---|---|
| `pnpm -r test` | **380 passing / 0 failing** across 8 packages (`@lkb/ai` 67). Matches the manifest exactly. |
| `pnpm -r typecheck` | exit 0, all packages Done |
| `pnpm lint:structure` | clean — lint-loc 249 files, lint-dupes 263 exports, snapshot fresh, tracker-audit G1 OK, **depcruise 0 violations / 269 modules** |
| Own adversarial probe | `scratchpad/probe.mts`, written by me against `providers/{gemini,ollama}.ts` + `router.ts` directly |
| Own live probe | `scratchpad/live.mts`, my own `fetch`-based `Transport`, real `GEMINI_API_KEY` from `.env` |

## 1. Wrong pairing — nine attacks, nine refusals

The failure that matters here is a plausible-but-mispaired result: one chunk's meaning silently
attached to another chunk's id, corrupting every later similarity search with nothing to show. I
could not produce one.

```
threw OK  gemini FEWER (2 of 3) :: gemini embed returned 2 vector(s) for 3 text(s) — refusing to pair them by index
threw OK  gemini MORE  (4 of 3) :: gemini embed returned 4 vector(s) for 3 text(s) — refusing to pair them by index
threw OK  gemini RAGGED(3 mixed):: gemini embed returned a 3-dim vector at index 1 but 2 at index 0 — a ragged set cannot be compared by cosine
threw OK  gemini MISSING values field on one :: ...returned a 0-dim vector at index 1 but 2 at index 0...
threw OK  gemini embeddings key absent entirely :: ...returned 0 vector(s) for 3 text(s)...
threw OK  ollama FEWER (2 of 3) / MORE (4 of 3) / RAGGED / embeddings key absent
```

Two beyond the manifest's own claims are worth naming: a response whose `embeddings` array is the
right length but where one entry **lacks `values`** is caught by the ragged check (it becomes a
0-dim vector next to a 3072-dim one), and a body missing `embeddings` entirely is caught by the
count check rather than silently yielding `[]`. Order is preserved (`[[9,9],[7,7]]` for
`["first","second"]`), and `purpose` switches `taskType` correctly — `query`→`RETRIEVAL_QUERY`,
`document` and **unset**→`RETRIEVAL_DOCUMENT`.

**One case does survive**, and it is ISS-096 below: N texts in, N vectors back, every one of them
empty. Pairing is correct, so neither guard is wrong to allow it, but the result is `dims: 0` —
degenerate rather than mispaired. It cannot corrupt a search today because nothing stores vectors
yet; it is filed against U1.2/U1.3, not against this unit.

## 2. Batching, and the cost of an empty batch

```
gemini 3 texts -> transport calls=1  vectors=3  batchSize(requests[])=3
gemini EMPTY   -> transport calls=0  result={"vectors":[],"dims":0,...}   (no throw)
ollama 3 texts -> transport calls=1  url=http://localhost:11434/api/embed  input[]=3
ollama EMPTY   -> transport calls=0  result={"vectors":[],...}            (no throw)
router empty   -> transport calls=0  ledgerRows=1 (status done)
```

N texts ⇒ exactly one call on both adapters; `texts: []` ⇒ **zero** calls, returning an empty
result rather than throwing. An empty array can never reach a paid endpoint, including through
`router.embed()`. The router still writes one `done` ledger row for the empty case, which I judge
correct: a request was routed and satisfied, it simply cost nothing.

## 3. Live call — dims observed, not accepted

My own transport, my own sentences (deliberately different from the maker's, so this is an
independent observation rather than a replay):

```
LIVE doc  : 2 vectors | dims=3072 | model=gemini-embedding-001 | 1.0s
  per-vector lengths: 3072, 3072
LIVE query: 1 vector | dims=3072
  cosine(doc0,doc1) = 0.6929
  cosine(query,doc0)= 0.7271   ("When are applications due?" vs the admissions-deadline sentence)
  cosine(query,doc1)= 0.5630   (vs the cricket sentence)
```

**3072 dims CONFIRMED** for `gemini-embedding-001`, and the `document`/`query` split behaves
semantically — the query ranks the relevant document above the irrelevant one by 0.16. This is the
number `U1.2`'s `chunks` schema must accommodate. Note for U1.2: 3072 float64 ≈ 24 KB per chunk in
a naive BSON array, which is a storage decision, not a defect here.

## 4. Ruling on `embed?()` optional + skip-not-fail — CORRECT, and it hides nothing

This was the design call I was asked to judge, so I tested the three ways it could go wrong rather
than reasoning about it:

```
canEmbed  gemini,ollama,anthropic,claude-code = true,true,false,false
skip-then-capable  -> provider=ollama  dims=2  ledger=[["ollama","done"]]
ENTIRELY incapable -> AllProvidersFailedError: all providers failed for jobKind "embedding":
                      claude-code (provider has no embed() — skipped); anthropic (... skipped)
TYPO'd name        -> Error: router.route: unknown provider "gemni" in chain "embedding"
unconfigured kind  -> Error: router.route: no chain configured for jobKind "no-such-kind"
fallback past a thrower -> provider=ollama ledger=[["boom","failed"],["ollama","done"]]
```

- **A typo'd provider name does not get silently skipped.** `route()` resolves names to instances
  and throws `unknown provider` *before* `embed()` ever consults `canEmbed`. This is the strongest
  argument for the design: the two failure modes are separated, so "absent method" and "absent
  provider" cannot be confused for one another.
- **A chain of entirely incapable providers is an error, not an empty result** — and the error
  names each skipped member and why. An index build cannot succeed while producing nothing.
- The alternative — a required `embed()` throwing on four adapters — would collapse both cases into
  the same runtime throw and lose the static `canEmbed` narrowing. The maker's reasoning holds.

**Ledger semantics for a skip: also correct, with one caveat (ISS-097).** A skip is not a job; it
consumed no provider, no tokens and no cost, and recording it as `status: "failed"` would inflate
the failure rate and the per-provider reliability picture the `jobs` ledger exists to give. Leaving
it out is the right call. The caveat is only that `router.ts:98`'s comment says skipping is recorded
"so the ledger still explains where a request went" — it is recorded in the thrown error's
`attempts`, never in the ledger, and when a later member succeeds the skip leaves no trace at all.
The behaviour is right; the sentence describing it is not.

## 5. Honesty of "what this does NOT do" — all three verified, one exactly

- **"No vectors are stored."** `schema/chunks.schema.json` holds `embeddingRef` (`type: string`)
  and has **no `vector` field**. Confirmed by grep — line 17 is the only embedding-related property.
- **"Nothing calls `embed()` in production yet."** Grepped `packages/` and `apps/` for `embed(`
  outside `packages/ai/src` and outside `*.test.*`: **zero hits.** The seam is genuinely unwired.
- **"Ollama's live path is untested — the daemon is reachable but `nomic-embed-text` may not be
  pulled."** I checked rather than took this on trust. `GET /api/tags` returns 200 with
  `qwen3:8b`, `glm-5.2:cloud`, `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud` — and
  `POST /api/embed` with `nomic-embed-text` returns
  `{"error":"model \"nomic-embed-text\" not found, try pulling it first"}`. The disclosure is
  precisely, not approximately, true. Crediting this: the manifest named the untested path
  unprompted and described it accurately enough that I could reproduce the exact gap.

## 6. Contract compliance (regression surface)

| | |
|---|---|
| C1 one `Provider` interface | Met. `EmbedJob`/`EmbedResult`/`embed?()` are added **to `provider.ts`**; both adapters `import type` them from `../provider.js` — no re-declared shapes (verified in both files' import lines). |
| C2 five adapters, injectable transport | Met. `embed()` on gemini/ollama goes through the **existing** `Transport`, no second seam introduced. lint-loc: all files within budget. |
| C3 `listModels()` real | Unchanged, untouched by this unit. |
| C4 ordered chain + typed error | Met and extended. `config/ai-routing.yaml` gains `embedding: [gemini, ollama]`; `router.embed()` reuses `route()` and throws `AllProvidersFailedError`. |
| C5 jobs ledger write | Met for the paths that reach a provider (`done` and `failed` rows both observed in my probe). |
| C6 STT sub-seam | Unchanged. |
| C7 parity contract test | Met and extended — 11 new tests, and my independent probe reproduces their claims without reading them. |
| C8 no regression | Met. 380/380, typecheck 0, lint:structure clean, depcruise 0 violations. |
| **[I1]** no live network needed to pass | Holds — the full suite is green offline; my live call was my own choice, not a requirement. |
| **[I2]** one interface, one definition | Holds — see C1. |
| **[I3]** every `complete()` attempt logged | Holds — untouched by this unit; `complete()`'s two `recordJob` calls are unchanged. |

## Issues written

- **ISS-096 (medium)** — a response with the correct vector COUNT but every vector empty returns
  `{dims: 0}` instead of throwing; both guards are relative (count vs count, length vs length[0]),
  so neither has a floor. Harmless today (nothing stores vectors); must be closed before U1.3 wires
  `embed()` into indexing.
- **ISS-097 (low)** — `router.ts:98` claims a skip is recorded in the ledger; it is not. Comment
  accuracy only, in a repo that has been bitten by prose outrunning behaviour (ISS-091/094).

Neither is a criterion failure and neither burns a fix cycle. `ISSUES-WRITTEN: none` would have been
acceptable; I filed these two because both are reproducible and both land squarely on U1.2/U1.3,
which start from here.

## Contract amendment made

`qa/contracts/ai-provider-seam.md` gained **C9** and **[I4]** (routine, auto-gated: adding criteria,
weakening nothing) — the contract predated the embedding seam and said nothing about it, so
U1.2–U1.5 would have been checked against a contract blind to their foundation. C9 records only
behaviour verified in this check, plus the observed 3072 dims. The dims-floor rule from ISS-096 is
deliberately NOT added as a criterion: writing a new criterion for the express purpose of failing
the unit in front of me would distort the gate as surely as softening one would.
