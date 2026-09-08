# QUEUE — top-3 recommended next units (checker sweep 2026-09-08, Mode B safety net)

> Last sweep stamp read `2026-09-07T19:08:36Z` (commit `53d73fa`). Range verified by
> `git log 53d73fa..HEAD`, not by trusting the stamp: **2 commits** — `cf7cbd2`
> (health-route-error-hardening), `d31a7ca` (search-route). Both re-read from disk.

## Terminal state: FINDINGS: 1

One finding — `data/eval/golden-set.json` cannot support the claim `recallAtK: 1.000` makes.
Independently confirmed with my own measurement (below), and **deliberately NOT filed to the
ledger by this sweep**: the maker has an in-flight unit proving exactly this, and its own checker
owns the row. Ledger clean, no bypass, no goal-drift, enforcement live. Three sub-threshold notes
recorded, none filed.

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** Both units in range have a matching-cycle manifest + verdict pair, re-read from
disk (not from the commit messages):

| commit | unit | manifest Fix cycle | manifest Status | verdict Cycle checked | verdict |
|---|---|---|---|---|---|
| `cf7cbd2` | health-route-error-hardening | 1 of max 3 | `checked-PASS` (L92) | 1 | PASS |
| `d31a7ca` | search-route | 1 of max 3 | `checked-PASS` (L147) | 1 | PASS |

Full-repo scan of all 73 manifests: **zero** stuck at `ready-for-check`. The single grep hit
(`catalogue-input-integrity.md:133`) is the same known prose false-positive prior sweeps ruled
out — the string appears inside that manifest's own narrative about a past reconciliation gap,
not in a Status line. Re-confirmed by direct read, again.

`search-route`'s verdict discloses that its checker could **not** run the live-Mongo check
(network/environment, item 11) and passed the unit on the other evidence. That is disclosed, not
hidden, and the maker's own live proof is independent of it — noted, not a finding.

### 2 — Feedback-inbox fold-in

No new entries since the last sweep. The 2026-09-08 PATTERN entry (false-green regression tests
that re-derive their own inline check) is correctly marked `— folded 2026-09-08`, but that edit
was **still uncommitted** — the previous sweep left it for the unit that owned the surrounding
in-flight files, and two units have since landed (`cf7cbd2`, `d31a7ca`) without picking it up.
`qa/feedback-inbox.md` is a checker-owned surface and the protocol for check 2 is "mark the entry
folded with date **+ commit**" — so **this sweep commits it**, closing a fold-in gap that was one
`git clean` from being lost. No content changed; only the existing fold marker is committed.

### 3 — Ledger integrity

```
$ node scripts/tracker-audit.mjs
tracker-audit: 2 finding(s)
  G2 unverified: 23 issue(s) are "fixed" with no verified_date — ISS-006, ISS-007, ISS-011, …
  G3 stale sweep: qa/.last-sweep predates HEAD by 0.3 day(s)

$ node scripts/tracker-audit.mjs --gate g1
tracker-audit: OK (gate G1)
```

**G1 clean. G2 expected shape** (the project never backfills `verified_date` on batch closures).
**G3 is this sweep's own trigger** and resolves on this commit.

**The previous sweep's duplicate-JSON-key fix holds.** Re-verified three independent ways, not
one — because a plain `JSON.parse` keeps the last value and therefore *cannot* detect the bug it
would be asked to prove absent:

- `python3 json.loads` per line: **70 lines, 0 invalid**
- `node JSON.parse` per line: **70 lines, 0 invalid**
- **raw key-occurrence scan** (regex count of `"key":` per line, the only check that actually
  sees duplication): **0 duplicate-key lines**

**Own count, recomputed from the file:** 70 issues — **3 open, 25 fixed, 42 verified.** The 3 open
are ISS-050/051/052, all low, all explicitly ruled FILE-don't-FIX by prior checker rulings.
No ledger correction needed this sweep.

**Reopen-power: not exercised, and one candidate deliberately declined.** The golden-set finding
below would ordinarily reopen the units that produced `recall-report.json` — but `T-021` and
`T-022` are **already `pending`** in `goal.json` (reverted by the `tracker-honesty` unit), so the
goal already tells the truth. Reopening would be theatre.

