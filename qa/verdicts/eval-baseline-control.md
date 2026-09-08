# Verdict — eval-baseline-control

**VERDICT: PASS**

- **Date:** 2026-09-08
- **Cycle checked:** 1 (matches the manifest's `Fix cycle: 1 of max 3`)
- **Mode:** A (unit check), fresh context, bound to `D:/KnowledgeBase`
- **Contract:** none existed. Written and adopted by this checker in the same action —
  `qa/contracts/eval-baseline-control.md` (deferred to the checker per ISS-006).
- **Judged against:** that contract's C1–C9 / I1–I4, the manifest's own stated criteria, and
  plan §10 U0.10.

```
VERDICT: PASS
SCOREBOARD: 9/9 criteria met, 4/4 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: ISS-071 (high, golden-set-recall) — the finding the manifest produced evidence
  for and deliberately did not file
EXPLANATION: Every number in the manifest reproduced under my own execution, and both mutations
  reddened exactly the tests claimed, with diff proof of application. I also independently
  reproduced the disclosed false-green: reverting only the blindness test's questions to id-free
  ones, under the same question-aware mutation, returns that test to GREEN — so the maker's
  strengthening is real and load-bearing, not a cosmetic edit. I verified both of the maker's
  walk-backs myself rather than accepting them: the substring-tautology framing is genuinely
  false (0 of 74 keyInsights appear verbatim in their own summary) and the retriever is genuinely
  not worthless (+0.783 lift). The third version of the finding survives; I filed it as ISS-071
  at high severity, scoped narrower than the manifest asserted on one axis and wider on another
  (see below).
```

## What I re-ran (all commands executed by me; nothing taken from the manifest)

| command | my result | manifest claim | match |
|---|---|---|---|
| `node scripts/eval-recall.mjs` | `recall@5 = 1.000 (46/46)`, `control = 0.217`, `chance floor = 0.217`, `VERDICT: SATURATED` | same three numbers | ✅ |
| `pnpm --filter @lkb/index test` | `tests 56 / pass 56 / fail 0` | 56/56 | ✅ |
| `pnpm -r typecheck` | exit `0`, all workspace projects `Done` | exit 0 | ✅ |
| `pnpm lint:structure` | clean — 237 files in budget, 254 unique exports, snapshot matches, tracker-audit G1 OK, 0 dependency violations (259 modules / 774 deps) | clean | ✅ |
| `node scripts/catalogue-score.mjs` | `24.6% adjusted / 33.3% machine-derived, 57 features` | 24.6%/33.3% unchanged | ✅ |

### Chance-floor arithmetic, re-derived from raw data (not from `assessBaseline`)

I did not let the module grade its own floor. Reading `data/toc-migrated/*/session.json` and
`data/eval/golden-set.json` directly: **23 sessions, 46 questions, 23 distinct expected sessions**
(exactly 2 per session — a balanced set). The deterministic blind top-5 is the first five session
ids; **10 of the 46 questions** name one of those five as their expected session.

```
10/46 = 0.2174     5/23 = 0.2174     report control.recallAtK = 0.21739130434782608
```

The control lands **on** the floor, not above it — so it is not leaking question signal, and
0.217 is a true floor rather than an artifact. `liftOverControl = 0.783`, confirmed from the
regenerated report.

## Criteria

- **[C1] question-blind — MET.** `baseline.ts:25-28`: the parameter is `_question` and is
  unreferenced in the body; the closure reads only `ordered` and `k`. Proven behaviourally by
  mutation (b), not just by reading.
- **[C2] deterministic — MET.** `const ordered = [...sessionIds]` defensively copies; the return
  is a pure `slice`. No randomness, no clock, no I/O.
- **[C3] respects `k` — MET.** Test at `baseline.test.ts:32-34`; `slice(0, k)`.
- **[C4] `at-chance` outranks `saturated` — MET.** `baseline.ts:67` tests `liftOverControl <= 0`
  **before** `baseline.ts:72`'s `else if (saturated)`. Behaviourally pinned by the test at
  `baseline.test.ts:52-57`, which feeds a *perfect* 1.000 measured against a *perfect* 1.000
  control and asserts `at-chance` — i.e. it exercises exactly the case where the two branches
  compete, which is the only way this precedence can be tested at all.
- **[C5] saturation computed, not assumed — MET.** `baseline.ts:63` derives it from
  `measured.recallAtK >= 1 && measured.misses.length === 0`. (The 2026-09-08 sweep's handoff
  flagged this as a hardcoded `false` on then-untracked in-flight code; that was fixed before
  submission and I confirm it is computed as of this check.) `chanceFloor` clamps via
  `Math.min(1, k / sessionCount)` with a `sessionCount === 0 → 0` guard, both covered at
  `baseline.test.ts:66-69`.
- **[C6] control reported and persisted — MET.** `eval-recall.mjs:57-63` builds the control over
  `sessions.map(s => s._id)` — the *same* candidate pool the real retriever faces, which is what
  makes the comparison fair — and prints all three lines. I confirmed the regenerated
  `data/eval/recall-report.json` carries `control`, `assessment`, and `goldenSetProvenance`.
- **[C7] mutation-provable — MET, both, with diff proof.**
  - **(a) `saturated = false`** — `diff` against my backup confirmed the single-line change was
    applied. Result: **55/56, `✖ a perfect score with zero misses is reported SATURATED, not as
    success`** — exactly that test, nothing else. Restored.
  - **(b) question-aware control** (`named = ordered.filter(id => question.includes(id))`,
    ranked first) — `diff` confirmed applied. Result: **54/56, `✖ the null retriever ignores the
    question entirely and is deterministic` AND `✖ the null retriever scores the real chance floor
    on a real golden set`** — both, as claimed. Restored.
  - Restore verified by `diff` against backups (**byte-identical, both files**), a repo-wide
    `grep -rn "CHECKER MUTATION"` returning nothing, and a clean **56/56**. No mutation residue.
- **[C8] blindness test runs on reactive inputs — MET, and independently proven load-bearing.**
  This is the item I did not take on trust. Holding mutation (b) in place, I reverted **only** the
  blindness test's two questions to id-free ones (`"what did they say about forex markups"` /
  `"...visa timelines"`) — the shape the manifest says the earlier version had. Result:
  **55/56, and the test literally named "ignores the question entirely" PASSED** under a control
  that demonstrably peeks at the question; only the chance-floor test caught it. Restoring the
  id-naming questions returns it to catching the mutation. The disclosed false-green is real, the
  fix is real, and the load-bearing assertion is `baseline.test.ts:29`
  (`assert.deepEqual(a, ["s1"..."s5"], "naming s9/s10 must not pull them into the top-5")`) —
  the `deepEqual(a, b)` self-comparison alone would still false-green.
