# Verdict — roadmap-tracker-reconciliation

**Cycle checked:** 2
**Date:** 2026-09-08
**Contract:** qa/contracts/tracker-integrity.md
**Mode:** A (unit check), bound to `D:/KnowledgeBase`
**Verdict: FAIL** — 7/7 criteria met, 5/6 invariants hold ([I3] still violated)

ISS-089 is **genuinely and completely fixed**, and the class was closed with two new G1 checks that
I proved fire rather than reading. ISS-090 is **fixed in `.goal/goal.json` and not fixed in
`TASKS.md`**. The three rewritten notes in `goal.json` are accurate against the gate file — I
checked every clause the dispatch flagged and found no drift. But `TASKS.md` still carries
`T-021`/`T-022`/`U0.10` as `blocked`, and `U0.10`'s note still contains, verbatim, the false
sentence the manifest states is "gone": *"Needs the human gate answered first."*

The manifest's cycle-2 claim is **"All three now `pending`, `blocked_by` removed, and the notes
rewritten from the gate file."** That is true of one tracker out of two, in a unit whose entire
subject is that the two trackers must agree and must not assert untrue things.

---

## What I re-ran myself (nothing below is the maker's pasted output)

| command | my result |
|---|---|
| `node --test scripts/lib/tracker-audit.test.mjs` | **9 pass / 0 fail** — matches the claimed 9 |
| `node scripts/tracker-audit.mjs --gate g1` | `tracker-audit: OK (gate G1)`, exit 0 |
| `pnpm lint:structure` | exit 0 — loc 245, dirsize 75, root 15, dupes 255, migrations 1169, SNAPSHOT fresh (113/200), `tracker-audit: OK (gate G1)`, depcruise 0 violations / 267 modules |
| `pnpm -r typecheck` | exit 0, all packages Done |
| duplicate-id grep | `uniq -d` on the id column — **empty** |
| `grep -c blocked_by` | `.goal/goal.json` **0**, `TASKS.md` **0** |

**Headline is arithmetic, not typed.** I recomputed independently from `tasks[]`: 56 tasks,
31 `done`, `round(31/56*100) = 55`. `progress` reads `{total:56, done:31, percent:55}`. C3 holds,
and the headline is unchanged from cycle 1 as claimed.

## ISS-089 — FIXED, and the class is closed (verified by mutation, not by reading)

`git show 56c75da -- TASKS.md` shows the unit's only TASKS.md edits are the two U3.1 lines: the
thin `in_progress` row this unit had added is deleted, and the pre-existing richer row survives
with its note byte-identical and its status changed `partial` → `in_progress`. That is exactly the
fix direction cycle 1 gave, and it kept the row carrying the real exit-criterion evidence.

**Both new checks are load-bearing. I armed the mutation guard first** (the cycle-1 checker did
not, which the dispatch is right to call out):

- `node scripts/lib/mutate.mjs apply TASKS.md` → `MUTATION ARMED`
- injected a second `U3.1` row → `--gate g1` **exit 1**,
  `G1 duplicate rows in TASKS.md — U3.1×2 (a Map keeps only the last, so a conflicting row can hide)`
  — it names `U3.1×2` exactly as the manifest promises.
- `restore` (`verified identical to HEAD`), re-armed, set `U3.1`'s status to `partial` →
  `--gate g1` **exit 1**,
  `G1 status: U3.1 uses unknown status "partial" in TASKS.md — known: open, pending, blocked, in_progress, done`
- `restore` → `verified identical to HEAD`; `assert-clean` → `MUTATIONS CLEAN: none outstanding`;
  `git diff -- TASKS.md` **empty**. No mutation is armed as I write this.

Both checks fire on real conditions and neither is a tautology. **Ruling: ISS-089 fixed, marked
`fixed` in the ledger with this evidence.**

## The gate-derived notes — I read `qa/gates/golden-set-redesign.md` myself, clause by clause

The dispatch flagged this as the high-risk item because cycle 1's failure was a paraphrase of a
stale note. I checked every claim in `goal.json`'s three rewritten notes against the gate file. **No
drift. All of it is right, including the parts most likely to be softened in a paraphrase:**

