# QUEUE — top-3 recommended next units (checker sweep 2026-09-07, Mode B safety net)

> Previous sweep: stamp read `2026-09-07T12:35:00Z` (commit `83feb37`). This session's wall clock
> has shown skew all session, so the range was verified by `git log 83feb37..HEAD`, not by
> trusting timestamps: six commits confirmed — `1d32382`, `d325d8a`, `985dd52`, `1ed5d87`,
> `ec323da`, `9131e34`.

## Terminal state: CLEAN

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** Three units landed in range, each a manifest + matching-cycle verdict, both
re-read from disk (not trusted from prior session prose):

| commits | unit | manifest Fix cycle | verdict Cycle checked | Status |
|---|---|---|---|---|
| `d325d8a` (fix) / `1d32382` (checker) | lint-score-split | 1 | 1 | checked-PASS |
| `1ed5d87` (test) / `985dd52` (checker) | assertAllCallsConfined-unset-coverage | 1 | 1 | checked-PASS |
| `9131e34` (fix) / `ec323da` (checker) | summarize-degradation-honesty | 1 | 1 | checked-PASS |

All three manifests read `checked-PASS`; both verdict files carry the same commit hash the
manifest cites for it. No `ready-for-check` orphan anywhere in `qa/manifests/` — every manifest in
the repo is `checked-PASS` or `superseded-by`. `qa/.last-tick`'s live tail runs continuously through
`2026-09-07T13:13:43Z`, covering exactly these three units plus the sweep dispatch itself — no
"maker asleep" finding.

**Ledger cross-check:** ISS-058, ISS-066, ISS-059 all read `status: "fixed"`, `fixed_date:
"2026-09-07"`, each with a `checker_verdict` note citing the actual Mode A re-derivation (own-wording
mutation reproduction in all three cases, not a pasted maker claim). None closed on the maker's
say-so.

### 2 — Feedback-inbox fold-in

`qa/feedback-inbox.md` — all entries, including the one closed last sweep (2026-09-07, maker,
ISS-056-unit PATTERN note), carry an explicit `— folded <date>` marker. **No new entries since the
last sweep, nothing unfolded.**

### 3 — Ledger integrity (`scripts/tracker-audit.mjs`, run fresh)

```
tracker-audit: 2 finding(s)
  G2 unverified: 7 issue(s) are "fixed" with no verified_date — ISS-054, ISS-056, ISS-058, ISS-059,
  ISS-060, ISS-061, ISS-066
  G3 stale sweep: qa/.last-sweep predates HEAD by 0.0 day(s)
```

**G1 clean** (trackers agree). **G2 is the expected shape**, not a defect: these seven were all
closed by a Mode A PASS within the last several hours; `fixed → verified` is a later, separate
re-check per the ledger's own rule, never same-cycle. Cross-checked against the ledger directly
(python scan) — the seven G2 names match exactly. **G3 is transient-expected**: this sweep's own
`.last-sweep` write (below) resolves it the moment this commit lands; not queued as an issue.

**Ledger status vocabulary — specifically re-verified this sweep** (per this session's earlier
self-caught bug: a severity/backlog read that treated `verified` rows as still-open, when the
ledger actually carries three statuses — `open` / `fixed` / `verified` — not two):

- `scripts/tracker-audit.mjs:67` — `if (r.status === "fixed" && !r.verified_date)` — correct, only
  flags the intermediate `fixed`-not-yet-`verified` state, never conflates `verified` with `open`.
- `.claude/hooks/mc-sessionstart.ps1:8` — `Where-Object { $_ -match '"status":\s*"(open|Open)"' }`
  — matches the literal string `open` only; does not match `verified` or `fixed` substrings (no
  false-positive on `"status":"verified"` — the pattern requires an exact quoted value, and no
  ledger status string contains `open` as a substring of another status).
- Repo-wide grep for other `issues.jsonl` consumers under `scripts/`, `.claude/hooks/`, and
  `apps/`/`packages/` (`*.mjs .ps1 .js .py .ts`) turned up only these two — no third tool silently
  miscounting the same way. (Other `status: "open"|"verified"` hits in the codebase are unrelated
  domain enums — `claims`/`gaps` collections, `apps/web/src/api/types.ts` — not the qa ledger.)
