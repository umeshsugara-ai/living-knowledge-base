# Verdict — search-prefilter-bypass-pin

**VERDICT: PASS**

**Date:** 2026-09-08
**Cycle checked:** 1
**Contract:** qa/contracts/search-route.md (invariant [I6])
**Manifest:** qa/manifests/search-prefilter-bypass-pin.md (Status: ready-for-check, Fix cycle 1)
**Bound to:** `D:/KnowledgeBase`
**Mode:** A (unit check). Fresh context, no builder reasoning. Every command below was re-run by
this checker; no pasted output was trusted.

```
VERDICT: PASS
SCOREBOARD: 15/15 criteria met, 6/6 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-076 (medium), ISS-077 (medium) — both new coverage gaps found by this
  checker's own adversarial mutations, neither a live defect, neither blocking (same disposition
  and same reasoning as ISS-072 and ISS-074, which were filed against passing units).
ISSUES-CLOSED: ISS-074 (fixed), ISS-075 (fixed). ISS-073 left open per the manifest.
EXPLANATION: Every claim the manifest makes was independently reproduced, including the two
  bypass replays with the exact predicted signatures (97/99 and 98/99) and live read-only parity
  against real Mongo on turnIds AND scores. The unit does what it says. It does NOT close the
  bypass class in general, and the manifest does not claim it does — but this checker found three
  working fourth bypasses, one of which measurably loses 6 of 20 real hits on a real query while
  typecheck and all 99 tests stay green. Those are filed, not charged to this unit.
```

---

## 1. What was re-run (all by this checker)

| Check | Result |
|---|---|
| `pnpm --filter @lkb/api test` (baseline) | **99 / 99 pass, 0 fail** |
| `pnpm --filter @lkb/index test` | **59 / 59 pass, 0 fail** |
| `pnpm -r typecheck` | **exit 0**, 10 projects Done |
| `pnpm lint:structure` | **exit 0** — lint-loc OK (241 files), lint-dirsize OK (75 dirs), lint-root OK, lint-dupes OK (255 exports / 24 schema $ids), lint-migrations OK (1144 files), SNAPSHOT fresh (116 lines), tracker-audit OK (G1), depcruise **0 violations, 263 modules** |
| Live Mongo parity (own script) | **RESULT PARITY ACROSS ALL QUERIES: YES**, 9 queries, turnIds AND scores identical |
| Working tree after all mutations | `search-store.ts` SHA256 `7F17F5F1…0774CE` (unchanged from baseline), `search-prefilter.ts` SHA256 `D2E7AF0D…0755D5`, `_temp-check.mjs` deleted, `git status` shows only the unit's own intended files |

`pnpm lint:structure`'s 263-module count matches the manifest exactly.

## 2. [C-level] The test file itself

`apps/api/src/search-prefilter-single-source.test.ts` was read in full and compared line-for-line
against `apps/api/src/tree-index-root-filter-single-source.test.ts`. It is a faithful application
of that pattern, not a superficial imitation:

- same imports and same `fileURLToPath(new URL(".", import.meta.url))` source-reading idiom;
- same stated rationale (**"calls `turnsColl()` with no injectable handle, so its query cannot be
  pinned by exercising real behaviour without a live Mongo"** mirrors the precedent's
  **"calls `getDb()` directly with no injectable handle (unlike `indexSession`, which gained one
  for ISS-056)"** — including the same cross-reference to ISS-056);
- same explicit self-limitation. The precedent says *"not that `tree_index` access is correct in
  general"*; this one says *"It does not prove the query is correct in general"* and names where
  the real assertions live (`search-prefilter.test.ts`) and that end-to-end parity is verified
  live per unit.
- same count-based assertion shape (`treeIndexRootFilter\(` × 2 there, `buildTurnPrefilter\(` × 1
  here) with the same "a count of N means one regressed" failure message.

**Does it overclaim?** No. This is the item most worth adversarial reading given the session's
history, and the docstring is if anything under-claiming: it states the pin proves only that *"the
shipping file building its own filter again"* cannot reappear silently. That is precisely and only
what §4 below shows it proves. **No overclaim finding.**

## 3. [C13/C14] Both documented bypasses replayed

Each mutation was confirmed to have genuinely changed the file via `Compare-Object` against a
byte-backup, and each restore was confirmed by SHA256 equality with the pre-mutation hash.

### (a) Delete the delegation, hand-roll an inline `$or`/`$regex`

Applied to `search-store.ts`: removed the `buildTurnPrefilter` import and replaced the delegation
with `const toks = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);` plus an inline
`{ $or: toks.map(...$regex...) }`. Diff confirmed 3 lines added / 3 removed.

**FULL `pnpm --filter @lkb/api test`: `tests 99 · pass 97 · fail 2`** — exactly as the manifest
predicts, and at the full-suite level, not an isolated file:

