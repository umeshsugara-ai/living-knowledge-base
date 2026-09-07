# QUEUE — top-3 recommended next units (checker sweep 2026-09-07T~12:35Z UTC, Mode B safety net)

> Previous sweep: `2026-09-07T15:35:00Z` (per the stamp — this session's wall clock showed skew all
> session, so the range was verified by `git log`, not by trusting that timestamp). Six commits
> confirmed since `555dcb4` by `git log 555dcb4..HEAD`: `de81b8a`, `3d0c442`, `b7be919`, `41accce`,
> `0c52bfa`, `ab8168c`, `3c6407f` (`3c6407f` lands after `ab8168c`, so seven total — all listed
> below).

## Terminal state: FINDINGS: 3

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** Every commit in the range resolves to a manifest *and* a matching-cycle verdict on
disk, re-checked against the manifest's own `Fix cycle` field, not assumed:

| commits | unit | manifest Fix cycle | verdict Cycle checked | Status |
|---|---|---|---|---|
| `de81b8a` (fix) / earlier `a51b9c8` PASS | tracker-honesty | 1 | 1 (commit `a51b9c8`) | checked-PASS |
| `3d0c442` (PASS+amend) / `b7be919` (fix) | claims-degradation-honesty | 1 | 1 | checked-PASS |
| `41accce` (PASS+amend) / `0c52bfa` (fix) | tenant-scoped-writes | 1 | 1 | checked-PASS |
| `ab8168c` (PASS) / `3c6407f` (fix) | indexSession-insert-confinement | 1 | 1 | checked-PASS |

Every `qa/manifests/*.md` in the repo reads `checked-PASS` or `superseded-by` — **zero manifests
pending check.** No `ready-for-check` orphan, no verdict lagging its manifest's cycle.

**Ledger cross-check:** manifests' claimed `Issues addressed` (ISS-056, ISS-060, ISS-061) all carry
a matching `fixed_date: 2026-09-07` and a `checker_verdict`/`fixed_evidence` note citing the actual
Mode A re-derivation (mutation testing + a live two-tenant proof against the real database for
ISS-056/ISS-060). None was closed on the maker's say-so.

**ISS-066 filed correctly.** The Mode A check of `indexSession-insert-confinement` (commit
`ab8168c`) found and filed a new gap two commits before HEAD: `assertAllCallsConfined` doesn't
inspect `$unset`, so a tenantId-stripping mutation via `$unset` (vs. reassignment via `$set`) would
slip through undetected. Correctly scoped **medium** — the evidence itself says latent, not live
(`indexSession`'s real code has no `$unset` call today).

### 2 — Feedback-inbox fold-in — one gap found and closed this sweep

Three of four entries already carried an explicit `— folded <date>` marker. **The fourth (dated
2026-09-07, maker, ISS-056-unit PATTERN note) did not**, despite the substance already being ruled
on in `qa/contracts/catalogue-progress-score.md`'s amendment log (commit `3d0c442`, two commits
before HEAD): I13/I14 upheld unchanged, the workflow-harm complaint sustained separately as
**ISS-058** (open, medium — split `catalogue-score --check` out of `lint:structure` into its own
commit/CI-gated `lint:score`). **Folded now** with the ruling cited and commit-pinned — this closes
the fold-in gap without touching the ruling itself (routine documentation, not a contract change).

### 3 — Ledger integrity (`scripts/tracker-audit.mjs`)

Ran it fresh (not trusted from a pasted result): **G1 clean** (trackers agree), **G2: 1 finding**
— `ISS-056`, `ISS-060`, `ISS-061` are `fixed` with `verified_date: null`. This is the *expected*
shape for issues closed by a Mode A PASS minutes-to-hours ago, not a defect: `verified_date` moves
only on a **later, separate** re-check per the ledger's own rule (`fixed → verified` is not
same-cycle). Not queued as an issue; flagged here so the next sweep knows to look for
`verified_date` on these three rather than re-deriving them from scratch. **G3: was stale by the
raw stamp comparison (this session's clock skew), cleared by re-stamping below** — the actual
commit-range check (§1) is what settled bypass detection, not the G3 arithmetic.

**Also corrected this sweep, off the ledger's own contradiction:** `ISS-054` ("maker asleep",
filed by the prior sweep against a `.last-tick` stamped `2026-09-04`) was still `status: open`.
`qa/.last-tick`'s live tail now reads through `2026-09-07T12:20:57Z` — 4 ticks, continuous, across
exactly the units this sweep verified. The liveness problem the issue named is resolved; left it
`fixed` (not `verified`) rather than silently dropping it, with the tick evidence quoted in the
ledger row.

