# Verdict — tracker-honesty (plan §10 U0.6)

**Result: PASS**
**Cycle checked: 1** (manifest `Fix cycle: 1 of max 3`)
Checked: 2026-09-07 · bound to `D:/KnowledgeBase`
Manifest: `qa/manifests/tracker-honesty.md`
Contract: **`qa/contracts/tracker-integrity.md` — CREATED by this check** (see §0)
Working tree at check time: `M .goal/goal.json · M TASKS.md · M package.json`, `?? scripts/tracker-audit.mjs`, HEAD `34eb5cb`

Every command below was re-run by me from a fresh shell. Nothing in this verdict is copied from
the manifest's pasted output; where my number matches the maker's, I produced it independently.

---

## 0. The missing contract — ruled on, not deferred

The manifest names `qa/contracts/snapshot-features-ledger.md`, which this unit does not implement,
and honestly says so: *"No contract states the trackers' own integrity rules — I propose the three
gates below become that contract if the checker wants one; drafting it pre-emptively felt like
inventing goalposts."*

That was the right instinct and the right handling. A maker drafting the rules it will be judged
against is the segregation-of-duties breach `ISS-006` already caught once in this repo. Naming the
gap in the manifest instead is exactly the behaviour the pair wants.

Mode A step 2 would normally make a contract/artifact mismatch a `CONTRACT_MISMATCH`. I decline that
reading: this is not the wrong feature submitted against the wrong contract — it is a unit with *no*
contract yet, on an approved plan item. The repo's own precedent covers it (`snapshot-features-ledger`
amendment log, 2026-09-03: maker-drafted, checker-adopted, "START stands on the plan §6d approval").

So I have **created `qa/contracts/tracker-integrity.md`** as the checker (sole writer of
`qa/contracts/`), START standing on plan §10 U0.6, and judged this unit against it. I did not adopt
the maker's three gates verbatim — I kept them as C1–C7 and added six invariants I1–I6 that the
unit's own corrections and judgement calls established, including the two that settle the G2
question (I5: the maker never sets `verified_date`; I6: `fixed → verified` needs a *later*,
independent re-check).

---

## 1. T-003 — attacked hardest, and the maker's call holds

The manifest left `T-003` at `done`, arguing the goal.json note (*"19/23 … Not done until 23/23"*)
was stale. This is the claim that would matter most if wrong, because it errs upward. I counted the
content myself rather than reading any note.

```
$ find . -name turns.json -not -path ./node_modules/*   →  23 files under data/toc-migrated/
```

Per-session turn count and total transcript character count, computed by parsing each file:

| session | turns | chars | | session | turns | chars |
|---|---:|---:|---|---|---:|---:|
| 2026-04-21-visa-blueprint-part2 | 291 | 101,051 | | 2026-07-22-uniaccess-cept | 56 | 31,649 |
| 2026-05-08-funding-dreams | 83 | 57,123 | | 2026-07-28-metrics-and-mingling | 83 | 60,074 |
| 2026-05-20-brand-story | 31 | 41,380 | | 2026-07-30-in-focus-3 | 96 | 54,618 |
| 2026-05-22-uniaccess-xavier | 64 | 25,943 | | 2026-08-03-uk-beyond-offer-letters | 46 | 57,287 |
| 2026-05-23-uniaccess-atlas | 8 | 8,539 | | 2026-08-03-…-reupload | 43 | 61,226 |
| 2026-05-28-in-focus-1 | 59 | 40,255 | | 2026-08-10-ucas-what-changed | 230 | 50,761 |
| 2026-05-29-decoding-cast | 15 | 10,239 | | 2026-08-12-uniaccess-ashoka | 26 | 62,569 |
| 2026-06-03-dual-enrollment | 90 | 67,022 | | 2026-08-24-uniaccess-leeds-arts | 102 | 51,411 |
| 2026-06-19-entrance-exams-p1 | 38 | 61,363 | | 2026-08-27-in-focus-4 | 51 | 46,957 |
| 2026-06-25-in-focus-2 | 69 | 45,828 | | 2026-07-03-inside-the-uc | 50 | 52,421 |
| 2026-06-30-identity-success | 16 | 49,439 | | 2026-07-08-black-robes-law | 134 | 76,523 |
| 2026-07-15-creative-futures | 269 | 101,131 | | | | |

