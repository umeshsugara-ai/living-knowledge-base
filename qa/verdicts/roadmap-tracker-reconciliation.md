# Verdict — roadmap-tracker-reconciliation

**Cycle checked:** 3
**Date:** 2026-09-08
**Contract:** qa/contracts/tracker-integrity.md
**Mode:** A (unit check), bound to `D:/KnowledgeBase`
**Verdict: PASS** — 7/7 criteria met, 6/6 invariants hold

ISS-090 is fixed in **both** trackers, not one. I re-derived every claim below myself; nothing here
is the maker's pasted output. The structural change that came with the fix — making `blocked` its
own `NORMALISE` class — is a correct fix rather than scope creep, and I verified independently that
it did not make blockage unrepresentable.

*(Cycles 1 and 2 both FAILed. Their verdict text is superseded by this file; the findings history
lives in the ledger rows for ISS-089 and ISS-090 and in the manifest's per-cycle sections.)*

---

## What I re-ran myself

| command | my result |
|---|---|
| `node --test scripts/lib/tracker-audit.test.mjs` | **11 pass / 0 fail** — matches the claimed 11 |
| `node scripts/tracker-audit.mjs --gate g1` | `tracker-audit: OK (gate G1)`, exit 0 |
| `pnpm lint:structure` | exit 0 — loc 245, dirsize 75, root 15, dupes 255, migrations 1169, SNAPSHOT fresh (113/200), `tracker-audit: OK (gate G1)`, depcruise 0 violations / 267 modules |
| `pnpm -r typecheck` | exit 0, all packages Done |
| `grep -cve '^\s*$' scripts/lib/tracker-audit.mjs` | **125** non-blank LOC (C7 budget 300) |

**Headline is arithmetic on the rows, not typed.** Recomputed from `tasks[]` independently:
56 tasks, 31 `done`, `round(31/56*100) = 55`. `progress` reads `{total:56, done:31, percent:55}`.
**C3 holds.**

---

## 1. The greps the dispatch demanded — run on BOTH trackers, and the rows read, not just the fields

The cycle-2 failure was a `blocked_by`-field grep returning 0 over a file that stated its blockage
in prose. So I ran the field grep **and** read the rows.

```
$ grep -c "BLOCKED by qa/gates" TASKS.md                    → 0
$ grep -c "Needs the human gate answered first" TASKS.md    → 0
$ grep -cE '^\| \S+ \| blocked \|' TASKS.md                 → 0
$ grep -n -i "blocked" TASKS.md                             → 4 hits, all benign (below)
$ grep -n "blocked_by" .goal/goal.json TASKS.md             → no matches in either file
goal.json tasks with status "blocked"                       → []   (enumerated in JS, not grepped)
goal.json tasks carrying a blocked_by key                   → []   (`'blocked_by' in t`)
```

The four surviving `blocked` occurrences in `TASKS.md` are **not** status assertions, and I read
each one:

- **:34 `| T-021 | open |`** — the word appears only inside `UNBLOCKED 2026-09-08: …`.
- **:35 `| T-022 | open |`** — *"NOT gate-blocked - the gate file says so explicitly. Blocked only
  by its dependency."* Correct, and it now agrees with the gate instead of contradicting it.
- **:74** — unrelated prose in a different section (a diarization `"structurally blocked" symptom`).
- **:93 `| U0.10 | open |`** — the retracted sentence is gone; the note explicitly records that the
  earlier claim *"was written from a stale read and is false."*

The three rows read `open` in `TASKS.md` and `pending` in `goal.json`. Both normalise to
`not-done`, which is C2's deliberate design (the contract's Out-of-scope section says vocabulary
choice itself is not a finding), and the *meaning* is now the same in both files.
**ISS-090's finding does not reproduce. C1, C2 hold.**

## 2. The three notes against `qa/gates/golden-set-redesign.md` — the gate file, not goal.json

I read the gate file myself, clause by clause, and checked the `TASKS.md` note text against it.
The dispatch is right that the inversion in condition 2 is the easiest thing to flatten while
paraphrasing. **It is not flattened.** `TASKS.md:34` carries, verbatim in substance:

> *"PASS = recall@5 STRICTLY between 0.217 and 1.000 with a non-zero miss count - 1.000 is a
> FAILURE of the remedy and escalates to Option B"*

against gate condition 2: *"Pass = a recall@5 **strictly between 0.217 and 1.000, with a non-zero
miss count**. **1.000 is a FAILURE of this remedy, not a success** … escalates to Option B rather
than closing this gate."* The direction of the failure is preserved, not softened into a
one-sided "≥ some number".

