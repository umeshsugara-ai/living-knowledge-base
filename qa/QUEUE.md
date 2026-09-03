# QUEUE — top-3 recommended next units (checker sweep 2026-09-03T~04:32Z, Mode B safety net)

| # | Unit | Why | Status |
|---|---|---|---|
| 1 | T-005b: Ask v2 (`select_nodes` job, `(score, reason)` evaluator, `refine`, `answer`, per-call log) | next per TASKS.md's documented pick-order and plan §6 step 5; already unblocked (dep T-019 done); should absorb ISS-010's route/reason/web-search gaps while building | TODO |
| 2 | ISS-014: advance `.goal/goal.json` `"current"` from stale `T-002` to `T-005b` | pointer fix only, no contract change; T-002 is Phase 1b (after T-005b/T-024 per TASKS.md footer + plan §6 "Next moves" step 5) — left un-advanced it risks `/maker continue` picking work out of documented order | TODO |
| 3 | ISS-012: one-line stale run-hint fix in `.dependency-cruiser.cjs` header (line 9) | trivial, already has an exact fix_direction; a dev copying the current comment gets a vacuous green (`--validate packages apps workers` parses as 2 modules cruised, not the real 27/32) | TODO |

## Also open (not top-3, still tracked)
- ISS-007 (low): contracts lack standard shape (status/north-star link/[I*]/amendment log) on all four early contracts.
- ISS-010 (medium): Phase-1 exit gaps unassigned — HTTP POST /ask route owner, web-search provider in T-019, D-002 retention field in T-018, turn-level speaker+timestamp citations (T-004b, Phase 1b). No new tasks needed per fix_direction; scope amendments to T-005b/T-019/T-018.
- ISS-011 (low): ARCHITECTURE §6 Q5 attribution drift (D-003 vs D-004/D-005 grant wording) — routine DECISIONS clarification, no ARCHITECTURE change needed.

## This sweep's findings (see qa/issues.jsonl for full detail)
- ISS-005 closed out: verified — maker-checker enforcement wiring (D-006) is installed and hand-run clean (mc-sessionstart.ps1, mc-precommit.ps1 both exit 0; CLAUDE.md block present; settings.json registers both hooks).
- ISS-014 opened: goal.json `"current"` pointer stale (T-002 instead of T-005b) — see table above.
- No bypass found: every commit since the last sweep (2026-09-03T02:15:01Z) maps to a manifest + matching-cycle PASS verdict for T-016, T-017, T-017b, T-018, T-019, T-020.
- Feedback-inbox fold-in: both 2026-09-03(later) entries confirmed structurally covered by existing contracts/tasks (TOC/whatsapp_msg via ingestion-source-seam.md + T-002/T-007/T-027; T-012 re-scope + T-009 promotion correctly reflected in TASKS.md only, no T-012 contract exists yet to amend) — marked folded in qa/feedback-inbox.md.
- Enforcement liveness: hooks registered + hand-runnable; repo has 33+ commits (versioning alive).
- Re-grill: not due (plan says re-grill ~4 weeks after T-024 demo; T-024 not yet built). qa/.regrill-due absent, correctly so.
