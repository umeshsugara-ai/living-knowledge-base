# Contract — monorepo-restructure (T-016)

> Ground truth for the design-first restructure decided in D-003 (plan §6c.1). Maintained by
> /checker; /maker reads only. This unit is STRUCTURE ONLY: no new features, no behaviour change
> — the existing three PASSed units (T-001 schema, T-004 tree index, T-005 ask router) must keep
> working exactly as before, now inside the designed layout.

## Scope
Turn `D:\KnowledgeBase` into a pnpm-workspaces TypeScript monorepo per D-003, port the two Python
logic units to TypeScript with their tests first, move data out of the code tree, keep the JSON
Schemas as the single source of truth, and shrink `ARCHITECTURE.md` to ≤150 lines. One working
tree — nothing is copied, only moved (git history preserved via `git mv`).

## Criteria (each machine-checkable)

1. **Workspace exists:** root `package.json` (`"private": true`, `packageManager` pinned to a pnpm
   version) + `pnpm-workspace.yaml` listing `packages/*`, `apps/*`, `workers/*`; `pnpm install`
   exits 0 from a clean checkout (lockfile committed).
2. **Package layout matches D-003:** directories `packages/core`, `packages/db`, `packages/ai`,
   `packages/ingest`, `packages/index`, `packages/ask`, `packages/meeting-bot`, `apps/api`,
   `workers/transcribe` exist, each with its own `package.json` (name `@lkb/<name>`) and, for TS
   packages, a `tsconfig.json` extending a root `tsconfig.base.json`. Empty packages contain only
   `package.json` + `src/index.ts` exporting nothing (a placeholder is allowed; a stub feature is not).
3. **Ports are behaviour-identical:** `packages/index/src/tree/{build,search}.ts` reproduce
   `tree_index/build_tree.py` + `tree_search.py` (same node_id scheme, same injectable `summarize`,
   same fallback rules), and `packages/ask/src/{evaluator,router}.ts` reproduce
   `ask_router/{evaluator,router}.py` (same thresholds/kwargs, `(score, reason)` normalisation,
   `insufficient_coverage`, separate `sources.internal/web`). Each has a test file with **at
   least the same test cases** as the Python originals (4 for tree, 6 for ask) and `pnpm -r test`
   exits 0. Test runner: `node --test` via `tsx` (no new test framework).
4. **Python originals removed after the port lands** (`git mv`'d into `packages/*/src` as `.py`
   is NOT acceptable — they are deleted once the TS tests pass; the git history keeps them).
   `schema/` stays in Python for `validate.py` (it is the schema validator, not app logic) and
   `python schema/validate.py` still exits 0.
5. **Generated types, not hand-written:** `packages/core/src/generated/<collection>.ts` produced by
   `json-schema-to-typescript` from `schema/*.schema.json` via a root script `pnpm gen:types`; a
   check `pnpm gen:types --check` (or equivalent diff) proves committed output matches the schemas.
   No hand-typed interface duplicates a schema field list anywhere in `packages/`.
6. **Data moved out of the code tree:** `TOC/` → `raw/TOC/` (git mv); `whatsapp_msg/` → `sources/
   whatsapp_msg/` as a **git submodule** pointing at its existing repo (its own `.git`, ARCHITECTURE,
   DECISIONS untouched); root `.gitignore` updated for the new paths; no path in the repo still
   references `TOC/` or `whatsapp_msg/` at the old locations (grep-checkable: `git grep -n "TOC/"`
   and `git grep -n "whatsapp_msg/"` return only historical mentions in `docs/DECISIONS.md`,
   `qa/verdicts/`, `qa/manifests/`, `goal.md`, and the plan-referencing lines of `.claude/CLAUDE.md`).
7. **Root hygiene:** `ls` at root shows ≤ 15 loose files (directories excluded); the 71 deck
   screenshots stay under `reference/` (already gitignored).
8. **ARCHITECTURE.md ≤ 150 lines** (`wc -l`), with §4's directory map replaced by the D-003 tree
   and §5 carrying the file/dir/dependency budgets — edited under the Changes-authorized grants of
   D-003 (§4, §5) and D-002/D-004/D-005 (§3 H8–H10, §6 Q2/Q4/Q5 closed, Q6 added).
9. **Nothing else changes behaviour:** `python schema/validate.py` exits 0 (9/9); the ask/tree TS
   tests exit 0; no file under `packages/` exceeds 300 LOC (400 for `*.test.ts`) — checked by a
   one-line `find … | xargs wc -l` in the manifest (the real linter is T-017).

## Non-goals for T-016
- No CI workflow, no lint scripts (T-017). No schema changes, no new collections, no migrations
  tool (T-018). No provider code (T-019). No Express routes, no Mongo connection.