- **[C9] build green, catalogue unchanged — MET.** See the table. The catalogue score not moving
  is the correct outcome and I checked it for that reason: a move would have meant this unit
  leaked into plan §4c's 57 catalogue features instead of staying eval instrumentation.

## Invariants

- **[I1] never a bare recall number — HOLDS.** `eval-recall.mjs` has no path that prints or
  persists recall without the control; the control and assessment are computed unconditionally.
- **[I2] verdict not softened — HOLDS.** No branch widening; the `informative` branch is the
  fall-through of two guards, not a default.
- **[I3] `chanceFloor == controlRecall` is a balanced-set coincidence — HOLDS, recorded.** It is
  exact here only because the set is exactly 2 questions per session across all 23. I recorded
  this in the contract so a future unbalanced set's legitimate divergence is not misread as a
  harness bug, and so nobody promotes the side-by-side print into a hard equality assertion.
  Sub-threshold note, **not** a failure: nothing is wrong today.
- **[I4] control never made question-aware — HOLDS.** Now pinned by C8's strengthened test.

## Manifest claims checked against the ledger

`Issues addressed: none directly` — correct. No open issue claimed fixed by this unit, so nothing
was closed on its word. ISS-071 is *created* by this check, not claimed by the maker.

---

# The main judgment call — my independent view

The manifest produced the evidence, refused to file the finding, and told me it had already been
wrong twice. I verified both disproofs myself before accepting the third version.

**Disproof 1 (verbatim-substring tautology) — genuinely false; the walk-back was correct.** I
checked containment across all 23 pages, not the single sample the manifest cites: **0 of 74
`keyInsights` appear verbatim in their own page's `summary`.** `keyInsights` and `summary` are
different fields, and `heuristic-retriever.ts` scores against `summary`. An exact-substring
matcher would score **0.000**, not 1.000. The tautology framing does not survive the data.