```
✖ search-store.ts delegates to buildTurnPrefilter instead of building a filter itself
✖ search-store.ts contains no hand-rolled Mongo filter — the exact bypass ISS-074 recorded
```

Restored → SHA256 identical → 99/99. **Reproduced.**

### (b) Add a `lexicalQueryTokens(` call, keeping the delegation

Applied: `import { lexicalSearchTurns, lexicalQueryTokens } from "@lkb/index";` plus
`if (lexicalQueryTokens(query).length === 0) return [];` after the delegation. Diff confirmed.

**`tests 99 · pass 98 · fail 1`** — and the one failure is the third test:

```
✖ search-store.ts does not re-derive query tokens
```

Tests 1 and 2 stayed green. This is the discrimination claim, and it holds: the three tests do not
all trip on any edit; each fires on its own route. Restored → SHA256 identical → 99/99.
**Reproduced.**

## 4. THE FOURTH BYPASS — I found three, and they work

The manifest asked for this explicitly and it is the right question to ask. I did not merely try to
confirm the pin; I tried to defeat it while keeping all three assertions satisfied. **Three
attacks succeeded.** All were executed, not reasoned about.

### Bypass 4A — call it once, then narrow the result (post-call mutation)

```ts
const prefilter = buildTurnPrefilter(query);
if (prefilter === null) return [];
prefilter.$or = prefilter.$or.slice(0, 1);      // ← keeps only the first token's clause
const turns = await turnsColl(tenantId).find(prefilter as never).toArray();
```

Import present ✓ · exactly one `buildTurnPrefilter(` ✓ · no `$regex` ✓ · no `$or:` (the assertion
regex is `/\$or\s*:/`, and `$or =` carries no colon) ✓ · no `lexicalQueryTokens` ✓.

**Measured: `pnpm --filter @lkb/api test` → 99 / 99 pass, 0 fail. `pnpm -r typecheck` → exit 0.**

This is a strict-subset filter — a direct [I6] break — and it is completely invisible. The
dispatch's hypothesis ("call `buildTurnPrefilter` once but ignore its result") is the weaker
sibling of this and also passes: replacing `find(prefilter as never)` with `find({} as never)`
while keeping the call **also measured 99/99**. That variant is answer-safe (a trivial superset)
but silently reverts the entire performance premise of the unit; 4A is answer-*unsafe*.

### Bypass 4B — launder the narrowing through a third file

Created `apps/api/src/search-prefilter-narrow.ts` exporting `narrowPrefilter()` (a `length > 2`
clause filter), then in `search-store.ts`:

```ts
const prefilter = narrowPrefilter(buildTurnPrefilter(query));
```

Call count is still exactly 1, the import is still there, and no forbidden token appears anywhere
in `search-store.ts`. **Measured: 99 / 99 pass, 0 fail.**

### Bypass 4C — break `buildTurnPrefilter` itself without reddening `search-prefilter.test.ts`

This is the one that matters most, because it partially re-opens what ISS-072 is recorded as having
closed. In `search-prefilter.ts`:

```ts
const tokens = lexicalQueryTokens(query).filter((t) => !/^\d+$/.test(t));
```

A token-removing transformation — the exact class [I6] forbids — targeting a token shape absent
from `search-prefilter.test.ts`'s six hard-coded `QUERIES`. **Measured: 99 / 99 pass, 0 fail;
`pnpm -r typecheck` exit 0.** The `PROPERTY:` test does not fire because it only ever evaluates
those six queries against a six-document fixture corpus.

**And it is not theoretical.** I ran this mutation against **real production Mongo** (read-only)
with my own parity script:

```
DIFF "2026 intake"  prefiltered=14  fullscan=20
```

Six real hits silently lost on a plausible real query, with every gate green. The other eight
queries stayed identical, so it is invisible to anything but the query shape that triggers it —
the precise signature of the ISS-072 / ISS-074 failure mode.

### What I tried that was correctly CAUGHT

Recorded so the pin gets credit for what it does hold:

- deleting the delegation + inlining `$or`/`$regex` → **caught** (2 tests, §3a);
- re-deriving tokens via `lexicalQueryTokens` in the store → **caught** (1 test, §3b);
- moving `createMongoSearchDeps` out of `search-store.ts` entirely → **caught by construction**:
  the call count in `search-store.ts` drops to 0 and test 1 fails;
- the string/computed-property trick the dispatch suggested (`c.text["$" + "regex"]` to write a
  narrowed filter without the literal token) → **works, but is strictly redundant**: 4A already
  achieves the same result in one line with no obfuscation at all, so the pin's token-absence
  assertions are not the binding constraint anyway.

### The common root cause — and why it is not this unit's fault

