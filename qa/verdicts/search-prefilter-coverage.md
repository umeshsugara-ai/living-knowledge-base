# Verdict — search-prefilter-coverage

**VERDICT: PASS**

**Date:** 2026-09-08
**Contract:** qa/contracts/search-route.md (invariant [I6])
**Manifest:** qa/manifests/search-prefilter-coverage.md
**Cycle checked: 1**
**Mode:** A (unit check), fresh context, bound to `D:\KnowledgeBase`
**Dual check:** no

```
VERDICT: PASS
SCOREBOARD: 15/15 criteria met, 6/6 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: ISS-074 (medium), ISS-075 (low); ISS-072 closed → fixed
EXPLANATION: The decisive replay reproduces exactly as claimed — the `length > 2` defect now
reddens 3 of 7 isolated tests AND moves the full @lkb/api suite from 96/96 to 93/96, where
before this unit the identical defect left all 148 tests green. The full-suite signal genuinely
changed, which was the crux. The PROPERTY test is a real property test, not a re-derivation: a
checker-original drop-last-token mutation made its `prefilterMatches` branch fire against the
real filter object ("UK visa" scored turn t1 at 0.5, but the filter Mongo receives does not match
its text). Live parity re-derived independently against real Mongo over 8 queries — identical on
turnIds AND scores. Two residuals filed rather than blocking: the delegation itself is still
unpinned (ISS-074), and the module's own docstring contradicts the maker's escapeRegex finding
(ISS-075).
```

---

## What this checker re-ran (nothing below is taken from the manifest)

### The decisive check — the original attack, replayed

Backed up `apps/api/src/search-prefilter.ts` (md5 `fde7aea96f89b26dc9831e9d99ec9861`), then applied
the mutation to the token derivation in `buildTurnPrefilter`:

```
46c46
<   const tokens = lexicalQueryTokens(query);
---
>   const tokens = lexicalQueryTokens(query).filter((t) => t.length > 2);
```

`diff` exit 1, md5 moved to `2395833dd8835d6581fde4c080943b26` — the file genuinely changed.

| | claimed | this checker measured |
|---|---|---|
| `node --test --import tsx apps/api/src/search-prefilter.test.ts` | 3 of 7 fail | **3 of 7 fail** ✓ |
| full `pnpm --filter @lkb/api test` | 93 pass / 3 fail | **96 tests, 93 pass, 3 fail** ✓ |
| after byte-identical restore | 96/96 | **96/96** ✓ |

The three reddened tests are `PROPERTY: …superset…`, `every query token survives into the
filter`, and `an all-short-token query still builds a real filter`. The PROPERTY test failed with
`"is it ok to go" scores 3 turn(s) but the pre-filter is null — every one would be missed`.

**This is the crux and it holds.** ISS-072's own evidence recorded that the same class of defect
left `pnpm -r typecheck` at exit 0 and all 148 tests (89 api + 59 index) green. The full-suite
signal has genuinely changed, not merely a new isolated file failing.

Restored from backup: md5 back to `fde7aea96f89b26dc9831e9d99ec9861`, `diff` clean,
**96/96 green. No mutation left behind** (`git status` verified: only the unit's own expected
files are modified/untracked).

### Is the PROPERTY test real, or does it re-derive its own answer? (checklist item 3)

The manifest's headline test failing on the `length > 2` mutation is not by itself proof — it
tripped on the `filter !== null` assertion, which a re-deriving test could also hit. So I ran a
**checker-original second mutation** designed to keep the filter non-empty while removing a
token, which only a test evaluating the REAL filter object can catch:

```
-  const tokens = lexicalQueryTokens(query);
+  const all = lexicalQueryTokens(query);
+  const tokens = all.length > 1 ? all.slice(0, -1) : all;
```

Result — the `prefilterMatches` branch fired:

```
AssertionError: "UK visa" scored turn t1 at 0.5, but the filter Mongo receives does not
match its text — this hit would be silently lost
```

**Judgment: the PROPERTY test genuinely evaluates the real filter object via `prefilterMatches`
and does not recompute what it asserts.** This is not the false-green pattern. Exporting
`prefilterMatches` specifically so the test evaluates Mongo's semantics rather than the maker's
model of them is the right call and is what makes the test load-bearing. Restored byte-identically;
96/96.

