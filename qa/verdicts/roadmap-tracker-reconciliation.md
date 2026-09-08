# Verdict — roadmap-tracker-reconciliation

**Cycle checked:** 1
**Date:** 2026-09-08
**Contract:** qa/contracts/tracker-integrity.md
**Mode:** A (unit check), bound to `D:/KnowledgeBase`
**Verdict: FAIL** — 7/7 criteria met, 4/6 invariants hold (I2, I3 violated)

The gates, the regex change, the tests and the six status claims in the manifest's table all
hold up under independent re-execution. The unit fails on the two rows it did **not** re-derive:
it introduced a duplicate `U3.1` row in `TASKS.md` (I2), and it set three rows `blocked` against a
human gate that had been **answered 42 minutes earlier** in the same working tree (I3). Both are
the exact failure mode this contract was written for, committed by the unit whose subject is
tracker integrity.

---

## What I re-ran myself (nothing below is the maker's pasted output)

| command | my result |
|---|---|
| `node scripts/tracker-audit.mjs --gate g1` | `tracker-audit: OK (gate G1)`, exit 0 |
| `node scripts/tracker-audit.mjs` (full) | exit 1, one finding: `G2 unverified: 34 issue(s)` — G2 only, no G1/G3 |
| `node --test scripts/lib/tracker-audit.test.mjs` | 7 pass / 0 fail |
| `pnpm lint:structure` | exit 0 — loc 245, dirsize 75, root 15, dupes 255, migrations 1167, SNAPSHOT fresh (113/200), `tracker-audit: OK (gate G1)`, depcruise 0 violations / 267 modules |

## Criterion-by-criterion

- **[C1] G1 row-set parity — PASS.** Both trackers carry the same 56 ids; `--gate g1` clean.
- **[C2] G1 status agreement — PASS.** No status findings. See the I2 note below: this passes
  *only* because `mdRows` is a `Map` and the later `U3.1` row overwrites the earlier one.
- **[C3] G1 arithmetic headline — PASS, and the headline is arithmetic, not typed.** I recomputed
  from `tasks[]` independently: 56 tasks, 31 `done`, `round(31/56*100) = 55`. `progress` reads
  `{total:56, done:31, percent:55}` — all three match. The prior `74% (26/35)` is likewise
  arithmetic (`round(26/35*100)=74`). **Confirmed: 74% → 55% is a computed consequence of the
  denominator growing by 21 real rows, not a number someone typed.** The maker's framing — that a
  percentage which drops when you write work down was wrong before — is correct and is the right
  way to have reported it.
- **[C4] G2 unverified fixes — PASS (gate fires).** Full run reports 34 unverified `fixed` rows.
- **[C5] G3 sweep freshness — PASS (gate silent; `.last-sweep` is not behind HEAD).**
- **[C6] The gate is exercised, not asserted — PASS. Mutation performed, this is the load-bearing
  proof the manifest asked for:**
  - `node scripts/lib/mutate.mjs apply scripts/lib/tracker-audit.mjs` → `MUTATION ARMED`
  - reverted the row regex to `(T-[0-9]+[a-z]?)`
  - `node scripts/tracker-audit.mjs --gate g1` → **exit 1**, `G1 row-set: in goal.json but not
    TASKS.md — U0.5, U0.6, U0.7, U0.8, U0.9, U0.10, U1.1, U1.2, U1.3, U1.4, U1.5, U2.1, U2.2,
    U2.3, U2.4, U2.5, U2.6, U3.1, U3.2, U4.1, U4.2` — **exactly 21 rows, as claimed.**
  - `node --test` under the mutation → **6 pass / 1 fail**, the failing one being the new
    `G1 sees U#.# roadmap ids` test. The new test is real, not a tautology.
  - `mutate.mjs restore` → `RESTORED … (verified identical to HEAD)`; `assert-clean` →
    `MUTATIONS CLEAN: none outstanding`; `git diff --stat -- scripts/lib/tracker-audit.mjs` →
    **empty**; `--gate g1` back to OK.
  - **Ruling: the regex widening is load-bearing, not cosmetic.** Without it the import would have
    failed the `lint:structure` commit gate with 21 `onlyGoal` rows. The manifest's claim is exact.
- **[C7] Budget — PASS.** `scripts/lib/tracker-audit.mjs` is 115 lines total; `lint-loc` OK.

## Status spot-checks — I checked all six, not the three asked for

| claim | my independent check | agrees? |
|---|---|---|
| U0.7/U0.8 `done` — `STUB_ROUTES` holds only `POST /webhooks/register` | read `apps/api/src/routes/stubs.ts:22-24` — array has exactly that one entry | yes |
| U0.9 `done` — five accessors | `packages/db/src/collections/` contains `topics.ts`, `speakers.ts`, `decisions.ts`, `orgs.ts`, `graph-edges.ts` | yes |
| U1.1 `pending` — provider exists, zero `embed` refs | `packages/ai/src/provider.ts` exists; case-insensitive grep for `embed` across `packages/ai/src` → **no matches** | yes |
| U1.2 `pending` — vector dir absent | `packages/index/src/vector` → ABSENT | yes |
| U2.1 `pending` — no `topics()` writer | grep `topics()` across `packages/index/src` + `apps/api/src` → no matches | yes |
| U3.1 `in_progress` — Ask page in flight | `apps/web/src/pages/AskPage.tsx`, `AskPage.test.tsx`, `apps/web/src/api/ask.ts` all present | yes |

