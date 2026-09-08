# Verdict — search-prefilter

**VERDICT: PASS**

**Cycle checked:** 1
**Date:** 2026-09-08
**Contract:** `qa/contracts/search-route.md`
**Manifest:** `qa/manifests/search-prefilter.md` (Status `ready-for-check`, Fix cycle 1)
**Project root:** `D:\KnowledgeBase` (bound; every path read or written resolves inside it)
**Mode:** A — fresh context, no builder reasoning. Every verify command re-run by this checker.

```
VERDICT: PASS
SCOREBOARD: 15/15 criteria met, 5/5 invariants hold (C1-C15, I1-I5; I6 added by this check)
FAILURES: none
ISSUES-WRITTEN: ISS-072 (high, coverage gap — non-blocking), ISS-073 (low, recorded bound)
EXPLANATION: The central claim — that a `$or` substring pre-filter over `lexicalQueryTokens`
is a guaranteed superset of the scoring set — is sound, and I verified it three independent
ways rather than accepting the argument: by deriving it from the source, by reproducing the
maker's mutation, and by a live read-only parity run against real Mongo over nine queries
(the maker's six plus three adversarial ones I added). All nine matched on turnIds AND
scores. Two findings do not block the PASS: nothing in the test suite pins the STORE's
consumption of the tokenizer (ISS-072 — I reintroduced the exact defect this unit exists to
prevent, in the shipping file, and all 148 tests stayed green), and the superset argument has
a narrow Unicode case-folding hole with zero occurrences in the real corpus (ISS-073). I
disagree with the maker's headline number but not its conclusion: I measured ~17%, not ~30%.
```

---

## 1. The central claim: is the superset argument actually sound?

**Yes — and it is a property, not a coincidence, exactly as the manifest argues.** I derived it
myself from source rather than accepting the manifest's reasoning.

The chain, with each link checked:

| Link | Verified how | Holds? |
|---|---|---|
| Scorer gives `score > 0` **only** on a whole-token match | `lexical.ts:59-64` — `turnTokens.has(t)` on a `Set` built by `tokenize`; `if (score > 0)` gates every push | Yes |
| Filter tokens **are** the scorer's tokens | `lexical.ts:43-45` — `lexicalQueryTokens` is `[...tokenize(query)]`, the same *private* `tokenize` at `lexical.ts:23`, spread with **nothing** filtered, mapped, or dropped | Yes |
| `q ∈ tokenize(text)` ⟹ `q` is a substring of `text.toLowerCase()` | True by construction: `tokenize` produces its members *by splitting the lowercased string* | Yes |
| substring of `text.toLowerCase()` ⟹ Mongo `/q/i` matches `text` | True for ASCII `q`. **One bounded exception** — see §1.2 | Yes, with a stated bound |
| Extras the filter admits are harmless | They score 0 and are dropped by the same `score > 0` gate (contract C2) | Yes |

### 1.1 Does it depend on using the scorer's own tokenizer? Yes — and more precisely than the manifest states.

The strict requirement is `filterTokens ⊇ scorerQueryTokens`. Sharing the tokenizer gives
*equality*, which is sufficient. This matters for how a future editor can safely change it:

- **Adding** tokens to the filter list is safe (still a superset — just more 0-scoring extras).
- **Removing** any token is a silent correctness break.

So the invariant is not "use the same tokenizer" but "never *reduce* the token list" — the same
tokenizer is simply the cleanest way to guarantee it. I have written that distinction into the
contract as **[I6]** rather than leaving it as prose in a manifest, because a future editor
reading only "same tokenizer" might reasonably think adding a stopword filter to *both* sides is
safe. It is not: dropping `in`/`AI` from both sides changes the *answers*, not just the fetch.

### 1.2 I tried to break it. Here is the one place it breaks.

I attacked each vector the dispatch named:

- **Case sensitivity (`$options: "i"` vs `toLowerCase`)** — safe in the ASCII range, which is the
  only range tokens can occupy (below).
- **Unicode / accented characters** — **safe, for a non-obvious reason.** `tokenize` splits on JS
  **non-unicode** `\W+`, i.e. `[^A-Za-z0-9_]`. So `é`, Devanagari, CJK are all *separators* and
  can never appear inside a token. `"café"` tokenizes to `["caf"]` on both sides. Verified live:
  the query `café` returned identical results (0 hits) on both paths, and `İnvestment` returned
  identical 10-hit results.
