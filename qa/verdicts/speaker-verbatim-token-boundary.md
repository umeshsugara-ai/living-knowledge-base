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

---

# Verdict — speaker-verbatim-token-boundary (cycle 2)

**Date:** 2026-09-08
**Cycle checked:** 2
**Commit checked:** `ff8ef8d`
**Worktree:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`)
**Contract:** `qa/contracts/speaker-resolution-llm.md` (unamended by this verdict)
**Mode:** A

```
VERDICT: FAIL
SCOREBOARD: 12/14 criteria met, 4/4 invariants hold
FAILURES:
- [C2b] sev: critical · The naming-cue rule does not close the criterion — 20 of 20 fabricated-person
  attacks ship. One capitalised non-name adjacent to any cue is enough: "Welcome Everyone to the
  session." yields person:everyone, "Thanks All for being here." yields person:all, "Hi Guys" yields
  person:guys, "Welcome To the annual conference." yields person:to. C2b names pronouns explicitly and
  "Everyone"/"All" are indefinite pronouns. · Fix: the cue is in the wrong slot — it evidences that the
  TURN names someone, never that the CANDIDATE is a name; add a candidate-level discourse rejection
  ALONGSIDE it, do not extend the cue list. · issue: ISS-093
- [C1] sev: high · The cue rule refuses the greeting / handover / third-party-mention evidence class
  this contract exists to admit. "Good morning Prasanti, please go ahead.", "Prasanti, what do you
  think about this?" (the contract's own cited probe A3) and "Our next presenter is Nilesh Gotecha."
  are all refused, with no C2a/C2b ground for the drop. · Fix: widen the cue list once ISS-093's
  candidate-level guard carries the anti-fabrication load; then re-derive the corpus figure per C13.
  · issue: ISS-094
