# Verdict — T-017b-snapshot-features-ledger

**Cycle checked:** 2
**Date:** 2026-09-03
**Contract:** qa/contracts/snapshot-features-ledger.md
**Manifest:** qa/manifests/T-017b-snapshot-features-ledger.md (Fix cycle: 2 of max 3)
**Prior verdict:** qa/verdicts/T-017b-snapshot-features-ledger.md cycle 1 — FAIL, 8/9, C6 partial
(6b met, 6a not wired). Issue: ISS-013.

## This cycle's claim
D-009 (docs/DECISIONS.md) authorizes registering
`.claude/hooks/features-snapshot-session-end.ps1` as a second SessionEnd hook in
`.claude/settings.json`, merged alongside the existing `lab-session-end.ps1` entry, and the
registration is done.

## Re-run evidence (all commands re-executed by this checker, fresh)

- Read `docs/DECISIONS.md` D-009: `Approved-by: Umesh` present; `Changes-authorized:` line reads
  literally ".claude/settings.json (add a second SessionEnd hooks entry for
  features-snapshot-session-end.ps1, merged alongside the existing lab-session-end.ps1 entry,
  never overwriting it)" — names exactly this settings.json change, not a vague grant. Links to
  T-017b/ISS-013/the contract criterion. [C6a authorization]
- Read `.claude/settings.json`: `SessionEnd` array now has two entries — the original
  `lab-session-end.ps1` block (byte-identical to cycle 1: same `-InputJson $i` piping, timeout
  10) unmodified, plus a new block piping the same way into
  `features-snapshot-session-end.ps1`, timeout 10. Neither entry was overwritten by the other.
  [C6a wiring]
- `python -c "import json; json.load(open('.claude/settings.json')); print('VALID JSON')"` →
  `VALID JSON`. [C6a well-formed]
- Hand-ran the hook myself: `echo '{}' | powershell ... features-snapshot-session-end.ps1
  -InputJson $i` → `EXIT:0`. [C6a functional]
- `python schema/validate.py` → 11/11 OK incl. `features_event`, `PASS: 11 collection schema(s)`.
  [C1]
- `node --test scripts/snapshot.test.mjs` → 4/4 pass. [C2, C3b, C4, C8]
- `node scripts/snapshot.mjs --check` → `OK: docs/SNAPSHOT.md matches a fresh regeneration (93
  lines, budget 200)`. `wc -l docs/SNAPSHOT.md` → 93. [C3, C4]
- `pnpm lint:structure` → all 5 lint checks OK, snapshot --check OK, depcruise clean (0 dependency
  violations, 28 modules). [C4, C6b]
- `pnpm test:lint` → 14/14 pass (10 lint tests + 4 snapshot tests). [C8]
- `pnpm gen:types -- --check` → `OK: 11 generated type file(s) + index.ts match schema/`.
- `pnpm -r typecheck` → 9/9 workspace projects clean.
- `pnpm -r test` → `packages/ask` 6/6, `packages/index` 4/4, 0 failures.
- Independent re-run of C5 (session-start FEATURE CHANGED simulation, my own test row, not the
  manifest's): backed up `docs/FEATURES.jsonl`, `appendEvent`'d a `removed` row
  (`checker-cycle2-test`), ran `.claude/hooks/mc-sessionstart.ps1` → printed `FEATURE CHANGED:
  checker-cycle2-test removed on 2026-08-20 -- checker cycle-2 verification row`; restored the
  ledger, regenerated `docs/SNAPSHOT.md`; `git status --porcelain -- docs/FEATURES.jsonl
  docs/SNAPSHOT.md` → empty. [C5]
- Read the memory pointer files directly: `project_snapshot_first.md` and `MEMORY.md` under
  `C:\Users\Lenovo\.claude\projects\d--KnowledgeBase\memory\` both exist with the content the
  manifest quotes. [C7]
- `git status --porcelain` (repo root, after all above) → only `.goal/goal.json` and
  `qa/.last-tick` modified (goal-tracking bookkeeping, outside this unit's scope) — nothing
  under `docs/`, `scripts/`, `.claude/`, or `schema/` left dirty by verification.

## Criteria

| # | Criterion | Result |
|---|---|---|
| C1 | features_event schema + validate.py | MET |
| C2 | appendEvent / CLI, append-only, reason-required | MET |
| C3 | snapshot.mjs generates SNAPSHOT.md per spec | MET |
| C3b | hand-edit drift caught with line-level report | MET |
| C4 | ≤200 lines, wired into lint:structure | MET |
| C5 | session-start hook FEATURE CHANGED line | MET |
| C6 | Regeneration wired to lifecycle points: (a) SessionEnd + (b) lint:structure fallback | MET — both (a) and (b) now confirmed |
| C7 | Memory pointer file + MEMORY.md | MET |
| C8 | Tests exist and pass | MET |
| C9 | Seed data (T-001/004/005/016/017), non-invented | MET |

ISS-013 (C6a) is resolved: D-009 supplies the missing `Approved-by: Umesh` authorization scoped
exactly to this settings.json change, the wiring is present and valid, and the hook runs clean
standalone. Ledger updated `open → verified` with this cycle's re-run evidence.

## Issues addressed
- ISS-013 → verified (see qa/issues.jsonl, verified_date 2026-09-03, verified_evidence quotes
  D-009 + the settings.json state + the hand-run exit code).

## Issues written
None new this cycle.

## Verdict

```
VERDICT: PASS
SCOREBOARD: 9/9 criteria met, 0/0 invariants (none declared)
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: D-009 supplies a properly scoped, Umesh-approved authorization for the exact
settings.json change ISS-013 flagged as missing. .claude/settings.json now carries both
SessionEnd hook entries (lab-session-end.ps1 unchanged, features-snapshot-session-end.ps1 added),
is valid JSON, and the new hook runs clean when hand-invoked (exit 0). All other criteria (C1-C5,
C7-C9, C6b) remain independently re-verified via a full re-run of the local CI chain
(validate.py, snapshot tests, lint:structure, test:lint, gen:types --check, workspace typecheck +
tests) plus a fresh hand-simulation of the session-start FEATURE CHANGED line. 9/9 criteria met —
PASS.
```