- **Tokens that are substrings of other tokens** — safe by design. A filter that over-matches
  (`it` matching `with`, `visit`) is exactly the "extras score 0 and get dropped" case. Verified
  live with the query `"IT"`: identical on both paths.
- **Regex metacharacters** — `escapeRegex` (`search-store.ts:14-16`) escapes
  `` . * + ? ^ $ { } ( ) | [ ] \ `` — **complete for Mongo's PCRE dialect**. `-` and `#` are
  context-only (char-class / `/x` mode, neither in play), and `/` is not a delimiter because the
  pattern is passed as a *string*. The `$&` replacement is correct. Doubly safe in practice since
  tokens are `[A-Za-z0-9_]` only — but the escaping must stay, as it is what makes the property
  survive a future tokenizer change. Verified live: `"c++"` identical.
- **Mongo regex vs JS `String.includes` divergence — THE ONE REAL HOLE.** JS `toLowerCase()`
  performs full Unicode case mapping; Mongo's `$options: "i"` is ASCII-only. They disagree for
  characters whose lowercase mapping *crosses into* ASCII:
  - `'\u0130'` (Latin capital I with dot above) → JS lowercases to `'i' + U+0307`. A turn reading
    `İnvestment` therefore tokenizes to `['i','nvestment']` (U+0307 is `\W`, so it splits) and
    **would be scored** for query token `i` — but Mongo's `/i/i` matches neither `i` nor `I` in
    the raw stored text, so the turn is **never fetched**. A silent miss.
  - `'\u212A'` (Kelvin sign) → `'k'`, same effect.

  **Live impact today: zero.** Read-only probe of the real `toc` tenant (2118 turns):
  `countDocuments({text:{$regex:'\u0130'}})` = **0** and the same for `\u212A` = **0**. (51 turns
  do carry other non-ASCII characters — none hazardous, since they can never produce a token.)

  This is filed as **ISS-073 (low)** and recorded as a stated bound on the new contract invariant
  I6, not as a defect to fix. The fix (NFKC-normalizing `text` at ingest) costs more than the
  hazard at a zero-occurrence rate. I am recording it because I6 now states the guarantee as a
  rule, and a rule should carry its own exceptions rather than have them rediscovered.

**Bottom line: the manifest's reasoning is correct and correctly identifies its own load-bearing
assumption.** It is a genuinely better piece of reasoning than "I tried some queries and they
matched" — the manifest says so, and it earned it.

---

## 2. Checklist items 1-3: source reads and re-run commands

### Item 1 — `packages/index/src/search/lexical.ts`

Confirmed. `lexicalQueryTokens` (line 43-45) is `return [...tokenize(query)]` — the same private
`tokenize` at line 23 the scorer calls at line 56. **Nothing is filtered, sorted, mapped,
lowercased twice, or dropped.** The scorer function body itself is byte-unchanged
(`git diff HEAD` shows the new function as a pure *insertion* above `SearchableTurn`) — so
"ranking is unchanged" is structurally true, not merely tested. The file still has **zero
imports**, so contract C1/I1 (purity) survive the addition.

### Item 2 — `apps/api/src/search-store.ts`

| Requirement | Evidence | Result |
|---|---|---|
| ALL tokens used, not length-filtered | line 48: `const tokens = lexicalQueryTokens(query);` — no `.filter`, no `.slice` | ✅ |
| Each token regex-escaped | line 54: `$regex: escapeRegex(t)` on every clause | ✅ |
| Escaping correct/complete for Mongo's dialect | line 15: `/[.*+?^${}()|[\]\\]/g` → `"\\$&"`. Analysed above — complete | ✅ |
| Empty-token case returns `[]`, never `$or: []` | lines 52: `if (tokens.length === 0) return [];` **before** the query is built | ✅ |
| Tenant scoping survives the new filter | `withTenant` (`tenantScope.ts:16-18`) does `{...filter, tenantId}` → `{$or:[...], tenantId}`, i.e. AND semantics. Confirmed live: 2118 turns is the `toc`-scoped count | ✅ |
| C9 — exactly one `turns` query | line 53, one `find(...).toArray()`; no `turns` call in the per-hit map (lines 65-71) | ✅ |
| C10 — session dedup | line 62: `[...new Set(scored.map((s) => s.sessionId))]`, one `Promise.all` over the deduped array | ✅ |
| C11 — per-hit null safety | lines 69-70: `?? null` on both | ✅ |
| I5 — read-only | only `.find()` and `.findOne()` reach the DB | ✅ |