**Disproof 2 (the retriever is worthless) — genuinely false; the walk-back was correct.**
+0.783 lift over a true floor. This is a decisive win over chance and the finding must not be
read as a criticism of the retriever.

**The third version — I agree, and it is correct.** The saturation claim is not an inference, it
is a definitional property of a measurement I reproduced: 46/46 with `misses: []` is the maximum
of the metric. A quantity at its maximum can move down or stay; it cannot move up. So the
instrument can register a regression and can never demonstrate an improvement. Correctly scoped
as an instrument defect, not a retriever defect.

**On U0.10's remedy — I agree it is insufficient, with one scoping correction against the
manifest and one correction in its favour.**

*Against.* U0.10 as written has three halves (plan lines 1251-1254), and only one is saturated:
(i) the **recall@5** half is saturated and cannot yield a falsifiable number on this set;
(ii) the **judge-agreement / T-022 evaluator-calibration** half is a different instrument and is
**not** shown saturated by this evidence — it is not blocked by this finding; (iii) "file the
retraction of the heuristic-proxy PASS" depends on no question set at all and should just be
done. The manifest's blanket "U0.10 as written cannot produce a falsifiable number" is right on
(i) and **overbroad** on (ii) and (iii). I filed the narrower claim.

*In its favour.* The manifest **under-scoped the blast radius**, and this I derived from the plan
text rather than from the manifest. The same saturation disarms two later gates: U1.4 requires
"recall@5 reported as a **delta against the U0.10 baseline**" (plan:1281) — a delta that can only
be ≤ 0 — and U1.5 requires "recall@5 **≥ 0.85** on the real golden set" (plan:1287), a target
cleared by anything not actively broken. So this is not a U0.10-local problem; it is the Phase-1
exit criterion. That makes the finding **stronger** than the manifest claimed, not weaker.

One thing I will not overstate: running U0.10 is not *literally* information-free. A real LLM
scoring below 1.000 would tell you it is worse than the heuristic. The precise claim — which the
manifest itself already hedges correctly — is that it can falsify "the LLM is at least as good"
and can never demonstrate improvement, while the `≥ 0.85` target it is measured against is
unfailable. That is enough to make the spend unjustified before the set is replaced.

**On the HUMAN_GATE — yes in substance, and it is already open, so I am raising no new gate.**
Authoring a non-derived question set is a judgment call a maker should not make alone (the plan's
own T-022 design requires two human graders), and it must be settled **before** U0.10 is
scheduled rather than discovered mid-unit. But the maker's `2026-09-08T01:35` tick already
escalated exactly this to the user and stopped, and the 2026-09-08 Mode B sweep confirmed it
(`qa/QUEUE.md` item 1, `golden-set-redesign — HUMAN_GATE, already with the user`). Raising a
second `GRILL:` row would re-ask a question already sitting with the human — the D-006
anti-pattern this project names by name. Recorded as a dependency inside ISS-071 instead.

**Filed: ISS-071 · severity `high` · feature `golden-set-recall`.** Not `critical` — nothing in
production is wrong, no data is lost, no user is affected. `high` because a `checked-PASS` unit
has `recallAtK: 1.000` on the books as evidence and Phase 1's exit criterion is defined against
that number. Filed against `golden-set-recall` (the contract that owns the set and the metric),
**not** against `eval-baseline-control` — this unit's harness is correct and is the thing that
*found* the defect; filing against it would punish the instrument for the reading.

**Not a double-file.** I checked `qa/QUEUE.md` and `qa/.last-sweep` before writing. The concurrent
Mode B sweep reached the same conclusion at the same severity independently and deliberately did
not file, deferring the row to this unit's checker precisely so there would be one row, not two.
ISS-071 is that row — the reconciliation the sweep asked for. The sweep and I differ on one point
of mechanism (it also rejects the substring framing, and additionally measured a +0.501 score
margin and 63% single-token solvability, which I did not re-derive and therefore do not rely on);
we do not differ on the conclusion or the severity.

## Why this is a PASS despite a high-severity issue

The unit's job was to build the two controls and measure honestly. It did: the controls are
correct, deterministic, mutation-proven, and the measurement is reproducible to the digit. The
high-severity finding is **about the golden set**, which this unit deliberately did not touch and
which a different contract owns. Failing this unit for successfully detecting a pre-existing
defect would be exactly backwards — and it disclosed its own test's false-green rather than
quietly fixing it, which is the behaviour this pair exists to reward.
