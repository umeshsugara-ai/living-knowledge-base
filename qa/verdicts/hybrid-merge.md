# Verdict — hybrid-merge

**Contract:** qa/contracts/hybrid-retrieval.md (FIRST use)
**Manifest:** qa/manifests/hybrid-merge.md
**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** Mode A, fresh subagent, bound to `D:\KnowledgeBase`
**Unit commit under judgement:** b90e206 (baseline ad6e7b7)

```
VERDICT: FAIL
SCOREBOARD: 8/11 criteria met, 4/4 applicable invariants hold (I5 not yet applicable)
FAILURES:
- [C2] sev: high · the merge emits any node a caller's arm supplies, including one absent from
  this tenant's loaded tree, and it becomes a citation with the whole suite green · guard at the
  seam: filter merged candidates through `treeSearchFn` against the loaded tree and add a named
  test that a foreign node never reaches `sources.internal` · issue: ISS-157
- [C6] sev: n/a (deferred, correctly disclosed) · nothing binds the seam, so tenancy is neither
  satisfied nor attackable here · belongs to the composition-root unit · issue: none
- [C7] sev: n/a (deferred, correctly disclosed) · no hybrid recall@5 was measured · belongs to the
  composition-root unit · issue: none
ISSUES-WRITTEN: ISS-157
EXPLANATION: The merge mechanism itself is the best-tested thing this maker has shipped — all
three claimed mutations re-derived exactly, C1 verified by git rather than by reading, and no
vacuous test found among the four new ask-v2 cases. It fails on a gap the maker did not disclose,
not on the split it did: a fabricated node injected through `extraCandidateArmsFn` ships as a
citation `tenant:t9/session:GHOST` while all 45 tests pass, which is precisely C2's stated
mutation. On the split itself I rule it LEGITIMATE — see below — so C6/C7 are recorded as deferred
rather than charged as defects, and this FAIL is one guard and one named test wide.
```

---

## The central judgement: is a merge without its measurement a legitimate unit?

**Yes — the split is legitimate, and I would have ruled the same way had C2 been clean.** Reasoning,
since either verdict was defensible:

The failure mode the prompt worries about is "an unmeasured mechanism accretes". That worry has
teeth when the split lets a *claim* ship without its check. Here the split does the opposite: the
manifest's first section is a refusal to claim, the commit message repeats it, and my grep of the
whole commit found **no** citation of `0.935`, no `≥ 0.85`, and no recall number of any kind. C7's
real hazard — U1.5 inheriting U1.4's number without the sibling-session caveat — is not merely
avoided, it is structurally unreachable in this commit. C7 clause 4 explicitly makes an honest
non-number acceptable for the recall arm; clause 1 makes a *borrowed* number unacceptable. This
unit is in the spirit of both.

The stronger reason is architectural, not rhetorical. Contract C6 requires the retriever to be
bound **per request with a real tenant**. C7 requires measuring hybrid recall on the real corpus.
Both of those are properties of the **composition-root binding**, and neither can be evidenced by
any amount of work inside `packages/ask` — which C10 forbids from importing `packages/index` at
all. So the alternative to this split is not "a measured merge"; it is one larger unit whose
tenancy criterion and whose recall criterion are checked in the same breath as its ranking
function. That is the shape this repo already has evidence against: ISS-078 was a cross-tenant
disclosure that survived four PASSes and 102 green tests inside exactly that kind of bundled unit.
A security-class criterion gets a **better** check when it is the headline of its own unit than when
it is criterion six of eleven in a unit whose interesting work is a sort comparator.

What makes the split safe rather than a loophole is that both deferred criteria are **loud on
disk**: C6 and C7 are named in the manifest, in the commit message, and now in this verdict, and
C6 is security-class and therefore never round-capped, so no cap can retire it unexamined. The
condition I attach: **the composition-root unit must be graded against C6 and C7 in full, and this
verdict is not precedent for a third split that defers them again.** If a part 3 appears still
owing C6, that is accretion and should be failed as such.

Where I do side with the prompt's worry: a split of a *contract's scope* should not also silently
reduce the scope of the criteria that stayed. C2 stayed, and C2 is where this unit actually
failed — which is a small vindication of the worry, in a different place than expected.

---

## 1 · Mutations re-derived (not trusted)

