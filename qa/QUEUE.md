# QUEUE — top-3 recommended next units (checker sweep 2026-09-07, Mode B safety net)

> Previous sweep stamp read `2026-09-07T13:20:00Z` (commit `173a931`). This session's wall clock
> has shown skew all session, so the range was verified by `git log 173a931..HEAD`, not by
> trusting timestamps: eight commits confirmed — `024cd43`, `889310d`, `9c07153`, `20f138d`,
> `85c6ed9`, `fba8d3c`, `b7c894d`, `dc3bb10`.

## Terminal state: CLEAN

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** Three units landed in range, each a manifest + matching-cycle verdict(s), all
re-read from disk (not trusted from prior session prose):

| commits | unit | manifest Fix cycle | verdict(s) Cycle checked | Status |
|---|---|---|---|---|
| `024cd43` (checker PASS) / `889310d` (refactor) | tree-index-filter-consolidation | 1 | 1 | checked-PASS |
| `9c07153` (checker PASS) / `20f138d` (feat/migration) | tree-index-tenant-id-migration | 1 | 1 | checked-PASS |
| `85c6ed9` FAIL c1 / `fba8d3c` FAIL c2 / `b7c894d` PASS c3 / `dc3bb10` (refactor) | scoped-collection-updateOne | 3 of max 3 | 1, 2, 3 (all present) | checked-PASS |

All three manifests read `Status: checked-PASS`. A full-repo scan of every manifest's Status line
(`grep -iE "^(## )?Status:"`) found zero manifests stuck at `ready-for-check` anywhere in the repo
— every one is `checked-PASS` or `superseded-by`.

**scoped-collection-updateOne specifically verified** (this was a 3-cycle unit — two real FAILs
before the PASS, the deep-dive the sweep brief asked for):
- `git log --follow -- qa/verdicts/scoped-collection-updateOne.md` shows three commits
  (`85c6ed9`, `fba8d3c`, `b7c894d`) touching that file — the verdict file was overwritten in
  place each cycle (expected — one slug, one live verdict path), but **git history preserves all
  three versions**: `git show 85c6ed9:qa/verdicts/scoped-collection-updateOne.md` and
  `git show fba8d3c:...` both return the full FAIL content (cycle 1: 8th raw call site in
  `scripts/sync-real-turns.mjs`, ISS-068; cycle 2: `countDocuments` shipped with zero test
  coverage, ISS-069) — neither FAIL was silently discarded or lost, both are permanently
  reconstructable from commit history, and the cycle-3 PASS verdict itself explicitly cites
  recovering cycle 1's content via `git show 85c6ed9` before judging.
- Manifest's `Fix cycle: 3 of max 3` matches the PASS verdict's `Cycle checked: 3` exactly.
- Ledger: ISS-065 and ISS-068 both `verified` (re-derived by the checker's own mutation
  reproduction on cycle 3, not re-stamped from a prior cycle's finding); ISS-069 `fixed` (correct
  per the ledger rule — `fixed → verified` requires a *later* separate re-check, never same-cycle,
  even though the same PASS cycle that closed it also re-confirmed the other two).

`qa/.last-tick`'s tail runs continuously through `2026-09-07T17:34:48Z`, covering exactly these
three units in sequence (including both FAIL/re-dispatch cycles) plus the decision to dispatch this
sweep — no "maker asleep" finding.

### 2 — Feedback-inbox fold-in

`qa/feedback-inbox.md` — all 4 entries carry an explicit `— folded <date>` marker, none newer than
2026-09-03. **No new entries since the last sweep, nothing unfolded.**

### 3 — Ledger integrity (`scripts/tracker-audit.mjs`, run fresh)

```
tracker-audit: 2 finding(s)
  G2 unverified: 10 issue(s) are "fixed" with no verified_date — ISS-054, ISS-056, ISS-058,
  ISS-059, ISS-060, ISS-061, ISS-062, ISS-063, …
  G3 stale sweep: qa/.last-sweep predates HEAD by 0.2 day(s)
```

**G1 clean** (trackers agree). **G2 is the expected shape**: these are all `fixed`-not-yet-
`verified` rows per the ledger's own rule (moved to `verified` only on a *later* re-check) —
own count confirms 11 `fixed` rows total (10 flagged + ISS-069, which the script's own output
truncated with `…`). **G3 is transient-expected**: this sweep's own `.last-sweep` write (below)
resolves it the moment this commit lands.

**Ledger status vocabulary — re-confirmed this sweep** (per this session's earlier self-caught bug
where an ad hoc maker query treated `verified` as `open`; last sweep already audited the two
committed consumers and found them clean — this is the requested quick re-confirmation, not a
fresh audit):
- `scripts/tracker-audit.mjs:67` — `if (r.status === "fixed" && !r.verified_date)` — unchanged,
  still only flags the intermediate state, never conflates `verified` with `open`.
- `.claude/hooks/mc-sessionstart.ps1:8` — `Where-Object { $_ -match '"status":\s*"(open|Open)"' }`
  — unchanged, matches the literal quoted value only.
- Repo-wide grep (ripgrep, respects `.gitignore`) for `issues.jsonl` across
  `*.mjs .js .ps1 .py .ts` still returns exactly these same two files — no third consumer has been
  added since last sweep.
