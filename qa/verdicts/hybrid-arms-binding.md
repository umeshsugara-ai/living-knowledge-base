# Verdict — hybrid-arms-binding (U1.5 part 2)

**Contract:** qa/contracts/hybrid-retrieval.md
**Manifest:** qa/manifests/hybrid-arms-binding.md (Fix cycle: 1 of max 3)
**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** Mode A, fresh subagent, bound to `D:\KnowledgeBase`
**Unit commit under judgement:** e2464fc (part 1: 2abc1c9 / a8c3dce / b90e206, baseline ad6e7b7)

```
VERDICT: FAIL
SCOREBOARD: 9/11 criteria met, 4/5 invariants hold (I2 does not)
FAILURES:
- [C6] sev: high (security-class, NEVER round-capped) · the factory's internals are pinned but the
  BINDING SITE is not: hoisting `deps.extraCandidateArmsFor("system")` out of the request handler in
  routes/ask.ts, so every tenant's question queries the boot tenant's corpus, leaves 170/170 tests
  GREEN. That is verbatim the disclosure C6 names ("a corpus captured at boot ... is a cross-tenant
  read disclosure") and it is reintroducible in two lines with nothing reddening. Zero tests in the
  repo reference `extraCandidateArmsFor`. The shipped code is CORRECT — my own live two-tenant probe
  against real Mongo confirms isolation — so this is a coverage failure on a security-class
  criterion, not a live leak · fix direction: a named test that drives `createAskRouter` with a
  recording `extraCandidateArmsFor` and asserts it is called with the VERIFIED KEY's tenantId, once
  per request, and that two requests from different keys yield two different bindings; confirm it
  reddens under the hoist mutation · issue: ISS-169
- [C7] sev: high · the reported 0.891 does not characterise what ships, in a way that goes materially
  beyond disclosure 4. The eval's tree arm is `createHeuristicRetriever`, whose own file header says
  it is "explicitly a proxy ... NOT a claim that this measures the real pipeline's recall"; the
  shipped tree arm is `selectNodes`, an LLM call. The eval's lexical arm reads `kk*4 = 20` turns
  before deduping to 5 sessions, the shipped one reads `k = 5` turns and can collapse to one or two.
  So the measured merge shares two arms and the fusion function with the shipped merge and differs in
  the third arm and in a second arm's depth. Worse, the unit's central ANALYTICAL claim — "the tree
  arm scores 0.391 ... it votes with almost the authority of noise" — is a property of the arm that
  does not ship, so the stated cause of the regression is unsupported for the shipped configuration.
  C7 clause 1's own reasoning ("a different retriever's measurement is not this unit's evidence")
  applies · fix direction: re-run the hybrid with the shipped lexical depth and label the tree arm as
  the heuristic proxy in the report's `retriever` string, or take a bounded live `/ask` sample. NOT a
  weight tune · issue: ISS-170
ISSUES-WRITTEN: ISS-169, ISS-170
EXPLANATION: Both numbers reproduce exactly on my own runs (hybrid 0.891 82/92, vector 0.935 86/92,
8 new misses / 4 recovered, by id), all three reports coexist and the heuristic report's md5 is
unchanged across both runs. On the central question I rule that SHIPPING the regressing merge is
acceptable and that the honest disclosure is what C7 clause 4 protects — but C7 is not SATISFIED,
because the measurement is of a policy that materially differs from the shipped one. C6 fails
separately and for a different reason: the code is right and the proof is missing, which is exactly
what I2 forbids, on the one criterion this contract marks security-class.
```

---

## 1 · THE CENTRAL RULING — is a merge that loses to its own vector arm shippable?

**Yes, it is shippable. No, its number may not be credited as satisfying C7. And the unit does not
fail because of the regression.** Stated at length because the dispatch asked for a ruling and both
answers were defensible.

**Why the regression is not itself a FAIL.**

1. **C7 clause 4 settles the incentive, and it settles it one step further out than its own text.**
   It says an honest sub-0.85 number "must never be worse for the maker than quietly re-scoping the
   measurement". The maker did something rarer: it produced a number that clears the literal bar and
   then argued against crediting it. If an honest number *below* the bar is safe, an honest number
   *above* the bar that the maker refuses to claim must be at least as safe. Failing that behaviour
   teaches the next unit to stop at "0.891 ≥ 0.85, PASS" — the precise reading C7 was written to
   prevent.
2. **The contract deliberately declines to set the rule I would be enforcing.** "Deliberately NOT
   criteria" names *a recall floor of its own* and *weights between the three arms*, each with its
   reason. A checker that failed this unit for "the configuration loses to one arm" would be
   legislating the criterion the contract's author explicitly refused to write, from the verdict
   seat, on a pending verdict. That is the softening rule running in reverse and it is no more
   legitimate in that direction.
3. **The alternative is the thing this repo exists to stop.** The only route from 0.891 to a number
   above 0.935 is per-arm weights fitted to 92 questions whose ground truth
   `qa/gates/golden-set-redesign.md` precondition 1 disputes. The maker named that and declined it.
   Charging it for declining would make weight-fitting the cheaper path, and D-015 is in
   `.claude/CLAUDE.md` because that habit already cost this repo three fix cycles.

**Why "correct machinery, bad configuration, shipped anyway" still gets teeth here.** The dispatch's
counter-worry is right that this is how a system accretes something nobody can point at. The answer
is not a FAIL on the regression; it is that the regression must stay *pointed at* and must not be
allowed to close anything. Three things enforce that in this verdict:

- **C7 is recorded NOT MET** (§4), so the `≥ 0.85` exit criterion of plan §10 U1.5 remains open and
  no later unit may cite 0.891 as having closed it.
