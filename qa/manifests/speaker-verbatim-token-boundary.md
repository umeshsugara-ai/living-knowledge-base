# Manifest — speaker-verbatim-token-boundary

**Contract:** `qa/contracts/speaker-resolution-llm.md` — this unit **tightens C2**. The checker
placed these two attacks as blocking criteria on the *apply* unit; I am closing them at the source
instead. Please amend C2 to require whole-word containment and a name-shaped `displayName`.
**Goal task:** U2.4 / catalogue B3.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none filed — the cycle-1 checker recorded both in EXPLANATION, correctly
declining to FAIL an artifact that met C2 *as written*.
**Status:** ready-for-check
**Branch:** `lane/a-speakers`

## Why

The cycle-1 checker got two attacks past the verbatim rule. Reproduced before fixing:

| attack | before |
|---|---|
| `"Ruby"` against `"My name is Rubykumar Shah."` | **shipped** as `person:ruby` |
| `"Good morning"` against `"Good morning everyone."` | **shipped** as `person:good-morning` |

Both are anti-fabrication failures. The model supplies `displayName`, so "it appeared in the text"
is not sufficient — it has to have appeared **as a name**. The first attributes a real person's
turns to a *different* real person whose name is a prefix of theirs; the second invents a human
being out of a greeting.

The checker was right not to fail cycle 1 — C2 said *substring* and the module did exactly that,
and inventing a criterion mid-verdict to fail a conforming artifact is the mirror image of
softening one. But deferring the fix to the apply unit would leave a known anti-fabrication hole
open across two more units, so it is closed here.

## What changed

`packages/index/src/pipeline/speakers-llm.ts` only. Two guards:

1. **`looksLikeAName(name)`** — every token must be capitalised, bar recognised interior particles
   (`van`, `de`, `bin`, `al`, …) which may be lowercase but never first or last; at most 4 tokens.
   Runs **before** containment: it rejects without touching any turn.
2. **`containsNameVerbatim(text, name)`** — whole-word containment via `indexOf` plus an explicit
   boundary test. **Deliberately not a `RegExp`:** building one from a model-supplied string means
   escaping it correctly every time, and a mis-escape here **fails open** — it would widen what
   counts as a match, which is the exact opposite of what this guard is for. `indexOf` has no
   escaping surface and no injection surface.

`speakers.ts` is **untouched**. The hole is LLM-path-specific: its regex captures `Rubykumar`, not
`Ruby`, and `[A-Z][a-z]+` cannot produce a lowercase second token.

## Evidence

```
$ pnpm --filter '@lkb/index' test
 tests 87   pass 87   fail 0        (82 before + 5 new)

$ pnpm -r typecheck            ... apps/api typecheck: Done     (exit 0)
$ pnpm lint:structure          tracker-audit OK; depcruise 271 modules / 0 violations
```

**Attacks, after:**

```
substring inside a longer name   name="Ruby"          -> refused
a greeting, not a name           name="Good morning"  -> refused
legitimate exact name            name="Ruby"          -> SHIPPED as person:ruby
legitimate two-word name         name="Jubin Thakkar" -> SHIPPED as person:jubin-thakkar
```

**Mutation table** (baseline 87/0):

| mutation | result |
|---|---|
| remove the name-shape guard | **85 / 2** |
| remove the word-boundary guard | **86 / 1** |
| remove the 4-token cap | **86 / 1** |
| **no-op control** | **87 / 0** |

My first control attempt was invalid — it injected a literal `\n` and broke the file (71/1). Rerun
correctly it holds at 87/0. Restore verified with `cmp` against a byte backup, **not** against
`HEAD`, since the hardening itself is uncommitted and a HEAD diff would be expected.

**No corpus regression:** 11/11 sessions still degrade honestly, 78/494 (15.8%) unchanged — the
deterministic path is unaffected.

## Known gaps

1. **An all-lowercase real name is now refused.** Conservative by design, consistent with "leave
   low-confidence speakers unresolved rather than guessing" — but it *is* a recall cost, and a
   corpus with lowercase-styled names would feel it.
2. **The particle list is Latin-script and short.** A name using an unlisted lowercase particle is
   refused, not mis-attributed.
3. **The 4-token cap is a judgement call**, not a measured threshold. It rejects "Thank You All For
   Joining Us" but would also reject a genuine five-part name.
4. **Same-first-name collision is still open** (checker's gap 5): two speakers both legitimately
   called "Ruby" still share `person:ruby`. That lives in `personIdFor` in the PASSed `speakers.ts`
   and remains blocking on the apply unit — untouched here on purpose.

## Note to the checker

Re-run the mutation table **including the control**. Try to get a fabricated name past the new
guards — particularly: a capitalised English word that appears in the transcript (`"Welcome"`,
`"Thanks"`) is still shape-valid and would ship if a turn contains it standalone. I consider that
in scope for C2 and would accept a FAIL on it; my judgement was that a stopword list is a
different, larger design decision than the two holes this unit closes, but say so if you disagree.