- Own count (18 open / 8 fixed / 40 verified = 66 total) matches `tracker-audit`'s G2 list and the
  task brief's "~18 genuinely open" exactly.

**Status counts:** 66 total — 18 `open`, 8 `fixed`, 40 `verified`.

### 4 — Enforcement liveness

182+ commits on HEAD (not zero-history). `.claude/settings.json` hooks present, `-File` form
(D-010) — `lab-session-start.ps1`, `mc-sessionstart.ps1`, `mc-precommit.ps1`,
`decisions-append-guard.ps1`, session-end hooks all registered. `qa/loop.md` present with `Stop:`
and `Human gate:` lines, uncontradicted by `qa/adapter.json` (absent — default coding adapter).
Loop-design triad: **can it spin** — no, Stop reads real signals (this sweep found zero pending
manifests). **Can it Goodhart the verifier** — no; all three units this range were checked by
mutation-tested re-derivation, not a self-reported score. **Can it run a wrong answer to
completion** — no; every `done_check` this range was at least as strong as its criterion (own-
wording reproduction each time). **Live.**

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks / 26 done / 74% — unchanged from last sweep. All three units this range
are ledger-driven with no goal task (manifests state "Goal task: none" — correct, per their own
scope). No new missing requirement surfaced; no `GRILL:` row.

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent. `qa/gates/` doesn't exist as a directory — no gate to have been answered
off-disk. Reopen-power: one historical escalation reference in the ledger (ISS-006, already
standing/open, not freshly reversed this sweep) — no unit re-PASSed twice on the same evidence in
this range. No `STALLED`/`EXHAUSTED` tick since the last sweep (all ticks in range are `ADVANCED`
per `qa/.last-tick`) — no `qa/debug/` report owed. North star unchanged since the last contract
amendment. **CLEAN.**

### 7 — Silent-failure hunt

Read the touched surface in range: `apps/api/src/indexing.ts`, `packages/index/src/pipeline/
summarize.ts`, `apps/api/src/indexing.test.ts`, `packages/index/src/pipeline/summarize.test.ts`,
`package.json`, `.github/workflows/ci.yml`. **Zero new hits.** The `summarize.ts` catch block
(previously an empty `catch { // fall through }`) is now a discriminated return carrying the real
error message (`degraded: { reason: `summarize provider call failed: ${err.message}` } }`) — this
range is itself a silent-failure *fix* (ISS-059), not a new instance. No new empty catch, no new
masking fallback, no new lost-cause re-raise, no new unawaited/untimed side effect.

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
   the same way `ingest-indexing-pipeline.md` was done: read in full, dated amendment-log entry,
   adopt-faithful-except-where-amended. Highest severity in the open backlog and the oldest
   standing item.
2. **`tree-index-tenant-scoping`** (closes **ISS-062** + **ISS-063**, both medium,
   `ingest-indexing-pipeline`) — `tree_index` has no `tenantId` field at all; tenants are separated
   only by the root filter written out longhand at each call site rather than through
   `scopedCollection` the way `claims`/`session_pages` now are (post `tenant-scoped-writes`,
   commit `0c52bfa`). Same risk family as ISS-060/ISS-061 which this session already fixed for two
   other collections — `tree_index` is the one gap the tenant-scoping unit explicitly flagged and
   left to the checker as "schema decision, not mine" (`qa/.last-tick` 2026-09-07T11:15:18Z).
3. **`manifest-close-out-and-contract-shape-sweep`** (closes **ISS-017** + **ISS-055**, both
   medium) — `real-llm-scorer.md`'s manifest is stuck at `ready-for-check` past its check window
   (T-009b close-out gap), and four contracts still carry no append-only amendment log at all
   (blocks routine amendment/prune on any of them). Lower urgency than items 1–2 (hygiene, not a
   live data-isolation gap) but next in severity order.

Also queued, low, unchanged from last sweep: **ISS-007**, **ISS-011**, **ISS-020**, **ISS-021**,
**ISS-036**, **ISS-040**, **ISS-050**–**ISS-053**, **ISS-057**, **ISS-064**, **ISS-065**.