**23/23 sessions carry real content. 0 placeholders.** The floor is 8,539 characters
(`uniaccess-atlas-skilltech`) — an order of magnitude above anything a placeholder could be, and I
read the leading 90 characters of every one of the 23: all are genuine spoken English from the
session, none is boilerplate. `grep -rl -i "placeholder\|TRANSCRIPT_PENDING\|not yet transcribed"
data/toc-migrated/` returns **nothing**.

The closing commit is real and its message matches what I measured:
`c07674d` *"fix(ai): real root cause of T-003 chunking stalls — 23/23 TOC sessions done"* — it names
`visa-blueprint-part2 (291 turns)`, `creative-futures (269)`, `in-focus-3 (96)` as the three newly
real; my count reproduces all three exactly.

**The maker's call is correct, and the manifest's framing of it is the most valuable thing in this
unit** — it checked before "fixing" and declined to revert a status that was already right. Reverting
T-003 would have been a *downward* error, which is safer but still an error.

**Mongo cross-check: INCONCLUSIVE, not a failure.** My probe could not reach the server (my `.env`
URI parse fell through to `localhost:27017`, connection refused). Per the dispatch's environment
note this is INCONCLUSIVE. It does not weaken the finding: the placeholder question is answered on
disk, and disk is the source Mongo is synced *from*.

---

## 2. T-021 / T-022 — the revert is correct, not over-correction

I read both verdicts in full. Both are genuine PASSes, and both PASS **a contract that had already
been scoped down**, against a proxy:

- **`qa/verdicts/golden-set-recall.md`** (T-021, PASS cycle 1). Criterion 3 grades
  `heuristic-retriever.ts`, whose own doc comment reads *"A NON-LLM stand-in for `packages/ask`'s
  real `selectNodes` … NOT a claim that this measures the real pipeline's recall."* Criterion 6 is
  graded explicitly as *"about the harness executing on real data and reporting honestly, **not
  about hitting 0.85**"*. So `recall@5 = 1.000` is a property of the stand-in.
- **`qa/verdicts/evaluator-calibration.md`** (T-022, PASS cycle 1). Criterion 3 grades the reference
  set as *"derived"* — 15 golden questions × 2, the "irrelevant" half generated by a fixed +7 offset
  into the sorted session list (`gen-calibration-set.mjs:33`). Nothing was hand-scored. Criterion 4's
  `mae = 0.170` is the heuristic scorer against that derived set.

The task rows name stronger deliverables: *"target recall@5 ≥ 0.85"* and *"on 30 **hand-scored**
pairs"*. Neither was measured. Under **I1**, a PASS against a scoped-down contract closes that
contract, not the task. **Reverting is right.**

**Is it over-correction that discards finished work?** No — the work is not discarded. Both rows
carry the verdict path and commit inline (`03fcf8d`, `1d2ee71`) and state that the harness is real
and PASSed; both verdict files stand untouched. What changed is only the claim in the headline.

**One consistency observation, not a failure.** The unit solved the *same* problem two different
ways: T-011 was **split** so the finished slice kept an id (`T-011a`), while T-021/T-022 were
**reverted** with the finished harness surviving only as prose in a note. Splitting is the stronger
form — it is the one I2 in the new contract prefers, and it would keep the harness work visible in
the denominator. I am not failing the unit for this: reverting errs *downward*, the real runs are
already sequenced as Phase-1 U0.10, and forcing a split now would churn ids for no measurement gain.
Recorded as a recommendation, not a defect.

