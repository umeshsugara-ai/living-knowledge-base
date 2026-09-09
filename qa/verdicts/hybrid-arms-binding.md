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