### 4 — Enforcement liveness

211 commits at range start, **213 now** (not zero-history). **6** `.ps1` hooks registered in
`.claude/settings.json`, unchanged: `decisions-append-guard`, `features-snapshot-session-end`,
`lab-session-end`, `lab-session-start`, `mc-precommit`, `mc-sessionstart`.
`docs/DECISIONS.md` **untouched** across the whole range (`git diff 53d73fa..HEAD` empty) —
append-only trivially intact. `qa/loop.md` present, `qa/adapter.json` still absent (default coding
adapter), no contradiction. **Live.**

Loop-design triad:
- **Can it spin?** No — 2 real unit close-outs, and the maker's last tick ended by *stopping* and
  asking the human rather than manufacturing a next unit. That is the Stop line working.
- **Can it Goodhart the verifier?** For code units, no — both this range were independently
  mutation-tested by their own checkers. **For the eval units, yes, and it already did** — see
  the finding below. This is the one place the triad's second question returns a real "yes", and
  it is the finding.
- **Can it run a wrong answer to completion?** Yes, once, and it did: `T-021`'s `done_check` was
  `recall@5 >= 0.85` against a set that returns 1.000 by construction. A `done_check` weaker than
  the criterion it closes is exactly this question's failure mode.

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks, **26 done / 9 pending**. `git diff` shows **only** the deterministic
recompute fields moved (`updated`, `velocity_per_day`, `eta_days`, `last_deterministic_tick`) —
zero task-row edits this range. North star unchanged.

**The prior sweep's U0.7–U0.10 gap: re-assessed, and it DOWNGRADES rather than escalates.** The
prior sweep asked whether this now deserves a maker/human action. Having re-derived the mapping,
my answer is **no — do not add `T-*` rows**, for a reason the prior sweep did not have:

- U0.7 (both halves), U0.8 and U0.9 are **already shipped**. Retro-adding `T-*` rows for closed
  work only inflates both numerator and denominator with history; it moves the percentage without
  telling anyone anything they can act on. That is cosmetic accounting, and this project reverted
  `T-021`/`T-022` precisely to stop doing cosmetic accounting.
- **U0.10 is not an uncovered roadmap item — it *is* `T-021` + `T-022`**, which already exist as
  rows and are already `pending`. The plan's own wording ("redo T-021/T-022 against a real LLM")
  says so. So the *one* remaining Phase-0-finish item is fully covered by existing rows.

The gap therefore closes itself, and the real action is not a new row — it is **amending `T-021`'s
acceptance criterion**, because `recall@5 >= 0.85` against the current golden set is not a target
a retriever can fail. That is queued as item 1 below.

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent. No `qa/gates/` directory. No unit re-PASSed twice on the same evidence.
All ticks in range `ADVANCED`, none `STALLED`/`EXHAUSTED`, so no missing `qa/debug/` report.