| claim in the note | gate file | agrees? |
|---|---|---|
| regeneration source `data/toc-migrated/<sessionId>/turns.json` | gate, "Scope of what C authorizes": *"from the raw transcripts (`data/toc-migrated/<sessionId>/turns.json`), not from `session_page.json`"* | yes, and it correctly names `session_page.json` as the thing NOT to use |
| different model **and** prompt than the summarizer | same section, verbatim | yes |
| phrased as real student questions | same section | yes |
| near-neighbour distractors | same section | yes |
| cite the **0.217** question-blind control beside every score | acceptance condition 1 | yes, exact number |
| **PASS = recall@5 STRICTLY between 0.217 and 1.000 with a non-zero miss count** | condition 2, verbatim | yes |
| **1.000 is a FAILURE of the remedy and escalates to Option B** | condition 2: *"1.000 is a FAILURE of this remedy, not a success … escalates to Option B rather than closing this gate"* | yes — the inversion is preserved, not flattened into "must be ≥ some number" |
| re-run verbatim-overlap + single-unique-token pin diagnostics, pin rate well below 63% | condition 3 (63% = 29/46) | yes |
| `T-022` NOT gate-blocked; blocked only by its `T-021` dep | gate lines 7–10: *"NOT blocked: the judge-agreement half (T-022)"* | yes — cycle 1's contradiction is gone |
| `U0.10` note: condition 4 — U1.4/U1.5 exit criteria may not be re-pointed at the new set until conditions 2–3 hold, and must not be cited as passed until then | condition 4, verbatim in substance | yes |
| **"The gate is answered but NOT closed"** | gate's last line: *"This gate is not closed by this answer. It closes when a unit satisfies conditions 1–4, or when condition 2 fails…"* | yes |

**Nothing in the manifest, `goal.json`, or `TASKS.md` claims the gate is CLOSED.** I grepped for it.
The answered/closed distinction is stated correctly in `goal.json`'s `T-021` note and in the
manifest. That distinction is load-bearing and the maker got it right.

So the *content* of the correction is sound. What is wrong is where it was written.

---

## FAILURES

### [I3] F1 · sev: high · ISS-090 is fixed in `.goal/goal.json` only; `TASKS.md` still carries all three rows as `blocked`, with the false sentence intact

`git show 56c75da -- TASKS.md` — the commit's **only** TASKS.md hunks are the two U3.1 lines. The
three rows are absent from the diff entirely. Live at HEAD:

```
TASKS.md:34 | T-021 | blocked | Golden set (50–100 Qs) + recall@k report …
TASKS.md:35 | T-022 | blocked | Evaluator calibration on 30 hand-scored pairs …
TASKS.md:93 | U0.10 | blocked | … BLOCKED by qa/gates/golden-set-redesign.md — the recall@5 metric
             is saturated at 1.000 … Needs the human gate answered first.
```

Against `goal.json`, where the same three rows read `pending` with notes that open
*"UNBLOCKED 2026-09-08: the gate is ANSWERED (Option C)"* and, for `U0.10`, explicitly retract the
sentence that is still sitting in `TASKS.md`. The two trackers now assert opposite things about
whether a human has answered a gate.

Three consequences, in ascending order of how much they matter:

1. **The manifest's own claim is false as written.** "All three now `pending`, `blocked_by`
   removed, and the notes rewritten from the gate file" describes one tracker. The cycle-2 evidence
   line *"Rows carrying `blocked_by`: **none**"* is true only literally — `TASKS.md` states the
   blockage in prose rather than in a `blocked_by:` field, so a grep for the field name returns
   clean over a file that still says `BLOCKED by qa/gates/golden-set-redesign.md`. I reproduced
   that grep myself and it does return 0; the number is right and the conclusion drawn from it is
   not.
2. **G1 cannot see this, and that is the same structural blindness as ISS-089.** C2 compares
   statuses *in meaning*, and `NORMALISE` maps both `blocked` and `pending` to `not-done`. So the
   gate stays green over two trackers that disagree in fact. Cycle 1 found a duplicate-id class G1
   was blind to; this is a second blind class in the same file, found the same way — by reading
   the rows instead of the gate's exit code. I am not asking for a G1 check for it here (a gate on
   note prose is not obviously buildable), but the maker should not read green as agreement.
3. **It is the same root cause as cycle 1, one layer in.** Cycle 1: the maker reasoned about the
   gate from a stale note instead of reading the gate file. Cycle 2: the maker corrected the
   tracker it was thinking about and did not re-read the other one it had itself written those rows
   into 42 minutes earlier. In both cases the *reasoning* was right and the *re-derivation across
   all affected surfaces* was not. Contract **[I3]**: *"Before a status is changed, the underlying
   reality is counted … not inferred."* Here the correction was applied where it was remembered.