One **non-blocking observation** (not a failure, not filed): line 54's `as never` cast defeats the
typed `Filter<Turns>`. A future typo (`txt` for `text`) would compile and silently match nothing.
Given the codebase's typed-accessor discipline elsewhere, this is a small hole — but the cast is
genuinely needed to express `$or` against the scoped accessor's signature, and ISS-072's proposed
test closes the same blast radius more cheaply. Noted, not charged.

A quiet **improvement** the manifest did not claim: on the old path a turn with a missing/non-string
`text` reached `tokenize(undefined)` and threw a `TypeError` (a 500). On the new path such a doc is
never fetched. Strictly more robust.

### Item 3 — commands, all re-run by this checker

| Command | Expected | **My actual result** |
|---|---|---|
| `pnpm -r typecheck` | exit 0 | **exit 0**, all 10 workspace projects `Done` ✅ |
| `pnpm --filter @lkb/index test` | 59/59 | **tests 59, pass 59, fail 0** ✅ |
| `pnpm --filter @lkb/api test` | 89/89 unchanged | **tests 89, pass 89, fail 0** ✅ |
| `pnpm lint:structure` | clean incl. lint-loc | **all 8 gates OK** ✅ |

`lint:structure` detail: `lint-loc: OK (238 files within budget)` · `lint-dirsize: OK (75 dirs)` ·
`lint-root: OK (15 loose root files)` · `lint-dupes: OK (255 exports, 24 schema $ids)` ·
`lint-migrations: OK (1137 files)` · `SNAPSHOT.md matches a fresh regeneration (116 lines/200)` ·
`tracker-audit: OK (gate G1)` · `depcruise: 0 violations across 260 modules, 777 dependencies`.

**LOC claim independently re-derived** (`awk 'NF' | wc -l`): `apps/api/src/store.ts` is now
**257** non-blank lines, and `git show HEAD:apps/api/src/store.ts` is **281**. The manifest's
"257" is exact. Its "315" describes a transient uncommitted state I cannot and need not verify;
it is not load-bearing, and 281 → 257 is precisely the 24 non-blank lines of the removed search
block.

---

## 3. Item 4 — mutation test, independently reproduced

Backed up `lexical.ts`, applied the mutation with an assertion that the target string occurred
exactly once, and **proved the file genuinely changed via `diff` against the backup**:

```
44c44
<   return [...tokenize(query)];
---
>   return [...tokenize(query)].filter((t) => t.length > 2);
```

Result — `npx tsx --test packages/index/src/search/lexical.test.ts`:

```
✔ ranks a matching turn above a non-matching one
✔ a turn with zero query-term overlap is excluded, not scored 0
✔ k limits the result count
✔ an empty query returns no hits, never a match-all
✔ scores are in [0, 1]
✔ results are sorted descending by score
✔ lexicalQueryTokens uses the SAME tokenization the scorer scores with
✖ short tokens are KEPT — dropping them silently loses real hits (measured regression)
✖ PROPERTY: every turn the scorer can score is reachable by a substring pre-filter on these tokens
ℹ tests 9 · pass 7 · fail 2
```

**Exactly 7/9, and exactly the two named tests reddened** — as claimed. The PROPERTY test's failure
message is the right one, naming the real consequence:

> `"is it ok to go" scored turn t5 at 1, but no pre-filter token appears in its text — a Mongo pre-filter would MISS this hit`

Worth noting for the maker's credit: the *third* new test ("uses the SAME tokenization") stayed
**green** under this mutation, because its fixture words are all >2 chars. So the two tests that
reddened are the two doing the real work, and the property test is not redundant with the
regression test — it fails on a *different* query and for a *structural* reason.

Restored from backup, `diff` confirms **byte-identical**, re-ran: **9/9 green**. No mutation left
behind (`git status` and a `grep` of line 44 both confirm the original).

---

## 4. Item 5 — live parity + latency, reproduced against real Mongo

