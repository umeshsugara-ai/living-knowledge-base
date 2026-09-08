# Verdict — speaker-verbatim-token-boundary

**Date:** 2026-09-08
**Cycle checked:** 1
**Commit checked:** `57f4e99`
**Worktree:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`)
**Contract:** `qa/contracts/speaker-resolution-llm.md` (amended by this verdict — see below)
**Mode:** A

```
VERDICT: FAIL
SCOREBOARD: 12/14 criteria met, 4/4 invariants hold
FAILURES:
- [C2b] sev: critical · A capitalised ordinary English word still ships as a fabricated person —
  "Welcome", "Thanks", "Okay", "Thank You" and the bare pronoun "I" all resolve (person:welcome …
  person:i). The greeting half of the twin attack this unit exists to close is closed only for the
  lowercase spelling. · Fix: shape is necessary, not sufficient — reject discourse words as a whole
  displayName, or require a naming cue in the evidence turn; do not widen the shape regex. ·
  issue: ISS-091
- [C2a] sev: high · The Rubykumar attack survives intact one character away: "Ruby" against
  "My name is Ruby-Anne Smith." still ships as person:ruby, and "Anne" as person:anne. · Fix: keep
  the indexOf design, widen the boundary predicate so the intra-name joiners looksLikeAName already
  admits ('-', apostrophe, '.') count as word characters. · issue: ISS-092