| claim in the TASKS.md note | gate file | agrees? |
|---|---|---|
| Option C = regenerate from `data/toc-migrated/<sessionId>/turns.json` | "Scope of what C authorizes" | yes |
| different model **and** prompt than the summarizer | same section | yes |
| phrased as real student questions; near-neighbour distractors | same section | yes |
| cite the **0.217** question-blind control beside every score | condition 1 | yes, exact number |
| **strictly between 0.217 and 1.000, non-zero miss count; 1.000 = FAILURE → Option B** | condition 2 | yes — inversion intact |
| re-run verbatim-overlap + single-unique-token pin diagnostics, pin rate well below **63%** | condition 3 (63% = 29/46) | yes |
| `T-022` NOT gate-blocked, blocked only by its `T-021` dep | gate lines 7–10, *"NOT blocked: the judge-agreement half (T-022)"* | yes |
| `U0.10`: condition 4 — U1.4/U1.5 exit criteria not re-pointed at the new set until conditions 2–3 hold, and not cited as passed until then | condition 4 | yes |
| *"The gate is answered but NOT closed"* | gate's last line | yes |

I grepped for any claim that the gate is **closed** across `TASKS.md`, `goal.json` and the
manifest: **none**. The answered/closed distinction is load-bearing and it is stated correctly in
both trackers. **[I3] now holds** — the correction was re-derived from the gate file and applied to
every surface, which is exactly what cycles 1 and 2 failed to do.

## 3. Mutation proof, replayed — and armed first

```
$ node scripts/lib/mutate.mjs apply TASKS.md
  MUTATION ARMED: TASKS.md (restore with: mutate.mjs restore)
$ sed -i 's/^| T-021 | open |/| T-021 | blocked |/' TASKS.md      ← the literal cycle-2 state
$ node scripts/tracker-audit.mjs --gate g1
  tracker-audit --gate G1: 1 finding(s)
    G1 status: T-021 is "pending" in goal.json but "blocked" in TASKS.md
  exit=1
$ node scripts/lib/mutate.mjs restore TASKS.md
  RESTORED: TASKS.md (verified identical to HEAD)
$ git diff --stat -- TASKS.md      → empty
$ node scripts/lib/mutate.mjs assert-clean
  MUTATIONS CLEAN: none outstanding
$ node scripts/tracker-audit.mjs --gate g1      → OK, exit 0
```

The finding names the pending/blocked mismatch exactly as the manifest promises, and it is the
check that was **structurally impossible** before this cycle. No mutation is armed as I write this;
`.claude/hooks/mc-precommit.ps1:22` delegates to `assert-clean`, so the commit below could not have
landed over an armed mutation. **C6 holds.**

## 4. Ruling on the scope call — the `NORMALISE` change is correct, not scope creep

The cycle-2 verdict asked only for three `TASKS.md` rows. The maker also changed
`tracker-audit.mjs:43` so `blocked` maps to its own class instead of collapsing into `not-done`.
**Ruling: correct, and it is the more important half of this cycle.**

- It is **causal, not adjacent.** The cycle-2 verdict's own second consequence said the gate stayed
  green over two trackers that disagreed in fact *because* both words normalised to `not-done`.
  Fixing only the three rows would have left the mechanism that hid them intact — and this unit has
  now had the same class of defect recur twice for exactly that reason. Repairing data while
  leaving the blind check is what makes a finding come back a third time.
- It is **contained.** `git log --name-only` on `683f043`: `TASKS.md`,
  `scripts/lib/tracker-audit.mjs`, `scripts/lib/tracker-audit.test.mjs`. No product code, no
  contract, no ledger, no manifest-adjacent surface. `apps/`, `packages/`, `workers/` untouched;
  typecheck and depcruise clean.
- **Blockage is still representable — I confirmed this independently, not from test 11.** I copied
  `TASKS.md` + `goal.json` to a scratch root, set `T-021` to `blocked` on **both** sides, and ran
  `audit(root)` against it: **zero G1 findings.** Agreeing `blocked` rows pass. The new class
  distinguishes disagreement; it does not outlaw the state. So this is not one lie traded for
  another.
- Test 11 (`G1 still accepts agreeing blocked rows — the new class did not make blockage
  unrepresentable`) is the right test to have written alongside it, and it is the test I would have
  demanded had it been missing.

The narrow reading — "a final fix cycle should change only what the verdict named" — would have
been the wrong call here, because the verdict named a symptom whose cause was one line away in the
same file the fix already had open.

## 5. Contract sweep

| | |
|---|---|
| **[C1]** row-set parity | holds — `--gate g1` clean; 56 ids on both sides |
| **[C2]** status agreement in meaning | holds — the three rows agree; `open`/`pending` is the contract's own permitted vocabulary spread |
| **[C3]** arithmetic headline | holds — recomputed 31/56 → 55%, matches `progress` |
| **[C4]** G2 unverified fixes | not engaged by this unit (see Notes) |
| **[C5]** G3 sweep freshness | not engaged by this unit |
| **[C6]** gate exercised, not asserted | holds — mutation fired and restored, armed |
| **[C7]** budget | holds — 125 non-blank LOC (≤300), `lint:structure` exit 0 |