**Residual (low, cosmetic):** goal.json's `T-021` and `T-022` still carry
`"completed": "2026-09-03T13:45:00"` / `13:46:01` while `status: "pending"`. I checked whether this
can leak upward: `D:/ai_os/.claude/skills/goal/scripts/analytics.py:6` filters
`status == "done" and t.get("completed")`, and `render_dashboard.py:320` guards on
`status == "done"` — so both consumers ignore it. **Inert.** Named in the contract's "Out of scope /
ignore" so a future check does not re-litigate it. Not an issue.

---

## 3. T-011 / T-011a — two genuinely different scopes, split cleanly

**All three joiners are stubs**, verified by reading them, not by trusting the note:

- `packages/meeting-bot/src/joiners/browser-joiner.ts:5` — `TODO(T-024b): this is a STUB. \`launch\` is injected as a Playwright-shaped function`
- `packages/meeting-bot/src/joiners/system-audio-joiner.ts:6` — `TODO(T-024b): this is a STUB. \`startCapture\`/\`stopCapture\` are injected …`
- `packages/meeting-bot/src/joiners/vexa-joiner.ts:7` — `TODO(T-024b): this is a STUB. It shapes a plausible Vexa bot-create/stop call …`

**`@lkb/meeting-bot` is imported by nothing.** Repo-wide search for the specifier returns only: its
own `package.json`/`src/`, `pnpm --filter` invocations in manifests and verdicts, the catalogue's
own A10 probe, `TASKS.md`'s new row, and a `scripts/catalogue.test.mjs` fixture. **Zero real
importers outside its own package** — which is independently corroborated by three prior checkers
(`catalogue-input-integrity.md:126`, `catalogue-progress-score.md:152`, `derived-input-trust.md:190`,
all recording A10 = STUB on the same grep).

**The scopes really were different.** `qa/verdicts/browser-profile-privacy.md` (PASS cycle 1, commit
`59dc2db`) grades `resolveProfileDir` path-traversal safety and a private-segment filter — profile
isolation primitives. That is not auto-join, not consent capture, not live capture. The commit
subject itself says *"T-011 Phase-B **primitives** (profile isolation + private-segment filter)"*.

**Nothing was lost or double-counted.** `T-011a` = `done`, carrying the same verdict path and commit
the old row carried; `T-011` = `open`/`pending`, carrying the stub evidence. Both ids exist in both
trackers, exactly once each — I checked for duplicate ids in `goal.tasks` programmatically:
`dupIds []`. The net effect on the headline is +1 task, +1 done — which is why the split is honest
rather than a way to bank a win.

---

## 4. The five imported rows — all five match TASKS.md and reality

| id | goal.json | TASKS.md | verdict/commit reference | verified |
|---|---|---|---|---|
| T-000 | done | done | "Answered inline — D-001" | ✅ statuses agree |
| T-004b | done | done | `15e4ecf` = *"checker: PASS T-004b tree-index-v2 (cycle 1)"* | ✅ commit exists, subject matches |
| T-004c | done | done | `qa/verdicts/regenerate-year-migration.md` + `8ae94f4` | ✅ verdict file exists; `8ae94f4` = *"fix(index): T-004c regenerate() year-migration…"* |
| T-009b | done | done | `089d2b6` = *"feat(ask): T-009b real LLM scorer, ScoreFn async-capable"* | ✅ commit exists, subject matches |
| T-028 | pending | open | "explicitly deferred (Umesh: baad mein dekh lenge)" | ✅ agree in meaning (C2) |

I resolved all four referenced commits with `git log -1` and read the two referenced verdict files
off disk. No dangling reference. The `pending`/`open` spelling difference on T-028 is C2-legal.

---

## 5. `progress` is arithmetic — recomputed independently

Recomputed from `goal.tasks` in a separate process, not by reading the block:

```
tasks 35  done 26  notdone 9  pct 74
block {"total":35,"done":26,"in_progress":0,"blocked":0,"pending":9,"current":"T-007","percent":74}
dupIds []
```

`grep -cE "^\| T-[0-9]+[a-z]? \| " TASKS.md` → **35**. Both trackers, 35 rows, no duplicate ids.
`26/35 = 74.28…` → 74. **Exact.** The old 29/23/79% is gone and the number went *down* because the
denominator got honest — the direction that proves the correction was not self-serving.