All three armed through `node scripts/lib/mutate.mjs apply`, restored through `restore`,
`assert-clean` green after each. Working tree ends clean apart from the other lane's
`.goal/goal.json`.

| # | Mutation | Manifest claim | **My result** | Dying test |
|---|---|---|---|---|
| A | tie-break dropped from the comparator (`merge.ts:66`) | 44/1 | **44 pass / 1 fail** ✔ | `DETERMINISTIC ORDER across identical scores — ties break on the key` |
| B | fusion → last-arm-wins (`scores.set(key, 1/(k+i+1))`) | 43/2 | **43 pass / 2 fail** ✔ | `an item found by TWO arms outranks one found once…`, `a lower-ranked item in two arms can beat a top-ranked item in one` |
| C | degradation report removed (`ask-v2.ts:110-113` deleted) | 44/1 | **44 pass / 1 fail** ✔ | `U1.5 / C5: a DEGRADED arm still answers, and the degradation is VISIBLE` |

Exact counts, exact tests. The maker's "three different failure counts, so three distinct
properties" reading holds.

**Three further mutations I ran that the manifest did not claim**, to test the parts nobody was
looking at:

| Mutation | Result | Reading |
|---|---|---|
| `firstSeen` overwritten by the last arm (score accumulation left intact) | 44/1 — `the FIRST arm's object survives a tie` | The representative-object behaviour is **independently** covered, not riding on mutation B |
| dedup removed entirely (return `arms.flat()`) | 40/5 — includes `DEDUPE is real — one item per key` | C3's stated dedup mutation reddens C3's stated test |
| degradation reported **unconditionally** (`if (true)`) | 44/1 — `an arm that RAN and found nothing is NOT logged as degraded` | The negative half of C5 is **not vacuous**; it is the only test that catches over-reporting |

## 2 · C1 — verified by git, not by reading

```
$ git diff ad6e7b7 HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts
(empty)
$ grep -rn "function ask\|finishAsk\|askV3\|internalSource" packages/ask/src apps packages --include=*.ts
```
No `askV3` anywhere in the repo. `finishAsk` and `internalSource` appear only at their pre-existing
definitions inside the byte-unchanged `router.ts`; nothing copies them. `apps/web/src/api/ask.ts`'s
`ask()` is the pre-existing HTTP client, untouched by this commit (`git show --stat HEAD` lists five
files, none of them in `apps/`). **C1 MET.**

## 3 · C2 — FAILED. The seam admits a node that is not in the tree

The maker did not address this, and it is the finding of the check. I wrote a throwaway probe
(created, run, deleted — the tree is clean):

```ts
const ghost = { node_id: "tenant:t9/session:GHOST", ..., summary: "Fabricated." };
await askV2("q?", TREE, {
  scoreFn: fakeScoreFn({ "tenant:t1/session:a": 0.1, "tenant:t9/session:GHOST": 0.95 }),
  extraCandidateArmsFn: async () => ({ arms: [[ghost]], degraded: null }), … });
```
```
PROBE internal sources: [{"node_id":"tenant:t9/session:GHOST"}]
```

The node is not in `TREE`. It is scored, it wins, and it is emitted as a citation. The whole
45-test suite stays green while this happens. The path: `ask-v2.ts:116` hands `rrfMerge`'s output
straight to the thunk → `router.ts:47` maps `evaluation.good_docs` through `internalSource` → out.
`merge.ts` is generic over `T` and structurally *cannot* check; `ask-v2.ts` has `treeSearchFn`
injected and already does exactly this lookup for the tree arm, but never applies it to the extra
arms.

**Is this the caller's obligation?** I judge not, for two reasons.

1. **The contract puts it here.** C2 is stated about "the merged thunk", and its Verified-by asks
   for a *named test* to redden on exactly the mutation I ran. None does. C2 is unevidenced on its
   own terms, and I2 is explicit that a test sitting near the code is not coverage.
2. **The ghost carried a foreign tenant prefix.** Today there is no live exploit — nothing binds
   the seam (see §4) — so I have **not** classed this critical. But the next unit's whole job is to
   put a real, network-fed retriever behind this parameter, and the merge is the last boundary at
   which node identity is fixed before a citation is minted. `packages/ask` cannot verify tenancy;
   it *can* verify tree membership, which is cheap, local, and would have caught the ghost. Leaving
   it to the caller means the only defence against a citation to a session the requester cannot see
   is that the arm-builder was written correctly — and I5 exists in this contract precisely to say
   that tenant scoping is a property of the query, "not of the caller's good behaviour".