**All six verified against files, none taken on the maker's word.** The claim "statuses were
verified on disk, not copied from the plan" holds for the entire U-unit table. It does **not** hold
for the three `blocked` rows — see F2.

## Readiness recomputation (my own, from the committed `goal.json`)

```
READY:   T-007, T-011, T-013, T-015, T-028, U1.1, U2.1, U3.1, U4.1
BLOCKED: T-021 -> qa/gates/golden-set-redesign.md
         T-022 -> qa/gates/golden-set-redesign.md
         U0.10 -> (no blocked_by field set)
```

Matches the manifest. `T-021`/`T-022` are correctly excluded and real feature work is offered.
The unit's stated purpose is achieved. But see F2: `U0.10` is suppressed on a reason that is false.

---

## FAILURES

### [I2] F1 · sev: high · `TASKS.md` now carries **two** `U3.1` rows, and this unit added the second

`TASKS.md` contains both:

```
| U3.1 | partial     | Ask page (`apps/web/src/pages/AskPage.tsx`) | Shipped + checker PASS 8/8 … NOT done against plan §10's own exit criterion …
| U3.1 | in_progress | Ask page in apps/web (POST /ask is unreachable from the UI today) | IN FLIGHT in a concurrent maker session …
```

`git show 103a550^:TASKS.md` confirms the `partial` row **pre-existed** and was the only U-row in
the file; `git show 103a550 -- TASKS.md` confirms this unit appended the `in_progress` one. So the
manifest's premise — "plan §10's units existed **only in the plan file**" — was not checked against
`TASKS.md` before writing to it.

This is contract **[I2] One id, one scope** verbatim, and it is worse than an untidy duplicate
because of *why G1 stays green*: `tracker-audit.mjs:47` builds `mdRows` as a `Map` and `set()`s
each match, so the **last row in file order silently wins**. The `partial` row loses. Had the two
rows been in the opposite order, `NORMALISE["partial"]` is `undefined` (it is not in the
`NORMALISE` table at all) and G1 would have fired a status finding. **C2 passes here by file
ordering, not by correctness** — a duplicate-id class of drift that G1 structurally cannot see.

Fix direction: collapse to one `U3.1` row (the `partial` note carries the real exit-criterion
evidence and should survive), or split per I2 into `U3.1` / `U3.1a`. Separately worth a `G1
duplicate id in TASKS.md` check, since the gate is blind to this today.

### [I3] F2 · sev: high · Three rows were set `blocked` against a gate that was already **answered**, and one blocking claim the gate file explicitly denies

`qa/gates/golden-set-redesign.md` carries, on disk, since commit `a7641bf` (2026-09-08 **12:17**):

> **Answered: 2026-09-08 — Option C (regenerate from raw transcripts) — Umesh, in session**

This unit committed at **12:59** (`103a550`), 42 minutes later, in the same working tree. Two
consequences:

1. **`U0.10`'s note is provably stale.** It reads *"Needs the human gate answered first."* The
   human answered. The gate answer is not a hand-wave — it specifies the build (rewrite
   `gen-golden-set.mjs` from `data/toc-migrated/<sessionId>/turns.json`, different model/prompt,
   real question phrasing, near-neighbour distractors) plus four binding acceptance conditions.
   `U0.10` is therefore excluded from readiness on a false premise, and it is exactly the kind of
   real feature work this unit exists to make pullable. (The gate does not *close* until conditions
   1–4 are met, so `blocked` may still be the right status — the **stated reason is what is wrong**,
   and a wrong reason is what a readiness computation reads.)
2. **`T-022`'s `blocked_by` contradicts the gate file.** The gate states, as a scope correction
   made by the `eval-baseline-control` checker (verdict `fcc2863`, ISS-071):
   > *NOT blocked:* the judge-agreement half (**T-022**) — a different instrument, unaffected.

   This unit nonetheless set `T-022` → `status: blocked`, `blocked_by:
   qa/gates/golden-set-redesign.md` in both trackers, without citing or contesting that line.
   `T-022` does carry `deps: ["T-021"]`, so a *dependency* block is arguable — but naming the gate
   as the blocker asserts something the authoritative gate file specifically denies.

Contract **[I3]**: *"Before a status is changed, the underlying reality is counted … not inferred
from a note. A stale note is evidence about the note."* The gate file **is** the reality here and it
was not read; the pre-existing task notes were. The direction is conservative rather than flattering
(so [I4] is not additionally engaged), but the unit's central claim is precisely that it re-derived
state, and on the three rows where a human decision had just landed it did not.

Fix direction: re-read `qa/gates/golden-set-redesign.md`, rewrite `U0.10`'s note to reflect Option C
and the four acceptance conditions (and decide `blocked` vs `pending` on that basis), and either
drop `T-022`'s `blocked_by` to a dependency on `T-021` or state in the row why the gate's own
"NOT blocked" line is being overridden.