ISSUES-WRITTEN: ISS-091, ISS-092
EXPLANATION: Everything the manifest asserts, I reproduced myself — 87/87, typecheck exit 0,
lint:structure green, the full mutation table including the no-op control (85/2 · 86/1 · 86/1 ·
87/0), the empty speakers.ts diff, the corpus numbers, and the pre-fix red. The work is real and
the reasoning is unusually good. It fails because the maker named the remaining hole and invited a
verdict on it, and I disagree with deferring it: this unit's stated purpose is anti-fabrication,
and "Welcome"/"I" invent a human being on identical grounds to "Good morning". Separately, the
first of the two attacks is not actually closed — hyphenate the name and it reappears unchanged.
Two halves of the same defect shipped as closed.
```

## What I re-ran (nothing below is the maker's pasted output)

| command | my result | manifest claim | verdict |
|---|---|---|---|
| `pnpm --filter '@lkb/index' test` | `tests 87 · pass 87 · fail 0` | 87/87 | ✅ matches |
| `pnpm -r typecheck` | all 5 packages Done, exit 0 | exit 0 | ✅ matches |
| `pnpm lint:structure` | tracker-audit OK (G1); depcruise **271 modules / 0 violations**; SNAPSHOT fresh | 271 / 0 | ✅ matches |

### Mutation table — re-run from scratch, control included

Byte backup taken with `cp` before each mutation, restored with `cp` + `cmp` after each;
`git status --short` empty at the end. Baseline 87/0.

| mutation | my result | manifest claim |
|---|---|---|
| remove the name-shape guard (`if (!looksLikeAName(name)) continue;`) | **85 / 2** | 85 / 2 ✅ |
| remove the word-boundary guard (`containsNameVerbatim` → `.includes`) | **86 / 1** | 86 / 1 ✅ |
| remove the 4-token cap (`> 4` → `> 99`) | **86 / 1** | 86 / 1 ✅ |
| **no-op control** (inserted a comment line) | **87 / 0** | 87 / 0 ✅ |

The maker's note about restoring with `cmp` against a byte backup rather than `HEAD` is correct in
general and moot at this commit (the hardening is committed, so a HEAD diff would have worked too);
I used the byte backup anyway, since it is the discipline that survives the uncommitted case.

### [I2] — `speakers.ts` byte-unmodified

`git diff 7048094 57f4e99 -- packages/index/src/pipeline/speakers.ts` → **empty**. Holds.

### [C12] — the 5 new tests against the PRE-fix module

Checked out `7048094:speakers-llm.ts` over the current file, ran the current test file, restored
(`cmp` clean). Result: **84 pass / 3 fail**, the three being exactly

```
✖ refuses a name that only appears INSIDE a longer word
✖ refuses a lowercase phrase that happens to be in the transcript
✖ refuses an absurdly long 'name' -- a sentence is not an identity
```

Three of the five are genuinely red-first and pin the fix; the other two ("still accepts the
legitimate names", "accepts a name at the very start and very end") are green on both sides — they
are regression guards, which is a legitimate and useful thing for them to be. The **manifest**
states only "82 before + 5 new" and is accurate. The **commit message**'s parenthetical, "82 + 5
new, written first, red before the fix", overstates it: 3 were red, not 5. Low severity, no ledger
row per D-013/D-014 — but worth not repeating, because the mutation-pinning claim is the one C12
exists to make.

### [C13] — corpus numbers, re-derived not read

I re-derived them by running the modules over `data/toc-migrated/*/turns.json` myself:

```
positional-sessions=11  positional-turns=494  resolved=78  degraded=11/11
```

78/494 = **15.8%**, and 11/11 sessions degrade honestly with a non-null `degraded.reason` under a
throwing provider. Both figures reproduce exactly. (For the record, the corpus has 23 sessions /
1950 turns in total; 12 sessions already carry real speakerRefs and are out of scope by [C5], which
is why the denominator is 494 and not 1950. The manifest's "11/11" is right but reads as if the
corpus had 11 sessions — a scoping word would help the next reader.)

## The adversarial pass — where a fabricated name still gets through

Probes run against the committed module through `extractSpeakers` with an injected `complete`
(temp test file, deleted after; working tree clean).

| probe | turn text | `displayName` | result |
|---|---|---|---|
| capitalised greeting standalone | `Welcome everyone to the session.` | `Welcome` | 🔴 **SHIPPED** `person:welcome` |
| acknowledgement | `Thanks for having me.` | `Thanks` | 🔴 **SHIPPED** `person:thanks` |
| interjection | `Okay so let us begin.` | `Okay` | 🔴 **SHIPPED** `person:okay` |
| **bare pronoun** | `I am going to start now.` | `I` | 🔴 **SHIPPED** `person:i` |
| two-word title-case prose | `Thank You for joining.` | `Thank You` | 🔴 **SHIPPED** `person:thank-you` |
| **hyphenated name, prefix** | `My name is Ruby-Anne Smith.` | `Ruby` | 🔴 **SHIPPED** `person:ruby` |
| **hyphenated name, suffix** | `My name is Ruby-Anne Smith.` | `Anne` | 🔴 **SHIPPED** `person:anne` |
| underscore adjacency | `user Ruby_k logged in.` | `Ruby` | 🔴 **SHIPPED** `person:ruby` |
| possessive | `Ruby's report is ready.` | `Ruby` | 🟢 shipped — **correct**, that turn does name Ruby |
| punctuation adjacent | `Hello, Ruby! Nice.` | `Ruby` | 🟢 shipped — correct |
| digit adjacency | `Room Ruby2 is booked.` | `Ruby` | 🟢 refused — correct |
| Devanagari, exact | `मेरा नाम प्रशांति है।` | `प्रशांति` | ⚪ refused |
| Devanagari, inside a longer word | `मेरा नाम प्रशांतिकुमार है।` | `प्रशांति` | ⚪ refused |
| CJK | `私はタナカです` | `タナカ` | ⚪ refused |

### On the hole the maker named (ISS-091) — my plain answer

The maker asked for a plain verdict and offered a FAIL. **I take it.** The reasoning:

The unit's own commit message states the standard: *"the model supplies displayName, so 'it
appeared in the text' is not sufficient — it has to have appeared **as a name**."* That is the right
standard and I am judging against it, not against a criterion I invented mid-verdict. Under it,
`"Welcome"` fails for precisely the reason `"Good morning"` fails: a greeting is not a person.
`looksLikeAName` does not test whether a string is a name; it tests whether a string is
**capitalised**. In transcript prose the first word of nearly every sentence is capitalised, so the
guard's discriminating power against the attack it was built for is close to nil — it caught
`"Good morning"` only because English does not capitalise the second word of a greeting.
`person:i`, from an ordinary first-person sentence, is the clearest demonstration: a pronoun is
shape-valid, whole-word-present, and a fabricated human being.

I accept that a general stopword list is a larger design decision. I do not accept that it is the
only way out, and the size of the eventual fix does not change whether the unit closed the hole it
says it closed. Two cheaper options, either of which would clear [C2b]: reject a small set of
discourse words as a whole `displayName`; or — better, and aligned with [C12] — require a naming
cue in the evidence turn (`"my name is"`, `"this is"`, a vocative comma, a handover), which is what
makes admitting greeting/handover evidence safe in the first place. Bare containment is doing the
work of a naming test, and it cannot.

### On the hole the maker did not name (ISS-092) — the more clear-cut FAIL

This one needs no disagreement about scope. **The first of the two attacks is not closed.**
`"Ruby"` against `"My name is Ruby-Anne Smith."` is the identical defect — a real person's turns
attributed to a different real person whose name is a prefix of theirs — and it still ships. The
boundary predicate `/[\p{L}\p{N}]/u` treats `-` as a word boundary, while `looksLikeAName`'s token
regex `/^\p{Lu}[\p{L}'’.-]*$/u` explicitly admits `-` and apostrophes as *intra-name*. The module
holds two contradictory definitions of where a name ends, and the containment side is the one that
fails open. The fix is small and does not disturb the design.

The `indexOf`-not-`RegExp` reasoning is, for what it is worth, correct and well argued — a
mis-escaped constructed pattern does fail open. Keep it; only the boundary predicate needs to widen.

## Notes that are not failures

1. **Non-Latin scripts are refused wholesale.** `looksLikeAName` requires `\p{Lu}`, which Devanagari
   and CJK do not have, so no name in those scripts can ever resolve. This is fail-*closed*, so it
   is a recall cost, not a fabrication — and the TOC corpus is transliterated-Latin throughout, so
   it costs nothing today. But **Known gap 2 understates it**: it says the *particle list* is
   Latin-script and short; the real limit is that the *shape guard itself* is Latin-only. Worth one
   sentence in the next manifest, not a fix.
2. **Stale docstring.** `containsNameVerbatim`'s comment reads *"Unicode-aware lookarounds are used
   rather than ``, which is ASCII-only…"* — an unfinished sentence describing a RegExp
   implementation, sitting directly above a comment that says *"Deliberately not a RegExp."* Leftover
   from an earlier draft; it contradicts the design it documents. Low, EXPLANATION only.
3. **Known gap 3 is honest and I agree with it.** The 4-token cap is a judgement call and says so.
   Note that it is also the weakest of the three guards: it fires only past four tokens, so the
   entire class of two- and three-word title-case prose (`"Thank You"`, `"Good Morning Everyone"`)
   passes it — which is a symptom of ISS-091, not a separate defect.
4. **Same-first-name collision** (`personIdFor`) is correctly still out of scope here and stays
   blocking on the apply unit — [I2] forbids touching `speakers.ts` and the maker did not.

## Contract amendment (checker-owned, applied with this verdict)

Per the maker's request, `qa/contracts/speaker-resolution-llm.md` C2 is amended — **routine
(tightening)**, not critical: nothing is weakened, no criterion was invented to fail a conforming
artifact, and both additions restate holes this checker's own cycle-1 verdict had already placed on
the contract's deferred list before this unit was built.

- **[C2a]** — whole-word containment, and the terminating boundary must not be a character that
  joins a name to itself (hyphen, apostrophe). A match inside a longer *name* is dropped.
- **[C2b]** — name-shape is **necessary but not sufficient**. A capitalised ordinary word
  functioning as discourse rather than identity is dropped. Mechanism is the maker's choice; the
  criterion is the outcome.
- "Deferred to the apply/persist unit" item 1 (token-boundary substring) is **un-deferred** — this
  unit elected to take it, so it is judged here. Item 2 (`personId` collision) stays deferred,
  unchanged.

## What cycle 2 needs

1. Close ISS-092 (boundary predicate) — small, mechanical, no design question.
2. Close ISS-091 — pick a mechanism and say why; a naming-cue requirement would be the stronger
   answer and would also harden [C12]'s "the verbatim rule is the only surviving guard".
3. Pin both with red-first tests, and re-run the mutation table with the control.
4. One sentence in Known gaps upgrading gap 2 to "the shape guard is Latin-script-only".
5. Delete the stale lookaround docstring.

Nothing else in this unit needs to change. The verification discipline on display here —
mutation table with a control, an invalidated control reported rather than hidden, `cmp` against a
byte backup, an explicit refusal to soften C2 in cycle 1 — is the standard, and this FAIL is about
coverage, not craft.
