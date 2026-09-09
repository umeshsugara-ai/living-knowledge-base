# Verdict — hybrid-merge · CYCLE 2

**Contract:** qa/contracts/hybrid-retrieval.md
**Manifest:** qa/manifests/hybrid-merge.md (Fix cycle: 2)
**Cycle checked: 2**
**Date:** 2026-09-09
**Checker:** Mode A, fresh subagent, bound to `D:\KnowledgeBase`
**Unit commit under judgement:** a8c3dce (cycle-1 commit b90e206, baseline ad6e7b7)

```
VERDICT: FAIL
SCOREBOARD: 8/11 criteria met, 4/4 applicable invariants hold (I5 not yet applicable)
FAILURES:
- [C2] sev: high · the ISS-157 guard compares the node_id STRING, not the node: an arm supplying a
  REAL node_id with a fabricated summary and fabricated `evidence` still mints that citation — the
  emitted evidence carried a foreign tenant's `turn_id` and the poisoned summary reached the answer
  context, with all 47 tests green · resolve instead of filtering: map each surviving id back to the
  TREE's own node object (`treeSearchFn` is already injected and does exactly this lookup, and the
  ledger's own ISS-157 fix_direction named it), so an arm can only vote on ranking and never on
  content · issue: ISS-158
- [C6] sev: n/a (deferred, FIRST deferral still — verified, not accepted) · nothing binds the seam;
  zero hits for `extraCandidateArmsFn`/`rrfMerge` under `apps/` · issue: none
- [C7] sev: n/a (deferred, FIRST deferral still) · no recall number of any kind appears in this
  cycle's commit · issue: none
ISSUES-WRITTEN: ISS-158, ISS-159
EXPLANATION: The cycle-1 attack is genuinely dead — I re-ran it myself and the ghost no longer
reaches `sources.internal` — and both claimed mutations re-derived to the exact counts, including
mutation E, the one that would have caught a guard that "passes by doing nothing". The unit fails on
a variant of the same attack: `collectNodeIds` builds a Set of id STRINGS, so a fabricated node
wearing a real node_id survives the filter as its own object, and `router.ts:33-35` copies its
`evidence` verbatim into the citation. The fix the cycle-1 verdict and the ledger both asked for —
resolve through `treeSearchFn` — closes ISS-157 and this as one class; the id-set filter closes only
the exact string the probe used.
```

---

## 1 · Did the cycle-1 attack actually die? Yes — reproduced independently

I wrote my own probe (`packages/ask/src/zz-checker-probe2.test.ts`, created → run → deleted; the
tree is clean and `mutate.mjs assert-clean` is green). I did not run the maker's test as evidence.

| # | Attack | Result |
|---|---|---|
| **A1** | plain ghost `tenant:t9/session:GHOST`, absent from the tree, FOREIGN tenant prefix, scored 0.95 | **BLOCKED.** `sources.internal: []`, verdict `incorrect`. The cycle-1 exploit is dead. |
| **A2** | **id collision** — `node_id: "tenant:t1/session:b"` (real id, a session `selectNodes` did **not** return) with `summary: "POISONED SUMMARY from another tenant."` and `evidence: [{turn_id:"tenant:t9/turn:X", text:"FABRICATED EVIDENCE"}]` | **ADMITTED.** See §2. |
| **A3** | ghost nested as a `children` entry of a supplied real node | **BLOCKED** as a citation — only the parent is a candidate; children are not walked out of arm objects, and `InternalSource` carries no children. No finding. |
| **A4** | a **legitimate** deep node (`tenant:t1/session:c/turn:1`, depth 2) supplied by an arm | **ADMITTED**, correctly — cited and answered from. The guard is not over-strict on depth (§4). |

A1 is what the manifest claims and it is true. A2 is what it does not claim.

## 2 · C2 — FAILED. The guard checks the id, not the node

```
### A2 id-collision ghost (real id, fake content/evidence)
  internal: [{"node_id":"tenant:t1/session:b",
              "evidence":[{"turn_id":"tenant:t9/turn:X","text":"FABRICATED EVIDENCE"}]}]
  verdict: correct
  scored nodes: [... {"id":"tenant:t1/session:b","sum":"POISONED SUMMARY from another tenant.","sc":0.95}]
```

Mechanism, three lines deep:

1. `ask-v2.ts:140-141` — `const known = collectNodeIds(tree); candidates = merged.filter(n => known.has(n.node_id))`. The predicate is a **string membership test**. The object that passes it is still the **arm's** object.
2. `merge.ts:52-61` — `firstSeen` keeps the first occurrence. The tree arm is only `selectNodes`' *subset* of the tree, so any id that is real but **unselected** is first seen from the extra arm. The arm's object is the representative.
3. `router.ts:33-35` — `internalSource` copies `node.evidence` into the citation verbatim, and `ask-v2.ts:171/174` joins `scored[].node.summary` into the context the answer is generated from.