All three succeed for one reason: **the pin constrains the SOURCE TEXT of one file; it does not
constrain the FILTER OBJECT that reaches Mongo.** Everything between `buildTurnPrefilter`'s
`return` and `turnsColl().find()` is unpinned, and so is `buildTurnPrefilter`'s behaviour outside
six literal example queries.

This is not a defect in the unit — the manifest states plainly that *"a source pin is weaker than
exercising the real query"* and *"this does not make `createMongoSearchDeps` behaviourally
tested."* Both statements are exactly right, and my results are the measurement of how much weaker.
Filed as **ISS-076** (4A + 4B: the pin does not constrain the filter object) and **ISS-077** (4C:
`search-prefilter.test.ts` is example-based, so a token-removing defect aimed away from its six
queries survives). **Neither blocks.** Charging this unit for a hole it disclosed in advance and
correctly scoped out would be charging it for honesty; the precedent (ISS-072 filed against a
passing unit, ISS-074 filed against a passing unit) is directly on point.

**But the pattern is now measured rather than suspected.** Three units in a row have closed the
layer just demonstrated and left the next one open, and the reason is structural, not a lapse of
diligence: a source-text pin can only ever pin the *previous* attack's syntax, so it will keep
losing this race by construction. See §7 for the consequence.

## 5. [ISS-075] The `escapeRegex` comment — verdict: accurate, and keeping the code is RIGHT

**Is it accurate?** Yes, and I did not take it on trust. The comment's load-bearing empirical claim
is that brute-forcing codepoints `0x0000–0x2FFF` yields zero tokens carrying a non-word character.
I re-ran that brute force myself inside my live probe (every codepoint embedded in three positions,
`a<ch>b`, `<ch>`, `x<ch>`, fed through the real `lexicalQueryTokens`):

```
ISS-075 brute-force 0x0000-0x2FFF: 0 token(s) carrying a non-word char
```

**Reproduced exactly.** I also confirmed the claim generalises beyond the stated bound: `tokenize`
splits on non-unicode `\W+`, so *any* non-ASCII codepoint — astral plane and emoji included — is a
separator by construction, never a token character. The comment's bound is therefore conservative,
which is the right direction for a bound to err in.

**Is it non-contradictory?** Yes. The old text asserted unescaped tokens were *"both a correctness
and a denial-of-service surface"* while `search-prefilter.test.ts:84-91` asserted the opposite in
the same unit. The rewrite now says *"Currently unreachable defence-in-depth, not an active guard"*
and the test says *"escaping is defence-in-depth: tokenization already strips every metacharacter
first."* The module and its test now say the same thing. The rewrite also names ISS-075 and quotes
the wording it replaces, so a future reader can see the correction rather than just the corrected
state. That is better than a silent fix.

**Should the dead code be deleted instead? Independent judgment: NO — keep it.** My reasoning, not
the maker's:

1. It is **not untested dead code**, which is the usual reason to delete. `escapeRegex` is directly
   exercised by its own test with six metacharacter cases plus a `.*`-must-not-match-everything
   assertion. It will work on the day it becomes live, which is the property dead code normally
   lacks.
2. Deleting it converts a *local, visible* guard into an *implicit cross-package coupling*: the
   correctness of `apps/api`'s regex construction would then silently depend on a `\W+` split in
   `packages/index/src/search/lexical.ts` with nothing at the dependent site to signal it. That is
   the exact "property documented but not enforced" shape this whole contract exists to fight —
   deleting would be re-committing the class error one level up.
3. The cost is one line and one `.replace`. There is no maintenance burden to trade against.
4. The named trigger is concrete and plausible, not hypothetical hand-waving: preserving `"c++"` as
   one token is a real search improvement someone will eventually make, and it would make this
   function live with no other warning.

The one thing I would NOT accept is the *old* framing, and it is gone. **ISS-075 → fixed.**

## 6. On declining to quote a headline latency figure — verdict: HONEST, not dodging

This is the right call and I would defend it against the opposite complaint.

Four measurements of the same change exist — ~30% (maker, sequential blocks), ~17% and ~9.8% (two
checkers, interleaved), and 957ms vs 1422ms this run. They span a 3× range. The mechanism behind
that spread is measured and understood: `search-store.ts` records transfer at 1064ms against
compute at 38ms, so the number being measured is **dominated by network RTT to a remote host**
(`13.202.206.101`), not by the code the unit changed. A ratio whose denominator is mostly network
variance is not a property of the change; publishing one figure as *the* improvement would be false
precision, and the next person to measure it would be entitled to call the manifest wrong.

