# Verdict — T-016-monorepo-restructure

**Date:** 2026-09-03
**Cycle checked: 1**
**Contract:** qa/contracts/monorepo-restructure.md
**Manifest:** qa/manifests/T-016-monorepo-restructure.md (Status: ready-for-check, Fix cycle 1 of 3)
**Bound root:** D:\KnowledgeBase — unit at commit 09d9706 (manifest committed at bdd8094 = HEAD)
**Checker:** fresh Mode A subagent; no builder context; default (coding) adapter (no qa/adapter.json)

```
VERDICT: PASS
SCOREBOARD: 9/9 criteria met, 0/0 invariants hold (contract declares no [I*])
FAILURES (if any): none
ISSUES-WRITTEN: ISS-011 (low, attribution nit — not a criterion failure)
EXPLANATION: Every manifest verify command was re-run by the checker and matched the expected clause: install/test/typecheck/gen:types --check/validate.py all exit 0 (4/4 + 6/6 tests, 10/10 schemas), the nine D-003 packages exist with @lkb/<name> + tsconfig extending the base, TOC/ moved by 54 R100 git renames, whatsapp_msg is a submodule at 7cdf1a1 = origin/main, six Python originals deleted after the port, root has 12 loose files, ARCHITECTURE.md is 128 lines with H8-H10 / Q2-Q5-Q6 landed, max LOC 72/99. The TS ports were diffed line-by-line against f89d98c:tree_index/*.py and ask_router/*.py — same node_id scheme, injectable summarize, page.summary→"" fallback, same threshold defaults/order, tuple-or-number normalisation, good_docs, insufficient_coverage, separate sources; the 4 + 6 test cases carry the same names and fixtures as the Python originals. ISS-006 and ISS-008 flipped open→fixed on evidence.
```

## What I re-ran (real output, not the manifest's)

| Check | Command | Result |
|---|---|---|
| C1 | `pnpm install --frozen-lockfile` | exit 0, "Done in 376ms using pnpm v10.33.0"; root package.json `private: true`, `packageManager: pnpm@10.33.0`; pnpm-workspace.yaml = packages/*, apps/*, workers/* |
| C2 | layout loop + `grep extends */tsconfig.json` | 9/9 dirs, names @lkb/{core,db,ai,ingest,index,ask,meeting-bot,api,transcribe}; 8 tsconfig.json all `extends ../../tsconfig.base.json` (workers/transcribe is Python — none, per D-003); placeholders = `export {};` only |
| C3 | `pnpm -r test` | exit 0; packages/index tests 4 pass 4 fail 0; packages/ask tests 6 pass 6 fail 0; runner `node --test --import tsx` |
| C3 | diff vs `git show f89d98c:{tree_index,ask_router}/*.py` | build.ts/search.ts/evaluator.ts/router.ts behaviour-identical (see EXPLANATION); RangeError ↔ ValueError; test names 1:1 with `def test_*` in the originals |
| C4 | `test ! -e tree_index && test ! -e ask_router`; `git diff --name-status f89d98c 09d9706` | dirs gone; 6 `D` entries for the .py files, no .py under packages/; `python schema/validate.py` exit 0, PASS 10/10 |
| C5 | `pnpm gen:types --check` | exit 0, "OK: 10 generated type file(s) + index.ts match schema/"; non-generated interfaces = Scored, Evaluation, InternalSource, AskResult only; type aliases are function/union shapes, no schema field lists |
| C6 | `git submodule status`, `.gitmodules`, `git -C sources/whatsapp_msg rev-parse HEAD` / `ls-remote origin main` | 7cdf1a1 sources/whatsapp_msg (heads/main) = origin/main; url whatsapp-archiver.git; submodule status clean (0 lines); `.env` present in raw/TOC and sources/whatsapp_msg |
| C6 | refined `git grep` TOC/ and whatsapp_msg/ (old-location only) | TOC/: only brainstorms/…:64 prose "TOC/webinar" + the contract's own grep text; whatsapp_msg/: only contract lines 39-43. `.gitignore` and `.claude/CLAUDE.md:39,43` use the new paths. 54 `R100` renames TOC/ → raw/TOC/ |
| C7 | `ls -Ap \| grep -v / \| wc -l` | 12 (≤15); `ls \| wc -l` = 21 incl. directories, which the contract excludes |
| C8 | `wc -l ARCHITECTURE.md`, `head -1` | 128 (≤150); header `last change: D-008`; §3 H8 (D-002/D-008), H9 (D-004), H10 (D-005/D-008); §4 D-003 tree; §5 budgets + dependency rules + purge gate; §6 Q2/Q4/Q5 closed, Q6 added; the old §5 "Consent before capture … open Q4" line is gone — all within D-002..D-005/D-008 Changes-authorized grants |
| C9 | `find packages apps workers -name "*.ts" … \| xargs wc -l` | max non-test 72 (build.ts), max test 99 (router.test.ts); validate.py 10/10; `pnpm -r typecheck` exit 0 (bonus) |

## Issues addressed (ledger)
- ISS-006 open → **fixed**: checker adopted the contract via amendment-log line (this check); maker did not touch qa/contracts/ in 09d9706.
- ISS-008 open → **fixed**: ARCHITECTURE.md now carries every D-002..D-005/D-008 grant (evidence above).

## New issues
- ISS-011 (low): §6 Q5 closure is attributed to D-003, whose Changes-authorized names only Q2 — DECISIONS attribution nit, remedy is a routine DECISIONS clarification, no ARCHITECTURE change. Does not fail C8 (the contract itself requires Q5 closed).

## Contract amendments (routine, this check)
- Adoption line for ISS-006; C9 count 9/9 → 10/10.

## Notes
- Manifest says "NOT committed — orchestrator commits"; in fact 09d9706 + bdd8094 are at HEAD. Working tree has only `.goal/goal.json` and `qa/.last-tick` modified (not the unit's).
- Goal task T-016 closed by this PASS via goal_cli.py done.
