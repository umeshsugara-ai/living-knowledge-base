# QUEUE — top-3 recommended next units (checker sweep 2026-09-03T07:35Z, Mode B safety net)

> Superseded queue note: the prior queue (stamped ~04:32Z) recommended T-005b, ISS-014's pointer
> fix, and ISS-012 — all three are now DONE (T-005b checker-PASS 6/6 verdict `e5dafe3`; ISS-012
> verified 2026-09-03; ISS-014 was fixed by commit `474279b` and the pointer correctly advanced
> through 6 more units since). This is a fully fresh pick against current TASKS.md state.

| # | Unit | Why | Status |
|---|---|---|---|
| 1 | T-021: Golden set (50–100 Qs) + recall@k report, target recall@5 ≥ 0.85 | unblocked (dep T-002 done); directly measures the goal.json north star ("POST /ask ... speaker+timestamp-cited internal answers"); Phase 1b's own evaluation loop — nothing else exercises /ask against real TOC data yet; also unblocks T-022 | TODO |
| 2 | ISS-016 + ISS-017: goal.json pointer hygiene + T-009b manifest close-out | goal.json's committed `current` points at a just-finished task (T-009b) and its uncommitted working copy points at a BLOCKED task (T-003, ISS-015) — either would misdirect the next `/maker continue` tick; separately the T-009b manifest never flipped to `checked-PASS` and its verdict's non-standard wording makes `mc-sessionstart.ps1` undercount "PASS not closed out" (reported 0, true count 1) — an enforcement blind spot, not just paperwork | TODO |
| 3 | T-023: URL ingestion adapter (Jina Reader / Firecrawl → paragraphs-as-turns) | unblocked (dep T-020 done); directly matches Umesh's explicit feedback-inbox ask ("URLs daalein to wahan se data properly aa jaye"); unblocks T-027 (Watched Sources, also explicitly requested) | TODO |

## Also open (not top-3, still tracked)
- T-004c (low urgency per TASKS.md footer — checker-flagged regenerate() edge case, depends T-004b done).
- T-007 (WhatsApp → claims ingestion, dep T-020 done, consent Q4 resolved per ARCHITECTURE §6) — viable alternate #3.
- T-013 (avatar/voice client, dep T-009 done) — unblocked but no near-term driver yet.
- T-025 (Calendar auto-join, dep T-024 done) — unblocked, deferred behind T-021/T-023 by priority, not by any gate.
- T-026 (recording purge policy, dep T-018 done, HIGH criticality per goal.json but not user-deferred like T-010/T-028) — worth scheduling soon given consent sensitivity.
- ISS-007 (low): contracts lack standard shape (status/north-star link/[I*]/amendment log) on early contracts.
- ISS-010 (medium): Phase-1 exit gaps unassigned — HTTP POST /ask route owner, web-search provider, D-002 retention field, turn-level citations. No new tasks needed; scope amendments to T-005b/T-019/T-018 (T-005b, T-019, T-018 all now done — re-verify this is still open next sweep, it may already be closed by their delivered content).
- ISS-011 (low): ARCHITECTURE §6 Q5 attribution drift (D-003 vs D-004/D-005) — routine DECISIONS clarification, no ARCHITECTURE change needed.
- T-003 BLOCKED on ISS-015 (invalid GEMINI_API_KEY — needs a valid key from Umesh). T-010/T-028 explicitly user-deferred.

## This sweep's findings (see qa/issues.jsonl for full detail)
- **No bypass found.** Every commit since the last sweep (`qa/.last-sweep` read as `2026-09-03T04:32:00Z FINDINGS: 2`) that touches source maps to a `qa: contract for ...` + `feat(...)` + `checker: PASS ...` + `qa: ... checked-PASS` commit quartet, for all of: T-018, T-019, T-020, T-005b, T-024, T-002, T-009, T-004b, T-006, T-012, T-009b. Every one of those units has a matching `qa/manifests/<slug>.md` and `qa/verdicts/<slug>.md`.
- **NEW — ISS-016 (medium):** `.goal/goal.json` `"current"` has drifted stale again — committed HEAD names `T-009b` (a task that was already done in the very commit that set the pointer), and the *uncommitted* working-tree copy (`git status --short` shows `M .goal/goal.json`, `M qa/.last-tick`) names `T-003`, which TASKS.md marks BLOCKED (ISS-015). This is the same failure shape ISS-014 named, recurring — the fix this time is a task ID, not a one-off pointer nudge (see fix_direction in the ledger).
- **NEW — ISS-017 (medium):** T-009b's manifest (`qa/manifests/real-llm-scorer.md`) was never flipped from `Status: ready-for-check` to `checked-PASS`, even though its verdict (`qa/verdicts/real-llm-scorer.md`) is a clean PASS and TASKS.md/ledger both call T-009b done. The verdict file also doesn't use the SKILL-mandated `VERDICT: PASS` line (it says `**Result: PASS**` instead), which caused `mc-sessionstart.ps1`'s own regex-based "PASS not closed out" counter to report 0 when hand-run, though this unit qualifies. Flagged as an enforcement blind spot, not just a hygiene gap.
- **ISS-014 re-checked:** the original complaint (pointer stuck at stale `T-002`) was genuinely fixed by commit `474279b` and the pointer correctly advanced through 6 further commits (`T-024` → `T-004b` → `T-006` → `T-012` → `T-009b`) reflecting real maker progress — left the ledger line untouched per this sweep's instructions (append-only), but note it in QUEUE for context: the *mechanism* (pointer hygiene) is what's now re-flagged fresh as ISS-016, not a reopen of ISS-014 itself.
- **Feedback inbox:** all three dated entries already carry "folded" annotations from the prior sweep with specific commit/contract references; re-read in full, no new unfolded content found.
- **Enforcement liveness:** hand-ran `.claude/hooks/mc-sessionstart.ps1` → exit 0, prints `MAKER-CHECKER ACTIVE ...` status line (see ISS-017 for its undercount bug). Hand-ran `.claude/hooks/mc-precommit.ps1 -InputJson '{"tool_input":{"command":"git commit -m test"}}'` → exit 0, correctly printed a WARN naming 1 unit still `ready-for-check`. Repo has 60+ commits since last sweep alone — versioning alive.
- **Re-grill:** not due. `qa/.regrill-due` absent. Plan says re-grill ~4 weeks after the T-024 demo; T-024's checker-PASS commit (`e2a8136`) landed 2026-09-03T11:29 local, same calendar day as this sweep (2026-09-03) — 4 weeks obviously has not elapsed. Correctly absent.
