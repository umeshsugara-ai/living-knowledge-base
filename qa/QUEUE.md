# QUEUE — top-3 recommended next units (checker sweep 2026-09-08, Mode B safety net)

> Last sweep stamp read `2026-09-07T18:25:00Z` (commit `67ac5e1`). Range verified by
> `git log 67ac5e1..HEAD`, not by trusting timestamps (this session's wall clock showed skew
> all session): **5 commits** — `cb4aaf2`, `fb21a8d`, `3245b5c`, `7e30f44`, `fe5eb5e`. The
> fifth (`fe5eb5e`, health-route) landed **while this sweep was running**, dispatched
> concurrently per `qa/.last-tick`'s own note — re-read `git log` mid-sweep rather than
> assuming it had or hadn't landed, per this sweep's brief, and it had by the time checks
> below ran.

## Terminal state: FINDINGS: 2

One real ledger bug fixed in place, one new medium-severity finding filed (health-route
robustness gap). No bypass, no goal-drift, no stale enforcement.

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** All 5 units in range have a matching-cycle manifest + verdict pair, re-read from
disk:

| commit | unit | manifest Fix cycle | verdict Cycle checked | Status |
|---|---|---|---|---|
| `cb4aaf2` | contract-adoption-backfill (4 contracts) | — (checker-direct action) | — | reopen closed (ISS-006) |
| `fb21a8d` | housekeeping pass (ISS-007/011/017/020/021/057) | — (checker-direct action) | — | 6 issues closed |
| `3245b5c` | knowledge-graph-accessors | 1 | 1 | checked-PASS |
| `7e30f44` | citations-route | 1 | 1 | checked-PASS |
| `fe5eb5e` | health-route | 1 | 1 | checked-PASS |

Full-repo scan of every manifest's Status line found **zero** stuck at `ready-for-check`
(`catalogue-input-integrity.md` false-positived on the literal string in its own prose at
line 133 — its real Status line, 129, reads `checked-PASS`; confirmed by direct read, not
just grep).

### 2 — Feedback-inbox fold-in

One new entry since the last sweep (2026-09-08, PATTERN note on false-green regression tests
that re-derive their own inline check instead of calling the production function). **Found
already folded** (marked `— folded 2026-09-08`) in the working tree — but that edit sits
**uncommitted**, bundled with the concurrently-running health-route unit's own uncommitted
files (`apps/api/src/fixtures.ts`, `production.ts`, `server.ts`, `store.ts`,
`docs/PROGRESS.md`, `.goal/goal.json`, `qa/.last-tick`, `qa/evidence/.../preflight.json`) —
all now folded into `fe5eb5e` except `feedback-inbox.md` itself, which is still uncommitted at
sweep time. Verified genuine and actionable (content is specific, cites 3 real ISS ids, states
a concrete rule for future test-writing) — **not re-editing it** since it is already correctly
folded; left for the unit that owns those uncommitted files to commit, to avoid this sweep
bundling unrelated in-flight work into its own narrow commit.

### 3 — Ledger integrity

```
$ node scripts/tracker-audit.mjs   (before fix)
tracker-audit: 2 finding(s)
  G2 unverified: 22 issue(s) are "fixed" with no verified_date
  G3 stale sweep: qa/.last-sweep predates HEAD by 0.0 day(s)

$ node scripts/tracker-audit.mjs --gate g1
tracker-audit: OK (gate G1)
```

