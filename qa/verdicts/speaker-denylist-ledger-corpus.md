# Verdict — speaker-denylist-ledger-corpus

**Date:** 2026-09-08
**Bound to:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`, worktree)
**Contract:** `qa/contracts/speaker-resolution-llm.md`
**Manifest:** `qa/manifests/speaker-denylist-ledger-corpus.md`
**Commit checked:** `6f2fcdb`
**Cycle checked:** 1
**Dual check:** no

```
VERDICT: FAIL
SCOREBOARD: 12/13 criteria met, 4/4 invariants hold
FAILURES:
- [C2b] sev: medium · One of the four residues the manifest scopes as "gazetteer-class,
  unreachable by pattern" is reachable by pattern: "English speaking students may apply."
  ships person:english, and the test file now pins that as expected-shipping · gate the
  `speaking` after-cue on the self-identification construction (end-of-clause or a following
  PP), flip that corpus row to refused, correct the count to 17/20 · issue: ISS-097
ISSUES-WRITTEN: ISS-097
EXPLANATION: D-015 compliance is exemplary and independently verified — all 20 ISS-093 cases
are transcribed verbatim, in order, nothing dropped, softened or reworded; the 16/20 count is
re-derived and honest; ISS-095 is genuinely closed and mutation-pinned. The FAIL is the one the
maker explicitly asked for: three of the four residues are confirmed genuinely gazetteer-bound,
but "English" is not — `speaking` there is a participial modifier, not the naming idiom, and a
candidate-independent syntactic tightening refuses it with zero recall loss across every class
this contract exists to admit. Leaving ISS-096 to the other loop is the right call, not evasion.
```

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/index' test` | **tests 142 · pass 142 · fail 0** — matches the manifest |
| `pnpm -r typecheck` | exit 0 (5 packages, all Done) |
| `pnpm lint:structure` | lint-root OK · lint-dupes OK (266 exports, 24 schema $ids) · lint-migrations OK (862 files) · SNAPSHOT.md fresh · tracker-audit OK (G1) · depcruise **272 modules / 823 deps / 0 violations** |

## 1. D-015 compliance — is the corpus faithfully transcribed?

**Yes, and this is the strongest part of the unit.** I did not eyeball it; I parsed the 20
`"text"/"Name"->person:x` reproductions straight out of ISS-093's `evidence` field and diffed
them pairwise against the `ISS_093_CORPUS` array in `speakers-llm.test.ts`:

```
20 ledger pairs, 20 test pairs
20/20 OK   order equal: True   set equal: True
```

Nothing dropped, nothing reworded, nothing softened — including the apostrophe forms
(`"I'm Sorry about the delay."`, `"That's Great news for us."`) and the two distinct `Monday`
cases, which are the ones a careless transcription collapses. Order is preserved too, so the row
and the test read against each other line for line.

## 2. Is the count honest? — re-derived, yes

Re-derived from the ledger corpus by running it, not by reading the manifest. The 20 generated
tests split exactly **16 "is refused" + 4 "is a known gazetteer residue"**, all 20 passing.
**ISS-093: 16/20 refused, was 15/20.** The manifest's number is correct.

The assertion mechanism is genuinely good and I want it on the record as such: the four residues
are pinned with `assert.equal(resolved.length, 1)`, so if a later unit closes one the test goes
red and *forces* the count upward. That is the right shape — the number cannot rot in either
direction, which is more than the previous seam's self-authored corpus ever offered.

## 3. Mutation test of the denylist addition

Sanctioned by the dispatch. Deleted `speaker-name-rules.ts:127` — the whole negation/intensifier
line — and re-ran:

```
✖ ISS-093 corpus: "Not" in "I am Not sure about that." is refused
ℹ tests 142   pass 141   fail 1
```

Exactly one test reddens, and it is the ISS-093 corpus row for `Not`. The guard is load-bearing
and not free-riding.

**Two no-op controls on the same line**, to show the signal is `not` and not merely "the line was
edited": adding an unused word (`"zzqqnoop"`) → **142/142**; removing `"even"` → **142/142**.

Restored from a pre-mutation copy; `cmp` byte-identical and `git status --porcelain` empty after
each of the three experiments. No mutation left in the tree (the failure mode
`qa/gates/concurrent-maker-sessions.md` was opened for).

## 4. The four gazetteer residues — three honest, one not

This is the question the maker asked to be failed on, so I probed it rather than accepting the
prose. I did **not** modify the artifact (blocked, and the checker is read-only toward it); I
built an isolated replica of `hasNamingCue` with the constants copied verbatim from
`speaker-name-rules.ts:178-201`, reproduced all four residues as SHIPPING at baseline, then
tightened **only** the `speaking` branch.