**Mongo was reachable this session.** TCP probe to `13.202.206.101:27017` (from `.env`
`MONGODB_URL`) succeeded. Read-only throughout — `find` / `findOne` / `countDocuments` /
`indexes()` only, zero writes.

Method: a throwaway script at `apps/api/src/_temp-check.mjs`, run with `npx tsx` from
`D:\KnowledgeBase`, **deleted immediately after** (confirmed absent; `git status` is byte-for-byte
what it was before the check). It imports the real `createMongoSearchDeps` from
`search-store.ts` and compares it against the old `find({})` path **reimplemented verbatim from
`git show HEAD:apps/api/src/store.ts`** — so the baseline is the actual previous code, not a
paraphrase. Comparison key is `turnId:score.toFixed(6)` in order, plus a check that the enriched
result shape (`turnId/sessionId/score/turn/session`) matches per hit.

```
tenant=toc turns=2118
IDENTICAL  "visa student university funding"   new=10 old=10 shape=true
IDENTICAL  "AI in counselling"                 new=10 old=10 shape=true   <- short tokens
IDENTICAL  "is it ok to go"                    new=10 old=10 shape=true   <- all-short tokens
IDENTICAL  "UK visa"                           new=10 old=10 shape=true
IDENTICAL  "c++"                               new=10 old=10 shape=true   <- regex metachars
IDENTICAL  "zzzznonexistentqueryxyz"           new=0  old=0  shape=true   <- zero-hit
IDENTICAL  "İnvestment"                        new=10 old=10 shape=true   <- CHECKER-ADDED: U+0130
IDENTICAL  "café"                              new=0  old=0  shape=true   <- CHECKER-ADDED: accented
IDENTICAL  "IT"                                new=10 old=10 shape=true   <- CHECKER-ADDED: substring-of-other-tokens
RESULT PARITY ACROSS ALL QUERIES: YES
```

**All nine identical on turnIds AND scores AND response shape**, including the three adversarial
queries I added beyond the manifest's six. Response shape and ranking are unchanged — confirmed
live, not merely argued.

### Latency — I do not reproduce the ~30% figure

7 interleaved runs per path (alternating new/old so network drift hits both equally), query
`"visa student university funding"`:

```
new: 763, 623, 719, 617, 731, 708, 634   → median 708ms
old: 978, 852, 835, 803, 965, 767, 873   → median 852ms
```

**~17% faster, not ~30%.** My absolute numbers are also well below the manifest's (708/852 vs
993/1422) — consistent with a warmer connection or a better network path this session.

My judgement: **the direction and the character of the win are confirmed; the magnitude is not a
stable constant.** This is *not* a failure — the manifest measured honestly on its own session,
and my methodology (interleaved) differs from whatever it used. But "1422ms → 993ms" should be
read as one session's observation, not a property of the change, and I have recorded both figures
in the contract so a future perf unit does not treat 30% as a baseline it has regressed from. If
anything this *strengthens* the manifest's own honest-ceiling framing: the win is even more
clearly a constant factor than claimed.

---

## 5. Item 6 — the honest-ceiling claim, and the ship-now call

### The index claim: verified exactly, by me

```js
db.collection('turns').indexes()
→ [ {key:{_id:1},        name:"_id_"},
    {key:{tenantId:1},   name:"tenantId_1"},
    {key:{tenantId:1,sessionId:1}, name:"tenantId_1_sessionId_1"} ]
```

**No text index.** The manifest's list is character-for-character correct. So the `$or` regex is
an unindexed collection scan — Mongo must still touch every one of the 2118 documents; the saving
is purely that it ships back ~10 documents instead of ~2118. The complexity claim is exactly
right: **O(corpus), constant-factor win, not a fix.** The manifest states this plainly and
without hedging, which is the correct posture and the reason I trust the rest of its numbers
enough to have spot-checked rather than re-derived every one.

### Should this have shipped now, or waited for the Phase-1 retrieval layer?

The manifest explicitly invites disagreement. **I agree it was right to ship — but for a
different and stronger reason than the one given, and with one reservation.**

The manifest's argument is "U1.5 would otherwise inherit a silent 1.4s." That is a real but weak
argument on its own: U1.5 inheriting a slow function is a *performance* problem, and performance
problems inherited from a named, contract-documented ceiling are not silent — this contract
already documented that ceiling in writing before this unit existed.