### Checklist items 1 and 2 — source reads

**`search-prefilter.ts`:** `buildTurnPrefilter` filters NO tokens (`lexicalQueryTokens(query)`
consumed whole, line 46). Returns `null` — not an empty `$or` — when `tokens.length === 0`
(line 47), with the two-fold reason stated (matches the scorer's own `[]` contract; Mongo
rejects `$or: []`). The header states [I6] in its **precise superset form** (lines 12–17):
"the filter's token set must be a SUPERSET of the scorer's — `filterTokens ⊇ scorerTokens`.
ADDING tokens is safe; REMOVING any is what breaks it," with the explicit correction that
"use the same tokenizer" is the weaker, misleading framing because a stopword filter applied to
BOTH sides still changes answers. ✓ — this is the stricter form, correctly stated. ISS-073 is
recorded as a bound in the same header (lines 19–22).

**`search-store.ts`:** delegates (`const prefilter = buildTurnPrefilter(query); if (prefilter ===
null) return [];`) and constructs nothing inline. `git diff` confirms the inline `$or` map, the
inline `escapeRegex`, and the `lexicalQueryTokens` import were all removed. C9 still holds by
inspection: exactly one `turns` query per request, `Map` for O(1) hit resolution, no second turns
query; C10's `[...new Set(...)]` session dedup and C11's `?? null` fallbacks are untouched. ✓

### Checklist item 4 — build gates, all re-derived

| Gate | Result |
|---|---|
| `pnpm -r typecheck` | **exit 0**, all 10 projects Done |
| `pnpm --filter @lkb/index test` | **59/59**, untouched ✓ |
| `pnpm --filter @lkb/api test` | **96/96** (89 pre-existing + 7 new) |
| `pnpm lint:structure` | **exit 0** — lint-loc OK (240 files), lint-dirsize OK (75 dirs), lint-root OK, lint-dupes OK (255 exports), lint-migrations OK (1141 files), SNAPSHOT fresh (116 lines), tracker-audit OK (G1), depcruise **0 violations across 262 modules** |

### Checklist item 5 — live Mongo parity, reproduced by this checker

Mongo **was reachable this session** (`13.202.206.101:27017`, TCP probe succeeded) — unlike the
previous `search-route` cycle-1 check, whose live item was recorded UNVERIFIED. That gap is now
closed.

Own throwaway script (`apps/api/src/_temp-check.mjs`, run via `npx tsx`, **deleted immediately**;
`git status` confirms no trace). Read-only, `find`/`findOne` only, no writes. It compares the real
`createMongoSearchDeps()` against an unbounded `find({})` scan scored the same way — the manifest's
6 queries plus two checker-added ones (a single short token, and a second zero-hit case).
Tenant `toc`, 2118 turns, k=10:

```
IDENTICAL  "visa student university funding"  new=10 old=10
IDENTICAL  "AI in counselling"                new=10 old=10   <- short tokens
IDENTICAL  "is it ok to go"                   new=10 old=10   <- ALL tokens short
IDENTICAL  "UK visa"                          new=10 old=10
IDENTICAL  "c++"                              new=10 old=10
IDENTICAL  "rates"                            new=10 old=10
IDENTICAL  "ok"                               new=0  old=0    <- checker-added
IDENTICAL  "zzzznonexistentqueryxyz"          new=0  old=0
RESULT PARITY ACROSS ALL QUERIES (turnIds AND scores): YES
```

Parity is on **turnIds AND scores**, not hit counts — the comparison key is `turnId@score` and
order-sensitive. Spot-checked scores are real and varied (1, 0.8, 0.75, 0.666…), so the comparison
is not trivially satisfied by everything scoring identically.

ISS-073's corpus claim independently re-verified in the same read-only pass: **0 of 2118 turns**
contain U+0130 or U+212A.

### Latency honesty (asked: fair characterisation or spin?)

**Fair, and if anything understated in the manifest's own disfavour.** Own interleaved run,
7 pairs, tenant `toc`, query `"visa student university funding"`:

```
old (find({}))   ms: 2014,1015,749,725,792,791,1110   median 792
new (prefilter)  ms:  828, 664,809,572,714,516, 746   median 714
improvement: 9.8%
```