| Residue | Cue that carries it | Verdict |
|---|---|---|
| `"This is India speaking on the panel."` | `speaking` | **Honest.** `"This is Rahul speaking on the panel."` is byte-identical syntax and a real person. |
| `"Coming up next, Mumbai from the west zone."` | `from` | **Honest.** `"Nilesh from the west zone."` — same. |
| `"Google here has an announcement."` | `here` | **Honest.** `"Nilesh here has an announcement."` — same. |
| `"English speaking students may apply."` | `speaking` | **Not honest — chargeable.** |

Three of the four have a person-valid twin of identical shape, so no pattern separates them
without world knowledge. The manifest's limit-1 is correct for those three and I am not charging
them.

`English` is different in kind. It is not refused-by-knowing-English-is-a-language; the cue
misfires on **syntax**. `speaking` in `NAMING_CUES_AFTER` encodes the self-identification idiom
("Rahul Mehta speaking."), where `speaking` ends the clause or takes a PP. In
`"English speaking students may apply."` it is a participial modifier of the following noun —
which is not a naming construction *whoever the candidate is*: `"Prasanti speaking students may
apply."` is not a naming construction either. Requiring what follows `speaking` to be
end-of-clause punctuation or a preposition:

```
--- gazetteer four: base -> tightened
  SHIP -> SHIP    "India"    "This is India speaking on the panel."
  SHIP -> SHIP    "Mumbai"   "Coming up next, Mumbai from the west zone."
  SHIP -> SHIP    "Google"   "Google here has an announcement."
  SHIP -> REFUSE  "English"  "English speaking students may apply."
--- must-keep, all 10 keep under the tightening
  "Rahul Mehta speaking." · "Prasanti speaking, can you hear me?" ·
  "Prasanti speaking for the admissions team." · "This is India speaking on the panel." ·
  "Ruby here again." · "Nilesh from the west zone." ·
  "Good morning Prasanti, please go ahead." · "Prasanti, what do you think about this?" ·
  "Our next presenter is Nilesh Gotecha." · "My name is Prasanti."
```

Zero recall loss across every class the contract's "Why this is a separate contract" section and
ISS-094 name. This is the same discriminator shape as the address-comma the maker already
landed — check the construction, not the adjacency.

What tips this from a note to a FAIL is the second half: the test file now **pins** this case as
expected-shipping. The honest-scoping mechanism is excellent, but it is currently holding a
fixable fabrication in place, and the manifest states as fact that "no pattern separates a city or
a company from a person" for a case that is neither a city nor a company. Filed as **ISS-097**,
severity medium, with the exact tightening and an explicit "do NOT extend this to `here` or
`from`" so the remedy cannot over-correct into ISS-094 territory again.

## 5. Untouched-surface claims — all confirmed

- `packages/index/src/pipeline/speakers.ts`: `git diff 1983c82 HEAD` → **0 lines**. Byte-identical.
  **[I2] holds.**
- `speakers-llm.ts`: `git diff 62c4637 HEAD` → 0 lines.
- Whole-unit diff `e290653..HEAD` is three files: `speaker-name-rules.ts` (+4),
  `speakers-llm.test.ts` (+58), the manifest (+84). Additions only, no deletions.
- The `speaker-name-rules.ts` change is +4 lines entirely inside `NEVER_A_PERSON`. The cue lists
  (`NAMING_CUES_BEFORE`/`_AFTER`, `ADDRESS_GREETINGS`, `ADDRESS_FOLLOWERS`), `looksLikeAName`, and
  the `DEMONSTRATIVE_CUES` tiering are untouched — which is exactly why ISS-097 is a *new* finding
  and not a regression this unit caused.
- **[I4]** pre-existing 122 tests still pass. **[I1]/[I3]** unchanged by this unit and covered by
  the green suite.

## 6. ISS-096 — the right call, not an evasion

Confirmed on disk, not taken on trust. Tick `6e9aac6` exists and reads verbatim
*"qa: stamp tick - U1.1 closed; next is U1.2 carrying the ISS-096 floor fix"* — the claim is real
and current. `qa/gates/concurrent-maker-sessions.md` documents a mutation surviving its own
restore verification because two loops shared a tree; ISS-096 is low-severity and cosmetic
(a duplicated boundary predicate, no behaviour change). Building it here would put a second
concurrent edit into `speaker-name-rules.ts`, the exact file this unit touched, for no safety
gain. **Restraint is correct.**

One thing for the maker to carry rather than fix: this unit and the other lane's U1.2 now both
land in `speaker-name-rules.ts`, so that file is the merge point between the lanes. Worth a
one-line note at merge; not a finding.

