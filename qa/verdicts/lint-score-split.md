# Verdict — lint-score-split

**Cycle checked:** 1
**Date:** 2026-09-07
**Contract:** qa/contracts/catalogue-progress-score.md (I7, and I13/I14 as touched-but-unweakened),
qa/contracts/structure-lint.md (criterion 7)
**Manifest:** qa/manifests/lint-score-split.md
**Mode:** A (unit check), fresh context, no builder reasoning taken on trust

## What I re-ran myself

1. **Own probe, different file from the manifest's** (`apps/web/src/App.tsx`, not
   `apps/api/src/routes/graph.ts`): appended a line, then ran `pnpm lint:structure` (exit 0,
   all six structure checks + depcruise green through the dirty scraped-source file) and
   `pnpm lint:score` (refused: `apps/web/src/App.tsx is not what the repository holds
   (modified)`, exit 2). Reverted the probe; `git status` on the file came back clean.
2. `git diff --stat HEAD -- scripts/catalogue-score.mjs scripts/lib/catalogue.mjs` → empty.
   Confirmed pure packaging, no scorer logic touched.
3. `git diff HEAD -- package.json` and `.github/workflows/ci.yml` → read in full. `lint:structure`
   had exactly the `&& node scripts/catalogue-score.mjs --check` clause removed, nothing else
   changed; a new `lint:score` script was added running only that command. CI gained one new step.
4. Parsed `.github/workflows/ci.yml` with `yaml.safe_load` (Python) → valid YAML, 13 steps.
   Enumerated the step list: "Catalogue score reproducibility" is step index 11, unconditionally
   reachable (no `if:` guard), sitting between "Structure budgets + dependency rules" (index 10,
   `lint:structure`) and "Linter negative tests" (index 12, `test:lint`) — exactly as the manifest
   claims, not orphaned or skipped.
5. `pnpm test:lint` → 45/45 pass (own run, fresh).
6. `pnpm -r typecheck` → 9/9 workspace projects with a typecheck script report `Done`, no errors
   (10 of 11 workspace projects scoped; the 11th has no typecheck script, unrelated to this unit).
7. `git diff --stat HEAD -- docs/PROGRESS.md` → empty; headline confirmed still
   `**20.2% of the 57-feature product catalogue.**` in the working tree. Unchanged, as claimed.
8. Read `qa/contracts/structure-lint.md` criterion 7 and its numbered checks 1–6 (lint-loc,
   lint-dirsize, lint-root, lint-dupes, lint-migrations, depcruise dependency rules).
   `catalogue-score.mjs --check` was never one of those six — it was an extra clause chained
   between `snapshot.mjs --check` and depcruise, itself also outside 1–6. Removing it from
   `lint:structure` therefore cannot violate "runs 1–6 in sequence"; the manifest's own reading
   (item 5 in the check-request) is correct. No amendment needed to structure-lint.md.

## The I7 wording tension — ruled, not left open

The manifest correctly declined to touch `qa/contracts/catalogue-progress-score.md` (checker-owned)
and asked for a ruling. I7's literal text ("must be wired into `pnpm lint:structure`") was stale
against this contract's own 2026-09-07 amendment-log ruling ("What moves is *where the refusal
runs*... belongs in the commit/CI path, not bundled into the everyday `pnpm lint:structure`
chain"). I rewrote I7 to read: "...must be wired into the commit/CI path — `pnpm lint:score`,
invoked as its own step in `.github/workflows/ci.yml` — not into `pnpm lint:structure`, which
stays runnable at any moment during an in-flight unit (ISS-058)," and appended an amendment-log
entry recording it as a wording reconciliation, not a substance change — the ruling had already
decided the substance; this only makes I7's own text match the ruling it was already bound by.
No invariant loosened: I11–I14 (content-vs-HEAD trust, line-ending-normalised sha, behavioural
pinning, derived trusted-input set) are byte-identical, and the refusal-on-uncommitted-source
strength this unit's own probe (step 1 above) reproduces is untouched.

## Judgment against qa/contracts/catalogue-progress-score.md

- **I7** — MET (post-amendment wording). `--check` still exits non-zero on staleness (unchanged
  logic) and is now wired into the commit/CI path via `lint:score` in `ci.yml`, exactly as the
  corrected text requires.
- **I9–I14** — untouched by this unit (zero diff on `catalogue-score.mjs`/`lib/catalogue.mjs`);
  re-verified their trust/refusal behavior still fires via my own probe in step 1. HOLD.
- **I1–I6, I8** — no code path affected by a packaging-only change; nothing here to move them.
  HOLD (not exercised fresh this cycle, no reason to suspect regression given zero scorer diff).

## Judgment against qa/contracts/structure-lint.md

- **Criterion 7** ("single entry point... runs 1–6 in sequence... exits 0 on the current tree") —
  MET. `pnpm lint:structure` still runs checks 1–6 in the same order and exits 0 on the current
  tree (verified live in step 1, dirty-file run). `catalogue-score.mjs --check` was never one of
  the six numbered checks, so its removal is orthogonal to this criterion, not a violation of it.

## Issues addressed

- **ISS-058** — verified fixed by execution (steps 1–4 above reproduce exactly the composition
  change the issue's `fix_direction` prescribed, with nothing else moved). Ledger flipped
  `open → fixed`.

## Scoreboard

criteria: I7 (catalogue-progress-score) 1/1 met · structure-lint criterion 7: 1/1 met
invariants: I9–I14 hold (0/0 changed, re-verified live) · I1–I6, I8 hold (untouched)

```
VERDICT: PASS
SCOREBOARD: 2/2 criteria met, 6/6 invariants hold (I9-I14 re-verified live; I1-I6/I8 untouched by this unit)
FAILURES (if any):
- none
ISSUES-WRITTEN: none new (ISS-058 flipped open -> fixed in qa/issues.jsonl)
EXPLANATION: Pure packaging split, confirmed by a zero diff on the scorer itself and by
reproducing the manifest's core demonstration on an independently chosen probe file. CI wiring
is valid YAML with the new step reachable and unconditioned. Reconciled I7's stale wording
against this contract's own prior ruling (routine, no invariant weakened). Full regression
(test:lint 45/45, typecheck clean, PROGRESS.md unchanged) re-run and confirmed.
```