The stronger argument, which the unit demonstrates without quite claiming, is **epistemic**: this
unit converted three assumptions into measurements, and two of them were wrong.

1. The sweep's premise "fine at 23 sessions, a cliff later" was wrong — it is already 1.4s *now*.
2. The obvious fix (a `{_id, sessionId, text}` projection) would have been an **8%** improvement
   sold as a fix, and — the part that matters — **every unit test would have passed.** It would
   have shipped as a perf win, closed the queue item, and left the actual problem in place with a
   "fixed" label on it.
3. The natural pre-filter (drop short tokens) was *silently wrong*, and the maker found that by
   probing real data **before** writing production code rather than after.

That third point is what settles it for me. The transfer-vs-compute split (1064ms transfer vs 38ms
compute) is now a measured fact in the repo, and the superset property is now a mechanized test
plus a contract invariant. **Whoever builds the Phase-1 retrieval layer inherits a
correctness-checked seam and a measured cost model instead of a guess.** That is worth more than
the 17%, and it is not work the Phase-1 unit would have gotten for free — it would have
re-derived it, or worse, not.

**The case for waiting, stated fairly:** this is ~150 lines of new surface, a new module, and a
new invariant added to a contract, all to buy a 17% improvement on a path that will be replaced
outright by Phase-1. If Phase-1 were imminent, this would be churn — you would be hardening a
component you are about to delete, and ISS-072 shows the hardening is not even complete. That is
a legitimate position and I would not overrule a maintainer who held it.

**Why it does not win here:** Phase-1 is not imminent (it sits behind U1.4/U1.5, and U0.10's
golden set is itself blocked on an open HUMAN_GATE per ISS-071 — so the retrieval work has a
human decision in front of it with no date). "Wait for the real fix" is only a good argument when
the real fix has a date. Here it does not, and a 1.4s search is user-visible today.

**Verdict on the shipping decision: ship, correctly decided.** With one condition I would attach
rather than a reason to have waited — **close ISS-072 before U1.5 builds on this seam.** Shipping
a correctness property that no test enforces, into a seam whose whole documented purpose is that
two future units "reuse it without re-review", is the part of this decision that is genuinely
under-defended. Not enough to block; enough to queue.

---

## 6. Item 7 — the `store.ts` corruption recovery, verified complete

The manifest discloses that its first extraction script duplicated ~170 lines, `tsc` caught it,
and `git checkout --` recovered it. **Verified clean.** `git diff HEAD -- apps/api/src/store.ts`
is *exactly three hunks* and nothing else:

1. `-import { flattenTreeToGraph, treeIndexRootFilter, lexicalSearchTurns, type Graph }` →
   the same line minus `lexicalSearchTurns`.
2. `-import type { SearchDeps, SearchHit } from "./routes/search.js";` (removed).
3. The removal of the trailing 4-line doc comment + 20-line `createMongoSearchDeps` block —
   which was the **last** thing in the file, exactly as the manifest's post-mortem describes.

**Nothing else changed. No duplication, no loss, no reordering, no whitespace churn.** Corroborated
four independent ways: the LOC arithmetic (281 − 24 = 257, and the removed block is 24 non-blank
lines); `pnpm -r typecheck` exit 0; the api suite's own two source-assertion tests
(`store.ts imports treeIndexRootFilter and both its tree_index call sites use it`) still green;
and `lint-dupes: OK (255 unique exports)`, which would have caught a duplicated `export function`.

The `production.ts` diff is the exact complement — `createMongoSearchDeps` removed from the
`./store.js` import list and added as a new `./search-store.js` import, nothing else. The
`SNAPSHOT.md` diff is a single added line (`qa/gates/`), as disclosed and unrelated to this unit.

---

## 7. Findings filed

### ISS-072 (high) — the store's use of the tokenizer is pinned by nothing

**Not disclosed by the manifest; found by a checker-original mutation.** I reintroduced the exact
defect this unit exists to prevent, but in `search-store.ts` — the file that actually ships it —
rather than in `lexical.ts`:

```
48c48
<       const tokens = lexicalQueryTokens(query);
---
>       const tokens = lexicalQueryTokens(query).filter((t) => t.length > 2);
```

