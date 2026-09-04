# QUEUE — top-3 recommended next units (checker sweep 2026-09-04T~15:10Z, Mode B safety net)

> Prior queue (stamped 2026-09-04T~14:31Z) is now due for refresh. Since that sweep: ISS-022
> (T-010 goal.json sync) and ISS-019 (qa/loop.md missing) were both closed (commit `ed7d389`),
> and a real new maker unit shipped — `ask-web-fallback-tavily` (commit `bedd090`, checker PASS
> cycle 1) — closing the third sub-gap ISS-010 had named. `qa/.last-tick` was stamped 3 times
> since (`c2fbb9f` latest).

## This sweep's findings

- **No bypass.** All commits since the last sweep stamp (`ed7d389`, `2524be7`, `458a900`,
  `bedd090`, `2c825a5`, `e2c1061`, `c2fbb9f`) are either qa-ledger/tick housekeeping or the one
  real feature commit (`bedd090`), which has a matching manifest + verdict on disk — re-verified
  this sweep (typecheck re-run clean, `git diff --stat` on the frozen `router.ts`/`router.test.ts`
  confirmed empty).
- **T-010 goal-sync (ISS-022) independently re-verified as honestly closed.** `.goal/goal.json`
  T-010 now reads `status: done`, `completed: 2026-09-04T20:05:31`, matching the two cited
  verdicts (`web-app-shell-brain-calendar.md`, `web-settings-keys.md`, both `Verdict: PASS`,
  `Cycle checked: 1`, re-read this sweep). Not a rubber stamp — the fix was applied outside the
  blocked sandboxed sweep, as the ledger entry discloses, and the evidence trail is real.
- **qa/loop.md (ISS-019) independently re-verified against Loop-Doctor-lite.** File exists, names
  all seven maker terminal states verbatim on its `Stop:` line (`ADVANCED`, `BACKLOG_EMPTY`,
  `HUMAN_GATE`, `STALLED`, `EXHAUSTED`, `BLOCKED`, `PAUSED`) and carries a `Human gate:` line
  matching this project's actual CRITICAL-action list (Mongo writes, irreversible deletes, real
  external comms, prod/customer-facing publishes, ownership/scope calls). No `qa/adapter.json`
  exists, so the DEFAULT coding adapter applies and is not contradicted. Check 4 passes clean.
- **ISS-010's four sub-gap closure claims independently re-verified, not just trusted:**
  1. `POST /ask` route — confirmed present and wired (`apps/api/src/routes/ask.ts:28`).
  2. Web-search provider — confirmed real (`apps/api/src/ask-web-fallback.ts` +
     `packages/ask/src/ask-v2.ts` `tavilySearchFn`), this sweep's own re-run of `tsc --noEmit` on
     both `packages/ask` and `apps/api` passes clean, `router.ts`/`router.test.ts` untouched.
  3. `media.schema.json` `retention` field — confirmed required
     (`schema/media.schema.json:7,17`).
  4. T-004b turn-level tree nodes — confirmed `done` in `TASKS.md:31`, checker PASS 5/5, verdict
     `15e4ecf`.
  All four hold. ISS-010's `fixed` status is honest, not corner-cut.
- **Ledger hygiene:** hand-edited status transitions (ISS-010/019/022 `open→fixed`,
  ISS-014/016 below) are the checker's normal Mode A/B write path (schema explicitly allows
  status mutation; only IDs are append-only/never-reused) — not itself a process violation.
  Re-validated the full ledger with `json.loads` per line: 22/23 lines valid; line 17 (ISS-017)
  remains the one pre-existing invalid-JSON line, already tracked by ISS-020 (append-only, left
  untouched, correctly still open).
- **NEW FINDING — ISS-014 and ISS-016 are stale, closed this sweep.** Both named a specific bad
  `.goal/goal.json` `current` pointer value (`T-002`, then `T-003`) that no longer exists — the
  pointer has since advanced (through the ordinary tick cadence, not a direct fix to either
  issue) to `T-007`, which is a real open `TASKS.md:49` task (depends `T-020`, done) and is
  correctly human-gated on the Q4 consent decision, matching `TASKS.md`'s own note. Marked
  `fixed` with `fixed_evidence` explaining the supersession — not deleted, per append-only
  discipline on IDs/history.
- **7 open issues re-confirmed accurate** as of this sweep's start (`ISS-007, ISS-011, ISS-014,
  ISS-016, ISS-017, ISS-020, ISS-021`) — all low/medium severity, all documentation/hygiene, no
  functional defects; two of the seven (`ISS-014`, `ISS-016`) closed by this sweep as shown
  above, so **the live open count is now 5**: `ISS-007` (contract shape, low), `ISS-011`
  (attribution drift, low), `ISS-017` (verdict-wording legacy defect, low — superseded
  functionally by `ISS-018`'s fix but the format gap itself is `ISS-021`, not re-litigated here),
  `ISS-020` (one malformed JSON line, low, append-only so left alone), `ISS-021` (verdict format
  standardization, low). None is more serious than filed; none touches a functional/security/data
  invariant.
- **Enforcement liveness: unchanged and still confirmed live** (not re-audited line-by-line this
  sweep since nothing in `.claude/settings.json` or `.claude/hooks/` changed since the last full
  check) — `mc-sessionstart.ps1`/`mc-precommit.ps1` present and registered, D-006/D-009 both
  `Approved-by: Umesh`.
- **Feedback inbox: fully folded**, no new entries since last sweep.
- **Goal-drift / re-grill: not due.** No `qa/.regrill-due` stamp, no `qa/.paused`, north star
  unchanged since last contract amendment, no unit re-PASSed twice on the same evidence. Check 6
  is CLEAN.
- **Goal coverage:** 23/29 done (79%), `current: T-007`. Remaining 6 pending tasks (`T-007,
  T-008, T-011, T-013, T-014, T-015`) are each either out-of-repo-governance (whatsapp_msg
  submodule), depend on an undone human-gated task, or explicitly require Umesh's approval
  before any buildable work exists (`T-011` meeting-bot auto-join needs the Q4 consent decision;
  `T-015` needs explicit approval before any data export). No coverage gap that a new contract
  criterion could close autonomously.

## Top-3 recommended next units

1. **ISS-007 (low) — bring all 4 contracts to the standard shape** (status / north-star link /
   `[I*]` invariants / append-only amendment log). Routine, checker-owned, no human gate —
   the only remaining item in the queue that is both real and autonomously actionable.
2. **ISS-011 (low) — append a routine DECISIONS clarification naming Q5 under D-003** (or a new
   D-entry) to fix the architecture-doc attribution drift. Routine amendment, no human gate.
3. **ISS-021 (low) — standardize the `VERDICT: PASS|FAIL|CONTRACT_MISMATCH` opening line** across
   the still-nonstandard verdict files (`evaluator-calibration.md`, `watched-sources.md`,
   `calendar-auto-join.md`, `browser-profile-privacy.md`) per the checker SKILL's Mode A step 8
   format — not enforcement-breaking today, but a template/reminder fix (e.g. via `qa/loop.md`)
   would close this structurally rather than needing another sweep catch.

No fourth slot filled: every remaining backlog item (`T-007/T-008/T-013/T-014/T-015`, `ISS-017`,
`ISS-020`) requires a human decision, an out-of-repo dependency, or is an append-only historical
record that should not be touched. This sweep does not manufacture a marginal unit to pad the
list.

## Overall progress
`.goal/goal.json` → **79% complete** (23/29 done), `current: T-007` (correctly human-gated on
the Q4 consent decision, not a stale pointer — see ISS-014/016 closure above).