Crucially, **declining the magnitude is not declining accountability** — the manifest still commits
to the two things that are stable and falsifiable: the *direction* (consistent across four
independent runs) and the *mechanism* (transfer-bound, ~75% of a 1.4s search was shipping 1.7MB of
text; a projection was measured and rejected at 8%). Those are the claims a future editor needs and
they are testable. It also does not quietly drop the number — it names all four measurements and
says why they diverge, which is strictly more information than any single figure would carry.

For the record, this checker's own run is consistent with that: no timing regression observed, and
correctness parity is exact.

**One refinement, not a finding:** the manifest could cheaply commit to a falsifiable *floor*
("the pre-filter path is never slower than the unbounded fetch on the same query") rather than a
point estimate. That would give a future perf unit something to break without reintroducing false
precision. Offered as a suggestion; its absence does not affect this verdict, and the contract's
tradeoff section already records the divergence honestly.

## 7. On the three stated non-goals — two correctly scoped, one I would upgrade

**(a) "A source pin is strictly weaker than exercising the real query." AGREE, unreservedly.**
§4 is the quantification of exactly this sentence. The manifest was right before I measured it.

**(b) "The honest general fix is an injectable collection handle (the shape `indexSession` gained
for ISS-056), which is a larger refactor." AGREE it is the right fix — but I am upgrading its
urgency, and this is the one place I part company with the manifest's scoping.**

The manifest files this as an acknowledged limitation. My findings change its character: all three
of my bypasses are invisible to *any* source-text pin, and **all three would be caught immediately**
by a test that asserts the object actually handed to `find()`. So the injectable handle is not a
nicer-engineering aspiration — it is the **only** remedy that closes the class rather than the
current instance, and the evidence for that is now measured rather than argued.

Is it *required now*, i.e. should it block this PASS? **No.** This unit is scoped to ISS-074's named
defect and delivers it completely and honestly; blocking would mean refusing a correct fix because a
larger one exists. But it should stop being an open-ended "larger refactor" and become **the next
unit**, and — reusing the contract's own words about this seam — it should land **before U1.5 builds
on it without re-review**, because U1.5 is specified to trust this contract rather than re-derive it.
The chain ISS-069 → ISS-072 → ISS-074 → ISS-076/077 is four rounds of the same lesson; the fifth
round should change instrument, not add a fourth string assertion. Recorded in ISS-076's
`fix_direction` and in the contract amendment below.

**(c) ISS-073's proportionate strengthening is MONITORING the count, not fixing the hole. AGREE,
and I re-verified the premise myself rather than accepting it.** My live probe over the real `toc`
tenant:

```
corpus: 2118 turns
ISS-073 occurrences of U+0130/U+212A in turn text: 0
```

Independently reproduced. With zero occurrences, low severity, and a fix that needs Mongo-side
collation, monitoring the count is the correctly-sized response and building it into this unit
would have been scope creep. **ISS-073 stays open**, exactly as the manifest asks.

## 8. Ledger actions

- **ISS-074 → `fixed`** (`fixed_date: 2026-09-08`). The specific bypass it records — delete the
  delegation, hand-roll a replacement — now moves the full suite 99/99 → 97/99. Independently
  replayed. Closure scoped in the row: the *named* bypass is closed, the bypass *class* is not.
- **ISS-075 → `fixed`** (`fixed_date: 2026-09-08`). Comment rewritten, contradiction gone, the
  brute-force claim independently reproduced, and the keep-the-code decision independently endorsed.
- **ISS-073 → left `open`**, per the manifest and confirmed by my own zero-occurrence probe.
- **ISS-076 (medium) → new.** The pin constrains source text, not the filter object; 4A and 4B both
  measured green at 99/99 + typecheck 0.
- **ISS-077 (medium) → new.** `search-prefilter.test.ts` is example-based; 4C measured green at
  99/99 and loses 6 of 20 real hits on `"2026 intake"` against live Mongo. Does **not** reopen
  ISS-072 — its named defect is genuinely closed — but bounds that closure.

## 9. Contract

`qa/contracts/search-route.md` amended (routine tightening, auto per the criticality gate — this
adds a rule, weakens nothing): [I6] gains a clause recording that source-text pins do not constrain
the filter object, with the three measured bypass routes, so a future editor cannot mistake a green
suite for an enforced invariant. No criterion softened; nothing removed.

## 10. Read-only / safety compliance

Production Mongo touched **read-only only** — `find` and `findOne` via the existing accessors, no
write of any kind, no `insert`/`update`/`delete`/`drop`. Throwaway probe written to
`apps/api/src/_temp-check.mjs`, run with `npx tsx`, and **deleted immediately** (confirmed absent
from `git status`). `.goal/goal.json` and `qa/evidence/live-2026-09-07-01-58-41/preflight.json`
left untouched. All mutations restored and verified byte-identical by SHA256. Final tree carries
only the unit's own intended changes.