- **ISS-170** records the delta, the 8/4 miss split by id, and the eval-vs-ship divergence, so the
  configuration question survives this session.
- The verdict states plainly that **the merge is enabled on `/ask` today** (`production.ts:107` →
  `routes/ask.ts:53`) while measuring worse than the arm it contains — which is a live product fact,
  not a QA note.

**What I explicitly did NOT do:** treat 0.891 ≥ 0.85 as satisfying anything, and re-open the arm
weights as a criterion.

## 2 · The numbers, re-derived (not trusted)

Both evals re-run by me against the live Mongo at `13.202.206.101:27017` and the real Gemini key.

```
node scripts/eval-recall.mjs --retriever hybrid → recall@5 = 0.891 (82/92) · control 0.217 · INFORMATIVE
node scripts/eval-recall.mjs --retriever vector → recall@5 = 0.935 (86/92) · control 0.217 · INFORMATIVE
```

Exactly the manifest's figures. I then diffed the two reports' miss sets myself rather than
accepting "8 new, 4 recovered":

| | n | ids |
|---|---|---|
| **new misses hybrid introduced** | **8** | `…atlas-skilltech-gq04`, `…ever-expanding-cast-gq04`, `…inside-the-uc-session-gq01`, `…creative-futures-gq02`, `…uk-beyond-offer-letters-gq03`, `…uk-beyond-offer-letters-gq04`, `…in-focus-4-gq01`, `…in-focus-4-gq02` |
| **recovered by hybrid** | **4** | `…atlas-skilltech-gq03`, `…in-focus-1-gq03`, `…entrance-exams-…-part1-gq01`, `…ashoka-university-gq04` |

−0.043 confirmed. The control is identical across both (0.217 = the chance floor), so the two
numbers are comparable, which is the only reason the delta means anything.

**The three reports coexist and none clobbers another.** `recall-report.json` (heuristic 0.391,
36/92), `recall-report-vector.json`, `recall-report-hybrid.json` are separate paths (`eval-recall.mjs:24-26`).
I md5'd the heuristic report before my two runs and after both: `de3c11aa95fb9f44f07afd18816bcb64`,
unchanged. The header comment records that the vector run once destroyed the baseline it was measured
against; the fix is real and I verified it rather than reading it.