### 4 — Goal coverage

`.goal/goal.json`: 26/35 done, 74%, 9 pending (`T-007`, `T-008`, `T-011`, `T-013`–`T-015`, `T-021`,
`T-022`, `T-028`). Nothing in this range changed goal-task shape — `tenant-scoped-writes` and
`indexSession-insert-confinement` are ledger-driven units with no goal task (correctly, per their
own manifests: "Goal task: none"). No new missing requirement; no `GRILL:` row.

### 5 — Goal-drift / re-grill (check 6)

`qa/.regrill-due` absent. No unit re-PASSed twice on the same evidence (reopen-power untouched this
sweep — nothing met its bar). No `STALLED`/`EXHAUSTED` tick since the last sweep (all four ticks in
range are `ADVANCED`), so no `qa/debug/` report is owed. `qa/gates/` still doesn't exist as a
directory — no gate to have been answered off-disk. **CLEAN.**

### 6 — Silent-failure hunt (check 7)

Read the 7 non-test/non-audit-script source files touched in range (`indexing.ts`, `claims.ts`,
`tenantScope.ts`, plus their three test files and `tracker-audit.mjs`). **Zero new hits** — this
range is itself the fix for the one silent-failure pattern found last sweep
(`claims.ts:66-68`'s bare `catch { return []; }` is now a discriminated `{ claims, degraded }`
result, `claims.ts:83-84`). No new empty catch, no new masking fallback, no new lost-cause
re-raise, no new unawaited/untimed side effect in the touched surface.

### 7 — Enforcement liveness

182 commits on HEAD (not zero-history). Hooks registered in `.claude/settings.json`, `-File` form
(D-010). `qa/loop.md` present with `Stop:` (:41) and `Human gate:` (:50) lines, uncontradicted by
`qa/adapter.json` (none present — default coding adapter). Loop-design triad re-asked: **can it
spin** — no, Stop reads real signals (this sweep found zero pending manifests). **Can it Goodhart
the verifier** — no new instance; this range's Mode A checks each ran mutation tests + one live
two-tenant database proof, not a self-reported score. **Can it run a wrong answer to completion** —
no; `indexSession-insert-confinement`'s own manifest records a prior checker dispatch that died
without a verdict (API error) and states plainly that no cycle was consumed — correct handling, not
a completion on a weak check. **Live.**

---

## Standing issue, unchanged this sweep (not reopened, not touched)

**ISS-006** (segregation of duties — high, open since prior sweep): of the four maker-authored
contracts named in the last sweep, `qa/contracts/ingest-indexing-pipeline.md` has since been
formally adopted (amendment-log entry, commit `527d8f7`, pre-dating this sweep's range). The other
three — `whatsapp-ingestion-first-slice.md`, `web-whatsapp-tab.md`,
`post-review-fixes-2026-09-06.md` — are still maker-drafted with no checker adoption recorded.
Reopen-power was not exercised again this sweep (already open, not freshly reversed); it remains
queued as-is.

---

## Top-3 recommended next units

1. **`contract-adoption-backfill`** (closes the remaining two-thirds of **ISS-006** high) —
   *checker work.* Adopt-or-amend `whatsapp-ingestion-first-slice.md`, `web-whatsapp-tab.md`,
   `post-review-fixes-2026-09-06.md` the same way `ingest-indexing-pipeline.md` was done: read in
   full, dated amendment-log entry, adopt-faithful-except-where-amended.
2. **`lint-score-split`** (closes **ISS-058**, medium) — pull `catalogue-score --check` out of
   `pnpm lint:structure` into its own `lint:score`, gated on the commit/CI path per the ruling in
   `qa/contracts/catalogue-progress-score.md`'s amendment log. Composition fix only; I13/I14 stay
   exactly as strong.
3. **`assertAllCallsConfined-unset-coverage`** (closes **ISS-066**, medium, filed two commits ago)
   — extend `apps/api/src/indexing.test.ts`'s confinement check to also flag `$unset` (and other
   update operators) touching `tenantId`, not just `$set`/bare reassignment. Small, same family as
   the `$set` gap this range just closed.

Also queued, low/medium, unchanged from last sweep: **ISS-017**, **ISS-055** (amendment-log gap on
the same three unadopted contracts as ISS-006 — closes alongside item 1), **ISS-059**, **ISS-062**,
**ISS-063**, **ISS-007**, **ISS-011**, **ISS-020**, **ISS-021**, **ISS-036**, **ISS-040**,
**ISS-050**–**ISS-053**, **ISS-057**, **ISS-064**, **ISS-065**.
