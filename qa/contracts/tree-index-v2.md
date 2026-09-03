# Contract — tree-index-v2 (T-004b)

> Ground truth for extending T-004's tree-index generator with topic/speaker child nodes and
> incremental regeneration, per plan §5 Phase 1b and ARCHITECTURE §H1. Drafted by the maker;
> /checker adopts or amends on first check. Uses T-002's real migrated data
> (`data/toc-migrated/*/session_page.json`) as its input fixture — the first time a `packages/`
> unit is tested against real content instead of synthetic fixtures.

## Scope
Extend `packages/index/src/tree/build.ts` (T-004/T-016) so each session leaf also gets **topic**
and **org** child nodes (speaker nodes deferred — T-002's turns are honestly `speakerRef: unknown`,
no diarization yet, so a speaker-node tree would be built on fake identity; do this properly once
T-003 unblocks). Add `regenerate(tree, changedSessionIds, sessions, pages)` for incremental
updates (rebuild only the affected month/topic subtrees, not the whole tree) — the "regenerate
before you can ship" requirement ARCHITECTURE §5 already established for SNAPSHOT.md, now applied
to the tree index itself.

## Criteria (each machine-checkable)

1. **Topic/org extraction**: `packages/index/src/tree/extract-topics.ts` — a pure function
   `extractTopicRefs(sessionPage): string[]` reading `session_page.json`'s existing content (the
   `keyInsights`/`summary` fields T-002 populated) via a simple keyword/noun-phrase heuristic (no
   LLM call required to PASS — same "injectable, real-by-default-but-fakeable" pattern as every
   prior unit; an LLM-based version is an optional injected `extractFn` override, tested with a
   fake, default is the heuristic). Real output on T-002's actual data, not a stub returning `[]`.
2. **Tree gains topic/org levels**: `buildTree` (T-004, extended not replaced) nests
   `session → topic → (leaf reference back to the session, since a topic can span sessions)` and
   `session → org` similarly, using T-018's `topics`/`orgs` collection shapes for the node ids.
   Existing T-004 test cases (4 original + T-016's port) still pass unchanged — this is additive.
3. **`regenerate(tree, changedSessionIds, sessions, pages): TreeIndexNode`** in
   `packages/index/src/tree/regenerate.ts` — walks only the year/month/topic subtrees touched by
   `changedSessionIds`, leaves everything else in `tree` byte-identical (test: regenerating with
   one changed session out of N must produce a result where the untouched N-1 session subtrees are
   `===`-comparable/deep-equal to the input, not rebuilt from scratch).
4. **Real integration test**: a test in `packages/index/src/tree/*.test.ts` loads **actual**
   `data/toc-migrated/*/session.json` + `session_page.json` files (all 23, via `node:fs`, no
   network) and builds a real tree — asserts the tree has 23 session leaves, at least one topic
   node with more than one session reference (proving cross-session topic grouping works on real
   content), and that `python schema/validate.py`-style validation of the tree's node shape
   against `schema/tree_index.schema.json` (T-004) still passes on this real-data tree.
5. **No regression:** `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-004b
- No speaker nodes (honest deferral — needs T-003's real diarization first, currently blocked on
  ISS-015). No live Mongo write of the tree (still an in-memory structure, DB-backed tree storage
  is a later unit). No wiring into `apps/api`'s `/ask` route (that already has a working, simpler
  tree via T-009 — swapping in the v2 tree is a follow-up once this unit proves the extension).

## Amendment log
- 2026-09-03 · routine · adopted as maker-drafted (checker's first check on this contract; content
  verified faithful to plan §5 Phase 1b / ARCHITECTURE §H1, no changes needed to adopt) · C3's
  literal wording ("leaves everything else in `tree` byte-identical", tested via the
  untouched-subtree `===`/deep-equal case) requires only untouched-subtree preservation, not
  session year-migration cleanup or cross-year topic-evidence refresh — `regenerate.ts`'s two
  disclosed scope limitations are honest out-of-scope edge cases, not C3 violations. Follow-up
  queued: **T-004c — handle session year-migration cleanup and cross-year topic-evidence refresh
  in `regenerate()`**, low urgency now (T-002's 23 sessions are all in year 2026, so neither edge
  case is reachable yet), revisit when a second year of real sessions exists.