So the citation's `node_id` is real, and everything a reader would actually *read* — the evidence text, its `turn_id`, the summary — came from the arm. The `turn_id` I injected names tenant t9. This is C2 on its own terms ("resolved to nodes that exist in **this tenant's loaded tree**, never fabricated" — the *node* is fabricated, only its label is not) and I5 on its own terms (tenant scoping is not a property of the caller behaving well).

**Why the maker missed it, precisely.** Not laziness and not a coverage gap in what was pinned — mutations D and E both re-derive exactly (§3). It is the **wrong invariant pinned**: "no unknown id is cited" instead of "every cited node IS the tree's node". The cycle-1 verdict §8 asked for the second ("restrict candidates to nodes **resolvable** in the tree loaded for this request — `treeSearchFn` is already injected and already does this lookup"), and ISS-157's recorded `fix_direction` repeated it. A Set of strings is the cheaper reading of the same sentence, and it closes exactly the one probe that had been run against it.

**Severity high, not critical**, on the same reasoning as ISS-157: nothing binds the seam yet (§4), so there is no live path. It is security-class and therefore **not round-capped** — this is round 2 on this criterion and the cap does not apply.

## 3 · Mutations re-derived (not trusted)

All armed via `node scripts/lib/mutate.mjs apply`, restored via `restore`, `assert-clean` green.
Clean baseline: **47 pass / 0 fail** (matches the manifest).

| # | Mutation | Manifest claim | **My result** | Dying test(s) |
|---|---|---|---|---|
| D | guard removed (`candidates = merged`) | 46/1 | **46 pass / 1 fail** ✔ | `ISS-157 / C2: a node an ARM invents can never become a citation` |
| E | guard → ignore the arms (`candidates = treeCandidates`) | 45/2 | **45 pass / 2 fail** ✔ | `U1.5: extra arms are merged into the candidates…`, `ISS-157 / C2: the guard does not drop LEGITIMATE arm nodes that are in the tree` |

**E is the one that matters and it is genuinely pinned.** The cheap wrong fix — silently ignoring the
arms, which satisfies "no ghost is cited" while disabling the whole feature — reddens two named
tests, one of which exists specifically for it. That is the failure mode this repo keeps shipping,
and the maker pinned it without being asked twice. Credit where it is due.

`merge.ts` / `merge.test.ts` are byte-unchanged since b90e206 (`git diff b90e206 HEAD --stat` empty),
so cycle 1's mutations A/B/C still stand and I did not re-run them.

**One further mutation of my own** (F): delete `for (const c of n.children ?? []) stack.push(c)` from
`collectNodeIds`, i.e. make the walk non-recursive → **43 pass / 4 fail**. The children walk is
covered; it is not a decorative loop.

## 4 · C6 / C7 — still the FIRST deferral, and scope was not widened

The cycle-1 condition was that a **second** deferral of either is accretion. Verified this is not one:

```
$ git show --stat a8c3dce      → 3 files: ask-v2.ts, ask-v2.test.ts, qa/manifests/hybrid-merge.md
$ grep -rn "extraCandidateArmsFn|rrfMerge" --include=*.ts apps packages | grep -v node_modules
                               → zero hits under apps/
$ git show HEAD~1 --format="" | grep -inE "0\.935|≥ ?0\.85|recall"   → no output
```

Nothing binds the seam; no composition root was touched; no recall number, no `0.935`, no `≥ 0.85`
is claimed anywhere in the commit. This is the **same unit, same first deferral, narrower not wider**
— cycle 2 added a guard and two tests and changed nothing else. C6 and C7 remain neither met nor
violated, remain loud on disk, and C6 remains security-class and uncapped. The cycle-1 condition
still binds the composition-root unit.

## 5 · Unreachable-path hunt — the eighth

Seven had been found across this maker's units, each by a mutation and none by a passing suite.
**A2 is the eighth**, and it is the second consecutive one to sit in the gap between a criterion and
the mutation someone wrote for it: cycle 1 asserted everything about *ordering* and nothing about
*membership*; cycle 2 asserted membership of the *id* and nothing about the *node*. The pattern is
not "the maker forgets to test" — mutation coverage here is better than anywhere else in the repo —
it is that the pinned property is one refinement behind the attack.

Also probed and found **covered**: the `children` walk (mutation F, 43/4); the deep-node path (A4);
the legitimate-arm path (mutation E). Found **uncovered besides A2**: the silent drop, §6.

## 6 · A second finding — dropped nodes are dropped silently (ISS-159, medium)

`ask-v2.ts:140-141` filters with no counter, no `recordJob`, no `auditLog` entry — while the code
**four lines above it** writes `ask.retrieval_degraded` precisely so that "answered from fewer arms"
cannot look identical to "answered from all arms". In probe run A1 the entire extra arm was rejected
and the audit log was indistinguishable in kind from a healthy run. A vector index misconfigured to
another tenant's namespace would return 100% rejected nodes and read as perfectly healthy.