---

## RULING on "What I deliberately did NOT do" — the restraint was **CORRECT**, on one sound reason and one stale one

The maker asked for this to be settled rather than left implicit. Settling it.

**This is not a maker dodging work. Declining was right, and I would have filed a finding had it
built the thing.**

**Ground 1 — the execution-surface argument — is sound and I verified it verbatim.**
`~/.claude/skills/goal/SKILL.md` states, as a hard security invariant:

> a `done_check` is … **allowlisted at task creation and reviewed by the human**, never introduced
> free-form mid-run by an auto-tick. An un-allowlisted `cmd` is treated as a gate (HUMAN), not
> executed.

`T-021` is a `.goal` task with `done_check` absent. An auto-tick writing a typed `cmd` `done_check`
onto it is the literal prohibited act. That a *sweep* recommended it does not launder it — a sweep
files findings, it does not grant allowlist authority, and the invariant names the auto-tick
specifically. Correct call, correctly reasoned.

**Ground 2 — "it would answer the gate on the human's behalf" — reaches the right conclusion
through reasoning that was already stale when written.** The gate's headline question ("where should
a non-saturated question set come from?") was answered — Option C — 42 minutes before this commit
(F2). So "the gate asks the human how to fix the saturated metric" was no longer true. The
conclusion survives anyway, for a reason the maker did not give: the gate's *"Also needs deciding in
the same breath"* section explicitly defers the threshold —

> `T-021`'s target of **recall@5 ≥ 0.85** is currently unfailable … that threshold should be
> **re-set against the new set's measured control**, not kept as an inherited number.

That decision is still outstanding, and it is the precise decision re-expressing `T-021`'s
`done_check` would have pre-empted. So: right restraint, right first reason, second reason accidentally
right. The one thing to carry forward is that the maker reasoned about the gate's state from memory
rather than re-reading the file — which is the same root cause as F2.

**Marking the rows `blocked` was the correct honest half**, and the manifest is right that it stops
the tracker advertising unfailable work as ready.

## Notes that are NOT failures

- I did not hunt findings. Both failures came out of the two checks the manifest itself asked for
  (spot-check the statuses; rule on the restraint) — F1 from checking whether the U-rows really
  existed nowhere, F2 from reading the gate file the `blocked_by` points at.
- The full audit's exit 1 on G2 (34 unverified) is **correct behaviour and correctly non-blocking**:
  `--gate g1` filters G2/G3 out, `lint:structure` calls only `--gate g1`, and it exits 0. Verified
  by running both. The module header at lines 19–24 gives the right reason (a gate that blocks on
  someone else acting is a gate people bypass). ISS-088 already tracks G2's monotonic growth.
- `U0.10` has `status: "blocked"` with no `blocked_by` field in `goal.json` (the reason lives only
  in `note`), where `T-021`/`T-022` both have one. Inconsistent, not a contract violation, and it is
  entangled with F2 — fix it in the same pass.
- No product code was touched; `git diff` on `scripts/lib/tracker-audit.mjs` is empty after my
  mutation, and no mutation is armed.

## Ledger

ISS-089 (I2, high), ISS-090 (I3, high) written to `qa/issues.jsonl`.
No goal task matches this unit slug (`Goal task: none`); no `/goal` close performed — and the
verdict is FAIL, so none would be.

---

```
VERDICT: FAIL
SCOREBOARD: 7/7 criteria met, 4/6 invariants hold
FAILURES:
- [I2] sev: high · TASKS.md carries two U3.1 rows (one pre-existing `partial`, one added by this unit as `in_progress`); G1 stays green only because Map-set lets the later row win · collapse to one row or split per I2, and consider a duplicate-id check in G1 · issue: ISS-089
- [I3] sev: high · T-021/T-022/U0.10 set `blocked` against qa/gates/golden-set-redesign.md, which was ANSWERED (Option C, Umesh) at 12:17, 42 min before this 12:59 commit; U0.10's note "needs the human gate answered first" is false and T-022's blocked_by contradicts the gate's own "NOT blocked: T-022" line · re-read the gate file and rewrite the three notes from it · issue: ISS-090
ISSUES-WRITTEN: ISS-089, ISS-090
EXPLANATION: The machinery is sound and independently reproduced — G1/G2/G3 fire, 7/7 tests pass, lint:structure exits 0, the mutation test shows the widened regex is load-bearing (21 onlyGoal rows and one reddened test when reverted, byte-identical restore after), the 74%→55% headline is arithmetic on 31/56 not a typed number, and all six U-unit status claims check out against the actual files. The unit fails on the rows it did not re-derive: it appended a duplicate U3.1 row to TASKS.md, and it marked three tasks blocked by a human gate that had been answered 42 minutes earlier in the same tree — the "verified on disk, not assumed" claim holding for the six rows it tabulated but not for the three it inferred from stale notes. Separately: the restraint on T-021's done_check was CORRECT — /goal's security invariant does forbid an auto-tick introducing a free-form typed cmd check, and the gate's threshold re-set is still genuinely undecided.
```
