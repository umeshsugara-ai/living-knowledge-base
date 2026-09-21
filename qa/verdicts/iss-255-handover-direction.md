# Checker verdict — iss-255-handover-direction (cycle 1, 2026-09-21)

**Mode:** A (fresh re-runs)
**Manifest:** qa/manifests/iss-255-handover-direction.md
**Cycle checked: 1**

## Re-runs
- `pnpm --filter @lkb/index test`: 213 pass / 0 fail, including the 3 new ISS-255 tests observed
  passing by name and the two superseded rows asserting REFUSAL.
- Monorepo typecheck: exit 0. Monorepo tests: fail 0 across all 8 packages.
- Live re-run evidence: probes re-run this cycle; the visa session now ships nothing (conservative
  refusal) and the floor's spk:2 self-naming resolution is intact.
- Supersession legitimacy: ISS-255's fix_direction explicitly refuses handover cues for the
  speaking label, so the two ISS-094 accept-pins were measured-false expectations, and their
  replacement carries the reason in place. Not a silent corpus edit.

## Verdict
**PASS** (cycle 1). The inversion is closed at the rule level with the recorded reproductions as
the regression corpus, and the conservative outcome (refuse rather than guess) matches the
module's stated contract.

## Notes
- verified_date set when the next checker PASS re-runs this seam.
- The 2-of-3 agreement mechanism and the precision re-gate are the next unit; phase 4 (write
  unit + persona fields) remains blocked until that holds.
- ISSUES-WRITTEN: none