**Citation hygiene (C7's verification clause).** I grepped every artifact for `0.891`. It appears in
the manifest, the commit message, `data/eval/recall-report-hybrid.json`, and `qa/.last-tick` — and in
**none** of `.goal/goal.json`, `docs/PROGRESS.md`, `docs/DECISIONS.md`. Every prose occurrence carries
either the regression framing or "a 92-question set whose ground truth an open gate precondition
already disputes". **No bare `≥ 0.85` PASS claim exists anywhere.** C7 clauses 2 and 3 are satisfied;
clause 1 is what fails, for the reason in §4.

## 3 · C6 — FAILED. The mutation the maker ran is not the mutation C6 asks for

**Mutation I re-derived, not trusted.** Armed via `mutate.mjs apply`, `scopedCollection(...)(tenantId)`
→ `("system")` on both reads in `ask-arms.ts`:

```
168 pass / 2 fail  ✔ exactly the manifest's count
  ✖ C6: every collection read carries the tenant the factory was called with
  ✖ C6: two tenants' arms query different corpora — no shared binding
```

Both dying tests are C6-named and nothing else dies. The factory's *internals* are genuinely pinned.

**Then I went further, as the dispatch asked — and the ninth unreachable path is here.**

**Mutation K (mine).** In `routes/ask.ts`, hoist the binding out of the handler:

```ts
const BOUND = deps.extraCandidateArmsFor ? deps.extraCandidateArmsFor("system") : undefined;
…
...(BOUND ? { extraCandidateArmsFn: BOUND } : {}),
```

**Result: 170 pass / 0 fail.** Nothing reddens. Every tenant's `/ask` now queries the boot tenant's
chunks and turns — the literal text of C6 ("`buildProductionDeps()` runs once at boot and has no
tenant … a corpus captured at boot … is a **cross-tenant read disclosure**"), reintroduced in two
lines, invisible to the whole suite.

```
$ grep -rn "extraCandidateArmsFor" --include=*.ts apps packages
apps/api/src/production.ts:107      ← the only producer
apps/api/src/routes/ask.ts:30       ← the type
                                     (and no third line — ZERO tests)
```

C6's Verified-by asks for "a named test with two tenants … **plus** a mutation that drops `tenantId`
from the retriever's query path and must redden that test". The retriever's query path begins where
the tenant is chosen. The maker mutated the half that was covered and reported the count from it.
**I2 is explicit: coverage is assumed absent until a mutation proves it present**, and here a
mutation proves it absent.

**This is the maker's named habit, at cycle 1 of a new unit.** Nine unreachable paths across these
units now; the last three each sat one refinement behind the pinned property (ordering→membership,
membership→node identity, factory internals→the binding). The tell is the same every time: the test
asserts the property of the object the maker wrote, not of the seam the object is installed into.

**Severity high, not critical, and I want the reason on record.** The shipped code is right. I
verified it live rather than by reading:

**Live two-tenant probe (mine — the evidence the maker disclosed it had not produced).** Written by
me, against real Mongo, driving the *shipped* `createAskArmsFor`. Two scratch tenants, disjoint
`chunks` + `turns`, **identical query text in both** so a leak would be a genuine collision, and each
tenant's tree deliberately seeded with a node for the OTHER tenant's session id so a leaked hit
*could* have resolved rather than being silently dropped:

```
zzchk-tenant-A: degraded=null arms=["tenant:zzchk-tenant-A/…/session:zzchk-sA", "…/session:zzchk-sA"]
zzchk-tenant-B: degraded=null arms=["tenant:zzchk-tenant-B/…/session:zzchk-sB", "…/session:zzchk-sB"]
CLEANUP: deleted chunks=2 turns=2; READ BACK remaining chunks=0 turns=0
PROBE CLEAN: no cross-tenant retrieval, cleanup verified
```

Both arms fired (two arms per tenant, `degraded: null`), each returned only its own tenant's session,
and the cleanup was **read back from the server**, not assumed. Writes were bounded to four
`zzchk-`-prefixed rows and the probe script was deleted; `git status` shows no residue.

So: **no live disclosure today, and a proof-shaped hole where C6's own verification clause put one.**
On a criterion this contract marks security-class and never round-capped, that is a FAIL, and the fix
is one test.

## 4 · C7 — FAILED, and not for the regression

Disclosure 4 says the harness "fuses SESSION IDS while `askV2` fuses NODES … same `rrfMerge` and the
same key discipline, but not the same call path". That is true and it understates the gap. Reading
`eval-recall.mjs:117-139` against `ask-arms.ts` + `ask-v2.ts:110-130`:

| arm | measured (eval harness) | shipped (`askV2`) | same? |
|---|---|---|---|
| tree | `createHeuristicRetriever` — keyword overlap on `summary` | `selectNodes(query, tree, complete, treeSearchFn)` — an **LLM** call | **no** |
| vector | `createVectorRetriever` over the tenant's real chunks | `rankSessionsByCosine` over the tenant's real chunks | yes, in substance |
| lexical | `lexicalSearchTurns(q, turns, kk*4 = 20)` → dedupe → `slice(0,5)` | `lexicalSearchTurns(q, turns, k = 5)` → dedupe | **no — 4× shallower** |
| fusion | `rrfMerge`, `keyOf = id` | `rrfMerge`, `keyOf = node_id` | yes |
| after fusion | top-5 **is** the answer | `ask()` → `evaluate()` **re-scores** with the LLM judge | **no** |

Three divergences, not one, and the id-vs-node framing is the least of them:

1. **The tree arm does not ship.** `heuristic-retriever.ts`'s own header: *"Explicitly a proxy for
   retrieval-harness testing while the real LLM path is blocked — **NOT a claim that this measures
   the real pipeline's recall**."* The manifest's table says "hybrid (RRF, 3 arms)" with no hint that
   one of the three is a documented stand-in.
2. **The shipped lexical arm is materially weaker than the measured one.** Taking 5 turns and then
   deduping by session can yield one or two distinct sessions where the harness's 20-turn read yields
   five. The arm that ships votes less than the arm that was scored.
3. **Recall@5 of the fused list is a candidate-set metric.** What `/ask` emits is `evaluate()`'s
   re-scoring of that list, so even a perfect fusion number does not bound what a caller sees.

**And this is why it matters more than a caveat.** The unit's headline explanation of the regression
is *"the tree arm scores 0.391 — barely above the 0.217 chance floor — so it is voting with almost
the authority of noise."* That sentence is about the **heuristic proxy**. The shipped tree arm is
`selectNodes`, which has never been scored on this corpus. So the number is of a near-neighbour
policy and its stated cause is a property of the one arm that is not in the shipped policy. Both
halves of the finding are about something other than what ships.

**Does that invalidate C7's satisfaction? Yes.** C7 clause 1 is not a formality about which script
runs — its reasoning is *"the U1.4 vector-only number is a different retriever's measurement and is
not this unit's evidence."* A hybrid whose tree arm is a documented non-shipping proxy and whose
lexical arm is 4× shallower is, by that same sentence, a different retriever's measurement. The
maker measured **a** hybrid honestly; it did not yet measure **its own**.

**I want to be equally clear about what this FAIL is not.** It is not a demand for a better number,
and the remedy must not be a weight tune. Either of these discharges it: re-run with the shipped
lexical depth and write the tree arm's proxy status into the report's `retriever` string (cheap,
honest, probably moves 0.891 a little in some direction and that is fine); or take a bounded live
`/ask` sample. **An honest FAIL with the number remains an acceptable outcome — C7 clause 4 is
undisturbed by this verdict.**

## 5 · Unreachable-path hunt — one more, plus a note

The dispatch named three surfaces. All three probed:

**`sessionNodesById` (`ask-arms.ts:44-56`) — covered, and cannot escape the tree.** Mutation L
(mine): delete `for (const c of n.children ?? []) stack.push(c)`, making the walk non-recursive →
**169 pass / 1 fail**, killing `arms return real TREE NODES, mapped from their own id vocabulary`.
The children walk is load-bearing and pinned. Structurally, both arms emit only
`bySession.get(...)` results with `undefined` filtered out, and `bySession` is built from **the tree
passed into the call**, which `ask-v2.ts:123` sources from the per-request `deps.tree.load(tenantId)`.
So **neither arm can return a node from outside the passed tree** — not by a foreign sessionId (test
`a hit for a session NOT in this tree is dropped rather than invented`, which I re-derived live in
§3's probe by seeding a foreign node and watching it stay unretrieved), and not by fabrication, since
no arm ever constructs a node object. This is the same resolve-don't-validate shape that closed
part 1's ISS-158, applied one layer out, and it is the right shape.
*Note, not filed:* `bySession.set` is unconditional under a LIFO `stack.pop()`, so on duplicate
session ids the **last-visited** node wins, whereas part 1's `collectNodesById` is first-wins. Both
are tenant-owned tree content and `node_id` is a path string, so nothing is fabricated and nothing
crosses a tenant; it is a benign inconsistency between two sibling walks, worth knowing if they are
ever unified.

**The lexical `seen` dedupe (`ask-arms.ts:99-105`) — UNPINNED, and load-bearing. ISS-169's sibling.**
Mutation M (mine): delete the two `seen` lines → **170 pass / 0 fail**. Nothing reddens, because every
fixture gives each session exactly one turn. It is not decorative: `rrfMerge` (`merge.ts:60-65`)
accumulates `scores.set(key, (scores.get(key) ?? 0) + 1/(k+i+1))` **per occurrence, with no
within-arm dedupe**, so a session with five matching turns would cast five lexical votes and could
outrank a session found once by all three arms. Removing `seen` is a silent ranking defect that no
test sees. Filed **ISS-170's sibling at medium** (`ISS-171`) — per `.claude/CLAUDE.md`'s severity
gate, medium is a ledger entry verified inside the next unit touching this file, not a unit of its
own. Worth recording alongside it: **`rrfMerge` itself has no within-arm dedupe defence**, so this
obligation now sits on every future caller; that is part 1's C3 territory and I am not re-opening a
byte-unchanged, twice-PASSed module over it.

**No third find.** I also checked whether the arms can be reached with a tree other than the
request's (`ask-v2.ts:123` passes the same `tree` object it was called with — no second lookup, no
cache) and whether an arm can mutate it (`sessionNodesById` only reads; the returned nodes are the
tree's own objects, and part 1's cycle-3 probe B6 already established `askV2` does not write through
them).

## 6 · Part 1's guarantees — intact, verified by git and by test

```
git diff ad6e7b7 HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts   → 0 lines
git diff b90e206 HEAD --stat -- packages/ask/src/merge.ts merge.test.ts             → empty
pnpm --filter @lkb/ask test                                                          → 50 pass / 0 fail
```

`ask-v2.ts`'s only change is the arms-fn **signature** (`(query)` → `(query, tree)`) and passing the
tree; the membership/resolution block below it is untouched, so cycle-3's resolve-don't-filter stands
and citations still resolve to the tree's own nodes. C3/C4 ride on a byte-identical `merge.ts` and
its cycle-1 mutations (tie-break, last-arm-wins, dedup-removal) are undisturbed — I did not re-run
them. **Mutation J re-derived**: swallow the vector failure (`failures.push(...)` → `void err`) →
**169 pass / 1 fail**, killing `C5: a FAILING vector arm still yields the lexical arm, and says why`.
Exactly the manifest's count, exactly the right test. C5's branch executes in the new module.

## 7 · Every criterion

| C | Verdict | Evidence I produced |
|---|---|---|
| C1 | **MET** | `router.ts`/`evaluator.ts` 0-line diff vs baseline. `git show --stat e2464fc` — 8 files, no `askV3`, no second `ask` entry point; the thunk seam intact at `ask-v2.ts:163`. |
| C2 | **MET** | §5 — arms emit only `bySession.get()` results resolved from the passed tree; mutation L pins the walk; the live probe (§3) shows a foreign-tenant session is dropped, not invented, even with a resolvable node planted for it. Part 1's resolution block byte-unchanged (§6). |
| C3 | **MET** | `merge.ts` byte-unchanged since the cycle-1 PASS; key still explicit and total over the arms (`keyOf: n => n.node_id`). |
| C4 | **MET** | As C3. The 0.891 reproduced **twice** to the digit across separate runs, which is the criterion's own stated purpose (a delta measured twice that differs is not a measurement). |
| C5 | **MET** | Mutation J re-derived, 169/1, right test. Plus `C5: a healthy run reports NO degradation` and `no embedder configured … is NOT a degradation` — the negative halves are present, so `degraded` still means something. Neither arm can throw: both are try/caught and the failures are joined, named per arm, into `degraded`. |
| **C6** | **FAILED** | §3. Mutation K → **170/170 green** with the boot-bound cross-tenant binding restored. Live probe clean, so code correct / proof absent. |
| **C7** | **FAILED** | §4. Measured policy ≠ shipped policy on the tree arm and the lexical depth; the regression's stated cause is a property of the non-shipping arm. Clauses 2–3 satisfied; clause 1 is not. |
| C8 | **MET (vacuous)** | Manifest claims `Issues addressed: none — roadmap feature work`. Confirmed against `qa/issues.jsonl`: no ledger row is claimed closed by e2464fc, so no corpus substitution is possible. D-015 not engaged. |
| C9 | **MET** | `pnpm -r typecheck` exit **0**, `pnpm -r test` exit **0**. `compete.ts` is not in the commit and still calls `askV2(question, tree, { ...deps.askDeps, tenantId })` at :72 with no arms — behaviour unchanged, which is exactly what C9 asks. `extraCandidateArmsFor` is optional on `AskRouteDeps`. *(Recorded, not charged: `/compete` therefore silently does **not** get the hybrid arms, so the two consumers now retrieve differently. C9 requires only that compete keep working, and it does — but a later unit measuring `/compete` should know.)* |
| C10 | **MET** | `npx depcruise --config .dependency-cruiser.cjs packages apps` → exit **0**, no violations (304 modules, 932 deps). `ask-arms.ts` lives in `apps/api` precisely because it needs `@lkb/index`/`@lkb/db`; `packages/ask` still imports neither, and `merge.ts` still imports nothing. |
| C11 | **MET** | Both gates by their own exit codes; no `lint:structure` wrapper. The other lane's `.goal/goal.json` was modified in the tree throughout and is not chargeable here. |

**Invariants.** **I1** holds — `router.ts`/`evaluator.ts` byte-unchanged, and no number was chased
(the maker refused to, which is the invariant working). **I2 does NOT hold** — mutations K and M each
prove a claimed property unpinned, one of them on the security-class criterion; that is the whole of
this FAIL. **I3** holds — a failed arm is reported per-arm by name and a healthy one is not, both
pinned. **I4** holds — 0.891 is not used to close `golden-set-redesign` or the `≥ 0.85` gate, and this
verdict records C7 as not met so it cannot be. **I5** holds at the data boundary and I verified it
live (§3), but only for the code as written — mutation K shows the invariant is not *defended* by any
test, which is why C6 fails rather than I5.

## 8 · What the maker should do (cycle 2)

Two things, neither of which is a weight tune:

1. **A named test on the BINDING, not the factory.** Drive `createAskRouter` with a recording
   `extraCandidateArmsFor`, assert it is invoked with the verified key's `tenantId` on each request
   and that two different keys produce two different bindings. Confirm it reddens under the hoist
   (mutation K). This is the C6 fix and it is one test.
2. **Make the 0.891 characterise what ships, or say precisely what it does not.** Cheapest honest
   version: match the shipped lexical depth in the harness, and write the tree arm's proxy status
   into the report's `retriever` string so the JSON itself carries the caveat. If the number moves,
   report where it moved — a *worse* number is still a discharge of C7.

Fold in **ISS-171** (the lexical `seen` dedupe) while touching `ask-arms.ts` — medium, one test.

The regression itself needs **no** action for this contract. Do not tune weights to raise 0.891.

## Commands re-run by this checker

```
node scripts/lib/mutate.mjs assert-clean                        → CLEAN (before and after every mutation)
pnpm --filter @lkb/api test                                     → 170 pass / 0 fail (clean baseline)
pnpm --filter @lkb/ask test                                     → 50 pass / 0 fail
pnpm -r typecheck                                               → exit 0
pnpm -r test                                                    → exit 0
npx depcruise --config .dependency-cruiser.cjs packages apps    → exit 0 (304 modules, 932 deps)
node scripts/eval-recall.mjs --retriever hybrid                 → 0.891 (82/92), control 0.217
node scripts/eval-recall.mjs --retriever vector                 → 0.935 (86/92), control 0.217
md5sum data/eval/recall-report*.json (before + after both runs) → heuristic report byte-stable
python miss-set diff of the two reports                         → 8 new / 4 recovered, by id
MUTATION I  arms query "system" not the request tenant          → 168 / 2  ✔ manifest exact
MUTATION J  vector failure swallowed                            → 169 / 1  ✔ manifest exact
MUTATION K  (mine) bind the arms at router construction, boot tenant → 170 / 0  ✖ NOTHING REDDENS
MUTATION L  (mine) sessionNodesById children walk removed       → 169 / 1  (covered)
MUTATION M  (mine) lexical `seen` dedupe removed                → 170 / 0  ✖ unpinned (ISS-171)
scripts/zz-checker-live-probe.mjs (mine, live 2-tenant Mongo probe, created → run → DELETED)
git diff ad6e7b7 HEAD -- packages/ask/src/{router,evaluator}.ts → 0 lines
git diff b90e206 HEAD --stat -- packages/ask/src/merge*.ts      → empty
grep -rn "extraCandidateArmsFor" --include=*.ts apps packages   → 2 hits, ZERO in tests
grep for 0.891 across the repo                                  → no uncaveated citation, no ≥0.85 PASS claim
```

All mutations restored via `mutate.mjs restore` and verified identical to HEAD; `assert-clean` green;
the two eval reports my runs rewrote were `git checkout`-ed back. Working tree left carrying only the
concurrent lane's `.goal/goal.json` and `qa/.last-tick`, which I did not touch.

---

# Verdict — hybrid-arms-binding (U1.5 part 2) — CYCLE 2

**Contract:** qa/contracts/hybrid-retrieval.md
**Manifest:** qa/manifests/hybrid-arms-binding.md (Fix cycle: 2 of max 3)
**Cycle checked: 2**
**Date:** 2026-09-09
**Checker:** Mode A + Mode D, fresh subagent, bound to `D:\KnowledgeBase`
**Commit under judgement:** `526e88b` (unit commit `ea5bd95`; part-1 baseline `ad6e7b7`)
**Dispatch context:** RECOVERY — the cycle-2 manifest sat at `ready-for-check` with only a
cycle-1 verdict on disk. Nothing from any earlier run was taken on trust; every number below is
one I produced myself at `526e88b`.

```
VERDICT: FAIL
SCOREBOARD: 10/11 criteria met, 4/5 invariants hold (I2 does not)
FAILURES:
- [C6] sev: high (security-class, NEVER round-capped) · the binding site is now genuinely pinned —
  but the DATA BOUNDARY still is not, and that is the half C6's own Verified-by actually names. A
  module-level cache of the tenant's `turns` or `chunks` inside `ask-arms.ts`, not keyed by tenant
  — one `??=`, the most ordinary perf change anyone would make to this file — leaves 173/173
  GREEN. The root cause is exact: `ask-arms.test.ts:65-66` asserts
  `a.queriedTenants.every(q => q.endsWith(":tenant-a"))`, and `[].every()` is `true`, so a cache
  that suppresses the second tenant's read entirely passes the assertion VACUOUSLY. The test also
  uses two SEPARATE db fakes and asserts on the query FILTER STRING, never on what came back —
  whereas C6 asks for a test "asserting tenant B's question never returns a candidate resolving to
  tenant A's session" · fix direction: one test, ONE db fake, two tenants whose chunks+turns both
  exist and whose sessions are both in the tree, asserting tenant B's arms contain only tenant B's
  node AND that the db was read at least once per tenant (kill the `.every()` vacuity explicitly);
  confirm it reddens under mutations R and S below · issue: ISS-179
ISSUES-WRITTEN: ISS-179 (new). ISS-169 → fixed, ISS-170 → fixed.
LIVE-BROWSER: qa/evidence/browser-hybrid-arms-binding-2026-09-09-checker/report.json (my own
  browser, my own clicks; the maker's PNGs were not read as verification)
EXPLANATION: Both cycle-1 failures are genuinely discharged and I verified each myself — the hoist
mutation that stayed green at cycle 1 now kills 3 tests, the cache variant kills 2, and the
corrected hybrid recall reproduces to the digit at 0.870 (80/92) against vector's 0.935, with the
report's own `retriever` string now naming the tree arm as the heuristic proxy. The unit fails on a
DIFFERENT leg of the same security-class criterion, found by the sibling hunt the dispatch asked
for: the binding is pinned, the corpus read is not. This is C6's third distinct unpinned path
(factory internals → binding site → data boundary), and C6 is explicitly never round-capped.
```

## 0 · What is new in this verdict, in one paragraph

Cycle 1 failed C6 and C7. **Both fixes are real and I re-derived both.** C7 is now MET. C6 fails
again, and I want to be precise that this is **not** the cycle-1 finding restated: mutation K —
the exact hoist that cycle 1 ran and that stayed 170/170 green — now kills **3 of 3** new tests.
What I found instead is the leg of C6 that neither cycle has covered: the shipped `ask-arms.ts`
reads the tenant's corpus, and **nothing asserts that what came back belongs to the tenant that
asked.**

## 1 · My mutation harness (D-020), and why the control matters

Written by me, repo-scoped, `timeout 600` on every test run, restore in a `finally` that fires on
timeout/interrupt/error, **every restore asserted SHA256-identical to the pre-mutation bytes**,
arm/restore through `scripts/lib/mutate.mjs`, and a final `git status --porcelain` +
`assert-clean`. Each mutant is additionally **asserted present in the file** before its run counts
— a check I added after the harness silently produced two no-op "mutants".

**The control earned its place twice in this session, which is the argument for the rule.**

1. Batch 2's control came back `tests: null`. Not a kill, not a survival — a broken parser (a
   heredoc had eaten a backslash, so `\d` was matching a literal `d`). Without a control I would
   have read three `null`s as three survivals and filed a security finding on a regex bug.
2. Batch 3's first attempt reported R and S as **survivors** when the load-bearing half of each
   edit had never applied — my needle used `\n` against a CRLF working copy, so only the harmless
   `let CACHE;` line landed. The `mutant_verified_present` assertion caught it. **A table without
   a control cannot distinguish a kill from a broken harness**, and mine was broken twice.

Every row below is from a run where the control was green and the mutant was verified present.

| # | mutation | file | result | reading |
|---|---|---|---|---|
| **CONTROL** | insert a no-op comment | `routes/ask.ts` | **173 pass / 0 fail / 0 cancelled** | harness can show green |
| **CONTROL3** | insert a no-op comment | `ask-arms.ts` | **173 / 0 / 0** | same, for the second file |
| **K** | hoist the bind to router construction, tenant `"system"` (**cycle 1's own mutation, which stayed green**) | `routes/ask.ts` | **170 / 3** | **ISS-169 FIXED** — kills all three new tests |
| **B** | bind lazily once, then reuse (the cheap wrong fix) | `routes/ask.ts` | **171 / 2** | matches the manifest exactly |
| **P** | bind *in front of* `requireScope`, so a refused caller binds a tenant | `routes/ask.ts` | **170 / 3** | the auth-ordering test is real |
| **T** | hardcode the LEXICAL read to `"tenant-a"` | `ask-arms.ts` | **172 / 1** | the filter assertion works — for this shape |
| **U** | hardcode the VECTOR read to `"tenant-a"` | `ask-arms.ts` | **172 / 1** | ditto |
| **N** | take the tenant from the **request body** instead of the verified key | `routes/ask.ts` | **173 / 0** | survivor (see §4, not charged) |
| **R** | module-level `CHUNK_CACHE ??=`, not keyed by tenant | `ask-arms.ts` | **173 / 0** | **SURVIVOR — ISS-179** |
| **S** | module-level `TURN_CACHE ??=`, not keyed by tenant | `ask-arms.ts` | **173 / 0** | **SURVIVOR — ISS-179** |

`0 cancelled` on every row: no timed-out test is hiding behind a `fail 0`. The working tree after
all runs carried only the concurrent lane's `.goal/goal.json` and `qa/.last-tick`; `assert-clean`
reports none outstanding.

## 2 · C6 — the third unpinned path, stated exactly

`ask-arms.test.ts:60-67`:

```ts
const a = fakeDb(); const b = fakeDb();
await createAskArmsFor({ embed: embedOk as never, db: a.db })("tenant-a")("q", TREE);
await createAskArmsFor({ embed: embedOk as never, db: b.db })("tenant-b")("q", TREE);
assert.ok(a.queriedTenants.every((q) => q.endsWith(":tenant-a")));
assert.ok(b.queriedTenants.every((q) => q.endsWith(":tenant-b")));
```

Two independent defects, and they compound:

1. **`[].every(...)` is `true`.** Under mutation S the second tenant's read never reaches the db,
   so `b.queriedTenants` is empty and the assertion passes without examining anything. Mutations T
   and U prove the assertion is not decorative — a *hardcoded wrong tenant* does die here. It is
   specifically the **absence** of a query that is invisible, and "the query didn't happen because
   something upstream is serving stale cross-tenant data" is precisely the failure mode C6 exists
   for.
2. **It asserts on the request, not the response.** Two separate `fakeDb()`s mean tenant A's rows
   and tenant B's rows never coexist in one corpus, so no assertion can be made — and none is —
   about tenant B's arms containing tenant A's session. C6's Verified-by is literal about this:
   *"a named test with two tenants whose chunks/turns both exist, asserting tenant B's question
   never returns a candidate resolving to tenant A's session."* That test does not exist.

**Is this in scope, or am I inventing a criterion?** It is the plainest reading of C6's own
verification clause, and the dispatch asked for exactly this hunt ("any other place a per-tenant
value could be captured once at boot and still pass"). A module-level cache is that place — not a
boot capture in `production.ts`, but a boot capture *inside the arms module*, reachable by the
single most natural optimisation anyone would apply to a function that does two unindexed
`find({}).toArray()` calls per request. `search-store.ts` already documents that the turns scan is
~663 ms unindexed; the pressure to cache it is real and near.

**Severity high, not critical, and the reason is on record:** the shipped code is correct. I did
not re-run cycle 1's live two-tenant Mongo probe — `ask-arms.ts` and `routes/ask.ts` are
**byte-unchanged** this cycle (`ea5bd95` touches neither), so that probe's result stands and there
is no live disclosure today. This is a proof-shaped hole where C6 put one, which is what **I2**
forbids.

## 3 · C7 — MET. I re-derived the number rather than reading it

Run by me at `526e88b`, against the live Mongo and the real embedding key:

```
node scripts/eval-recall.mjs --retriever hybrid → recall@5 = 0.870 (80/92) · control 0.217 · INFORMATIVE · 12 misses
node scripts/eval-recall.mjs --retriever vector → recall@5 = 0.935 (86/92) · control 0.217 · INFORMATIVE ·  6 misses
```

**0.870 to the digit, and the delta vs vector alone is −0.065**, exactly as the manifest states —
including that the correction moved the number **down** and **widened** the regression from −0.043.
A maker reporting a worse number than the one it had already banked is the behaviour C7 clause 4
protects, and it deserves to be said plainly rather than buried in a scoreboard.

Both cycle-1 defects are fixed in the source, not merely in the prose:

- **Lexical depth** — `scripts/eval-recall.mjs` now calls `lexicalSearchTurns(question, turns, kk)`
  where it called `kk * 4`, and the `.slice(0, kk)` that compensated is gone. That is the shipped
  depth.
- **The proxy is named in the artifact itself.** The report's `retriever` field, read by me out of
  `data/eval/recall-report-hybrid.json`, is now
  `hybrid (tree=HEURISTIC PROXY not the shipped selectNodes LLM arm; + cosine + lexical@k, RRF, gemini-embedding-001, 1452 chunks)`.
  A future reader of the JSON cannot miss it. That is precisely the discharge cycle 1's fix
  direction offered.

**The stated cause of the regression — the specific thing I was asked to judge.** Cycle 1 explained
the regression as *"the tree arm scores 0.391 … it is voting with almost the authority of noise"*,
which was a property of an arm that does not ship. Cycle 2 does **not** substitute a better-argued
cause; it **withdraws** the claim and writes *"It may still be true of `selectNodes`; I have no
evidence either way."* That is the correct response to the finding. The manifest now asserts no
cause at all, so there is no unsupported causal claim left to charge — and it is a better outcome
than a replacement story, which is what I was watching for.

**Citation hygiene (C7's own verification clause), re-grepped by me.** `0.891` survives nowhere as
a live claim; `0.870` appears only inside the report's own `reason` string and the manifest's
regression framing. `.goal/goal.json`, `docs/PROGRESS.md`, `TASKS.md` and `docs/DECISIONS.md`
carry **no** hybrid number, and every `≥ 0.85` occurrence in the repo is a statement that the
target is **not** met or may not be closed. No bare PASS claim exists. Clauses 1–4 all satisfied.

**Baseline integrity.** `data/eval/recall-report.json` md5 `de3c11aa95fb9f44f07afd18816bcb64`
before and after both of my runs — the heuristic baseline the delta is measured against was not
clobbered, which this harness has done before.

## 4 · The survivor I am NOT charging, and why

**Mutation N** — `const tenantId = req.body.tenantId ?? req.auth!.tenantId` — survives 173/173.
A caller-supplied tenant override is a cross-tenant read of the same class. I am leaving it in
EXPLANATION rather than FAILURES because it *adds* an override that no code path has, rather than
removing a guard that exists, and mutation evidence is weakest exactly there. It is worth one
extra line in the ISS-179 test (post a body carrying `tenantId: "tenant-b"` under tenant A's key
and assert the binding is still `tenant-a`), and I would rather the maker got it for free while
writing that test than burn a cycle on it. Flagging, not charging.

**ISS-171 (medium, cycle 1) is still open and still unpinned** — my mutation M (delete the lexical
`seen` dedupe) → 173/173. Per this repo's severity gate a medium is verified inside the next unit
touching the file; this cycle touched only the test file, so it correctly stays open. Not charged.

## 5 · Mode D — my own browser, my own clicks

`qa/evidence/browser-hybrid-arms-binding-2026-09-09-checker/report.json`, written alongside the
maker's and overwriting nothing. I did not read the maker's `ask.png`.

On `http://localhost:5173/ask` I typed the question, clicked Ask, and got a real grounded answer
(UKVI Basic Compliance Assessment, Enroly CAS Shield, NBFC lending caps) with
`INTERNAL SOURCES (1)` = `…session:2026-08-03-uk-beyond-offer-letters` and `WEB SOURCES (0)`; the
post-study-work half was declined rather than invented. **Then I clicked the citation** — the
maker only looked at it — and it navigated to a real session page rendering the real panel, 2
claims and a 46-turn transcript. One console error on the page: a `favicon.ico` 404, present on
every page of the web app and unrelated to this unit.

Two honest limits: the servers were **already running** and I could not stamp which commit they
serve (mitigated by this cycle changing no server-side source at all); and the API-served
`/compete` page returned **HTTP 401** because its prefilled demo key is stale — recorded as an
instrument limitation and not charged, since `/compete` passes no `extraCandidateArmsFn`
(`compete.ts:72`) and so never exercises this unit's arms at all.

## 6 · Every criterion

| C | Verdict | Evidence I produced at `526e88b` |
|---|---|---|
| C1 | **MET** | `git diff ad6e7b7 HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts` → empty. `ea5bd95` touches 6 files, none in `packages/ask`. |
| C2 | **MET** | Unchanged from cycle 1 (arms resolve only via `bySession.get()` from the passed tree). Live: the rendered citation resolved to a real 46-turn session (§5). |
| C3 | **MET** | `merge.ts` byte-unchanged since its own PASS; not touched by `ea5bd95`. |
| C4 | **MET** | Unchanged module; and the hybrid figure reproduced **exactly** across my run and the maker's, which is the criterion's stated purpose. |
| C5 | **MET** | Unchanged module; C5's named tests among the 173 green. |
| **C6** | **FAILED** | §2. Mutations R and S → **173/173 green** with a verified mutant and a green control. ISS-179. |
| C7 | **MET** | §3. 0.870/0.935 re-derived by me; shipped lexical depth in the source; proxy named in the report artifact; causal claim withdrawn; citation grep clean; baseline md5 stable. |
| C8 | **MET (vacuous)** | Manifest: `Issues addressed: none`. `ea5bd95` closes no ledger row by claim, so D-015's substitution rule is not engaged. |
| C9 | **MET** | `pnpm -r typecheck` exit **0**; `compete.ts` untouched and still arm-free, so its behaviour is unchanged, which is what C9 asks. |
| C10 | **MET** | `npx depcruise --config .dependency-cruiser.cjs packages apps` exit **0**. |
| C11 | **MET** | `pnpm -r typecheck` exit **0**, `pnpm -r test` exit **0**, by their own exit codes. |

**Invariants.** **I1** holds (router/evaluator byte-unchanged; no number chased — the maker
published a *worse* one). **I2 does NOT hold** — mutations R and S prove a claimed property
unpinned on the security-class criterion. **I3** holds. **I4** holds — 0.870 closes nothing, and
this verdict records the `≥ 0.85` gate as still open. **I5** holds in the code and, again, is
**not defended by any test at the data boundary** — which is why C6 fails rather than I5.

## 7 · Cycle 3 is the LAST — precisely what must land

**A cycle-3 FAIL means the unit STALLS.** One test discharges this. Nothing else is required and
nothing else should be attempted.

1. **The C6 data-boundary test.** ONE `fakeDb()`, not two. Seed tenant A's and tenant B's `chunks`
   and `turns` in it with distinct `sessionId`s, and put **both** sessions in the tree so a leaked
   hit could actually resolve rather than being silently dropped. Then:
   - assert tenant B's arms contain **only** tenant B's node (the response, not the filter);
   - assert `queriedTenants.length > 0` for each tenant — an explicit kill for the `.every()`
     vacuity, so a suppressed read can never pass again;
   - **confirm it reddens under mutations R and S** (module-level `CHUNK_CACHE ??=` /
     `TURN_CACHE ??=` in `ask-arms.ts`). Report both counts, with a no-op control.
2. **Free while you are there (§4), not required:** one extra assertion that a request body
   carrying `tenantId: "tenant-b"` under tenant A's key still binds `tenant-a` (kills mutation N).

**Do NOT** tune weights, do not re-measure recall, do not touch `merge.ts`, `router.ts` or
`evaluator.ts`. C7 is met and the regression needs no action for this contract.

## Commands re-run by this checker

```
pnpm --filter @lkb/api test                                   → 173 pass / 0 fail / 0 cancelled
pnpm -r typecheck                                             → exit 0
pnpm -r test                                                  → exit 0
npx depcruise --config .dependency-cruiser.cjs packages apps  → exit 0
node scripts/eval-recall.mjs --retriever hybrid               → 0.870 (80/92), control 0.217
node scripts/eval-recall.mjs --retriever vector               → 0.935 (86/92), control 0.217
md5sum data/eval/recall-report.json (before + after)          → de3c11aa… unchanged
git diff ad6e7b7 HEAD -- packages/ask/src/{router,evaluator}.ts → empty
git show --stat ea5bd95                                       → 6 files; no server-side source
grep 0.891 / 0.870 / 0.85 across md,json,ts,mjs               → no bare PASS claim, no uncaveated cite
own mutation harness (D-020): CONTROL, CONTROL3, K, B, P, T, U, N, R, S — table in §1
  every restore SHA256-identical · git status clean · mutate.mjs assert-clean green
live browser: localhost:5173/ask — typed, clicked Ask, CLICKED the citation through to the session
```
