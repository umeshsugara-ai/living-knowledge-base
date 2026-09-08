# Manifest — speaker-verbatim-token-boundary

**Contract:** `qa/contracts/speaker-resolution-llm.md` — this unit **tightens C2**. The checker
placed these two attacks as blocking criteria on the *apply* unit; I am closing them at the source
instead. Please amend C2 to require whole-word containment and a name-shaped `displayName`.
**Goal task:** U2.4 / catalogue B3.
**Date:** 2026-09-08
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** none filed — the cycle-1 checker recorded both in EXPLANATION, correctly
declining to FAIL an artifact that met C2 *as written*.
**Status:** ready-for-check (cycle 2)
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

---

# Fix cycle 2 — responding to the cycle-1 FAIL

The cycle-1 verdict **FAILED** this unit, 12/14, with two findings. Both were reproduced before
being fixed, and I agree with the FAIL on both counts.

## ISS-091 (critical) — capitalisation is not nameness

`"Welcome"`, `"Thanks"`, `"Okay"` and the bare pronoun `"I"` all shipped as people. **`person:i`
came from `"I am going to start now."`** — a human being invented out of a pronoun. My shape guard
tested capitalisation, and transcript prose capitalises nearly every sentence start; `"Good
morning"` was only ever caught because English lowercases "morning". I had named this hole and
argued for deferring it. The checker declined, and it was right: this unit's entire stated purpose
is anti-fabrication, and `"Welcome"` invents a person on identical grounds to `"Good morning"`.

**Fix — a naming cue, not a stopword list** (the checker's suggested route, and the cheaper one to
justify). A candidate must sit immediately adjacent to a phrase marking an *act of naming*:
preceded by `my name is` / `I'm` / `this is` / `this side` / `welcome` / `joined by` / `over to` /
`thank you` / `hi`, or followed by `here` / `speaking` / `from` / `with us`. A stopword list is
unbounded and language-specific; a cue is **positive evidence** that the turn introduces or
addresses someone — exactly what the prompt asks the model to find. The cue phrases are fixed
constants, never model-supplied, so the RegExp trimming punctuation around them has no injection
surface.

## ISS-092 (high) — the first attack was not actually closed

`"Ruby"` against `"My name is Ruby-Anne Smith."` still shipped as `person:ruby`, and `"Anne"` as
`person:anne`. `containsNameVerbatim` treated `-` as a boundary while `looksLikeAName` admits `-`
**inside** a name: two contradictory definitions of where a name ends, and the containment side is
the one that fails open. Fixed by sharing one `NAME_JOINERS` set between both — a character that
can sit inside a name can never simultaneously mark its edge. `.` is deliberately excluded: it ends
far more sentences than it joins names, and including it would refuse `"My name is Ruby."`

## Three existing tests were re-fixtured — assertions unchanged

The cue rule broke three fixtures written under the looser rule (`"Ruby again here."`,
`"Actually Rahul Mehta."`, `"That would be Ruby"`) — none of which is naming language. I changed the
**fixture prose only**, never an assertion, and flag it explicitly because re-fixturing is exactly
how a weakened test gets disguised. Each still tests what it did: partial evidence survival,
contradiction handling, and offset arithmetic at both edges of a turn.

## The mutation run found the suite had stopped pinning two guards

First cycle-2 table: removing `looksLikeAName` **and** the 4-token cap each changed nothing (95/0),
because the cue rule rejected every existing fixture first. An earlier cycle taught me not to read
that as "redundant", so I probed instead — and found three cases where a cue passes and only the
shape guard rejects (`"a lot"`, `"back"`, `"going to be announced later"`), plus one where only the
cap rejects (a title-cased slide title, `"Our Journey So Far Together"`). Both guards do real work;
the tests had simply stopped covering it. Four tests added; both guards now pinned.

## Evidence (cycle 2)

```
$ pnpm --filter '@lkb/index' test     tests 99   pass 99   fail 0
$ pnpm -r typecheck                   exit 0
$ pnpm lint:structure                 green
```

**Attacks, after:**

```
ISS-091 "Welcome" -> refused     ISS-092 "Ruby" (in Ruby-Anne) -> refused
ISS-091 "I"       -> refused     ISS-092 "Anne" (in Ruby-Anne) -> refused
ISS-091 "Thanks"  -> refused
legit "Jubin Thakkar" / "Nilesh Gotecha" / "D'Souza" -> all still SHIPPED
```

**Mutation table** (baseline 99/0), every guard independently pinned:

| mutation | result |
|---|---|
| cue rule to plain containment | **93 / 5** (measured at 98 tests) |
| remove name-shape guard | **95 / 3** |
| remove 4-token cap | **98 / 1** |
| empty the name-joiner set | **97 / 1** |
| **no-op control** | **99 / 0** |

Restored with `cmp` against a byte backup after every mutation.

**No corpus regression:** 11/11 sessions still degrade honestly; deterministic path unchanged at
78/494 (15.8%), same two speakers.

## Cycle-1 notes accepted

- **"11/11" phrasing was misleading** — the corpus is 23 sessions / 1950 turns; 11 have positional
  labels and 12 already carry real names (out of scope by C5). Stated properly here.
- **"5 new, written first, red before the fix" overstated it** — 3 of the 5 were red; the other two
  are legitimate-name regression guards, green on both sides. The manifest was accurate; the commit
  message was not. Correcting rather than letting it stand.
- **Stale docstring removed** — `containsNameVerbatim` described lookarounds directly above the
  comment explaining it deliberately avoids a RegExp.
- **Known gap 2 understated it:** non-Latin scripts are refused wholesale by the *shape* guard, not
  merely by the particle list. Fail-closed, but a real recall limit, now stated as one.

## Still open (unchanged)

`personId` collision for two speakers legitimately sharing a name (`person:ruby`) remains deferred
to the apply unit — it lives in the PASSed `speakers.ts`, which I2 forbids touching.

## Recall cost, stated plainly

The cue rule refuses a name mentioned without an adjacent naming cue in that same turn. That is a
deliberate recall reduction on an unmeasured baseline: the real LLM yield above 15.8% was never
measured (known gap 1), and this makes it lower than it would otherwise have been. Refusing is the
right error for anti-fabrication, but it is a cost and the measurement unit must report it.