**Bonus check the manifest did not claim: the `current` pointer.** `ISS-014` and `ISS-016` are both
open findings about `progress.current` going stale — a recurring failure in this repo. `current` is
`T-007`, whose status is `pending` in goal.json and `open` in TASKS.md, and which is the *first*
not-done row in order. **Not stale.** No new finding.

---

## 6. The gates — broken deliberately, every one fired, all restored byte-identically

Baseline, reproduced: `node scripts/tracker-audit.mjs` → **exactly 2 findings (G2, G3)**, exit 1.

I took md5 baselines of `TASKS.md`, `.goal/goal.json`, `qa/issues.jsonl` and `qa/.last-sweep` before
touching anything, then ran seven deliberate breaks:

| # | break | gate output | fired |
|---|---|---|---|
| 1 | deleted the `T-004b` row from `TASKS.md` | `G1 row-set: in goal.json but not TASKS.md — T-004b` | ✅ |
| 2 | flipped `T-006` `done → open` in `TASKS.md` only | `G1 status: T-006 is "done" in goal.json but "open" in TASKS.md` | ✅ |
| 3 | hand-edited `progress.percent` 74 → 99 | `G1 progress.percent says 99%, the rows give 74%` | ✅ |
| 4 | hand-edited `progress.total` 35→30, `done` 26→30 | `G1 progress.total says 30, there are 35 tasks` + `G1 progress.done says 30, 26 tasks are done` | ✅ (both, separately) |
| 5 | appended a `fixed` issue with `verified_date: null` | `G2 unverified: 21 issue(s) …` (20 → 21) | ✅ |
| 6 | appended a `fixed` issue **with** a `verified_date` | `G2 unverified: 20 issue(s) …` — count unchanged | ✅ (no false positive) |
| 7 | appended `{not json` to the ledger | `G2 ledger: 1 unparseable line(s) …` | ✅ |
| 8 | wrote a `qa/.last-sweep` stamp dated after HEAD | G3 silent, gate clean | ✅ (no false positive) |

Test 6 and test 8 matter as much as the others: a gate that fires on everything is a gate that gets
switched off. Neither produced a false positive.

**Restore verified by checksum**, not by eye: `md5sum -c` → `TASKS.md: OK`, `qa/issues.jsonl: OK`.
`.goal/goal.json` differed by **exactly two lines**, both timestamps written by the `/goal`
auto-monitor's own 5-minute tick during the check window (`"updated"` and
`"last_deterministic_tick"`, `15:01:02 → 15:06:01`) — `diff` confirms no other byte moved, and none
of my mutations survived. `git status` shows no unintended file touched.

**C6 note on G1's vocabulary normalisation (the manifest's own disclosed limitation).** I checked
whether it masks anything *here*: `goal.tasks` contains **zero** `blocked` and zero `in_progress`
rows, and `TASKS.md` has no `blocked` rows either. So today it masks nothing real. The design is
right — the alternative fires on every row (`open` vs `pending`) — and the residual exposure (a
future `blocked` silently reading as `pending`) is now recorded in the contract's Out-of-scope
section as a deliberate choice rather than an oversight.

**The regex limitation is also real and correctly characterised**: a reformat of the `TASKS.md`
table makes G1 report rows as *missing*, which is loud. Failing open-and-noisy is the safe
direction.

---

## 7. Budget and lint

```
$ grep -cve '^\s*$' scripts/tracker-audit.mjs
95                                              # budget 300 ✅

$ pnpm lint:structure
lint-loc: OK (215 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (239 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1062 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
OK: docs/PROGRESS.md is current (20.2% of 57 features)
✔ no dependency violations found (239 modules, 702 dependencies cruised)
EXIT=0                                          # ✅
```

`package.json` adds exactly one line: `"audit:trackers": "node scripts/tracker-audit.mjs"`. The
`lint:structure` chain is untouched — consistent with the manifest's stated decision (ruled on in §8b).

---