Three independent measurements now exist: **~30% (maker) · ~17% (previous checker) · ~9.8% (this
checker)**. Mine is the *lowest* of the three. Direction is consistent in 6 of my 7 interleaved
pairs (one inversion at pair 3: 749 old vs 809 new). The manifest's statement — "the direction is
consistent and the mechanism is understood, but the magnitude is not a stable constant … it moves
with network conditions to a remote host" — is exactly what three runs spanning 9.8%–30% support.
Accepting the previous checker's correction against its own higher number, and then declining to
substitute a new headline figure, is the honest move, not spin. It remains a constant-factor win
on an unindexed scan.

---

## The two judgment calls the manifest invited disagreement on

### 1. ISS-073 deferral — **agree, deferral is right**

Leaving it open, recorded as a stated bound, is correct here. A known correctness hole should be
fixed regardless of occurrence count when the fix is **cheap and local**; this one is neither. The
real fix is Mongo-side collation or NFKC-normalising `text` at ingest — an ingest/schema change with
its own blast radius, entirely outside a test-coverage unit's scope, and shipping it inside this
unit would be speculative work against zero evidence.

What makes the deferral *safe rather than negligent* is not the 0/2118 count — it is that the bound
is written into three places a future editor cannot miss: contract [I6]'s "Bounded exception"
clause, the module header (lines 19–22), and the ledger row. A hole that is recorded cannot be
silently rediscovered. I re-verified the count myself rather than accepting it.

**One caveat I record without demanding action:** "0 occurrences" is a *snapshot*, and nothing
currently detects the transition. Ingest could start carrying Turkish/Azeri text or Kelvin signs
with no alarm, and ISS-073's own fix direction ("revisit only if the corpus starts carrying…")
names a trigger that nothing watches. The proportionate strengthening is not fixing the hole now
but making the count *monitored* — a cheap assertion wherever corpus-shape checks already live.
Noted for a future unit; not filed as a separate issue and not a condition of this PASS.

### 2. The `escapeRegex`-is-unreachable finding — **claim verified; filed as ISS-075 (low)**

**Verified independently, not taken on trust.** `tokenize` is `text.toLowerCase().split(/\W+/)
.filter(Boolean)` (`packages/index/src/search/lexical.ts:24`) — no `u` flag, so `\W` is
`[^A-Za-z0-9_]`. Brute-forced it: every codepoint `0x0000`–`0x2FFF` embedded between two letters,
plus targeted metacharacter queries (`c++`, `a.c`, `^s$`, `(p)`, `back\slash`, `50%`, `.*`,
`[a-z]`, `{2,3}`, `a|b`, `café`, `日本語`, `İstanbul`, `KELVIN K`) — **0 tokens containing a
non-`[A-Za-z0-9_]` character.** The manifest's claim is correct: `escapeRegex` cannot receive a
metacharacter from this path.

**Filed, yes — but as a documentation defect, not a security one.** The reason is narrower than
"a previously-shipped manifest overstated a property," which on its own I would not file: the
manifest and the contract's [I6] both describe the situation accurately today ("Belt-and-braces
in practice … but the escaping must stay"), and test 6 pins the unreachability explicitly with a
clear comment. The knowledge is captured.

What tips it over is that **the shipped module contradicts itself.** `search-prefilter.ts:31–33`
still asserts "Mongo compiles `$regex` as a real expression, so an unescaped user token is both a
correctness and a denial-of-service surface," while `search-prefilter.test.ts:85–91` in the same
unit says "it is easy to believe escapeRegex is what makes a query like `c++` safe. It is not."
Both were written by this unit. A future reader reaching for the module docstring — the nearer
and more authoritative-looking text — will conclude the escaping is live DoS protection and may
rest a security-posture claim on an inert guard. That is worth one low row in the project's
memory, and the fix is a comment correction, not a code change. **Keeping `escapeRegex` is
correct** and I endorse the reasoning (it becomes load-bearing the day tokenization preserves
punctuation, with no other warning) — it is unit-tested directly, so it will work when that day
comes.

---

## New findings

### ISS-074 (medium) — the gap is narrowed, not eliminated: the *delegation* is unpinned