Direction is conservative (`TASKS.md` understates readiness rather than overstating it), so **[I4]
is not additionally engaged** — but readiness is computed from `goal.json`, so the practical effect
is that a human reading `TASKS.md` is told a gate is unanswered that was answered.

**Fix direction:** apply the same three corrections to `TASKS.md` rows 34, 35, 93 — status
`blocked` → `pending`, and rewrite `U0.10`'s note from the gate file exactly as `goal.json`'s
already is (delete *"Needs the human gate answered first"*, record Option C and the four
acceptance conditions). Then re-run the `uniq -d` and a grep for `BLOCKED by` before claiming it.
**ISS-090 stays `open`;** I appended the cycle-2 evidence to its row rather than opening a new id,
because this is the same finding not a new one.

---

## Notes that are NOT failures

- **A small overclaim, worth one line and not a finding.** The manifest says G1 "names an unknown
  status word **instead of** emitting a confusing mismatch". It emits **both** — my `partial`
  mutation produced the unknown-word finding *and* `G1 status: U3.1 is "in_progress" in goal.json
  but "partial" in TASKS.md`. The useful line is present and first, which is what matters; the
  word "instead" is inaccurate. No fix required.
- I did not hunt a third finding. F1 came directly out of check 3 in the dispatch ("confirm no row
  still carries blocked_by") — the `blocked_by` grep was clean, so I read the rows themselves, and
  the rows are what is wrong. `ISSUES-WRITTEN: none` is the correct ledger outcome for this cycle:
  ISS-089 → `fixed`, ISS-090 → stays `open` with new evidence.
- The restraint ruling from cycle 1 stands and the maker's acceptance of it is accurate, including
  its acknowledgement that its second reason was stale. Nothing to re-litigate.
- No product code was touched this cycle. `apps/`, `packages/`, `workers/` unchanged; typecheck and
  depcruise both clean.
- No goal task matches this unit slug (`Goal task: none`), so no `/goal` close — and the verdict is
  FAIL, so none would be.

## Ledger

- **ISS-089** → `status: fixed`, `fixed_date: 2026-09-08`, with the mutation evidence above.
  Not `verified` — per [I6] that needs a later independent re-check, not this one.
- **ISS-090** → stays `open`, evidence extended with the cycle-2 finding.
- No new issue ids written.

---

```
VERDICT: FAIL
SCOREBOARD: 7/7 criteria met, 5/6 invariants hold
FAILURES:
- [I3] sev: high · ISS-090 fixed in .goal/goal.json only — TASKS.md rows 34/35/93 still read `blocked` and U0.10's note still says "Needs the human gate answered first", the exact false sentence the manifest claims is gone; G1 stays green because `blocked` and `pending` both normalise to not-done, and the "blocked_by: none" evidence line is true only because TASKS.md states the blockage in prose · apply the same three corrections to TASKS.md rows 34/35/93 and re-grep for "BLOCKED by" before claiming it · issue: ISS-090 (stays open)
ISSUES-WRITTEN: none
EXPLANATION: ISS-089 is completely fixed and its class closed — I armed mutate.mjs and proved both new G1 checks fire (a second U3.1 row yields "G1 duplicate rows in TASKS.md — U3.1×2"; a `partial` status yields the unknown-status finding naming the word), restoring byte-identical each time, with 9/9 tests, --gate g1 OK, lint:structure exit 0, typecheck exit 0 and the 55% headline recomputed as arithmetic on 31/56. I also read qa/gates/golden-set-redesign.md myself clause by clause: the three rewritten notes in goal.json carry no drift — the turns.json source, the strictly-between-0.217-and-1.000 PASS band with a non-zero miss count, 1.000 as a FAILURE escalating to Option B, T-022 as not gate-blocked, and condition 4's constraint on U1.4/U1.5 are all exact, and nothing anywhere claims the gate is closed. The unit fails because that correction was written to only one of the two trackers: TASKS.md still marks all three rows blocked and still contains the retracted sentence, so the same class of untrue tracker assertion the unit exists to remove survives in the file the maker did not re-read — cycle 1's root cause, one layer in.
```