ISSUES-WRITTEN: ISS-093, ISS-094 (ISS-091, ISS-092 -> fixed)
EXPLANATION: I reproduced everything the manifest asserts — 99/99, typecheck exit 0, lint:structure
green, the full mutation table including the no-op control, the empty speakers.ts diff, and both
cycle-1 attacks now genuinely refused. The three re-fixtured tests are clean: prose only, not one
assertion loosened or deleted. It fails because the fix is narrower than the finding. ISS-091's
literal reproductions are closed, but its defect class — a human being invented out of discourse
text — is wider open than before I could measure it: every attack I aimed at the cue rule landed.
```

## What I re-ran (nothing below is the maker's pasted output)

| command | my result | manifest claim | verdict |
|---|---|---|---|
| `pnpm --filter '@lkb/index' test` | `tests 99 · pass 99 · fail 0` | 99/99 | matches |
| `pnpm -r typecheck` | all 7 packages Done, exit 0 | exit 0 | matches |
| `pnpm lint:structure` | lint-root OK · lint-dupes OK (265 exports) · lint-migrations OK (860 files) · SNAPSHOT fresh · tracker-audit OK (G1) · depcruise **271 modules / 0 violations** | green | matches |

### Mutation table — re-run from scratch, control included

`cp` byte backup before each mutation, `cp` restore + `cmp` after each, `git status --short` empty
at the end. Baseline 99/0.

| mutation | my result | manifest claim |
|---|---|---|
| cue rule -> plain containment | **94 / 5** | 93 / 5 (fails match) |
| remove name-shape guard | **95 / 4** | 95 / 3 (arithmetic) |
| remove the 4-token cap | **98 / 1** | 98 / 1 (matches) |
| empty `NAME_JOINERS` | **98 / 1** | 97 / 1 (arithmetic) |
| **no-op control** | **99 / 0** | 99 / 0 (matches) |

**Judgement on the maker's claim that all four guards are independently pinned: upheld.** Each
mutation moves the suite from green, and the control does not. The four tests added this cycle are
doing real work — I confirmed the shape guard and the cap are reachable only through a cued fixture,
which is exactly what the maker's own first cycle-2 table exposed and then closed.

Two rows do not sum to the 99-test baseline (95+3, 97+1 = 98), i.e. they were carried over from the
98-test run rather than re-measured after the four tests were added. Cosmetic; the failure counts
that matter are right and the conclusion is unaffected. Say 99 next time.

### The three re-fixtured tests — audited line by line

`git diff 57f4e99 ff8ef8d -- packages/index/src/pipeline/speakers-llm.test.ts`. The maker flagged
this itself as the move that can disguise a weakened test. It did not.

| test | fixture change | assertions | still proves |
|---|---|---|---|
| partial survival | `"Ruby again here."` -> `"This is Ruby again."` | **byte-identical** | yes — `t404` still fabricated, still dropped, speaker still retained on `t1`+`t2` |
| contradiction unresolved | `"Actually Rahul Mehta."` -> `"Actually, my name is Rahul Mehta."` | **byte-identical** | yes — and strictly *more*: under the cue rule the old fixture would have been filtered before reaching the contradiction guard, so the test would have passed vacuously |
| offsets at both edges | `"That would be Ruby"` -> `"Over to Ruby"` | **byte-identical** | yes — name still terminal in the string, offset arithmetic at the end edge unchanged; `"Ruby speaking."` (start edge) untouched |

No assertion was loosened, weakened, or deleted; no `assert` line appears in the diff at all. Nothing
was converted to a `skip`, a `todo`, or a looser matcher. The middle row is a small improvement.

### ISS-091 / ISS-092 — verified individually

| probe | result |
|---|---|
| `"Ruby"` in `"My name is Rubykumar Shah."` | refused |
| `"Ruby"` in `"My name is Ruby-Anne Smith."` | refused |
| `"Anne"` in `"My name is Ruby-Anne Smith."` | refused |
| `"Ruby-Anne Smith"` claimed whole | **shipped** `person:ruby-anne-smith` (correct) |
| `"Welcome"` / `"Thanks"` / `"Okay"` / `"I"` standalone | all refused |
| `"Good morning"` | refused |

**ISS-092 is genuinely closed** and I have marked it `fixed`. Sharing `NAME_JOINERS` broke no
legitimate case I could find: `"My name is Ruby."`, `"J. Smith"`, `"D'Souza"`, `"O'Brien"` (curly
apostrophe) and `"Over to Ruby. Next slide please."` all still resolve.

**ISS-091 is marked `fixed` only for its literal reproductions.** Its defect class is not closed —
that is ISS-093 below, and it is why this cycle FAILs.

### ISS-093 — the cue rule, attacked (20 attacks, 20 shipped)

Single turn, injected `complete` returning `{speakerRef:"spk:0", displayName:N, turnIds:["t1"]}`.

| transcript text | displayName | result |
|---|---|---|
| `Welcome Everyone to the session.` | `Everyone` | **shipped** `person:everyone` |
| `Hello Everyone, thanks for joining.` | `Everyone` | **shipped** `person:everyone` |
| `Hey Everyone welcome aboard.` | `Everyone` | **shipped** `person:everyone` |
| `Thanks All for being here.` | `All` | **shipped** `person:all` |
| `Hi Guys, let us start.` | `Guys` | **shipped** `person:guys` |
| `Hi There, can you hear me?` | `There` | **shipped** `person:there` |
| `Welcome Back to the second session.` | `Back` | **shipped** `person:back` |
| `Welcome To the annual conference.` | `To` | **shipped** `person:to` |
| `Thank you So much everyone.` | `So` | **shipped** `person:so` |
| `I'm Sorry about the delay.` | `Sorry` | **shipped** `person:sorry` |
| `I am Not sure about that.` | `Not` | **shipped** `person:not` |
| `That's Great news for us.` | `Great` | **shipped** `person:great` |
| `This is Important for all of you.` | `Important` | **shipped** `person:important` |
| `Thank you Monday for the slot.` | `Monday` | **shipped** `person:monday` |
| `Monday with us marks the deadline.` | `Monday` | **shipped** `person:monday` |
| `Welcome Diwali celebrations this week.` | `Diwali` | **shipped** `person:diwali` |
| `This is India speaking on the panel.` | `India` | **shipped** `person:india` |
| `Coming up next, Mumbai from the west zone.` | `Mumbai` | **shipped** `person:mumbai` |
| `Google here has an announcement.` | `Google` | **shipped** `person:google` |
| `English speaking students may apply.` | `English` | **shipped** `person:english` |

Three things make this a critical rather than a curiosity:

1. **`"Welcome Everyone to the session."` is the archetypal opening line of this corpus** — a webinar
   greeting, not a contrived string. `person:everyone` is precisely "a human being invented out of a
   greeting", the sentence the manifest gives as this unit's whole purpose.
2. **C2b names pronouns explicitly.** `"Everyone"`, `"All"` are indefinite pronouns; `"There"` is an
   expletive pronoun. The criterion enumerates the exact category that ships.