Checker-original probe, beyond the dispatch's checklist. ISS-072's literal wording is "reintroducing
the exact `length > 2` defect … in `search-store.ts`, the file that actually ships it." The unit
closes the **derivation-transformation** class of that defect. It does not close the
**bypass** class. I re-inlined a defective filter in `search-store.ts`, deleting the delegation:

```
-      const prefilter = buildTurnPrefilter(query);
-      if (prefilter === null) return [];
+      const toks = lexicalQueryTokens(query).filter((t) => t.length > 2);
+      if (toks.length === 0) return [];
+      const prefilter = { $or: toks.map((t) => ({ text: { $regex: t, $options: "i" } })) };
```

`pnpm -r typecheck` **exit 0**, `pnpm --filter @lkb/api test` **96/96**, `pnpm --filter @lkb/index
test` **59/59**. Nothing reddened. Restored byte-identically (md5
`4319e97c2e54d22d5b07017723ac04c7`), 96/96 re-confirmed.

`createMongoSearchDeps` still has no direct test coverage of any kind — the same root cause
ISS-072 recorded ("`search.test.ts` drives the route through `fakeSearchDeps()`, never the Mongo
deps"). The extraction moved the untested boundary; it did not remove one.

**Why this does not block the PASS.** (a) The shipped code is correct today — this is a coverage
gap, exactly as ISS-072 itself was filed ("NOT a live defect … it does not block this unit's
PASS"); consistency requires the same treatment. (b) The residual requires a structurally
different and much less likely edit — deleting a delegation and hand-rolling a replacement, which
is the duplicate-instead-of-edit-in-place anti-pattern this repo's own CLAUDE.md and PreToolUse
guard already target — rather than the one-clause addition to an existing line that ISS-072
demonstrated. (c) The dispatch's decisive test, which defined this unit's scope, passes in full.
Filing at medium rather than high for the same reasons.

**Fix direction:** the source-assertion pattern this repo already runs twice
(`indexing.ts imports treeIndexRootFilter…`, `store.ts imports treeIndexRootFilter…` — both green
in today's suite) — assert `search-store.ts` imports `buildTurnPrefilter` and that its sole
prefilter call site delegates rather than constructing `$or` inline. ISS-072's own `fix_direction`
proposed exactly this and it was not taken; the extraction approach chosen instead is better for
the derivation class and simply does not cover this one. The two are complementary, not
alternatives. Worth closing before U1.5 builds on this seam.

### ISS-075 (low) — module docstring contradicts the unit's own escapeRegex finding

See judgment call 2. `apps/api/src/search-prefilter.ts:31–33` presents escaping as live
correctness/DoS protection; `search-prefilter.test.ts:85–91` and the manifest both establish it is
unreachable defence-in-depth. Documentation-only; no code change warranted, and `escapeRegex`
should stay.

---

## Contract

**No amendment needed this cycle.** [I6] as written by the previous cycle already states the
superset property in the form this unit implements, already carries the escaping clause in its
correct belt-and-braces framing, and already records the ISS-073 bound. This unit's contribution is
to make [I6] *enforceable* rather than merely stated — which is what its own sub-clause demanded
("`lexical.test.ts`'s `PROPERTY:` test pins this for the pure layer. **It does NOT pin the store's
consumption of it — see ISS-072.**"). That sentence is now partially discharged; ISS-074 records
the remainder. Left in place rather than edited, since it is still accurate about the delegation.

## Ledger

- **ISS-072** → `status: fixed`, `fixed_date: 2026-09-08`, citing this manifest and verdict, with
  an explicit scope note that closure covers the derivation-transformation class and that the
  bypass class is tracked as ISS-074.
- **ISS-073** → left **open**, unchanged, as the correct call (judgment 1).
- **ISS-074** (medium), **ISS-075** (low) → newly filed.

## Cleanup

Both mutated files restored from backups and md5-verified byte-identical
(`search-prefilter.ts` `fde7aea9…`, `search-store.ts` `4319e97c…`). The throwaway parity/latency
script `apps/api/src/_temp-check.mjs` was deleted; `git status` shows only the unit's own expected
files. `.goal/goal.json` and `qa/evidence/live-2026-09-07-01-58-41/preflight.json` untouched.