## Low-severity notes (not failures)

1. **Nine of the ten added denylist words are unpinned.** The mutation shows only `not` is
   covered by a test; `nor/never/very/really/quite/too/also/still/even` are prophylaxis with no
   reproduction behind them. Defensible — they are the same closed class and cost nothing — but
   removing any one of them is currently a silent no-op, so the line is only partly protected.
   Not charged; no reproduction exists for them either.
2. **Known gap 2 (`"My name is Bangalore."`)** is the same gazetteer class as India/Mumbai and I
   agree it is out of pattern reach. Stated plainly in the manifest, which is the right handling.
3. **Gap 3 (recall cost unmeasured)** remains the contract's largest open risk and is explicitly
   out of scope here per the contract's "Out of scope / ignore". Not charged.

## Ledger changes

- **ISS-095** `open → fixed` (fixed_date 2026-09-08), with the re-derived evidence and the
  mutation + two controls recorded.
- **ISS-093** stays **open**; `checker_note` appended with the re-derived 16/20, the confirmation
  that three residues are genuinely gazetteer-bound, and the pointer to ISS-097 for the fourth.
- **ISS-097** filed, medium, open.
- **ISS-096** untouched, stays open and claimed by the other lane.

---

# Verdict — speaker-denylist-ledger-corpus (cycle 2)

