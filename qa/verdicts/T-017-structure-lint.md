# Verdict — T-017-structure-lint

**Date:** 2026-09-03
**Contract:** qa/contracts/structure-lint.md (adopted this check — amendment log added)
**Manifest:** qa/manifests/T-017-structure-lint.md
**Cycle checked: 1**
**Unit at:** HEAD 6ef2980 `feat(T-017): CI structure lint per D-003`
**Bound to:** D:\KnowledgeBase (no qa/adapter.json → default coding adapter)
**Checker:** fresh /checker subagent, Mode A. Environment: node v24.13.1, pnpm 10.33.0, dependency-cruiser 18.2.0.

```
VERDICT: PASS
SCOREBOARD: 10/10 criteria met, 0/0 invariants hold (contract declares no [I*])
FAILURES (if any): none
ISSUES-WRITTEN: ISS-012 (low — stale run hint in .dependency-cruiser.cjs header; not a criterion)
EXPLANATION: Every verify command was re-run by the checker and reproduced the manifest's claims: five linters OK on the real tree, `pnpm lint:structure` exit 0, `pnpm test:lint` 10/10, both planted dependency violations (core→@lkb/db, ai→db real path) fail depcruise AND the `lint:structure` chain, reverts restore exit 0 with a clean tree, ci.yml parses with 12 steps on push+pull_request, and the full local CI sequence (install --frozen-lockfile → typecheck → test → gen:types --check → validate.py → lint:structure → test:lint) exits 0 at every step. The manifest's hazard about the contract-literal depcruise form was confirmed (2 modules / 0 deps) and recorded as a routine C6 amendment; the goal.md → docs/goal.md move is a byte-identical R100 rename that fixes a real budget violation without loosening it, and the §4 update sits inside D-003's "directory map" grant.
```

## What I re-ran (all from D:\KnowledgeBase, verbatim results)

| Command | Result | Exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | Done in 376ms | 0 |
| `node scripts/lint-loc.mjs` | `lint-loc: OK (24 file(s) within budget)` | 0 |
| `node scripts/lint-dirsize.mjs` | `lint-dirsize: OK (26 dir(s) within budget)` | 0 |
| `node scripts/lint-root.mjs` | `lint-root: OK (12 loose root file(s), 1 gitignored excluded)` | 0 |
| `node scripts/lint-dupes.mjs` | `lint-dupes: OK (17 unique export(s), 10 unique schema $id(s))` | 0 |
| `node scripts/lint-migrations.mjs` | `lint-migrations: OK (382 file(s) scanned)` (manifest said 381 — tree-state count, not a defect) | 0 |
| `pnpm lint:structure` | five OK lines + `✔ no dependency violations found (27 modules, 32 dependencies cruised)` | 0 |
| `pnpm test:lint` | `tests 10 / pass 10 / fail 0` | 0 |
| `npx depcruise --validate packages apps workers` (contract literal) | `✔ … (2 modules, 0 dependencies cruised)` — mis-parse CONFIRMED | 0 |
| `npx depcruise packages apps workers --validate` | `✔ … (27 modules, 32 dependencies cruised)` | 0 |
| `python -c "import yaml; …ci.yml…"` | `valid YAML; steps: 12 \| on: ['push', 'pull_request']` | 0 |
| `pnpm -r typecheck` | all packages + apps/api Done | 0 |
| `pnpm -r test` | index 4/4, ask 6/6 | 0 |
| `pnpm gen:types --check` | `OK: 10 generated type file(s) + index.ts match schema/` | 0 |
| `python schema/validate.py` | `PASS: 10 collection schema(s) validated correctly.` | 0 |
| `ls -Ap \| grep -v / \| wc -l` / `git check-ignore -v .env` | 13 / `.gitignore:2:**/.env` → 12 counted | — |
| `wc -l ARCHITECTURE.md` | 130 | — |
| `grep -c structure.config.json ARCHITECTURE.md` / `grep -nE "300 LOC\|≤ 15 loose\|≤ 150 lines"` | 2 / no hits | — |
| LOC per script (non-blank) | dirsize 33 · dupes 59 · loc 29 · migrations 27 · root 32 · lib/walk 104 · lint.test 130 | — |