- `scripts/tracker-audit.mjs`'s only other `status`-adjacent logic (`NORMALISE` at line 28) is a
  *different* vocabulary space entirely (`.goal/goal.json` task statuses — `open/pending/blocked/
  in_progress/done`, collapsed to `done`/`not-done`) — not the qa ledger's `open/fixed/verified/
  wontfix`, so it is not a candidate for this bug class and was correctly out of scope for last
  sweep's audit too.

**Own count, verified by direct scan:** 69 total — 16 `open`, 11 `fixed`, 42 `verified`. Matches
the sweep brief's "69 total rows, 16 open" exactly.

### 4 — Enforcement liveness

198 commits on HEAD (not zero-history). `.claude/settings.json` hooks present in `-File` form
(D-010) — `lab-session-start.ps1`, `mc-sessionstart.ps1`, `mc-precommit.ps1`,
`decisions-append-guard.ps1`, session-end hooks all registered and unchanged since last sweep.
`qa/loop.md` present with `Stop:`/`Human gate:` lines, uncontradicted by `qa/adapter.json` (absent
— default coding adapter, unchanged). Loop-design triad: **can it spin** — no, this range's Stop
signal was three real manifest close-outs plus two real FAILs, not busywork. **Can it Goodhart the
verifier** — no; all units this range were checked by the checker's own mutation-tested
reproduction (see #1), not a maker self-report, and the scoped-collection-updateOne FAILs are
direct proof the gate has teeth. **Can it run a wrong answer to completion** — no; every
`done_check` this range was at least as strong as its criterion. **Live.**

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks / 26 done / 74% — unchanged from last sweep. All three units this
range are ledger-driven with no goal task (each manifest states "Goal task: none" — correct, they
strengthen a shared primitive/schema rather than close a T-* task). No new missing requirement
surfaced; no `GRILL:` row.

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent. No `qa/gates/` directory — no gate to have been answered off-disk.
Reopen-power: no unit re-PASSed twice on the same evidence this range (scoped-collection-
updateOne's two FAILs were genuine new findings each cycle, not a disagreement re-litigating the
same evidence — ISS-068 then ISS-069, two different gaps). No `STALLED`/`EXHAUSTED` tick since the
last sweep — all ticks in range are `ADVANCED` or `FAIL cycle N` (a normal fix-cycle step, not a
stall) per `qa/.last-tick`. North star unchanged since the last contract amendment. **CLEAN.**

### 7 — Silent-failure hunt

Read the touched non-test/non-schema surface in range: `apps/api/src/indexing.ts`,
`apps/api/src/store.ts`, `packages/db/src/collections/{eval-runs,gaps,meeting-candidates,
trusted-senders,watched-sources}.ts`, `packages/db/src/lib/tenantScope.ts`,
`packages/index/src/index.ts`, `packages/index/src/tree/build.ts`, `scripts/sync-real-turns.mjs`.
**Zero hits.** No empty/log-only catch in any of these (only one `catch` in the whole set —
`sync-real-turns.mjs`'s `main().catch((err) => { console.error(err); process.exitCode = 1; })`,
which logs AND propagates via a non-zero exit code, not a swallow). `tenantScope.ts`'s diff adds
`countDocuments`/`updateOne` accessors and removes the `raw` escape hatch entirely — the
opposite of a masking fallback (it closes the exact hand-carried-tenantId escape hatch class that
ISS-060/065/068 all belong to). No lost-cause re-raise, no unawaited/untimed side effect
introduced.

---

## Standing issue, unchanged this sweep

**ISS-006** (segregation of duties — high, open since prior sweeps): `ingest-indexing-pipeline.md`
was formally adopted before this range began; `whatsapp-ingestion-first-slice.md`,
`web-whatsapp-tab.md`, `post-review-fixes-2026-09-06.md` are still maker-drafted with no checker
adoption recorded. Untouched this sweep — no commit in range touches these three contracts.

---

## Top-3 recommended next units

1. **`contract-adoption-backfill`** (closes **ISS-006**, high) — *checker work.* Adopt-or-amend
   `whatsapp-ingestion-first-slice.md`, `web-whatsapp-tab.md`, `post-review-fixes-2026-09-06.md`
   the same way `ingest-indexing-pipeline.md` was done. Highest severity in the open backlog and
   the oldest standing item — untouched for multiple sweeps now.
2. **`manifest-close-out-and-contract-shape-sweep`** (closes **ISS-017** + **ISS-055**, both
   medium) — `real-llm-scorer.md`'s manifest close-out gap and four contracts still carrying no
   append-only amendment log (blocks routine amendment/prune on any of them). Re-checked this
   sweep: still open, still the next-highest severity after ISS-006.
3. **`orphaned-scratch-tenant-cleanup`** (closes **ISS-067**, low, filed this range) — two
   orphaned scratch-tenant `tree_index` documents remain in the live database from an earlier
   checker's live-proof cleanup. Deliberately left unfixed by the migration unit itself (a schema
   migration should only add/backfill fields, not delete) — needs its own small, deliberate delete
   unit against production data.

Also queued, low, unchanged from last sweep: **ISS-007**, **ISS-011**, **ISS-020**, **ISS-021**,
**ISS-036**, **ISS-040**, **ISS-050**–**ISS-053**, **ISS-057**, **ISS-064**.

ISS-062, ISS-063, ISS-065 (last sweep's #2 recommendation) are now closed/verified by the three
units this range covers — removed from the queue.