## 8. The two judgement calls the maker asked me to rule on

### 8a. G2 — the refusal to stamp `verified_date` was RIGHT, and I have now done the triage

**The refusal was correct, and it is the single best decision in this unit.** The ledger is the
checker's surface (now written down as **I5**). A maker that turns a gate green by writing the field
the gate reads has not fixed anything — it has built a gate and then disabled it in the same commit,
which is precisely the class of dishonesty this unit exists to remove. Refusing cost the maker a
red gate on its own submission; that is what integrity looks like when it is expensive.

**And the maker's suspicion about the composition of G2 was right too.** I triaged all 20. They split
cleanly in two:

**Twelve were hygiene — a later, independent checker re-executed the defect and observed it closed,
then set `status: fixed` and forgot the date field.** I read the closing verdicts and confirmed each
one re-ran the attack rather than merely referencing the id:

| issues | closed by | evidence I read |
|---|---|---|
| ISS-034, ISS-035 | `qa/verdicts/catalogue-input-integrity.md` | header line: *"ISS-034 → fixed, ISS-035 → fixed (both independently re-executed)"*; §1 re-runs the original attack and gets a REFUSAL, §4 confirms ISS-034 |
| ISS-037, ISS-039 | `qa/verdicts/evidence-trust-by-content.md` | *"I re-ran the in-place …"*; §1 *"The ISS-037 attack, re-executed — PASSES"*, §3 fingerprint check, closing table rows "open (high) → **fixed**" with the restore stated |
| ISS-041, ISS-042, ISS-043 | `qa/verdicts/score-input-trust-complete.md` | §2 *"the +42.1-point attack, re-run independently ✅ FIXED"*, §4 *"staged tamper, my own throwaway repo ✅ FIXED"*, §5 CRLF materialisation ✅ FIXED |
| ISS-038, ISS-044, ISS-045, ISS-046, ISS-047 | `qa/verdicts/derived-input-trust.md` (cycle 2) | mutation table M1–M5 CAUGHT, the ISS-047 attack *"rebuilt from scratch"*, and line 307: *"ISS-044 / ISS-045 / ISS-046 / ISS-047 / ISS-049 — re-verified this cycle, no regression"* |

Under **I6** (`fixed → verified` requires a *later* independent re-check) all twelve qualify.
**I have stamped them `status: "verified"`, `verified_date: "2026-09-07"`**, each with a
`checker_note` naming the verdict file that did the verifying and stating plainly that this is
hygiene, not a fresh verification by me.

**Eight are not mine to close in a unit check.** `ISS-006, ISS-008, ISS-010, ISS-014, ISS-016,
ISS-018, ISS-019, ISS-022` — all `found_by: checker-sweep`, all process/tracker findings (stale
`current` pointer, ARCHITECTURE drift, manifest close-out gaps, segregation of duties). Verifying
those is a Mode B sweep's job, not this unit's, and I will not stamp what I did not check. They stay
failing G2.

```
$ node scripts/tracker-audit.mjs        # after triage
G2 unverified: 8 issue(s) … — ISS-014, ISS-006, ISS-008, ISS-010, ISS-016, ISS-018, ISS-019, ISS-022
G3 stale sweep: qa/.last-sweep predates HEAD by 2.8 day(s)
```

**20 → 8. Sixty percent of G2 was exactly the ledger hygiene the maker guessed it was** — and it was
right not to guess on the record.

### 8b. The contract, and the `lint:structure` wiring

**Contract: YES — created**, as `qa/contracts/tracker-integrity.md` (§0). The gates are worth having
rules for, and rules the maker cannot author.

**Wiring: the maker's reasoning is right, and I am adopting it with one refinement.**
*"A gate that blocks every commit until someone else acts is a gate people delete"* is correct and
matches this repo's own history — an enforcement path that annoys gets bypassed, and a bypassed gate
is worse than none because it still looks alive. **G2 and G3 must stay out of `lint:structure`:**
both are cleared by the *checker*, so wiring them would block the maker's commits on my calendar.