Result: `pnpm -r typecheck` **exit 0**. `pnpm --filter @lkb/api test` **89/89 PASS**.
`pnpm --filter @lkb/index test` **59/59 PASS**. **Nothing reddened.** Restored byte-identical,
re-confirmed green.

Root cause: no test exercises `createMongoSearchDeps` at all — `search.test.ts` drives the route
through `fakeSearchDeps()`, and there is no `search-store.test.ts`. The PROPERTY test proves the
superset property **of `lexicalQueryTokens`**; nothing asserts the store **consumes** it
unfiltered. The property is proven about a function the shipped code is free to stop using
correctly. `escapeRegex` and the empty-token short-circuit have no coverage either.

**Why this does not FAIL the unit:** the shipped code is correct today, and no contract criterion
requires store-level mutation coverage (C14 names the route guard and the `score > 0` filter,
both of which this unit leaves untouched and both of which remain covered). This is the same shape
as ISS-069 — correct code, unpinned by tests — which was likewise filed without blocking a PASS.
I am rating it **high** rather than medium because the failure mode it leaves open is *silently
wrong answers* with no error, on a seam two future units are specified to trust without
re-reviewing.

Remedy is cheap and the pattern already exists in this repo: a static source-assertion test in the
style of the existing `"store.ts imports treeIndexRootFilter and both its tree_index call sites
use it, not a hand-written copy"` test.

### ISS-073 (low) — Unicode case-folding bound on the superset property

As analysed in §1.2. Zero occurrences in the live corpus; recorded as a stated bound on the new
contract invariant I6 rather than a defect to fix.

---

## 8. Contract amendments made (checklist item 7 — checker territory)

`qa/contracts/search-route.md`, all **routine** under the criticality gate (a tightening and two
records; nothing weakened, nothing softened to let this artifact pass):

1. **C9 reworded** — its substance ("exactly one `turns` query per request") is unchanged and
   still holds; only the literal `find({})` text and the `store.ts` file reference went stale.
   The criterion protects query *count*, not the filter's emptiness.
2. **[I6] ADDED** — the superset / never-reduce-the-token-list invariant, with its three
   load-bearing sub-clauses (no token removal, empty-token short-circuit, mandatory regex
   escaping) and its one recorded Unicode bound. This converts an argument that lived only in a
   manifest into a rule a future edit can be judged against — the manifest asked whether this was
   needed; it was.
3. **Tradeoff section updated** with this checker's own measured numbers and the independently
   re-derived index list, explicitly recording that they do **not** reproduce ~30%.

---

## 9. Everything this checker ran

```
git status --porcelain / git log / git diff HEAD -- <each changed file>
git show HEAD:apps/api/src/store.ts | awk 'NF' | wc -l           → 281
awk 'NF' apps/api/src/store.ts | wc -l                           → 257
pnpm -r typecheck                                                → exit 0, 10/10 projects
pnpm --filter @lkb/index test                                    → 59/59
pnpm --filter @lkb/api test                                      → 89/89
pnpm lint:structure                                              → all 8 gates OK
[mutation A] lexical.ts length>2  + diff-vs-backup proof         → 7/9, both target tests red
[restore A]  diff byte-identical                                 → 9/9
[mutation B] search-store.ts length>2 + diff-vs-backup proof     → typecheck 0, 89/89, 59/59 (ISS-072)
[restore B]  diff byte-identical                                 → green
TCP probe 13.202.206.101:27017                                   → OK
[live, read-only] 9-query parity new-path vs verbatim-old-path   → 9/9 IDENTICAL (ids+scores+shape)
[live, read-only] db.collection('turns').indexes()               → 3 indexes, no text index
[live, read-only] latency, 7 interleaved runs each               → new 708ms / old 852ms median
[live, read-only] corpus probe U+0130 / U+212A / non-ASCII       → 0 / 0 / 51 turns (ISS-073)
rm apps/api/src/_temp-check.mjs; git status re-confirmed unchanged
```

No code, artifact, or manifest was edited by this checker. Writes were confined to
`qa/verdicts/search-prefilter.md`, `qa/issues.jsonl`, and `qa/contracts/search-route.md`.

---

**Maker close-out:** flip `qa/manifests/search-prefilter.md` to `Status: checked-PASS`.
**Queued follow-up:** ISS-072, to be closed before plan §10 U1.5 builds on this seam.
