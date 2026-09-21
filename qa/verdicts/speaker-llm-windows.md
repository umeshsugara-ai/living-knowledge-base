# Checker verdict — speaker-llm-windows (cycle 1, 2026-09-21)

**Mode:** A (fresh re-runs)
**Manifest:** qa/manifests/speaker-llm-windows.md
**Cycle checked: 1**

## Re-runs
- `pnpm --filter @lkb/index test`: 210 pass / 0 fail (3 new window tests observed passing).
- `pnpm -r typecheck`: exit 0. Monorepo tests: fail 0 everywhere.
- Diff review: only the five named files; no Mongo writes, no schema change.
- The eval numbers in the manifest were re-derived from the probe outputs recorded in
  qa/probes/ (speakers-windowed-eval.mts, speakers-shipped-eval.mts,
  deterministic-floor-check.mts); the ISS-255 ledger row carries the full measured evidence.

## Verdict
**PASS** (cycle 1) — for phase 2 as scoped (windowed path + adapter + routing pin + honest
no-write eval). The phase-3 precision bar itself is measured FAILING (ISS-255) and the manifest
says so plainly; that is the eval working, not the unit failing — the gate's phase order
explicitly requires the precision gate BEFORE any write unit, and nothing was written.

## Notes
- The write unit (phase 4, incl. persona/knowledge-profile fields) stays BLOCKED until ISS-255's
  fix_direction lands and the precision gate holds.
- ISSUES-WRITTEN: ISS-255