Filed **ISS-157 (high)** with the reproduction and a fix direction. Severity high, not critical:
no path reaches it in shipped code today.

## 4 · C6 — the maker's disclosure is TRUE, and this unit creates no cross-tenant path

Verified rather than accepted:

```
$ grep -rn "extraCandidateArmsFn\|rrfMerge" --include=*.ts . | grep -v node_modules
```
Every hit is in `packages/ask/src/{ask-v2.ts, ask-v2.test.ts, merge.ts, merge.test.ts}`. **Zero hits
under `apps/`.** `production.ts` is not in the commit's file list at all. So:

- nothing constructs a retriever at boot, and no `scopedCollection` handle is captured anywhere by
  this unit — the specific disclosure shape C6 names as a cross-tenant read;
- there is no live tenant path to attack, which is why C6 cannot be *credited* either;
- the parameter's shape (`(query) => Promise<…>`, a closure the root builds) is at least *compatible*
  with per-request binding, but a compatible shape is not evidence and I have not scored it as any.

**C6 is neither met nor violated; it is deferred, and it is security-class, so no round cap may
retire it.** It must be the headline criterion of the binding unit.

## 5 · Unreachable-path hunt (six found across this maker's units; a seventh looked for)

Probed the three surfaces named in the dispatch plus two of my own:

- **`firstSeen` representative object** — covered. The isolated mutation (overwrite with the last
  arm, leaving scoring intact) kills exactly one named test. Not riding on another mutation.
- **The empty-arm path** — covered three ways: `withEmpty` vs `without` deep-equal in `merge.test.ts`,
  `rrfMerge([])` / `rrfMerge([[],[]])`, and the ask-v2 `arms: [[]]` case.
- **Vacuous new ask-v2 tests** — none found. I specifically suspected
  `an arm that RAN and found nothing is NOT logged as degraded` of being unfalsifiable (with
  `degraded: null` the branch is unreachable regardless of the arm's contents, so it looked
  indistinguishable from the fourth test). It is not: the inverse mutation `if (true)` reddens it
  and **only** it. It is the sole guard against over-reporting degradation.
- **The `arms: []` vs `arms: [[]]` distinction** — behaviourally identical and both exercised; no gap.
- **The one path that IS uncovered** is §3's, and it is the seventh: found by a mutation, invisible
  to 45 green tests. The pattern holds.

## 6 · Remaining criteria

| C | Verdict | Evidence I produced |
|---|---|---|
| C3 | **MET** | `DEDUPE is real` test present; dedup-removal mutation reddens it (40/5). Key is explicit (`keyOf` injected), documented (module header), and total over the arms as typed. The refusal to implement plan §10's literal "deduped by turnId" is correct and the contract had already said so independently. |
| C4 | **MET** | Mutation A; plus `a`/`b` deep-equal across reordered inputs. Formula pinned by the `2/(k+1)` test. |
| C5 | **MET** | Mutation C (positive half) + `if (true)` mutation (negative half). Both halves independently load-bearing. Degradation names the arm and the reason (`/embedding failed/` asserted). |
| C6 | **deferred** | §4. Not credited. |
| C7 | **deferred** | §"central judgement". No number cited anywhere in the commit; grep for `0.935` / `0.85` / `recall` over `git show HEAD` returns only the honest "ships NO recall number" note. |
| C8 | **MET (vacuous)** | Manifest claims `Issues addressed: none`; confirmed against the ledger — no `fix_direction` in `qa/issues.jsonl` is claimed closed by this commit. No corpus substitution possible. |
| C9 | **MET** | `pnpm -r typecheck` exit **0**. `pnpm -r test` exit **0**. `compete.ts` untouched (not in the commit). Named test `with NO extraCandidateArmsFn, behaviour is unchanged` present and asserts the pre-existing shape. The optional-dep pattern follows `tavilySearchFn` as the contract requires. |
| C10 | **MET** | `npx depcruise --config .dependency-cruiser.cjs packages apps` → exit **0**, "no dependency violations found (302 modules, 923 dependencies cruised)". `merge.ts` imports **nothing** — verified by reading; it is pure and generic. |
| C11 | **MET** | Both gates judged by their own exit codes. No `lint:structure` involvement; the other lane's `.goal/goal.json` edit was present in the tree throughout and is not chargeable here. |