3. **The maker's own new shape-guard test is one capital letter from being defeated.** It asserts that
   `"Welcome back to another session."` / `"back"` is refused. Capitalise it — `"Welcome Back to the
   second session."` / `"Back"` — and it ships. The test pins the guard against lowercase prose, which
   the manifest itself argues is not the case that matters in a transcript.

**Why it happened, for cycle 3.** The cue was put in the wrong slot. `citesNameAsAnIntroduction`
*replaced* `containsNameVerbatim` at `speakers-llm.ts:243`, so the cue became the sole gate on the
containment side. But a naming cue is evidence about the **turn** ("this sentence introduces or
addresses someone"); it is not, and cannot be, evidence about the **candidate** ("this string is a
name"). The maker's reasoning for preferring a cue over a stopword list — that a stopword list is
unbounded and language-specific — is sound as far as it goes, but it argues for cue *in addition to*,
not *instead of*, a candidate-level rejection. The cue supplies the missing half of the evidence; it
does not supply the half `looksLikeAName` was already failing to supply.

**Extending the cue list will not fix this and cycle 3 should not try.** The bypass needs one
capitalised token adjacent to one cue; a longer list is a longer attack surface. Add the
candidate-level discourse rejection that ISS-091's `fix_direction` listed as option 1 — greetings,
interjections, acknowledgements, pronouns (`everyone`, `all`, `guys`, `there`), particles and
prepositions (`to`, `so`, `back`, `not`), weekday and month names — and keep the cue. Then pin it
with the table above; every row is a ready-made test.

### ISS-094 — the recall side, which I own a share of

I proposed the naming cue in ISS-091's `fix_direction`, so I state plainly that this finding is
partly a cost of my own suggestion. It is still a finding: these refuse, and no criterion authorises
the drop.

| transcript text | displayName | result |
|---|---|---|
| `Good morning Prasanti, please go ahead.` | `Prasanti` | **refused** |
| `Prasanti, what do you think about this?` | `Prasanti` | **refused** |
| `Our next presenter is Nilesh Gotecha.` | `Nilesh Gotecha` | **refused** |
| `Prasanti said the deadline is Friday.` | `Prasanti` | **refused** |

The middle two matter most. The contract's "Why this is a separate contract" section justifies this
file's existence on the ground that the LLM path *deliberately admits* greeting and handover
evidence, and cites `"Prasanti, what do you think?"` by name as the probe that proved it. C12 then
makes that admission the reason the verbatim rule is load-bearing. The cue rule has quietly reverted
this path toward the deterministic C6 posture it was written to differ from — `"hi"`/`"hello"`/`"hey"`
are cues but `"good morning"` is not, and a vocative comma is not a cue at all. The manifest declares
a general recall cost honestly; it does not say the contract's three headline evidence classes are
among the losses. Fix it together with ISS-093 — once a candidate-level guard carries the
anti-fabrication load, the cue list can widen safely.

### Criteria and invariants

12/14 met. **C1** fails on ISS-094 (a verbatim, whole-word, name-shaped `displayName` with no C2a/C2b
ground for a drop is not kept). **C2b** fails on ISS-093. C2, C2a, C3–C13 met and re-derived. **I1**
(no throw), **I2** (`speakers.ts` diff is 0 lines against `57f4e99`; last touched at `1983c82`),
**I3**, **I4** (99/99, no pre-existing test lost) all hold.

### Notes, not failures

- `"J"` against `"My name is J. Smith."` **ships** as `person:j` — a fragment of a longer name, the
  ISS-092 class, surviving because `.` is deliberately excluded from `NAME_JOINERS`. The exclusion is
  well-reasoned (including it would refuse `"My name is Ruby."`) and C2a enumerates hyphen, apostrophe
  and letter boundaries but not the period, so I am not charging it. Worth a comment in the code
  naming the residue, and reconsidering if the apply unit ever meets initials.
- `"Ruby"` in `"Ruby's slides are next, welcome all."` is refused — the possessive is a cue-less
  occurrence, so this is ISS-094's shape, not a separate defect.
- Non-Latin names (Devanagari, Han) are refused wholesale by `looksLikeAName`'s `\p{Lu}` anchor, since
  those scripts have no case. The maker states this correctly as a fail-closed recall limit in the
  cycle-2 notes. Not a criterion violation — no criterion requires non-Latin recall — but it should be
  a named open question on the apply unit, not only a manifest paragraph.
- The five-token name `"Maria Del Carmen Garcia Lopez"` is refused by the 4-token cap, as the maker's
  known gap 3 predicts. Consistent with the stated design.
- Prose in the manifest is accurate throughout, and the four cycle-1 notes I raised (the "11/11"
  phrasing, the overstated red-before-green claim, the stale docstring, understated gap 2) were each
  corrected rather than argued away.

### Ledger

- **ISS-091** -> `fixed` (literal reproductions closed; class continues as ISS-093)
- **ISS-092** -> `fixed` (closed outright, boundary joiners now shared)
- **ISS-093** (critical, open) — the cue rule does not close C2b; 20/20 attacks ship
- **ISS-094** (high, open) — the cue rule refuses the evidence class this contract admits

No contract amendment this cycle. C2a and C2b as written are exactly the criteria that caught this;
neither needs changing, and neither may be softened because the artifact fails one.

**Fix cycle 2 of max 3.** If cycle 3 lands a candidate-level discourse rejection alongside the cue,
widens the cue list to cover greeting/vocative/handover, and pins both with the two tables above,
this passes.

---

# Cycle 3 verdict — 2026-09-08

**Cycle checked: 3** · commit `62c4637` · manifest `qa/manifests/speaker-verbatim-token-boundary.md`
· contract `qa/contracts/speaker-resolution-llm.md` · worktree `D:\KnowledgeBase-lanes\a-speakers`
(branch `lane/a-speakers`).

```
VERDICT: FAIL
SCOREBOARD: 14/15 criteria met, 4/4 invariants hold
```

## What I re-ran myself

| command | my result | manifest claim |
|---|---|---|
| `pnpm --filter '@lkb/index' test` | tests 122 · pass 122 · fail 0 | 122/122 ✔ |
| `pnpm -r typecheck` | exit 0, all 6 packages Done | exit 0 ✔ |
| `pnpm lint:structure` | lint-loc OK (250 files), dirsize/root/dupes/migrations OK, SNAPSHOT matches, tracker-audit G1 OK, depcruise 272 modules / 0 violations | green ✔ |

**Mutation table, re-derived** (baseline 122/0; every mutation reverted with `cmp` against a byte
backup, final `cmp` clean, suite back to 122/0):

| mutation | my result | manifest |
|---|---|---|
| `isDiscourseOnly` → `false` | **120 / 2** | 120/2 ✔ |
| un-tier the demonstrative (drop `multiToken &&`) | **120 / 2** | 120/2 ✔ |
| `addressed` → `true` (drop the address comma) | **121 / 1** | 121/1 ✔ |
| `looksLikeAName` → `true` | **120 / 2** | 120/2 ✔ |
| cue rule → plain `nameOccurrences().length > 0` | **118 / 4** | 118/4 ✔ |
| empty `NAME_JOINERS` (cycle-2 guard, still pinned) | **121 / 1** | — |
| **no-op control** (byte-identical rewrite) | **122 / 0** | 122/0 ✔ |

Every guard is independently pinned and none subsumes another. The control is honest. My first
attempt at the address-comma and joiner mutations silently failed to match (perl escaping) and read
122/0 — I caught that by grepping the mutated line before trusting the number, and both reproduce the
manifest once actually applied. Worth stating, because a mutation that did not apply looks exactly
like a guard the suite does not pin.

**C13 re-derived over the real corpus** (my own script over `data/toc-migrated/*/turns.json`, not the
maker's): `{sessions: 23, sessionsWithPositional: 11, positionalTurns: 494, resolvedTurns: 78,
pct: 15.8, names: ["Ruby", "Jubin Thakkar"]}`. Exactly the manifest's figures, including the corrected
"11 of 23" phrasing and the two speakers.

**[I2] holds — `speakers.ts` is byte-untouched.** `git diff 57f4e99^ HEAD -- packages/index/src/pipeline/speakers.ts`
is empty; the file was last touched at `1983c82`, before this unit began. The whole unit's diff is
4 files: `index.ts` (+1), `speaker-name-rules.ts` (+217, new), `speakers-llm.test.ts` (+233/-3),
`speakers-llm.ts` (+10/-3).

## ISS-094 — CLOSED

Re-probed with the four reproductions recorded in the row itself. 3 of 4 now ship:
`"Good morning Prasanti, please go ahead."` ✔, `"Prasanti, what do you think about this?"` (the
contract's own probe A3) ✔, `"Our next presenter is Nilesh Gotecha."` ✔. The fourth,
`"Prasanti said the deadline is Friday."`, is still refused — but that is a bare third-party mention
with no naming cue, i.e. the general recall cost the manifest declares openly, not the
greeting/handover/address class the contract exists to admit. The three headline classes are back.
I also confirmed the surrounding class independently: mononym self-naming, `"Ruby here again."`,
`"Rahul Mehta speaking."`, `"Prasanti, over to you."`, `"My name is Ruby-Anne Smith."`,
`"This is Sean D'Souza speaking."`, `"This is Makrand Rajadhyaksha."`, `"My name is A. R. Rahman."` —
all ship. **The comma discriminator does real work and it did not cost the address class.** Marked
`fixed` in the ledger.

## ISS-093 — NOT CLOSED. 15 of its 20 recorded attacks refuse; 5 still ship

The manifest's headline is **"12/12 fabrications refused"**, and that is true — of a 12-case corpus
the maker authored this cycle. ISS-093's ledger row records **20** reproduced attacks, and I re-ran
those twenty verbatim against `62c4637`:

```
refused x15   SHIPPED x5:
  "I am Not sure about that."                  / "Not"     -> person:not
  "This is India speaking on the panel."       / "India"   -> person:india
  "Coming up next, Mumbai from the west zone." / "Mumbai"  -> person:mumbai
  "Google here has an announcement."           / "Google"  -> person:google
  "English speaking students may apply."       / "English" -> person:english
```

Four of those five are the gazetteer class — place, org and language proper nouns — and I am **not**
charging them. `"India"`, `"Mumbai"`, `"Google"` are not discourse words; C2b's class is "an ordinary
English word functioning as discourse rather than as an identity", and no pattern separates a city
from a person without world knowledge. The maker states this as honest limit 1 and it is honest. My
own additional probes in the same family (`"Our next presenter is Microsoft."`,
`"Please welcome Tata Consultancy Services."`, `"My name is Bangalore."`, `"Over to Singapore for the
update."`, `"Good morning Marketing, please go ahead."`, `"Chairman, what do you think?"`) all ship
too, for the same irreducible reason. **Scoping note, not a failure** — but it must become a named
open question on the apply/persist unit, because that is the unit where a fabricated `person:microsoft`
would actually land in a document.

**`"Not"` is different, and it is the FAIL.** It is a negation particle: a closed-class English
function word, squarely inside the class the maker enumerated and squarely inside C2b. It is not a
gazetteer problem — it needs no world knowledge, only one more entry in `NEVER_A_PERSON`. And it was
named **by that exact word** in ISS-093's own fix direction ("prepositions/particles `to`/`so`/`back`/
`not`"): `to`, `so` and `back` are all in the list; `not` is not. `person:not` ships today from a
sentence a real transcript contains.

Related, and the reason the residue was missed: the manifest's account of the demonstrative demotion
overclaims. It says `"This is India calling."` was the one attack a pattern could not reach and was
closed by demoting the bare demonstrative for single-token candidates. That closes *that sentence*,
but the demotion applies only to `DEMONSTRATIVE_CUES` — `"This is India speaking on the panel."` ships,
because `speaking` is a `NAMING_CUES_AFTER` cue and the after-cues were never tiered. The guard is
narrower than the prose claims it is.

## Criteria

- **[C2b] fails** — one reproduced case (`"Not"`). Every other criterion is met and re-derived by me,
  not read: C1 (evidence deduplicated, in transcript order, `turnId` paired with its own `sessionId`),
  C2 / C2a (Rubykumar, Ruby-Anne, Ruby_k all refused), C3, C4, C5, C6, C7 (the two-name contradiction
  still lands in `unresolved`), C8, C9, C10, C11, C12 (five independent mutations, each reproducible),
  C13 (re-derived above).
- All four invariants hold. Earlier verdicts in this file counted 14 criteria; the contract as it now
  stands carries 15 (`C1, C2, C2a, C2b, C3–C13`), which is why the denominator moved.

## The three fixture rewrites — audited across all three commits, nothing weakened

I diffed `speakers-llm.test.ts` at `57f4e99`, `ff8ef8d` and `e226276`. **Every removed line across all
three commits is a fixture string. Not one assertion was deleted, relaxed or renamed**; the removals
are exactly:

```
ff8ef8d  - "Ruby again here."   - "Actually Rahul Mehta."   - "That would be Ruby"
e226276  - "This is Ruby again."
```

and each rewritten test still exercises what it claims:

- *partial evidence survival* — still cites `["t1","t404","t2"]` and still asserts both real turns
  survive and the invented one does not.
- *contradiction* — still two distinct names on one label, still asserts `resolved: []` +
  `unresolved: ["spk:0"]`.
- *offset arithmetic at both edges* — still one fixture with the name **first** (`"Ruby speaking."`)
  and one with it **last** (`"Over to Ruby"`). The edge property is intact; only the cue changed.

Three rewrites in three cycles is a pattern worth naming, and I looked hard at it. It is **not**
masking anything here: each rewrite was forced by a guard the checker demanded, each was disclosed in
the manifest before I looked, and the assertion side is byte-stable. What it *does* mask is coverage
drift — the maker found this itself in cycle 2 ("the suite had stopped pinning two guards") — so the
mutation table, not the pass count, is what keeps these tests honest. Keep running it every cycle.

## `speaker-name-rules.ts` — legitimate split

The seam is real: the four exported guards answer a question about names and text and import nothing
from providers, jobs, or `speakers.ts`. `lint-loc` passes for the right reason — `speakers-llm.ts` is
genuinely 160 lines of extraction and the rules are 218 lines of rules, not a 321-line file cut at
line 300 to satisfy a budget. Nothing duplicates `speakers.ts`, which keeps only `personIdFor` and its
own regex self-naming pass — a different concern.

One real duplication **inside the new file**: `containsNameVerbatim` and `nameOccurrences` carry
byte-identical `isNameChar` predicates and identical scan loops, and `containsNameVerbatim` now has
**no production caller** — it is re-exported from `index.ts` and referenced only in a test comment.
Two copies of a boundary rule is precisely the shape of the ISS-092 defect (two definitions of where a
name ends, drifting apart). Low severity, filed as a note, not a failure.

## Notes, not failures

- **A real mononym that collides with the calendar list is refused.** `"My name is May."` → refused;
  `"My name is June."` likewise. The maker deliberately kept `Grace`/`Hope`/`Summer` out of the
  denylist but months are in it, and `May`/`June`/`April` are real given names. `"This is April
  Summers."` ships only because `isDiscourseOnly` requires *every* token to be discourse. This is a
  recall cost in the safe direction and C2b authorises the drop, so it is not a violation — but it is
  a named limit the manifest does not state, and the measurement unit should count it.
- **`"J"` from `"My name is J. Smith."` still ships as `person:j`** — carried from cycle 2, disclosed
  by the maker as limit 4, and I am again not charging it: C2a enumerates hyphen, apostrophe and
  letter boundaries and deliberately excludes the period for a sound reason. A minimum length of two
  characters for a single-token candidate would close it at no cost. Must be blocking on the apply unit.
- Non-Latin scripts still refused wholesale by `\p{Lu}`; the 4-token cap still refuses a genuine
  five-part name. Both stated correctly by the maker as fail-closed limits.
- The manifest is otherwise accurate. Every number in it that I could re-derive, I re-derived, and
  every one matched.

## Ledger

- **ISS-094** → `fixed` (3/4 recorded reproductions now ship; the fourth is the declared no-cue
  recall cost, not this class).
- **ISS-093** → stays `open`, with a cycle-3 `checker_note`: 15/20 refused, 4 residual are the
  uncharged gazetteer class, 1 is chargeable.
- **ISS-095** (medium, new) — the chargeable residue: `"Not"` ships as `person:not`.
- **ISS-096** (low, new) — duplicated boundary predicate + uncalled `containsNameVerbatim` export.

No contract amendment this cycle. C2b as written is exactly the criterion that caught this and needs
no change; nothing was softened.

## What cycle 3 failing means, stated plainly

This unit is **three fix cycles in and now materially correct**: 20 of the checker's 24 combined
attacks refuse, all three of the contract's headline evidence classes are back, five guards are
independently mutation-pinned, and `speakers.ts` never moved. It fails on **one closed-class word**
that the issue it claims to close names explicitly. Per the max-3 rule this unit is now **STALLED**
and escalates to the Approver — and the escalation should say what it is: not a design failure, a
one-line omission plus a measurement-scope habit. The remedy is `"not"` (and, while there,
`"nor"`, `"never"`, `"very"`, `"really"`, `"quite"`) added to `NEVER_A_PERSON` with a pin, plus one
standing rule for the next cycle: **the closure corpus is the ledger row's, not a fresh one.** The
maker measured 12/12 against attacks it chose; had it re-run the 20 in ISS-093, it would have found
this itself.