**No `GRILL:` row raised — deliberately.** The golden-set problem does need a human decision
(the plan itself requires two human graders to de-ambiguate the rubric), which is a textbook
check-6 trigger. But the maker's own `2026-09-08T01:35` tick **already escalated exactly this to
the user and stopped**. Raising a `GRILL:` row now would re-ask a question already sitting with
the human — the D-006 anti-pattern this skill names by name ("the approval lived in chat, the
sweep kept flagging, the maker kept re-asking"). The gate is open and correctly placed; a second
one is noise, not rigour.

### 7 — Silent-failure hunt

Read the full surface touched this range: `apps/api/src/health-probe.ts`,
`apps/api/src/store.ts` (`createMongoHealthDeps`, `createMongoSearchDeps`),
`apps/api/src/routes/search.ts`, `packages/index/src/search/lexical.ts`.

**No silent failures. Nothing filed.** Detail, including the two things I checked *because* they
look like the pattern and turned out not to be:

- **`probeMongoHealth` (health-probe.ts:22) — `catch { return {db:"error", collections:{}} }` is
  a bare, argument-less catch that discards the error object.** Structurally this is the
  "default-value fallback masking a failure" shape. It is **not** a finding: the degraded return
  is the literal contract (`qa/contracts/health-route.md`, "REPORT an unhealthy backend, never
  crash reporting it"), and `db:"error"` makes the failure *loud*, not silent — the caller cannot
  mistake it for health. The skill's carve-out ("never opens an issue on a fallback the contract
  explicitly asks for") applies exactly. Sub-threshold note only: the *cause* is dropped, so ops
  learns `db:"error"` but never why. A one-line `console.warn` in the catch would cost nothing.
  Not filed — observability preference, not a defect.
- **`routes/search.ts:39` — `await deps.search(...)` in an async handler with no try/catch.**
  This is the exact shape of ISS-070 and I expected it to be a repeat. **It is not.**
  `apps/api/package.json` pins **`express: 5.2.1`**, and Express 5 forwards rejected promises
  from async handlers to the error handler automatically. No unhandled rejection, no hung
  request. ISS-070 was a genuine bug specifically because `probeMongoHealth` ran *outside* that
  mechanism. Cleared on evidence, not assumed.
- **`createMongoSearchDeps` (store.ts:280) — `turnsColl(tenantId).find({}).toArray()` loads a
  tenant's entire `turns` collection into memory on every `/search` request.** Real, and unbounded
  in principle. **Not filed**: it is disclosed in the function's own header comment, correct at
  23 sessions, and the plan explicitly replaces this scorer at U1.5. Recorded as a watch-item so
  U1.5 inherits it rather than rediscovering it.
- `lexical.ts`: pure, no I/O, no error handling to get wrong. `session: null` / `turn: null`
  fallbacks are the disclosed `citations.ts` citation shape, not swallows. Clean.

---

## The golden-set question — independent assessment (the finding)

I was asked to form my own view on whether `data/eval/golden-set.json` is tautological. I did not
take the maker's reading on faith; I measured the set myself. **I agree with the conclusion, and
I disagree with the stated mechanism** — and the correction makes the case stronger, not weaker.

**Where the maker's reading is wrong.** The claim is that the set "cannot distinguish a good
retriever from a trivial exact-substring matcher." Taken literally, that is false, and measurably
so: the questions come from each page's `keyInsights`, while `heuristic-retriever.ts` scores
against each session node's `summary` — a **different field** of the same document (confirmed:
`packages/index/src/tree/build.ts:129`, `summary = page?.summary`). I checked containment
directly: **0 of 46 questions appear verbatim in their target summary.** An exact-substring
matcher would score 0.000, not 1.000. The tautology framing does not survive contact with the
data.

**Where the maker is right, on numbers I derived myself.** Re-implementing the retriever's own
token-overlap scoring over the 23 real session pages:

| measurement | result |
|---|---|
| recall@5 (the reported metric) | **46/46 = 1.000** |
| recall@1 (much harder, unreported) | **45/46 = 0.978** |
| mean score margin, correct session vs. best competitor | **+0.501** on a 0..1 scale |
| median margin | +0.515 |
| questions where the correct session does *not* win outright | **1 of 46** |
| trivial control: a *single* globally-unique token uniquely pins the session | **29/46 = 63%** |

The correct answer beats every one of the other 22 sessions by **half the entire scale**. That is
not a retrieval task; that is a lookup. And 63% of the set is solved by one rare token
("FRR Forex", "FEMA", "Provident Fund") with no ranking, no scoring, no retriever at all.

So the defect is real but it is **not exact-substring tautology — it is same-source vocabulary
leakage plus ceiling saturation.** Query and target were written by the same summarizer over the
same transcript, so they share the rare named entities that make the answer unique; and with the
metric pinned at 1.000 with zero misses, it can register a regression but can **never** register
an improvement.

**On U0.10 specifically: I agree, and not mildly.** "Redo T-021/T-022 against a real LLM" swaps
the *system under test* while leaving the *measuring instrument* untouched. Against a set where
the right answer wins by +0.50 and recall@5 is 1.000 by construction, an LLM retriever will also
score ~1.000 — and the `>= 0.85` target is cleared by anything that is not actively broken. The
plan's stated purpose for U0.10 is "without it Phase 1 is unfalsifiable"; executing U0.10 as
written would spend real LLM budget to produce a second unfalsifiable number. **The measuring
instrument is the broken part, and U0.10 does not touch it.** Not overstated — if anything the
plan understates it, because U0.10 as written would let the project *believe* it had fixed
falsifiability.

**Would I file it, and at what severity: yes — `high`, type `eval-validity`.** Not `critical`:
nothing in production is wrong, no data is lost, no user is affected. But `high`, because a
`checked-PASS` unit is on the books recording `recallAtK: 1.000` as evidence, and Phase 1's exit
criterion is defined against that number.

**I am not filing it.** The maker has an in-flight unit building exactly this proof
(`packages/index/src/eval/baseline.ts` + `baseline.test.ts`, both currently **untracked** —
work in progress, no manifest yet; `qa/manifests/` has no `eval-baseline-control` at sweep time).
That unit's own checker owns the ledger row. Two rows for one defect is worse than none.

**One handoff for that unit's checker** (in-flight untracked code, explicitly *not* a sweep
finding — the silent-failure hunt covers PASSed units, and this is neither committed nor
submitted): `baseline.ts:63` reads `const saturated = false;` — hardcoded, never computed from
`measured.misses.length === 0 && measured.recallAtK === 1`. As written, the `"saturated"` branch
at line 72 is unreachable and `assessBaseline` would return **`"informative"`** for the real data
(1.000 measured vs ~0.217 control, lift +0.783) — the precise inverse of the truth, on the exact
case the module exists to catch. `baseline.test.ts`'s "a perfect score with zero misses is
reported SATURATED" asserts `saturated === true` and would currently fail, so this reads as
mid-TDD red rather than a defect being shipped. Recorded here only so it cannot land green by
accident.