The refinement: **G1 is not like that.** Row-set parity, status agreement and the arithmetic headline
are entirely within the committing author's control and always clearable in the same commit — and G1
is the gate that would have caught the original 29-vs-34 drift. Leaving *all three* advisory means
the one gate that could have prevented this unit's whole subject matter still has nothing forcing it
to run. Filed as **ISS-053 (low)**: add a `--gate g1` flag and append it to the `lint:structure`
chain. Deliberately **low, and not a condition of this PASS** — the unit did the honest thing by
disclosing the choice, and I would rather this land as its own small unit than be bolted on here.

---

## Scoreboard against `qa/contracts/tracker-integrity.md`

| | criterion | result |
|---|---|---|
| C1 | G1 row-set parity | ✅ break-tested (both directions), 35 = 35 |
| C2 | G1 status agreement in meaning | ✅ break-tested; no `blocked`/`in_progress` rows exist to mask |
| C3 | G1 arithmetic headline | ✅ 35/26/74 recomputed independently; all three sub-findings break-tested |
| C4 | G2 unverified fixes | ✅ fires, no false positive, unparseable-line branch fires |
| C5 | G3 sweep freshness | ✅ fires at 2.8 d; clears on a fresh stamp |
| C6 | gate exercised, not asserted | ✅ 8 deliberate breaks, all restored (checksums) |
| C7 | budget + lint | ✅ 95 LOC / 300; `pnpm lint:structure` exit 0 |

| | invariant | result |
|---|---|---|
| I1 | no `done` on evidence weaker than the row's deliverable | ✅ T-021/T-022 reverted; T-003 re-derived and correctly left `done` |
| I2 | one id, one scope | ✅ T-011/T-011a split, no duplicate ids, nothing lost or double-counted |
| I3 | corrections re-derived, not assumed | ✅ 23 dirs counted; 3 joiners read; 4 commits resolved |
| I4 | flattering direction carries inline evidence | ✅ every changed row's note names its evidence |
| I5 | the ledger is the checker's | ✅ maker refused to stamp `verified_date`; checker did the triage |
| I6 | `fixed → verified` needs a later independent re-check | ✅ applied — 12 stamped on named verdicts, 8 correctly left open |

---

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 6/6 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: ISS-053 (low, open — G1 not wired into any gate)
ISSUES-CLOSED: ISS-034, ISS-035, ISS-037, ISS-038, ISS-039, ISS-041, ISS-042, ISS-043, ISS-044, ISS-045, ISS-046, ISS-047 → verified (G2 triage, §8a)
EXPLANATION: Every correction holds under independent re-derivation, including the one that could
have flattered — I counted all 23 TOC session transcripts myself (0 placeholders, 8,539-char floor)
and the maker was right to leave T-003 `done` and fix the stale note instead. T-021/T-022 really were
only ever measured against a heuristic proxy against an already-scoped-down contract, so reverting is
correct rather than over-correction; T-011's three joiners are all explicitly STUB and the package has
zero importers, so the split is real and loses nothing; all five imported rows resolve to commits and
verdict files that exist; 35/26/74% is exact arithmetic. I broke each gate deliberately — eight
mutations — and every one fired with no false positives, restoring byte-identically. The maker's
refusal to stamp `verified_date` on 20 issues it had not verified was the right call and is now
written into the contract as I5/I6; my own triage found 12 of the 20 were checkers omitting the field
after genuinely re-executing the defect (G2: 20 → 8), and the 8 that remain are sweep territory.
Contract `qa/contracts/tracker-integrity.md` created; `lint:structure` left unwired for G2/G3 per the
maker's correct reasoning, with G1-only wiring filed as ISS-053 (low, not a PASS condition).
```

---

### Recommended next
1. **Run the overdue Mode B sweep** (G3, 2.8 d) — it also owns the remaining 8 G2 rows.
2. **ISS-053** — `--gate g1` into `lint:structure` (small, self-contained).
3. **Phase-1 U0.10** — the real-provider T-021/T-022 runs that reverting these two rows now demands.