| | |
|---|---|
| **[I1]** no `done` on weak evidence | holds — no row changed `done` state this cycle |
| **[I2]** one id, one scope | holds — `uniq -d` on the id column empty; no duplicate rows |
| **[I3]** corrections re-derived, not assumed | **holds now** — notes rewritten from the gate file, and I re-read the gate rather than the notes to confirm it |
| **[I4]** flattering direction audited hardest | holds — the change raises readiness (`blocked`→`open`), and each row carries its evidence inline (the gate path, Option C, the four conditions). `percent` unchanged at 55%; denominator unchanged at 56 |
| **[I5]** the ledger is the checker's | holds — `683f043` touches no `qa/issues.jsonl`, no `qa/.last-sweep`, no verdict file |
| **[I6]** `fixed → verified` needs a later independent re-check | holds — ISS-090 goes to `fixed`, not `verified`; ISS-089 stays `fixed` |

---

## Notes that are NOT failures

- **The G2 backlog is real but out of this unit's scope.** The full audit (no `--gate`) exits 1 with
  *"35 issue(s) are `fixed` with no `verified_date`"*. That is C4, which the contract's own
  amendment log deliberately keeps out of `lint:structure` as checker-owned, and it predates this
  unit. Not charged here; it belongs to a sweep.
- **A residual trace of the cycle-2 overclaim.** The manifest corrected its "names an unknown status
  word **instead of** a mismatch" wording, but the *test name* at
  `tracker-audit.test.mjs` still reads `G1 names an unknown status word instead of emitting a
  confusing mismatch`. It emits both. Cosmetic, one line, no fix required.
- **`.goal/goal.json` is dirty in the working tree, and it is not this unit's.** `git diff` shows
  only `updated`/`last_deterministic_tick` timestamps and four added `progress` counters
  (`in_progress`, `blocked: 0`, `pending`, `current`) written by the concurrent monitor tick. It
  also dropped the file's trailing newline. Neither affects any criterion — `progress.total/done/
  percent` still verify as arithmetic — and I did not touch it.
- **I did not hunt a finding.** Every item the dispatch told me to press on came back clean under a
  check I ran myself, including the two designed to catch a flattering paraphrase (the gate's
  1.000-is-a-failure inversion, and whether the new `blocked` class quietly outlawed a legitimate
  state). `ISSUES-WRITTEN: none` is the correct outcome.
- No goal task matches this unit slug (`Goal task: none`), so no `/goal` close is performed.

## Ledger

- **ISS-090** → `status: fixed`, `fixed_date: 2026-09-08`, with the cycle-3 evidence above recorded
  in `fixed_evidence`. Not `verified` — per [I6] that needs a later, independent re-check that
  re-executes the defect.
- **ISS-089** → unchanged at `fixed` (closed in cycle 2).
- No new issue ids written.

---

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 6/6 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: ISS-090 is fixed in both trackers. I re-grepped TASKS.md and goal.json myself and read the rows rather than trusting a blocked_by field grep — the grep that produced the cycle-2 failure: "BLOCKED by qa/gates" 0, "Needs the human gate answered first" 0, blocked-status rows 0, no blocked_by key in either file, and the four surviving "blocked" strings in TASKS.md are all benign (an UNBLOCKED prefix, the gate's own "NOT gate-blocked" line, unrelated prose, and an explicit retraction). I read qa/gates/golden-set-redesign.md rather than goal.json to verify the three notes: the PASS band is still stated as recall@5 strictly between 0.217 and 1.000 with a non-zero miss count, 1.000 is still a FAILURE escalating to Option B, the 63% pin-rate diagnostic and condition 4 are intact, and nothing claims the gate is closed. The mutation proof replays exactly as written — armed via mutate.mjs, a reintroduced `| T-021 | blocked |` yields "G1 status: T-021 is pending in goal.json but blocked in TASKS.md" exit 1, restore verified identical to HEAD, git diff empty, assert-clean CLEAN. On the scope call I rule the NORMALISE change correct rather than creep: the collapse of blocked into not-done is why G1 could not see the divergence, the diff is three files with no product code, and blockage stays representable — I confirmed that independently by running audit() over a scratch copy with T-021 set blocked on BOTH sides, which yields zero G1 findings. 11/11 tests, --gate g1 exit 0, lint:structure exit 0, typecheck exit 0, and the 55% headline recomputed as arithmetic on 31/56 rows.
```