---

## Top-3 recommended next units

The QA meta-backlog is empty (3 open issues, all explicitly file-don't-fix). Plan §10 U0.7/U0.8/
U0.9 are all closed. Everything below points at the one remaining Phase-0-finish item and the
thing standing in front of it.

1. **`golden-set-redesign` — replace the instrument before spending on U0.10.** *HUMAN_GATE,
   already with the user.* U0.10 must not run against the current set. The replacement needs the
   properties the current one lacks: questions written from the **transcripts**, not from the
   summaries being retrieved (kills the shared-vocabulary leak); phrased as actual **questions**,
   since all 46 current entries are declarative statements and users do not talk that way;
   deliberately including **near-neighbour sessions** so some answers are genuinely contestable;
   and every future recall figure reported **next to its question-blind control**, never alone.
   Human input is genuinely required here (the plan's own two-hand-graders requirement) — the
   maker already escalated and stopped, correctly. Also amend `T-021`'s `done_check`: a `>= 0.85`
   target against a set that returns 1.000 by construction is not a criterion.
2. **`eval-baseline-control` — land the control harness, no human and no LLM spend needed.**
   *Maker work, already in flight.* This is the cheapest thing that makes every future recall
   number falsifiable, and it is buildable **today**, in parallel with the human decision in
   item 1: report `recall@k` and the question-blind control side by side, and refuse to report a
   bare score. Finish it, wire it into `recall-report.json`, and fix the hardcoded
   `saturated = false` before submitting (see the handoff above) — a saturation detector that
   cannot detect saturation is worse than none, because it certifies the broken number as
   "informative". Land this and item 1's redesign has a working scoreboard waiting for it.
3. **`/search` follow-through** (plan §10 U0.7 shipped its first cut; two disclosed gaps remain) —
   *maker work, small, no gate.* (a) `createMongoSearchDeps` loads every turn in the tenant per
   request — fine at 23 sessions, a real cliff later, and the U1.5 hybrid merge inherits it;
   (b) search covers `turns` only, not `session_pages`, disclosed by the unit itself. Neither is
   urgent, both are cheap now and awkward after U1.5 builds on top. Pick this when items 1–2 are
   blocked on the human.

## Standing issues, unchanged this sweep

ISS-050 / ISS-051 / ISS-052 (all low, `catalogue-progress-score`) — ruled "FILE, don't FIX"
(sabotage-of-the-instrument class, zero measured payload) by prior checker rulings. Recorded,
not chased. ISS-070 closed and verified by `cf7cbd2` this range.