**G1 clean, G2 expected shape, G3 transient** (resolves once this sweep's commit lands) — same
as every prior sweep.

**Real ledger bug found and fixed.** `fb21a8d`'s housekeeping pass appended new `status` +
`fixed_date` (+ `fixed_evidence`) fields to 3 rows (**ISS-017, ISS-020, ISS-021**) without
removing the old `status: "open"` / `fixed_date: null` fields already on those lines —
producing objects with **two `status` keys and two `fixed_date` keys each**. `JSON.parse`
silently resolves this to the last value (so `tracker-audit.mjs` and every prior "0 invalid
lines" claim were not lying — Node/Python's parsers both accept duplicate keys and keep the
last), but it is genuinely malformed JSON (RFC 8259 §4 requires unique names) and a
stricter consumer would trip on it. Confirmed via a direct Python scan of raw key occurrences
per line (not just per-line `json.loads`, which hides the duplication) — 3 lines, all 3 in the
same commit, same duplicated pair of keys each time.

**Fixed directly** (this is the "real ledger bug" carve-out in this sweep's brief, not a
routine content edit): re-parsed each of the 3 lines with `json.loads` (which correctly
resolves to the final/intended values) and rewrote each line as clean, single-key JSON with
the same resulting values — no data lost, no field content changed, only the duplicate keys
collapsed. Re-validated: **0/70 invalid lines, 0 duplicate-key lines** across the whole ledger
(both a per-line `json.loads` pass and a raw key-occurrence scan).

**Spot-checked 2 of the 6 `fb21a8d` closures independently** (per this sweep's brief, not
trusting the commit message):
- **ISS-017** (verdict wording): `qa/verdicts/real-llm-scorer.md` read directly — line 3 now
  reads `**VERDICT: PASS**` (was `**Result: PASS**` per the original finding). Fixed as
  claimed.
- **ISS-057** (missing Cycle-checked line): `qa/verdicts/regenerate-year-migration.md` read
  directly — `**Cycle checked: 1**` present at line 4. Fixed as claimed. (Its verdict still
  opens `**Result: PASS**`, not `VERDICT: PASS` — correct, that file was never in ISS-017/021's
  wording-fix batch, only in ISS-057's separate cycle-line fix.)
- **D-012** (`ISS-011`): `git log -p fb21a8d -- docs/DECISIONS.md` shows a pure append (no
  earlier entry's lines touched) — genuinely written via `append_decision.ps1`'s pattern, no
  `Approved-by` needed since it authorizes no enforcement-path or ARCHITECTURE.md change
  (confirmed: "Changes-authorized: none" in the entry itself).

**Own count:** 70 total (69 + this sweep's ISS-070) — **4 open, 24 fixed, 42 verified.**

### 4 — Enforcement liveness

210 commits at range start, 211 now (not zero-history). 6 `.ps1` hook references in
`.claude/settings.json`, unchanged. `qa/loop.md` present, uncontradicted by `qa/adapter.json`
(still absent — default coding adapter). Loop-design triad: **can it spin** — no, 5 real unit
close-outs. **Can it Goodhart the verifier** — no; every unit this range was independently
mutation-tested by the checker itself (citations 404-branch, knowledge-graph accessor pattern
match + duplicate-accessor grep, health-route 503-branch), not a maker self-report. **Can it
run a wrong answer to completion** — no; `done_check`s matched or exceeded their criteria.
**D-012 append-only compliance** — confirmed above. **Live.**

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks, unchanged task-row set this range (only the routine deterministic
recompute fields moved — `git diff .goal/goal.json` shows no task-row edits). **All 5 units
this range are Phase-0-finish roadmap items with no T-* task** (`citations-route`,
`knowledge-graph-accessors`, `health-route` all explicitly say "Goal task: none — plan §10
U0.x" in their manifests), matching the pattern already established for hygiene/robustness
units in prior ranges. **Gap, not a bug:** plan §10's U0.7–U0.10 roadmap items are tracked only
in the plan document and this sweep's queue, never as `T-*` rows in `goal.json` — so
`goal.json`'s 74%-done figure does not reflect Phase-0-finish progress at all. Not editing
`goal.json` myself (not certain enough of the right task-ID scheme to invent one
unilaterally) — flagging for a human or the next maker tick to decide whether U0.7–U0.10
deserve `T-*` rows or stay plan-only.

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent. No `qa/gates/` directory. No unit re-PASSed twice on the same
evidence. All ticks in range `ADVANCED`, none `STALLED`/`EXHAUSTED`. North star unchanged.
**CLEAN.**

### 7 — Silent-failure hunt

Read the touched surface: `apps/api/src/routes/citations.ts`, `apps/api/src/routes/health.ts`,
`apps/api/src/store.ts`'s `createMongoCitationsDeps()`/`createMongoHealthDeps()`,
`packages/db/src/collections/{topics,speakers,decisions,orgs,graph-edges}.ts`.

- `citations.ts` / `createMongoCitationsDeps()`: clean. Per-evidence-item `?? null` is
  disclosed, intentional partial-failure visibility (contract invariant), not a swallow.
- The 5 new `packages/db` accessors: clean, 3-line pattern each, no error handling to get
  wrong.
- **`createMongoHealthDeps()` — one real finding, filed as `ISS-070` (medium).** The
  `try/catch` in `checkHealth()` wraps only `db.command({ping:1})`. The subsequent
  `Promise.all(names.map(name => db.collection(name).countDocuments()))` and the
  `readFileSync(SCHEMA_INDEX_PATH)` call sit **outside** any try/catch, and
  `apps/api/src/routes/health.ts`'s handler has no try/catch of its own. Repo-wide grep for
  error-handling middleware/`asyncHandler` in `apps/api/src` found **zero matches** — this is
  the repo's existing pattern everywhere (citations.ts and most other routes share it), so it
  is not new-to-this-range recklessness. But `health.ts`'s own file-header comment specifically
  claims "the route's whole job is to REPORT an unhealthy backend, never crash reporting it" —
  a claim that is only true for the ping branch. A transient failure between a successful ping
  and the count loop turns the one route ops depends on being answerable into an unhandled
  promise rejection. Not blocking (health-route already shipped `checked-PASS` on its own
  contract, which this doesn't violate), but real and worth a quick follow-up unit.

## Standing issues, unchanged this sweep

ISS-050/051/052 (all low, `catalogue-progress-score`) — explicitly ruled "FILE, don't FIX"
(sabotage-of-the-instrument class, zero measured payload) by prior checker rulings. Recorded,
not chased.

---

## Top-3 recommended next units

The QA meta-backlog is now effectively empty (4 open issues, 3 of them explicitly
file-don't-fix, 1 brand new and small) — per this sweep's own brief, recommendations point
back at the actual product roadmap (plan §10) rather than more ledger hygiene:

1. **`GET /search`** (closes the second half of **U0.7** — plan §10) — *maker work.* Lexical
   retrieval over `turns`/`session_pages`, returning `/ask`'s citation shape. The plan
   explicitly names this as unblocking the hybrid-merge scorer and the Ask/Search UI, and it's
   the one piece of U0.7 this range's `health-route` unit deliberately left undone (manifest:
   "this unit builds only the `/health` half"). Natural next pick — same `stubs.ts` pattern
   `citations-route` and `health-route` just established twice.
2. **U0.10 — Honest eval baseline** (plan §10) — *maker work, flagged explicitly critical in
   the plan itself*: "redo T-021/T-022 against a real LLM... record the real recall@5 and judge
   agreement **even if they fail the 0.85 target**... do not skip to save a week — without it
   Phase 1 is unfalsifiable." Phase-0-finish is otherwise essentially done (U0.5–U0.9 all
   closed this range and prior ones); this is the one remaining item standing between here and
   Phase 1 (the vector layer), and skipping it is the exact mistake the plan calls out by name.
3. **`health-route-error-hardening`** (closes **ISS-070**, medium) — *maker work, small.* Wrap
   `createMongoHealthDeps()`'s post-ping `Promise.all`/`readFileSync` in its own try/catch
   (fall back to `{db:"error", collections:{}}` matching the ping branch's own contract), or
   wrap the route handler itself. Cheap, low-risk, closes the one real gap this sweep found in
   an already-shipped unit before it causes a real ops incident.

Also worth a human decision (not queued as a unit): whether plan §10's U0.7–U0.10 roadmap items
should get `T-*` rows in `goal.json` (see check 5) — currently plan-only, so `goal.json`'s 74%
figure doesn't move as Phase-0-finish work lands.

ISS-006, ISS-007, ISS-011, ISS-017, ISS-020, ISS-021, ISS-036, ISS-053, ISS-057, ISS-064,
ISS-067 (recent-range fixes) removed from previous queues — closed/fixed, superseded by this
sweep's own re-derivation above.