ISS-157's own recorded `fix_direction` asked for this ("report any dropped node the way a degraded
arm is reported rather than silently"). It was not implemented and it was not named-with-a-reason in
the manifest. I3 says availability is degraded, never faked. Filed **medium**, not charged as a
separate criterion failure — C5's text scopes itself to `vectorSearchFn` throwing — and it should be
folded into the ISS-158 fix, which touches the same three lines.

## 7 · Remaining criteria

| C | Verdict | Evidence I produced this cycle |
|---|---|---|
| C1 | **MET** | `git diff ad6e7b7 HEAD -- packages/ask/src/router.ts packages/ask/src/evaluator.ts` → 0 lines. Cycle 2's commit touches 3 files, none of them `router.ts`/`evaluator.ts`. No `askV3`. |
| C2 | **FAILED** | §2. |
| C3 | **MET** | `merge.ts`/`merge.test.ts` byte-unchanged since the cycle-1 PASS of this criterion. |
| C4 | **MET** | as C3. |
| C5 | **MET** | as C3 for the merge; the ask-v2 degradation path is unchanged this cycle and mutation F reddens the C5 test, confirming it still executes. See §6 for the adjacent gap I did **not** charge here. |
| C6 | **deferred (1st)** | §4. Not credited. |
| C7 | **deferred (1st)** | §4. Not credited. |
| C8 | **MET** | The manifest claims `Issues addressed: ISS-157`. ISS-157's ledger row records exactly one reproduction — the `tenant:t9/session:GHOST` node scored 0.95 through `extraCandidateArmsFn`. The new named test re-runs it **verbatim** (same id, same shape, same scoring), not a substituted corpus: **ISS-157: 1/1 recorded reproduction refused**, re-derived by me in probe A1. No self-authored corpus was swapped in. D-015 satisfied. |
| C9 | **MET** | `pnpm -r typecheck` exit **0**, `pnpm -r test` exit **0**, `compete.ts` untouched; the `with NO extraCandidateArmsFn` test still green (it is one of the two E kills, so it is live). |
| C10 | **MET** | `npx depcruise --config .dependency-cruiser.cjs packages apps` → exit **0**, "no dependency violations found (302 modules, 923 dependencies cruised)". `collectNodeIds` is local and imports nothing — the right call given C10. |
| C11 | **MET** | Both gates by their own exit codes, no `lint:structure` wrapper. The other lane's `.goal/goal.json` modification was in the tree throughout and is not chargeable here. |

Invariants: **I1** holds (C1 by git). **I2** holds as discipline — every claimed property was
mutation-proved, and the one property that was *not* pinned is charged to C2 rather than
double-counted. **I3** holds for the arm-failure path; strained by §6, filed as ISS-159. **I4** holds
trivially — no number. **I5** not yet applicable (no retrieval arm exists), though A2 is what it will
look like when it is.

## 8 · What the maker should do (cycle 3 — the last of max 3)

One change, and it is smaller than the one it replaces:

1. In `ask-v2.ts`, **resolve rather than filter**. Build `Map<string, TreeIndexNode>` in the walk
   `collectNodeIds` already performs (or call `treeSearchFn(tree, merged.map(n => n.node_id))`), and
   emit **the tree's node object** for each surviving id. An arm then votes on ranking only and can
   never contribute content — which closes ISS-157 and ISS-158 as one class rather than one string
   comparison at a time.
2. Add a named test: an arm node whose `node_id` is real but whose `summary`/`evidence` differ from
   the tree's is **replaced by the tree's node** in `sources.internal` and in the answer context.
   Confirm it reddens when resolution is reverted to a filter.
3. Fold in ISS-159 while there: one audit entry when `merged.length !== candidates.length`, reusing
   the C5 mechanism.

C6 and C7 stay open for the composition-root unit and must not be attempted here.

## Commands re-run by this checker

```
pnpm --filter @lkb/ask test                                   → 47 pass / 0 fail (clean baseline)
pnpm -r typecheck                                             → exit 0
pnpm -r test                                                  → exit 0
npx depcruise --config .dependency-cruiser.cjs packages apps  → exit 0 (302 modules, 923 deps)
git diff ad6e7b7 HEAD -- packages/ask/src/{router,evaluator}.ts → 0 lines
git diff b90e206 HEAD --stat -- packages/ask/src/merge*.ts    → empty
git show --stat a8c3dce                                       → 3 files, none under apps/
grep -rn "extraCandidateArmsFn|rrfMerge" --include=*.ts apps packages → no hits under apps/
git show HEAD~1 | grep -inE "0\.935|≥ ?0\.85|recall"          → no output
mutate.mjs apply|restore|assert-clean  × 3 (D, E, F)          → all restored, clean
npx tsx --test src/zz-checker-probe2.test.ts (own probe, 4 attacks, deleted after)
```


---

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