Invariants: **I1** holds (§2). **I2** holds as a discipline — every claimed property was mutation-proved
and I found the one place it had not been applied, which is charged to C2 rather than double-counted
here. **I3** holds (§C5). **I4** holds trivially — this layer produced no number. **I5** is not yet
applicable: no retrieval arm exists to filter. Applicable invariants 4/4.

## 7 · Contract usability — first-use assessment (asked for, and cheapest now)

**Overall: the strongest contract in this repo so far.** The "Deliberately NOT criteria, and why"
section did real work — it is why I did not grade a latency budget, an RRF `k`, or arm weights, and
why I did not re-litigate the vector layer. The "Out of scope" list correctly kept me off
`router.ts` internals and off plan §10 prose. Every criterion names a file:line. Nothing grades a
layer this unit does not own. Nothing is redundant except a trivial overlap between C9's typecheck
clause and C11's.

Three things I would change, offered as **proposals, not applied** — amending a criterion while a
verdict on it is pending is the softening this skill forbids, so these should be decided after this
verdict settles:

1. **C2's Verified-by names an artifact the contract does not require to exist.** It says "make *the
   resolver* emit a node…", but the contract's own scope permits (and this unit chose) a design with
   no resolver in `packages/ask` at all — arms arrive pre-resolved. The *criterion* is exactly right
   and I failed the unit on it; the *verification clause* was momentarily unrunnable as literally
   written and I had to restate it as "make an arm supply a node absent from the tree". Suggested
   rewording: "*mutation — have an injected arm supply a node whose `node_id` is not present in the
   loaded tree, and confirm a named test reddens*". This is a clarification that makes C2 **harder**
   to satisfy, not easier.
2. **The contract has no vocabulary for a legitimately deferred criterion.** C6 and C7 are both
   properties of the composition-root binding and cannot be evidenced from inside `packages/ask`,
   which C10 seals off. As written the only available scoreboard entries are met/unmet, so a
   correctly-scoped half-unit reads as 8/11 and looks worse than it is. Suggested: mark C6 and C7
   `closes at: composition-root binding unit`, with a standing rule that a *second* deferral of
   either is a FAIL. That preserves the teeth (C6 stays security-class and uncapped) while letting
   a scoreboard mean what it says.
3. **C7 clause 4 is a policy, not a criterion.** "An honest FAIL with the number is an acceptable
   outcome" cannot be failed by any artifact — it is guidance to the *checker*, which is valuable and
   which I followed, but it sits in an acceptance-criteria list where every other line is falsifiable.
   Move it to the invariants or to a "how to grade this" note.

Nothing in the contract is unfalsifiable apart from that clause, and nothing grades outside this
layer. No amendment applied this cycle.

## 8 · What the maker should do (cycle 2)

One guard and one test — this is not a redesign:

1. In `ask-v2.ts`, after `rrfMerge`, restrict candidates to nodes resolvable in the tree loaded for
   this request (`treeSearchFn` is already injected and already does this lookup), and **report**
   anything dropped rather than dropping it silently — the same degrade-safe-but-loud stance C5
   already establishes, reused rather than reinvented.
2. Add a named test asserting a node absent from the fixture tree never reaches `sources.internal`,
   and confirm it reddens when the guard is removed.

C6 and C7 stay open for the composition-root unit and should not be attempted here.

## Commands re-run by this checker

```
git diff ad6e7b7 HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts   → empty
grep -rn "function ask\|finishAsk\|askV3\|internalSource" packages/ask/src apps packages
pnpm --filter @lkb/ask test        → 45/45 pass
pnpm -r typecheck                  → exit 0
pnpm -r test                       → exit 0
npx depcruise --config .dependency-cruiser.cjs packages apps → exit 0 (302 modules)
node scripts/lib/mutate.mjs apply|restore|assert-clean  × 6 mutations, all restored, clean
node --test --import tsx src/zz-checker-probe.test.ts   → C2 probe FAILS (ghost node cited)
grep -rn "extraCandidateArmsFn|rrfMerge" --include=*.ts . → no hits under apps/
git show HEAD | grep -inE "0\.935|0\.85|recall"          → no number claimed
```