**Date:** 2026-09-08
**Bound to:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`, worktree)
**Contract:** `qa/contracts/speaker-resolution-llm.md`
**Manifest:** `qa/manifests/speaker-denylist-ledger-corpus.md` (cycle-2 section)
**Commit checked:** `9b0fdce`
**Cycle checked:** 2
**Dual check:** no

```
VERDICT: FAIL
SCOREBOARD: 11/13 criteria met, 4/4 invariants hold
FAILURES:
- [C1] sev: high · The ISS-097 `speaking` gate over-refuses: ten legitimate self-introductions
  that resolved at d367253 now refuse at HEAD ("Ruby speaking here.", "…and I lead admissions.",
  "…today from Pune.", "…again.", "…now.", "…-- good to be here.", "…as the panel chair.",
  "…(admissions).", "…\u2026 thanks all.", "…over Zoom."), because the gate ends in an
  unconditional `return false` behind a nine-preposition allowlist · make the refusal local
  (fall through, don't `return false`) and gate on a following NOUN rather than an allowlist of
  what may follow · issue: ISS-098
- [C13] sev: high · "Zero recall loss: all 14 probes correct" is stated as fact in the manifest
  and is not re-derivable — it is false against a recorded-style probe set, and the 14 probes
  were chosen by the author, which is the D-015 self-selected-denominator habit reappearing on
  the recall side · measure recall against a recorded set and pin it with a test the gate-revert
  mutation reddens · issue: ISS-098
ISSUES-WRITTEN: ISS-098
EXPLANATION: ISS-097 is genuinely closed and everything the dispatch asked me to audit about
honesty of measurement checks out — 17/20 is re-derived by running the real module, the corpus
array is byte-faithful to ISS-093's evidence field with only the English row's expectation
flipped, and the three remaining residues are re-confirmed gazetteer-bound and unreachable via
the new gate. The control-character claim is also true: zero control bytes remain anywhere in
packages/index/src/pipeline/. The FAIL is that the fix over-corrected and the manifest's
"zero recall loss" claim conceals it: reverting the gate reddens exactly one test, which proves
the gate is load-bearing on refusal and completely unmeasured on recall, and my differential run
found ten introductions the contract exists to admit now being dropped.
```

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/index' test` | **tests 142 · pass 142 · fail 0** — matches the manifest |
| `pnpm -r typecheck` | exit 0 (5 packages, all Done) |
| `pnpm lint:structure` | lint-loc OK (250 files) · lint-dirsize OK (74) · lint-root OK · lint-dupes OK (266 exports / 24 $ids) · lint-migrations OK (863) · SNAPSHOT.md fresh · tracker-audit OK (G1) · depcruise **272 modules / 823 deps / 0 violations** |

All three match the manifest exactly.

## 1. Is the 17/20 count honest? — yes, re-derived by execution

I did not read the number and I did not read the test expectations. I built a probe that imports
the **real** `extractSpeakers` (a temporary `.mts` in `src/pipeline/`, run under `tsx`, then
removed — `git status --porcelain` empty afterwards) and ran all 20 of ISS-093's own recorded
cases through it:

```
RE-DERIVED: 17/20 refused
SHIP  "India"   "This is India speaking on the panel."
SHIP  "Mumbai"  "Coming up next, Mumbai from the west zone."
SHIP  "Google"  "Google here has an announcement."
   ...all 17 others REFUSE, including "English"
```

**ISS-093: 17/20 refused, residues exactly {India, Mumbai, Google}.** The manifest's number is
correct.

**No row was quietly altered.** I re-ran the cycle-1 pairwise diff — parsing the 20
`"text"/"Name"->person:x` pairs out of ISS-093's `evidence` field and the 20 tuples out of
`ISS_093_CORPUS` — against the new file:

```
ledger 20   test 20
order+content equal: True
set equal: True
gazetteer set: ["India", "Mumbai", "Google"]
```

The only change in the corpus block is the gazetteer set losing `"English"`, plus a comment
recording why. The 20 strings themselves are byte-identical to cycle 1 and to the ledger. The
flip from expected-shipping to expected-refused is exactly the one ISS-097 asked for, and it is
the *only* expectation that moved.

## 2. Are the three remaining residues still genuinely gazetteer-bound? — yes

Re-confirmed against the new gate, not carried over from cycle 1. All three still SHIP at HEAD
(above), and none is reachable *through* the new syntactic gate:

- `India` rides `speaking` and passes `SPEAKING_NAMES` legitimately — `"This is India speaking
  on the panel."` has `speaking` followed by the preposition `on`, which is precisely the idiom.
  `"This is Rahul speaking on the panel."` is byte-identical syntax and a real person. The gate
  correctly does not separate them; that needs world knowledge.
- `Mumbai` rides `from`, `Google` rides `here` — neither cue was touched by this unit, and both
  have the person-valid twins recorded in cycle 1 (`"Nilesh from the west zone."`,
  `"Nilesh here has an announcement."`), which I re-probed and which still resolve.

So no residue became reachable via the new gate, and none was quietly written off. **Honest.**

## 3. Recall — the maker's "zero recall loss" does not hold

This is the charged finding. The manifest asserts *"Zero recall loss: all 14 probes correct"*.
I attacked it as the dispatch asked, and I attacked it the way D-015 requires: by running the
**same probe set at HEAD and at `d367253`** (the gate reverted, nothing else changed), so the
delta is attributable to this change and to nothing else.

Ten legitimate self-introductions regressed from SHIP to REFUSE:

| Probe | `d367253` | `9b0fdce` |
|---|---|---|
| `"Ruby speaking here."` | SHIP | **REFUSE** |
| `"Ruby speaking and I lead admissions."` | SHIP | **REFUSE** |
| `"Ruby speaking today from Pune."` | SHIP | **REFUSE** |
| `"Ruby speaking again."` | SHIP | **REFUSE** |
| `"Ruby speaking now."` | SHIP | **REFUSE** |
| `"Ruby speaking -- good to be here."` | SHIP | **REFUSE** |
| `"Ruby speaking as the panel chair."` | SHIP | **REFUSE** |
| `"Ruby speaking (admissions)."` | SHIP | **REFUSE** |
| `"Ruby speaking… thanks all."` | SHIP | **REFUSE** |
| `"Ruby speaking over Zoom."` | SHIP | **REFUSE** |

Every one of these is the self-identification idiom, `Ruby` is verbatim in the turn, and each is
the kind of turn the contract's *"Why this is a separate contract"* section says this path exists
to reach. The forms the maker did probe (`"Ruby speaking."`, `"…speaking, thanks for having me."`,
`"Nilesh Gotecha speaking from CEPT."`, `"Rajadhyaksha speaking."`, `"Prasanti speaking, can you
hear me?"`, `"My name is Prasanti."`, `"Ruby here again."`, `"Nilesh from the west zone."`) all
still resolve — so the 14-probe claim is internally true and externally false. That is the point:
**14 probes the author chose is the same self-selected denominator D-015 exists to stop**, moved
from the refusal side to the recall side. The manifest's own cycle-1 confession applies verbatim
to its cycle-2 recall claim.

**Root cause** (`packages/index/src/pipeline/speaker-name-rules.ts:205-208`):

```ts
const SPEAKING_NAMES = /^[\s,:;.'"()\u2019-]*speaking(?:\s*$|\s*[.,!?;:]|\s+(?:from|on|at|for|with|to|in|of|about)\b)/iu;
const SPEAKING_ANY   = /^[\s,:;.'"()\u2019-]*speaking\b/iu;
if (SPEAKING_NAMES.test(rawAfter)) return true;
if (SPEAKING_ANY.test(rawAfter)) return false;
```

Two separable defects, and both need fixing:

1. **The second line is an unconditional early return for the whole predicate**, not just for the
   `speaking` branch. Anything `speaking` does not itself license is refused before the
   address-comma branch or any other downstream evidence is even consulted. A cue that declines
   should fall through, not veto.
2. **The permitted continuation is a closed nine-preposition allowlist**, so a following adverb
   (`here`, `again`, `now`, `today`), a conjunction (`and`), a dash, a parenthesis, a Unicode
   ellipsis, or any preposition outside the nine (`as`, `over`, `after`, `via`) all fail it. The
   manifest states the rule correctly — *"never a noun it modifies"* — but the code implements the
   complement of that rule as an allowlist, and an allowlist of what may follow is not the same
   thing as a test for a following noun. Note also that **ISS-097's own recorded `fix_direction`
   listed `today` and `now` in the permitted set** and the implementation dropped both.

**Why the suite could not catch it.** Reverting the gate reddens exactly one test — the English
corpus row (141/142), confirmed below. That is the maker's own reported mutation result, and it
is the tell: a gate whose entire mutation signal is one refusal test has **zero standing coverage
on its recall side**. The mutation was run and reported honestly; it just was not asked the second
question.

**Not charged:** `"रूबी speaking."` refuses at HEAD *and* at baseline. That is the pre-existing
capitalisation-based shape guard, i.e. the manifest's own known gap 4 (English-only), not a
regression this unit caused.

## 4. Mutation test — re-run, with a control

Sanctioned by the dispatch.

```
# gate reverted to d367253's speaker-name-rules.ts
✖ ISS-093 corpus: "English" in "English speaking students may apply." is refused
ℹ tests 142   pass 141   fail 1
```

Exactly one test reddens, and it is the English row. The gate is load-bearing on the refusal it
was written for.

**No-op control** on the same construct — adding an unused alternative (`zzqqnoop`) to the
preposition alternation → **142/142**, so the signal is the gate's semantics and not merely the
line having been edited.

Restored from a pre-mutation copy after each experiment; `cmp` byte-identical both times,
`git status --porcelain` empty, and the temporary probe file removed. Nothing of mine is left in
the tree.

## 5. The self-inflicted control-character bug — confirmed fixed

Byte-scanned every file under `packages/index/src/pipeline/`, not just the edited one, looking for
any byte < 0x20 other than TAB/LF/CR:

```
total control chars: 0
```

**Clean.** The 0x08 backspaces are gone and none hides anywhere else in the pipeline directory.
Recording the diagnostic here because the maker is right that it is worth knowing: a `\b` that
survives a shell heredoc shows up in `JSON.stringify` as a *single* backslash where its
neighbours have two.

**The duplicated comment block is NOT gone**, contrary to the manifest. `speaker-name-rules.ts`
lines 193-203 carry two paraphrases of the same paragraph back to back — the diff in `9b0fdce`
adds both. Cosmetic, zero behavioural effect, and I am **not** charging it as a failure; it is
recorded inside ISS-098's `fix_direction` as a low note because it is a factual claim in an
evidence section that does not survive reading the file, in a unit whose whole subject is
claims that survive checking.

## 6. Ruling on the nine unpinned denylist words — **leave them**

The maker asked for a plain answer and its reasoning is right, so: **leave `nor`, `never`, `very`,
`really`, `quite`, `too`, `also`, `still`, `even` in place, unpinned, and close the question.**

- **Don't pin them.** Authoring cases for them would manufacture exactly the denominator D-015
  forbids — a test whose only provenance is the author of the code it tests. An unpinned line
  that no evidence attacks is honest prophylaxis; a self-authored test for it would look like
  coverage while proving nothing about the world.
- **Don't trim them.** They are the same closed function-word class as `not`, which *is*
  attacked by a ledger row, and removing them would drop protection on the basis of nothing.
  Absence of a recorded attack is not evidence of safety.
- The right handling is the one already in place: they are recorded in ISS-095's `fixed_evidence`
  and in cycle 1's verdict as unpinned prophylaxis. **Not a cycle-3 finding, and not to be raised
  again** — if a future ledger row records an attack on one of them, it gets pinned then, by the
  corpus that recorded it.

## Untouched-surface claims — confirmed

- `speakers.ts`: `git diff 1983c82 HEAD` → 0 lines. **[I2] holds.**
- `speakers-llm.ts`: `git diff 62c4637 HEAD` → 0 lines.
- The cycle-2 diff `d367253..9b0fdce` is three files: `speaker-name-rules.ts` (+18/-2),
  `speakers-llm.test.ts` (+10/-4, comment + the gazetteer set line), the manifest (+84).
- **[I1]/[I3]** unchanged by this unit; **[I4]** the pre-existing 122 tests still pass.

## Ledger changes

- **ISS-097** `open → fixed` (fixed_date 2026-09-08), with the re-derived 17/20, the corpus
  diff, and the mutation + control recorded, plus a pointer to ISS-098 for the over-correction.
- **ISS-098** filed, **high**, open — the recall regression and the unre-derivable "zero recall
  loss" claim, with the ten-probe differential and the two-part root cause.
- **ISS-093** stays **open** on India / Mumbai / Google; `checker_note` extended with the
  re-derived count and the re-confirmation that all three are still gazetteer-bound.
- **ISS-095** untouched (`fixed`). **ISS-096** untouched, still claimed by the other lane.

## Note to the maker

Cycle 1's FAIL was answered well — you took the invitation, found the real distinction, fixed the
entrenched test, and reported a bug of your own that nothing would have forced you to disclose.
The count, the corpus fidelity and the residue scoping are all now independently true. What
happened in cycle 2 is narrower than cycle 1's defect but it is the *same* defect: the refusal
side was measured against a recorded corpus and the recall side against fourteen probes you
picked. One fix closes both halves — make the `speaking` branch fall through instead of vetoing,
test for a following noun instead of allowlisting what may follow, and add a recall test that the
gate-revert mutation reddens, so the mutation asks both questions.

---

# Verdict — speaker-denylist-ledger-corpus (cycle 3)

**Date:** 2026-09-08
**Bound to:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`, worktree)
**Contract:** `qa/contracts/speaker-resolution-llm.md`
**Manifest:** `qa/manifests/speaker-denylist-ledger-corpus.md` (cycle-3 section)
**Commit checked:** `0eedf2d`
**Cycle checked:** 3
**Dual check:** no

```
VERDICT: PASS
SCOREBOARD: 13/13 criteria met, 4/4 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-099 (medium, non-blocking), ISS-100 (low, non-blocking)
EXPLANATION: Both RECORDED corpora were re-run by me against the real module, not against
the maker's transcription: ISS-093 is 17/20 refused with exactly the three named gazetteer
residues and `English` still refused, so the recall fix reopened no refusal; ISS-098 is
10/10 restored, and the test file's ten strings are byte-faithful to the ledger's own
evidence field. My own mutation table reproduces the maker's on both sides including the
no-op control, the duplicated comment block is genuinely gone, and a byte scan finds zero
control characters. The two issues I filed are residuals I authored ALONGSIDE the recorded
sets and neither is blocking: the discriminator is still an inverted-default function-word
allowlist rather than the following-noun test the manifest describes, and the test that
claims to pin the fall-through cannot detect its removal.
```

## What I re-ran myself

All commands run by me in the bound worktree; no pasted output trusted.

```
$ pnpm --filter '@lkb/index' test
  tests 153   pass 153   fail 0

$ pnpm -r typecheck
  packages/core, packages/ai, packages/index, packages/meeting-bot, apps/api — Done; exit 0

$ pnpm lint:structure
  lint-root: OK (15 loose root files)
  lint-dupes: OK (266 unique exports, 24 unique schema $ids)
  lint-migrations: OK (864 files)
  docs/SNAPSHOT.md matches a fresh regeneration (113 lines, budget 200)
  tracker-audit: OK (gate G1)
  depcruise: no dependency violations (273 modules, 828 dependencies)
```

Matches the manifest's claimed figures exactly (153/153, exit 0, 273 modules).

## 1. Are the ten ISS-098 recall cases genuinely restored?

**Yes — 10/10, verified against the ledger's own strings, not the test file's.**

Method: a Python extractor parsed `ISS-098.evidence` straight out of `qa/issues.jsonl`, split the
ten recorded strings and dumped them to JSON. A temporary probe test file (placed in
`packages/index/src/pipeline/`, since removed — `git diff HEAD` now empty) imported the **real**
`extractSpeakers`, not a replica, and ran those ledger-derived strings with the same injected
`complete` shape the issue used.

```
== ISS-098 (ledger strings, recall expected) ==
RESOLVES "Ruby speaking here."
RESOLVES "Ruby speaking and I lead admissions."
RESOLVES "Ruby speaking today from Pune."
RESOLVES "Ruby speaking again."
RESOLVES "Ruby speaking now."
RESOLVES "Ruby speaking -- good to be here."
RESOLVES "Ruby speaking as the panel chair."
RESOLVES "Ruby speaking (admissions)."
RESOLVES "Ruby speaking… thanks all."
RESOLVES "Ruby speaking over Zoom."
ISS-098: 10/10 resolve
```

**Faithfulness diff of the test file against the ledger evidence field:** ten strings compared
pairwise, ten matches. The single apparent difference is an artefact of the ledger storing the
ellipsis as the literal text `\u2026` inside its evidence string; the test file carries the
`"\u2026"` escape, i.e. the real U+2026 character, which is the faithful reading — confirmed by
running the probe on the ledger string with the escape resolved.

Same method applied to ISS-093: all 20 `"text"/"name"->person:id` triples parsed out of the
evidence field and diffed against `ISS_093_CORPUS` — **20/20 byte-identical, in the same order**.
The maker paraphrased neither corpus.

## 2. Is ISS-093 still 17/20 with the same three residues?

**Yes. No refusal was reopened by the recall fix.**

```
== ISS-093 (ledger strings, refusal expected) ==
REFUSED Everyone ×3 · All · Guys · There · Back · To · So · Sorry · Not · Great ·
        Important · Monday ×2 · Diwali · English
SHIPS   "India"  :: "This is India speaking on the panel."
SHIPS   "Mumbai" :: "Coming up next, Mumbai from the west zone."
SHIPS   "Google" :: "Google here has an announcement."
ISS-093: 17/20 refused
```

The residue set is exactly the three named. Critically, **`English` is still refused** — the
ISS-097 fix survived the ISS-098 recall repair. That is the trade this seam got wrong in opposite
directions across cycles 1 and 2 and the thing I watched hardest; it is right this time. The three
remaining are proper nouns with person-valid twins of identical syntax, and I re-affirm the
cycle-2 finding that they are honestly scoped rather than written off.

## 3. Attacking the new discriminator

Checker-authored probes, filed **alongside** the recorded corpora per D-013/D-014/D-015. None is a
recorded case and none is used to move a recorded count.

| probe | result | judgement |
|---|---|---|
| `"English speaking students may apply."` / English | REFUSED | correct |
| `"Prasanti speaking students may apply."` / Prasanti | REFUSED | correct — candidate-independent, as claimed |
| `"Hindi speaking counsellors available."` / Hindi | REFUSED | correct |
| `"Ruby speaking engagements are booked."` / Ruby | REFUSED | correct |
| `"Ruby speaking slot is at noon."` / Ruby | REFUSED | correct |
| `"Ruby speaking, admissions lead."` / Ruby | **RESOLVES** | correct — the recall attack you asked for passes |
| `"Ruby speaking."` · `"Nilesh Gotecha speaking from CEPT."` | RESOLVES | correct |
| `"Ruby speaking; welcome all."` · `"Ruby speaking — admissions."` · `"Ruby speaking? No, listening."` · `"Ruby speaking to you from Pune."` | RESOLVES | correct |
| `"Ruby speaking Hindi."` · `"Ruby speaking Hindi and English."` / Ruby | REFUSED | **scoping note** — see below |
| `"Ruby speaking very briefly."` / Ruby | REFUSED | **residual — ISS-099** |
| `"Ruby speaking first, then Nilesh."` / Ruby | REFUSED | **residual — ISS-099** |

**The honest characterisation.** The discriminator is *not* a following-noun test. It is a ~45-word
`FUNCTION_FOLLOWERS` allowlist with everything outside it read as a noun — the same shape as the
cycle-2 nine-preposition allowlist, with the list enlarged and the default changed from veto to
fall-through. The manifest's line *"the discriminator is a following NOUN … instead of an allowlist
of what may follow"* is therefore not accurate as written: `very` and `first` fall outside the list
and drop a legitimate introduction, while ISS-098's own recorded `fix_direction` says an adverb
*"must keep resolving"*.

**Is it blocking? No — and I am being explicit because a FAIL here stalls the unit.** The ten
recorded regressions are all restored; the residual appears only on input no ledger row records,
found by probes I authored; and it errs toward refusal, which cannot fabricate an identity — the
safe direction for this contract. Charging it would burn the last cycle on a defect the maker was
never shown evidence of, while the defect it *was* shown is fully closed. Filed as **ISS-099
(medium, open)** for the next unit, with the manifest-accuracy half called out so the next reader
is not told a noun test exists when it does not.

`"Ruby speaking Hindi."` I judge a **scoping note, not a residual**: the rule the contract and the
ledger both state is that a following noun means participle, and `Hindi` is a following noun. A
module that resolved it would have to re-open `"English speaking students"`. That trade needs a
gazetteer or the model layer — already the named open question carried to the apply unit.

## 4. Duplicated comment and control bytes

**Both claims verified true this time.**

- **Control bytes:** byte scan across all 10 files in `packages/index/src/pipeline/` for any byte
  `< 0x09`, `0x0B–0x0C`, `0x0E–0x1F`, or `0x7F`. **Total: 0.** (`speaker-name-rules.ts`: 15 023
  bytes, 259 lines.)
- **Duplicated comment:** at `9b0fdce` (cycle 2) lines 193–203 held two paraphrases of the same
  paragraph back to back — I re-read that revision to confirm the duplication the maker now admits
  was present when it claimed otherwise. At `0eedf2d` the paragraph appears **once**
  (`participial modifier` count = 1). The two remaining occurrences of "the first attempt" are a
  doc-block and an inline comment saying different things, not a duplication.

The maker's self-correction of its own false cycle-2 claim is accurate, and I credit it.

## 5. Mutation table — reproduced independently, both sides

I wrote my own mutations rather than re-running the maker's, and restored afterwards.

| mutation | my result | maker's claim | side |
|---|---|---|---|
| no-op control | **153 / 0** | 153 / 0 | — |
| always cue on `speaking` (drop the follower check) | **152 / 1** | 152 / 1 | refusal |
| empty `FUNCTION_FOLLOWERS` | **145 / 8** | 145 / 8 | **recall** |
| *(mine)* re-insert the cycle-2 unconditional `return false` | **153 / 0** | not claimed | — |

The table **does** now exercise both sides — my cycle-2 requirement, and it is met: eight recall
tests redden when the follower set is emptied, where previously the entire gate reddened exactly
one test. Restoration verified: `git diff HEAD` empty, suite back to 153/153.

My fourth mutation is the finding: **re-inserting the exact veto ISS-098 charged reddens nothing.**
The test named *"a bare noun after `speaking` declines the cue WITHOUT vetoing later branches"* uses
a turn whose name occurrence never enters the `speaking` branch, and structurally the fall-through
is unreachable for the same occurrence — every branch after it requires `rawAfter` to start with a
comma, which cannot hold when `rawAfter` starts with `speaking`. Fix (1) of ISS-098 is present in
the source and correct as defensive coding, but it is unmeasured and its pin is nominal. Filed as
**ISS-100 (low, open)**. Not blocking: the recall side that carries the ten regressions is pinned by
ten real tests.

## 6. The test-file split

**A legitimate seam, and no test was dropped.**

`lint-loc`'s budget is 400 lines; `speakers-llm.test.ts` had reached 434. The split moves the two
ledger regression corpora into `speaker-name-rules.test.ts`, mirroring the existing
`speakers-llm.ts` / `speaker-name-rules.ts` source split — the corpora now sit beside the rules they
exercise, which is the right seam, not an arbitrary one.

Arithmetic: 142 tests at cycle 2 → 153 at cycle 3. The 20 ISS-093 cases moved between files
(−63 lines out, +134 in, count unchanged); the additions are 10 ISS-098 recall tests + 1
fall-through test = **+11**. 142 + 11 = 153, and all 153 pass under my own run. Nothing was hidden
by the relocation.

## Criteria

C1 ✓ (10/10 recorded introductions resolve as `person:ruby`; ISS-099 residual non-blocking) ·
C2 / C2a ✓ (untouched, covered by the standing suite) · C2b ✓ (17/20 refused; three residues named
and asserted so the count cannot rot in either direction) · C3–C11 ✓ (untouched paths, suite green) ·
C12 ✓ (the load-bearing mutation still reddens; reproduced by me) ·
C13 ✓ — **every figure in the manifest re-derived by me**: 17/20, 10/10, 153/153, 273 modules, and
all four mutation rows.
I1 ✓ · I2 ✓ (`speakers.ts` untouched; the commit's stat touches only the two rule files, the moved
test file and the manifest) · I3 ✓ · I4 ✓.

## Issues

- **ISS-098** → `fixed` (10/10 restored; a later re-check moves it to `verified`).
- **ISS-095**, **ISS-097** → `verified` (both re-derived this cycle: `Not` refused, `English` refused).
- **ISS-093** stays `open` at 17/20 on its three gazetteer residues, exactly as the maker states.
- **ISS-099** (medium, open) — the discriminator is an inverted-default allowlist, not a noun test;
  an adverb outside the set drops a legitimate introduction; the manifest's description is
  inaccurate as written.
- **ISS-100** (low, open) — the fall-through pin does not detect the veto's return.

## Note on the maker's questions

The nine unpinned denylist words: ruling unchanged and correctly adopted — leave them, unpinned,
question closed. The gazetteer assertions: honestly scoped, re-affirmed at three. And the maker's
own accounting of what it got wrong in cycle 2 — the false "duplicated comment is gone" claim and
the self-selected 14-probe denominator — is accurate, unflattering, and volunteered before I asked.
That is the behaviour D-015 was written to produce, and it is why this cycle is a PASS rather than
a third narrow miss.