### C6 planted-then-reverted sequence (performed by the checker)
```
PLANT 1  packages/core/src/index.ts += import "@lkb/db";
  depcruise --config .dependency-cruiser.cjs packages apps workers
  error no-unresolvable-workspace-import: packages/core/src/index.ts → @lkb/db
  x 1 dependency violations (1 errors, 0 warnings). 28 modules, 33 dependencies cruised.   exit=1
REVERT 1 → ✔ no dependency violations found (27 modules, 32 dependencies cruised)          exit=0
PLANT 2  packages/ai/src/index.ts += import "../../db/src/index.js";
  error ai-db-only-core: packages/ai/src/index.ts → packages/db/src/index.ts
  x 1 dependency violations (1 errors, 0 warnings). 27 modules, 33 dependencies cruised.   exit=1
REVERT 2 → ✔ no dependency violations found (27 modules, 32 dependencies cruised)          exit=0
PLANT 3  (plant 1 again) via `pnpm lint:structure` → chain exits 1                          exit=1
REVERT 3 → git status --porcelain: only pre-existing ` M .goal/goal.json` / ` M qa/.last-tick` (maker's, untouched by this check)
```
Extra bite-checks on the REAL tree (not just fixtures): planted `export function evaluate()` under packages/core → `lint-dupes: FAIL … evaluate declared in packages/ask/src/evaluator.ts, packages/core/src/tmpchk/dup.ts` exit 1; planted `scripts/migrate-2026-09-03-x.mjs` → `lint-migrations: FAIL` exit 1. Both removed; tree clean.

## Criteria judgement
- **C1 lint-loc** — script reads `loc.{max,testMax,extensions,testPatterns}` + `roots`/`ignoreDirs` from structure.config.json; non-blank count (`countLoc`); prints `file:count (budget N)`. MET.
- **C2 lint-dirsize** — non-recursive `looseFiles` per dir, ignoreDirs honoured, 30 budget from config. MET.
- **C3 lint-root** — loose files (dotfiles in, dirs out, gitignored out via `git check-ignore --stdin`), ARCHITECTURE 150 / md 200 / README 80. Real violation (goal.md 322 lines) fixed by rename, not by loosening. MET.
- **C4 lint-dupes** — export regex on packages/*.ts excluding generated/ + index.ts; schema `$id` dedupe. Real-tree plant fails. MET.
- **C5 lint-migrations** — `^migrate-.*\.(mjs|js|ts|py)$` anywhere outside migrations/. Real-tree plant fails. MET.
- **C6 dependency rules** — six §5 rules on real paths + no-circular + couldNotResolve; clean tree 0, two distinct plants 1, reverts 0. Judged on intent per the adopted amendment (contract-literal form mis-parses; recorded, not softened). MET.
- **C7 single entry** — `lint:structure` chains 1–6 with `&&`; plant 3 proves the chain exits 1; clean tree exit 0. MET.
- **C8 negative tests** — `scripts/lint.test.mjs` under `node --test`, at-budget clean fixture → 0 and over-budget → 1 for each of C1–C5, 10/10; runs via `pnpm test:lint`. MET.
- **C9 CI workflow** — ci.yml on push + pull_request, steps in the contract's order (install frozen → typecheck → test → gen:types --check → validate.py → lint:structure → test:lint); valid YAML; full sequence reproduced locally. MET.
- **C10 budgets in one place** — structure.config.json holds every number; ARCHITECTURE §5 references the file and restates none. MET.

## goal.md → docs/goal.md (checker's judgement on the D-003 grant)
`git diff -M 10a6774 6ef2980 -- goal.md docs/goal.md` → R100, 0 lines changed; content byte-identical. The root `.md` cap is a D-003 budget; moving an immutable transcript out of root is the only fix that neither splits the transcript nor softens the rule. ARCHITECTURE §4 (directory map, table row) is exactly what D-003's Changes-authorized names. D-000's `goal.md` mention is immutable history and stays. Within grant; no issue.

## Ledger
- ISS-012 opened (low): `.dependency-cruiser.cjs:9` still advertises the mis-parsed run form.
- ISS-007 (all contracts lack the standard shape) — this contract now has an amendment log; status/north-star/[I*] still absent, ISS-007 stays open.
- Manifest `Issues addressed: none` — consistent.
