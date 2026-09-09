# Contract — hybrid-retrieval (plan §10 **U1.5**)

> **Status:** ACTIVE. Created by **/checker** on 2026-09-09 under `/checker init-contract`.
>
> **Authorization, recorded honestly.** The human answer in `qa/gates/vector-retrieval-contract.md`
> (**Answered: 2026-09-09 — Option 1, both layers**, Umesh: *"go with whatever is best"*) named
> **two** layers: `vector-retrieval` and `entity-promotion`. **This is a third.** It is written under
> that answer rather than under a fresh gate for one reason, stated so a later reader can disagree
> with it: U1.5 is the unit that gate was *opened for* — its own header reads *"Blocks: U1.5 (hybrid
> tree + vector + lexical merge into `askV2`) starting honestly"* — and the merge falls in the seam
> between the two contracts that answer produced:
> - `vector-retrieval.md` scopes it **out** ("those are U1.5's and belong in `ask-router-v2.md` or a
>   successor, not here").
> - `ask-router-v2.md` lists **"No vector-index query path (structured tree only)"** as an explicit
>   non-goal.
>
> So the merge is covered by neither, and building it uncovered would be the fifth consecutive time
> a shipped layer is graded against a plan bullet. If Umesh judges that the seam warranted its own
> gate, the remedy is an amendment entry saying so — not a silent re-grade of the unit.
>
> **Criteria in this file may be changed only by a checker, never by the maker.** A maker writing the
> contract it will be judged against is the segregation-of-duties failure ISS-006 was filed for;
> `.claude/CLAUDE.md` makes `qa/contracts/` read-only to the maker (feedback → `qa/feedback-inbox.md`).
>
> **Derivation.** Every criterion is derived from **code** — `packages/ask/src/ask-v2.ts`,
> `packages/ask/src/router.ts`, `packages/index/src/search/lexical.ts`,
> `packages/index/src/vector/retriever.ts`, `apps/api/src/production.ts`,
> `apps/api/src/routes/{ask,compete}.ts`, `apps/api/src/search-store.ts`,
> `packages/db/src/lib/tenantScope.ts` — from plan §10 U1.5, from `qa/gates/*`, and from
> `qa/contracts/vector-retrieval.md` C6. **Nothing here is transcribed from a maker manifest**; no
> manifest for this unit exists yet, and if one appears it is the artifact under judgement.

## North star

U1.5 turns three *already-shipped, independently-verified* retrievers into **one candidate list**,
without touching the one path that currently works. The merge is a **pure, deterministic ranking
function** plus an **injection at the composition root**. Its failure modes are not "bad answers" —
they are (a) a rewrite of `ask()`, (b) a ranking that changes between two identical runs so a recall
delta cannot be measured twice, (c) an embedding outage taking `/ask` down, (d) a degraded merge that
looks identical to a healthy one, and (e) a boot-bound retriever serving one tenant's corpus to
another. Every criterion below is about one of those five.

## Scope

**In scope**
- The candidate-production step in `packages/ask/src/ask-v2.ts` (today: `selectNodes(...)` at line 82,
  handed to `ask()` as the thunk `() => candidates` at line 86) and any new pure merge module it calls.
- The `vectorSearchFn` (and lexical) **injection** into `AskV2Deps` and its wiring in
  `apps/api/src/production.ts` / `apps/api/src/routes/ask.ts`.
- `apps/api/src/routes/compete.ts:72`, as the **second consumer** of `askV2`.
- The reciprocal-rank fusion itself: key normalization, dedup, tie-breaks, degradation signalling.

**Out of scope — a future checker must NOT grade these against this contract**
- **`packages/ask/src/router.ts` (`ask()`, `evaluate()`) and `packages/ask/src/evaluator.ts`.** C1
  makes not touching them a criterion; their *internal* behaviour is `ask-router.md`'s and
  `ask-router-v2.md`'s.
- **The vector layer's own correctness** — cosine, dedupe-before-truncate, dimension refusal,
  `createVectorRetriever`'s missing-embedding throw. That is `vector-retrieval.md` C1–C5, already
  PASSed; re-grading it here would be a third round on a capped seam.
- **`lexicalSearchTurns`' scoring quality and the Mongo pre-filter** — `search-route.md`'s, PASSed
  twice; the merge *consumes* it.
- **The embedding provider, chain config, and `routeEmbed`** — `ai-provider-seam.md`'s.
- **The golden set's ground truth and the sibling-session ambiguity** —
  `qa/gates/golden-set-redesign.md`'s. C7 governs only how its number may be *cited*.
- **Absolute answer quality, LLM judge agreement, and end-to-end `/ask` wall-clock latency.** No
  budget is derived here; see "Deliberately NOT criteria".
- **A search UI or `GET /search` changes** (U3.2).
- **Plan §10 prose as such.** Four consecutive checks in this repo graded shipped layers against plan
  bullets, and the gate above was opened over it. Grade the criteria below.

## Acceptance criteria

### C1 — `ask()` is not rewritten; the merge lives in the thunk
`packages/ask/src/router.ts` and `packages/ask/src/evaluator.ts` are **byte-unchanged** by this unit,
and `askV2` still reaches `ask()` through the existing thunk seam (`ask(query, tree, () => candidates,
scoreFn, …)`, ask-v2.ts:86). No second `ask`-like entry point, no `askV3`, no copy of `finishAsk`.
*Verified by:* `git diff <pre-unit-sha> HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts`
is **empty**, plus `grep -rn "function ask\|finishAsk\|internalSource" packages/ask/src` showing no new
definition. Plan §10 calls touching `ask()` "scope creep on the one working path"; this makes that
machine-checkable rather than advisory.

### C2 — The merged thunk still yields `TreeIndexNode[]`, and every node is real
`ask()` consumes candidates as `TreeIndexNode`s: it reads `node.node_id`/`node.evidence` for
`sources.internal` (router.ts:32-35) and `askV2` reads `n.summary` for the refine context
(ask-v2.ts:111). Therefore vector hits (which return **`sessionId`s** — `retriever.ts:52`) and lexical
hits (which return **`turnId` + `sessionId`** — `lexical.ts:16-21`) must be resolved to nodes that
exist in **this tenant's loaded tree**, never fabricated.
*Verified by:* mutation — make the resolver emit a node whose `node_id` is not present in the fixture
tree, and confirm a **named** test reddens. This is the machine form of plan §10's *"`/ask` still
returns only citations resolving to real turns"*: a citation is only real if its node came from the
tree that was loaded for that request.

### C3 — Dedup is by an explicit normalized key, and the key is stated
The three retrievers emit **three different id kinds**. The merge must define one normalization
(e.g. `sessionId` + resolved `node_id`) and dedupe on it, keeping the **best-fused** occurrence, so a
session surfaced by all three retrievers appears **once**.
*Verified by:* a named test with a fixture where the same session is returned by tree, vector and
lexical, asserting exactly one candidate for it; plus a mutation that removes the dedup step and must
redden that test. Plan §10 says "deduped by turnId", but turnId is a field only `LexicalHit` carries —
a contract that repeated that literally would be unimplementable, so the criterion is that the key is
**explicit, documented, and total over all three sources**, not that it is named `turnId`.

### C4 — RRF is deterministic: identical inputs, identical *ordered* output
Fusion is `Σ 1/(k + rank_i)` (or a documented equivalent), and **equal fused scores break ties on the
normalized key**, so two runs over the same corpus and query produce the same ordering — not merely
the same set.
*Verified by:* mutation — reduce the comparator to the score difference alone (dropping the tie-break)
and confirm a named test reddens; plus a named test asserting two invocations return
`deepStrictEqual` arrays. This mirrors `vector-retrieval.md` C3 and exists for the same reason: every
recall delta in this project is read off a ranking, and a delta measured twice that differs is not a
measurement.

### C5 — Degradation is safe **and visible**
`vectorSearchFn` needs an embedding round-trip. If it throws (provider down, no embedding chain, no
chunks for the tenant), `askV2` **still returns an answer** from tree + lexical, and the degradation is
**recorded**, not swallowed:
- an entry appears in the existing `auditLog` and via `recordJob` (ask-v2.ts:66-80, 94-95 — the
  mechanism already exists; no new logging system is required), naming the failed arm;
- the failure is **distinguishable from "the vector arm ran and found nothing"**.

This is the same degrade-safe-but-loud stance already taken by `writeSessionChunks` (returns a
`skipped` result rather than throwing — session.ts:83, session.test.ts:235-269) and `recordVectorGap`.
*Verified by:* two named tests — a `vectorSearchFn` that throws still produces an answer whose
`auditLog` contains the degradation entry; a `vectorSearchFn` that returns `[]` produces **no** such
entry. Plus a mutation: replace the handler with a bare `catch {}` and confirm the first test reddens.
The second half is load-bearing: this project has had **three separate silent-degradation defects**
(the `summarize` chain that degraded on an unregistered provider — production.ts:45-54; the guards
whose branch never executed; the pre-filter that lost 6 of 20 real hits with every test green). A
silent degrade is indistinguishable from a healthy run, which is exactly how a recall number becomes
a lie.

### C6 — Tenancy: the vector arm is bound **per request**, never at boot
`buildProductionDeps()` runs once at boot and has no tenant (`ROUTER_TENANT_ID = "system"`,
production.ts:28), while `tenantId` is resolved per request from the verified key
(`routes/ask.ts` → `req.auth!.tenantId`; compete.ts:65). The chunk corpus is tenant-scoped
(`scopedCollection`, tenantScope.ts:30-42). Therefore the injected retriever must take `tenantId` per
call (or be constructed per request); a corpus captured at boot, or a `scopedCollection` handle bound
to a fixed tenant, is a **cross-tenant read disclosure**.
*Verified by:* a named test with two tenants whose chunks/turns both exist, asserting tenant B's
question never returns a candidate resolving to tenant A's session; **plus** a mutation that drops
`tenantId` from the retriever's query path and must redden that test. **This criterion is
severity-critical and is never round-capped** (`.claude/CLAUDE.md`, "Round cap", security class):
ISS-078 in this repo was a cross-tenant read disclosure found at round 5, after four consecutive
PASSes and 102 green tests.

### C7 — The `≥ 0.85` exit criterion may NOT be satisfied by inheriting `0.935`
Plan §10 gives U1.5 *"recall@5 ≥ 0.85 on the real golden set **or an honest FAIL with the number**"*.
Carried forward verbatim from `vector-retrieval.md` C6, so U1.5 cannot inherit the number without its
caveat:

> **0.935 (86/92) is a downward-biased FLOOR, citable only with the sibling-session-ambiguity caveat
> attached, and it may NOT on its own satisfy a `≥ 0.85` exit criterion, nor close condition 4 of
> `qa/gates/golden-set-redesign.md`, while that gate's precondition 1 remains open.**

Concretely, for this unit:
1. U1.5 **must measure its own** hybrid recall@5 — the U1.4 vector-only number is a different
   retriever's measurement and is not this unit's evidence.
2. That figure is reported as a **delta** against the U0.10/heuristic baseline, and every citation of
   an absolute value carries the caveat.
3. A bare `≥ 0.85` **PASS claim** is a FAIL of this criterion while precondition 1 is open, however
   good the number is. `.goal/goal.json` (U0.10 note) and `TASKS.md:93` already say the same thing;
   this makes it a criterion instead of a note.
4. **An honest FAIL with the number is an acceptable outcome for the unit's recall arm** — plan §10
   says so explicitly. Reporting a real sub-0.85 figure must never be worse for the maker than
   quietly re-scoping the measurement.
*Verified by:* the checker greps every artifact citing the number (manifest, verdict, `docs/PROGRESS.md`,
DECISIONS, code comments, `.goal/goal.json`) and confirms each is caveated or a delta.
*Precedent:* an uncaveated `1.000` became load-bearing in this project once already, before the golden
set was rebuilt.

### C8 — Measurement corpus rule
If this unit also claims to fix any filed ledger issue, its regression test **re-runs that issue's own
recorded reproductions verbatim from `qa/issues.jsonl`**, and the manifest reports the count **by
issue id** (`ISS-nnn: 15/20`). A self-authored corpus may be **added**, never **substituted**; any
recorded reproduction left open is named with its reason.
*Verified by:* the checker diffs the tests' cases against the ledger rows for the claimed ids.
Straight from `.claude/CLAUDE.md` (D-015): a fix measured against a corpus its own author chose is
marking homework with an easier exam — that habit let a unit pass three cycles with its originating
issue still open.

### C9 — The second consumer keeps working
`apps/api/src/routes/compete.ts:72` calls `askV2(question, tree, { ...deps.askDeps, tenantId })` and
shares `AskRouteDeps` with `/ask`. Any new dep must therefore be **optional** in `AskV2Deps` (the
pattern `tavilySearchFn` already set — ask-v2.ts:40, production.ts:114), or `compete.ts` must be
updated in the same unit. With the new arms absent, `askV2` behaviour is **unchanged** from before
this unit.
*Verified by:* `pnpm -r typecheck` exit 0, the existing `compete` route tests green untouched, **plus**
a named test that constructs `AskV2Deps` with no vector/lexical arm and asserts the pre-existing
result shape.

### C10 — Architecture seam holds
`packages/ask` still does not import `packages/index` (`.dependency-cruiser.cjs`'s
`ask-index-ingest-only-ai-db-core` rule, ARCHITECTURE §5) — the vector and lexical arms arrive by
injection from an `apps/*` composition root, exactly as `treeSearchFn` does (production.ts:110). The
merge function itself is **pure**: no I/O, no db/provider import.
*Verified by:* `npx depcruise --config .dependency-cruiser.cjs packages apps` exit 0, plus a read of
the new module's imports.

### C11 — Standing gates
`pnpm -r typecheck` and `pnpm -r test` each exit 0, judged **by their own exit codes**, not through
the `lint:structure` wrapper. A `lint:structure` failure attributable to another lane's `TASKS.md` /
`.goal/goal.json` rows is **not** chargeable to this unit; say so and move on.

## Invariants

- **[I1] The working path is not collateral.** Any change that improves a recall number while
  altering `router.ts`/`evaluator.ts` behaviour is a regression, whatever the number does.
- **[I2] Coverage is assumed absent until a mutation proves it present.** In this repo three separate
  guards shipped whose branch never executed, and every one was found by mutation rather than by a
  passing suite. A test sitting near the code is not coverage.
- **[I3] Availability is degraded, never faked.** Losing the vector arm may reduce recall; it may not
  produce an error to the caller, and it may not produce a result that reads as healthy.
- **[I4] No number produced by this layer closes a gate that gates this layer.** C7 is the standing
  instance.
- **[I5] Tenant scoping is a property of the query, not of the caller's good behaviour.** Every
  retrieval arm filters by the request's `tenantId` at the data boundary.

## Deliberately NOT criteria, and why

- **A recall floor of its own (e.g. "≥ 0.90").** The same reasoning as `vector-retrieval.md`: the
  golden set's ground truth is contested by an open gate precondition, and 0.935 is measured on one
  corpus with at least two residual misses that are corpus-coverage artifacts. C7 governs *citation*;
  it deliberately sets no floor.
- **An end-to-end `/ask` latency budget.** `vector-retrieval.md` C8 is explicit that its 62–78 ms is
  **ranking-only** and "may NOT be cited as end-to-end `/ask` latency". Nothing in this repo has ever
  measured `/ask` with a real un-amortised embed round-trip, and `search-store.ts` documents that the
  turns scan is still unindexed (~663 ms after the pre-filter). A budget written from those numbers
  would be invented, not derived. **What is missing is a measurement, not a rule** — U1.5 recording
  a first end-to-end p50/p95 would be the right input to a later amendment.
- **A specific RRF `k` constant (60 or otherwise).** No evidence in this repo bears on it. C4 requires
  determinism and a documented formula; pinning a constant would encode a guess as a requirement.
- **Weights between the three arms.** Nothing has measured their relative precision on this corpus.
  A weight set now would be a number nobody could defend at the first re-chunk.
- **"Vector must beat lexical" / any per-arm quality claim.** That is a property of the corpus and the
  embedding model, neither of which this unit owns.
- **A requirement to cap or expand candidate count.** `selectNodes` has its own budget today; changing
  it is a separate decision with its own cost evidence, and folding it in here would let a merge unit
  quietly change what the LLM sees.

## Amendment log

- 2026-09-09 · **START** · contract CREATED by /checker under `/checker init-contract hybrid-retrieval`,
  per the answer recorded in `qa/gates/vector-retrieval-contract.md` (2026-09-09, Umesh, Option 1).
  **Recorded honestly: that gate named two layers — `vector-retrieval` and `entity-promotion` — and
  this is a third, in the seam both of those contracts explicitly exclude.** The gate was opened
  because of U1.5; drafting rather than re-asking is a judgement call, and this line is here so it can
  be overturned by an amendment rather than by silence. Criteria derived from `ask-v2.ts`, `router.ts`,
  `lexical.ts`, `vector/retriever.ts`, `production.ts`, `routes/{ask,compete}.ts`, `search-store.ts`,
  `tenantScope.ts`, plan §10 U1.5, `vector-retrieval.md` C6, and `.claude/CLAUDE.md`'s round-cap and
  D-015 measurement rules. No criterion was taken from a maker manifest; none exists for this unit.
