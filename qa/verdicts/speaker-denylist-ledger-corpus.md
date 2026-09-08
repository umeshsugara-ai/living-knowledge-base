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
