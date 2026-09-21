# Checker verdict — speaker-block-floor (cycle 1, 2026-09-21)

**Mode:** A (fresh re-run of the manifest's verify commands)
**Manifest:** qa/manifests/speaker-block-floor.md
**Cycle checked: 1**

## Fresh re-runs
- `pnpm --filter @lkb/index test`: all 4 new block-scoping tests observed PASSING by name;
  207 pass / 0 fail total. The recurring-label test asserts exactly the gate's measured failure
  shape (same label, later block NOT absorbed into one identity).
- `pnpm --filter @lkb/index typecheck`: exit 0.
- Diff review: scope honored — only the four named files touched; no schema change, no Mongo
  write, no model call. The verbatim-evidence rule and contradiction refusal are structurally
  untouched (evidence collection code unchanged; only scoping metadata added).
- The deterministic floor's re-run inside speakers-llm for scoping is pure over the same turns;
  no provider call introduced.

## Verdict
**PASS** (cycle 1).

## Notes
- The gate's phase order is respected: phase 2 (LLM candidates), phase 3 (no-write precision
  eval), phase 4 (write unit + persona fields) remain separate future units.
- sync-speakers.mjs block-based coverage measurement is explicitly deferred and named in the
  manifest — consistent with the gate's phase-1 wording ("update the existing speaker tests and
  scripts/sync-speakers.mjs measurement") only as far as it goes; the sync-script half is still
  owed. Recorded as a note, not an issue: the phase is not complete until that lands with the
  next unit.
- ISSUES-WRITTEN: none
