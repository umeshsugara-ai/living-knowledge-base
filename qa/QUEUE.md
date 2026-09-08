# QUEUE — top-3 recommended next units (checker sweep 2026-09-09, Mode B)

> Range: `d265833..169efb3` (last sweep stamp `2026-09-08T17:46:00Z`). Bound root `D:/KnowledgeBase`;
> the three sibling worktrees (`a-speakers`, `b-golden-set`, `c-unrun-writers`) were **read** for
> bypass detection and pair-state reconciliation and **not modified**.
> **Terminal state: FINDINGS: 2** — ISS-142, ISS-143 (plus in-place evidence on ISS-130, ISS-133).
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/.last-sweep`. Nothing else.

## HUMAN_GATE — open, blocking

- `qa/gates/ledger-shard-union-hook.md` — **unanswered.** Enforcement-path change
  (`.claude/hooks/mc-sessionstart.ps1:5` is still `$LEDGER = 'qa/issues.jsonl'`), so per the project
  CLAUDE.md it needs a `docs/DECISIONS.md` entry carrying **`Approved-by: Umesh`**. This is the
  *unfixed half* of ISS-129: `scripts/lib/tracker-audit.mjs` now globs the union (verified,
  `tracker-audit: OK (gate G1)`), the session-start hook does not.
- `qa/gates/loop-safety-contract-ratification.md` — `**Answered:** _(pending)_`.
- `qa/gates/vector-retrieval-contract.md` — `**Answered:** _(pending)_`.

Answered/closed: `concurrent-maker-sessions`, `golden-set-redesign`, `ledger-id-collision`,
`ledger-id-divergence` (both via D-019), `mongo-host-unreachable` (self-resolved). None was
answered off-disk — no `docs/DECISIONS.md` entry mentions any of the three open gates.

## Merge audit — `c3989ef` (lane/c-unrun-writers, 21 commits)

**Bypass detection: CLEAN.** All 13 source-touching commits in the range map to a manifest naming
their unit: `4aef342`→`watched-sources-entrypoint`, `c8da5ee`→`watched-sources-url-normalisation`,
`43c1281`/`26e283a`/`948212e`/`f6f2b86`→`guarded-fetcher`, `d12232a`/`534af4e`/`cb54652`→
`watched-sources-run`, `b91cd7b`→`promote-tree-entities`, `5addd42`→`claims-write-targeting`,
`93a1ec2`/`b9159cf`→`ledger-shard-union-readers`. All four lane-c manifests, verdicts and contracts
arrived with the merge.

**The U1.0 duplicate was the whole of the damage.** Verified independently, not taken on trust:
`TASKS.md` row-id set is a superset of *both* merge parents (`comm` against `821b70c` and `efd2fd8`
is empty in each direction), no id appears twice, `.goal/goal.json` holds 61 tasks with no lane-c
task id missing, and `pnpm lint:structure` exits 0 with `tracker-audit: OK (gate G1)`.
`pnpm -r test` green (api 156/156, plus index/ingest/ai/ask/meeting-bot/db/core, 0 fail anywhere)
and `pnpm -r typecheck` clean. Three paths present in lane-c and absent from HEAD
(`apps/api/src/indexing.ts`, `.test.ts`, `scripts/backfill-chunks.mjs`) are the pre-U1.0c layout the
master side refactored into `apps/api/src/indexing/` and `scripts/backfill.mjs` — superseded, not
lost. `apps/api/src/watched-run-deps.test.ts` was *deleted* by `cb54652` inside the lane, not by the
merge.

## Ledger union (D-019) — re-measured

| File | Rows | Parse errors | Ids |
|---|---|---|---|
| `qa/issues.jsonl` (master) | 143 | 0 | ISS-001..ISS-141 contiguous, **no gaps**, + 2 lane-shaped ids |
| `qa/issues.c-unrun-writers.jsonl` (master) | 22 | 0 | ISS-C-UNRUN-WRITERS-001..022 |
| **Union on master** | **165** | **0** | **0 duplicate ids** |
| `a-speakers/qa/issues.jsonl` | 103 | 0 | ISS-001..ISS-103, **no shard** |
| `b-golden-set/qa/issues.jsonl` | 86 | 0 | ISS-001..ISS-086, **no shard** |
| `c-unrun-writers` (both files) | 117 + 22 | 0 | matches master |

Open by severity across the master union: **1 critical, 4 high, 11 medium, 18 low** (34 open;
79 fixed, 52 verified). The merged shard's ids do **not** collide with the canonical sequence —
that part of D-019 worked exactly as designed.

## Top 3 recommended next units

1. **ISS-142 (high) — repoint the merged lane-c audit trail.** 96 of 101 bare `ISS-NNN` references
   in the four merged manifests, four verdicts and three contracts now resolve to *unrelated*
   canonical rows. This is the failure D-019 names in its own rationale, arriving on master.
   Remedy is a rewrite of the references to `ISS-C-UNRUN-WRITERS-NNN` in those qa docs (commit
   messages are immutable — note the mapping in the gate file instead). **Not** a renumbering of
   any ledger row.
2. **ISS-130 (high) — adopt shards in the two remaining lanes.** `a-speakers` and `b-golden-set`
   still write un-namespaced `qa/issues.jsonl`. Master is at ISS-141; `a-speakers`' next
   allocation is ISS-104, which collides with 38 existing master rows. Measured, not predicted.
3. **ISS-143 (medium) — normalise the two lane-shaped ids in the canonical ledger** *(only if the
   maker judges it cheap; otherwise take the next unblocked roadmap task per D-013 tier 3 —
   `U1.5` hybrid merge is the first `open` roadmap row with its deps met).*

`ISS-132` is deliberately **not** queued here — the maker holds it as this tick's unit
(`divergence-mapping-correction`). `ISS-104` (critical, open) belongs to `lane/a-speakers` and is
not actionable from master.

## Normal sweep duties

- **Pair state:** one manifest at `ready-for-check` — `speaker-verbatim-token-boundary` (cycle 3).
  Its verdict on master **does** carry `Cycle checked: 3` (line 424, `62c4637`), so the handshake is
  matched: a fix gap, not a dispatch gap. `lane/a-speakers` `f1e616c` already closes it as
  `superseded-by speaker-denylist-ledger-corpus`; that branch is unmerged. **Master's copy is an
  unmerged-lane artifact, not a genuine dangling handshake** — it resolves on merge and needs no
  maker action here. ISS-133 updated in place.
- Every other manifest is `checked-PASS` with cycle numbers matching its verdict.
  `git ls-files --others qa/` is empty — no untracked verdict.
- **Maker liveness: HEALTHY.** `qa/.last-tick` stamped `2026-09-08T19:17:16Z`, no `qa/.paused`,
  no `STALLED`/`EXHAUSTED` stamp lacking a `qa/debug/` report.
- Feedback inbox fully folded; `qa/.regrill-due` absent, no `GRILL:` row raised.
- `docs/DECISIONS.md` additions-only across the range (0 changed lines — nothing appended).
- **Silent-failure hunt** over the range's new source (`guarded-fetch.ts`, `node-transport.ts`,
  `watched/run.ts`, `routes/watched-sources.ts`, `promote-entities.ts`, `tracker-audit.mjs`):
  **nothing filed.** The two `catch { return null }` sites are URL validators whose callers reject
  `null` explicitly (400 at `routes/watched-sources.ts:74`), i.e. fail-closed, not masked; the
  `catch` in `watched/run.ts:101` records the failure against the source and continues by documented
  contract; `guarded-fetch.ts:231` rethrows with the cause and fails closed on an empty DNS answer.
- **Reopen-power not exercised** — no PASSed unit's claim was found unbacked.
