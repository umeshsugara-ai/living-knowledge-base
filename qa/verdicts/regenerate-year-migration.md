# Verdict — regenerate-year-migration (T-004c)

**Result: PASS**

Contract: `qa/contracts/regenerate-year-migration.md`
Manifest: `qa/manifests/regenerate-year-migration.md`
Commit checked: `8ae94f4d0d6a4a2eef9821b777cbd6842e8759b0`
Checker run: fresh shell, `cd /d/KnowledgeBase`, git-bash, independently re-executed — nothing
taken from the manifest's pasted output.

## Diff scope (git show 8ae94f4 --stat)
Matches the manifest's file list exactly:
`packages/index/src/tree/build.ts`, `packages/index/src/tree/regenerate.ts`,
`packages/index/src/tree/regenerate.test.ts`, `qa/contracts/regenerate-year-migration.md`,
`qa/manifests/regenerate-year-migration.md`. No other files touched.

`git show 8ae94f4 -- packages/index/src/tree/tree.test.ts packages/index/src/tree/tree-real-data.test.ts`
produced **no output** — confirms these two pre-existing test files are byte-identical, untouched
by the commit.

## Criterion 1 — Old-year cleanup
Read `packages/index/src/tree/regenerate.ts:40-49` (`findExistingYear`) and `:51-85`
(`regenerate`). Confirmed:
- `findExistingYear` genuinely scans the **input `tree`** (year → month → session nodes), not the
  `sessions` array, matching `node_id.endsWith(`/session:${sessionId}`)`.
- For every `changedSessionIds` entry, `findExistingYear(tree, id)`'s result (if found) is added
  to `touchedYears` unconditionally — independent of whether any other changed session shares that
  year. This is the core claim.
- Test `T-004c C1: a session that moved year is cleaned up from its old year...` (regenerate.test.ts:83-102):
  a single session moves 2026→2027 with no other changed session in 2026. Asserts
  `year2026 === undefined` (2026, having only the moved session, vanishes entirely from
  `result.children`) and the session is present under 2027. This exactly proves the "entirely
  absent if no other sessions" branch.
- Test `T-004c C1: old year survives...` (regenerate.test.ts:104-122): a second session (`sessStays`)
  remains in 2026. After the move, 2026 survives (rebuilt), `sessStays` is still present, and the
  moved session is gone from 2026 — proving the "old year survives if other sessions remain" branch.
- Re-ran: both tests pass (see full suite output below).

## Criterion 2 — `buildTree` gains `topicContextSessions?: Sessions[]`
Read `packages/index/src/tree/build.ts:64-140`. Confirmed:
- 5th positional param, after `extractFn`, `topicContextSessions: Sessions[] = sessions` (line 66).
- Pass 1 (lines 70-86, the cross-session topic-sharing map `topicSessionIds`/`topicDisplayName`)
  iterates `topicContextSessions`.
- Pass 2 (lines 88-137, actual year/month/session/topic/org node construction) iterates `sessions`
  only — unchanged.
- Default `= sessions` means every call site that omits the 5th arg is behaviorally identical to
  pre-T-004c.
- `git show 8ae94f4 -- packages/index/src/tree/tree.test.ts packages/index/src/tree/tree-real-data.test.ts`
  returned no diff (see above) — the 5 pre-existing tests are unmodified and (per the fresh test run
  below) all still pass: `real T-002 data...`, `grouping and nesting`, `evidence on every session
  node`, `tree_search known and unknown`, `summarize injection and fallback`.

## Criterion 3 — `regenerate()` passes full tenant list as `topicContextSessions`
Read `regenerate.ts:69-76`: `tenantAllSessions` (full tenant session list, not just the
touched-year subset) is computed and passed as the 5th arg to `buildTree` for the touched-year
rebuild.
- Test `T-004c C3: a touched year's topic node picks up cross-year sessionRefs from an untouched
  year` (regenerate.test.ts:124-152): two years (2026, 2027) share a "New Zealand" topic via
  `s2026`/`s2027`. Only `s2026` (year 2026) is retitled/touched. After `regenerate`:
  - the rebuilt 2026 topic node's `evidence.sessionRefs` includes `"s2027"` (the untouched year's
    session id) — proves cross-year sessionRefs propagation into the touched year.
  - `year2027 === original.children.find(y => y.title === "2027")` (strict `===`) — proves the
    untouched year is genuinely NOT rebuilt, `===`-preserved.
  This is a legitimate proof of criterion 3, not just a shape check.

## Non-goal legitimacy
The "untouched years' own topic nodes don't refresh" limitation is stated in the contract's
**Non-goals** section (lines 52-56) and mirrored in the module docblock
(`regenerate.ts:20-23`) and `build.ts:21-26` comments, written before/alongside the code, with
technical justification (rebuilding untouched years would break the `===`-preservation guarantee
that is the entire point of incremental regeneration). This reads as a deliberate, disclosed scope
boundary, not a post-hoc excuse — accepted as-is.

## Criterion 4 — No regression (fresh re-run, this checker's own shell)

```
$ pnpm -r typecheck
Scope: 9 of 10 workspace projects
... all typecheck: Done (packages/core, db, ai, index, ask, ingest, apps/api, meeting-bot)

$ pnpm --filter @lkb/index test
✔ regenerate rebuilds the touched year to reflect the session change
✔ regenerate keeps an untouched year's subtree === to the input (different years)
✔ regenerate is a no-op when changedSessionIds don't touch this tenant's tree
✔ T-004c C1: a session that moved year is cleaned up from its old year, present in the new one
✔ T-004c C1: old year survives (rebuilt, not vanished) when it still has other sessions
✔ T-004c C3: a touched year's topic node picks up cross-year sessionRefs from an untouched year
✔ real T-002 data: 23 session leaves, cross-session topic, schema-valid shape
✔ grouping and nesting
✔ evidence on every session node
✔ tree_search known and unknown
✔ summarize injection and fallback
tests 11 / pass 11 / fail 0

$ pnpm -r test
All suites green: packages/ai 23, packages/index 11, packages/ask 21, packages/ingest 18,
packages/meeting-bot 20, apps/api 18 — matches manifest's per-package counts exactly.

$ pnpm gen:types --check
OK: 21 generated type file(s) + index.ts match schema/

$ python schema/validate.py
PASS: 21 collection schema(s) validated correctly.

$ pnpm lint:structure
lint-loc: OK (114 file(s) within budget)
lint-dirsize: OK (56 dir(s) within budget)
lint-root: OK (13 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (163 unique export(s), 21 unique schema $id(s))
lint-migrations: OK (664 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (109 lines, budget 200)
✔ no dependency violations found (127 modules, 345 dependencies cruised)
```

(lint-migrations file count 664 vs manifest's 663 — one more file scanned since the manifest was
written, unrelated to this unit's scope; not a regression.)

## Verdict
All 4 criteria independently verified against fresh command output and direct source reading.
**PASS.**

## Note on working tree at check time
`.goal/goal.json` and `qa/.last-tick` showed as modified (uncommitted) at the start of this check —
attributed to a concurrent checker-sweep process per this unit's instructions; left untouched by
this verdict's commit.
