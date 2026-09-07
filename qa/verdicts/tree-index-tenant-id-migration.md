# Verdict — tree-index-tenant-id-migration

**Contract:** qa/contracts/ingest-indexing-pipeline.md, criterion 3a
**Manifest:** qa/manifests/tree-index-tenant-id-migration.md
**Date:** 2026-09-07
**Cycle checked:** 1
**Checked by:** /checker, Mode A unit check, fresh context, bound to `D:/KnowledgeBase`

```
VERDICT: PASS
SCOREBOARD: 6/6 criteria met, 0/0 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-067
EXPLANATION: Independently re-verified every claim rather than trusting the manifest's pasted
output. Live database read directly (own script): all 3 tree_index documents carry a real
tenantId matching their node_id tenant:<id> prefix. Idempotency confirmed two ways — `npx
migrate-mongo up` reports nothing to do, and re-running the migration's own up(db) logic directly
against the live collection produced a byte-identical snapshot (0 docs touched). Both mutations
reproduced with my own wording (removing the write-boundary stamp in indexing.ts; removing
tenantId from treeIndexRootFilter's return) — each reddened apps/api to 75/77 with exactly the
claimed assertion message, and reverted to a clean 77/77 with a diff-stat identical to the
pre-mutation state. Blast radius confirmed via `git diff --stat`: confined to
schema/tree_index.schema.json + fixture + generated type, build.ts, indexing.ts, store.ts, their
test files, migrations/, docs/SNAPSHOT.md, docs/PROGRESS.md, plus .goal/goal.json and
qa/.last-tick/qa/evidence (repo bookkeeping, not code) — nothing in packages/ask or the
tree-traversal functions (search.ts, flatten-graph.ts, heuristic-retriever.ts). Full suite/
typecheck/schema/gen-types/lint:structure all re-run fresh and clean (344/344, 10 projects, PASS,
OK, OK).
```

## What I re-ran myself (never trusted pasted output)

1. **Live database, read independently.** Wrote my own read-only script (not the manifest's),
   connected to `mongodb://13.202.206.101:27017` db `lkb`, listed all `tree_index` documents:
   ```
   _id=6a9d7b9033ea455b49422cb8 node_id=tenant:toc               tenantId="toc"               MATCH=true
   _id=6a9ea31c8dfa86dc4dd2d2dd node_id=tenant:chk060-A-aa9c3020 tenantId="chk060-A-aa9c3020" MATCH=true
   _id=6a9ea3288dfa86dc4dd2d35d node_id=tenant:chk060-A-fc1ebd22 tenantId="chk060-A-fc1ebd22" MATCH=true
   ```
   All 3 real documents carry `tenantId` matching the `tenant:<id>` prefix inside their `node_id`.

2. **Idempotency, two independent ways.**
   - `npx migrate-mongo up -f migrate-mongo-config.cjs` produced no output (nothing pending —
     already applied per `migrate-mongo status`, which lists all 3 migrations as applied,
     including `20260907140000-tree-index-tenant-id.cjs` at `2026-09-07T16:46:36.042Z`).
   - Wrote my own script that imports the migration file directly and calls its `up(db)` a second
     time against the live collection, snapshotting `tree_index` before and after: 3 docs before,
     3 after, **byte-identical JSON snapshot** — the `$exists:false` guard genuinely touches zero
     documents on a second run, independent of migrate-mongo's own bookkeeping.

3. **Both mutations, reproduced with my own wording, on the real code (not copy-pasted from the
   manifest):**
   - Mutation A — `apps/api/src/indexing.ts`'s `rootDoc` spread stripped of the `tenantId` merge
     (`{ ...newRoot } as TreeIndexRootDocument` instead of `{ ...newRoot, tenantId }`). Ran
     `pnpm --filter @lkb/api test`: **75/77, 2 RED**, exact message `"tree_index.replaceOne wrote
     a root document with no real tenantId field (ISS-062)"`. Reverted; **77/77 clean**.
   - Mutation B — `packages/index/src/tree/build.ts`'s `treeIndexRootFilter` reverted to
     returning only `{ node_id, level }`. Ran the same suite: **75/77, 2 RED**, exact message
     `"tree_index.findOne's filter must match on the real tenantId field too (ISS-062)"`.
     Reverted; **77/77 clean**, and `git diff --stat HEAD` after both reverts matches the
     pre-mutation diff stat exactly (21/+27 line changes on the two files, same as before I
     touched anything).

4. **Blast radius, via `git diff --stat` against HEAD (889310d):** confined to
   `.goal/goal.json`, `apps/api/src/indexing.test.ts`, `apps/api/src/indexing.ts`,
   `apps/api/src/store.ts`, `docs/PROGRESS.md`, `docs/SNAPSHOT.md`,
   `packages/core/src/generated/tree_index.ts`, `packages/index/src/tree/build.ts`,
   `packages/index/src/tree/tree.test.ts`, `qa/.last-tick`,
   `qa/evidence/live-2026-09-07-01-58-41/preflight.json`, `schema/fixtures/tree_index/valid.json`,
   `schema/tree_index.schema.json`, plus new `migrations/20260907140000-tree-index-tenant-id.cjs`
   and `qa/manifests/tree-index-tenant-id-migration.md`. **Nothing in `packages/ask` and nothing
   in the traversal functions this contract explicitly protects** (`search.ts`,
   `flatten-graph.ts`, `heuristic-retriever.ts`, `select-nodes.ts`, `testUtils.ts`) — confirmed by
   their absence from the diff-stat output, not merely by the manifest's assertion.

5. **The naming-split code itself, read directly.** `schema/tree_index.schema.json`'s `allOf`/
   `$defs.node` split, `packages/core/src/generated/tree_index.ts`'s resulting
   `TreeIndexRootDocument = TreeIndexNode & {tenantId: string}`, `build.ts`'s
   `treeIndexRootFilter` doc comment and return value, `indexing.ts`'s `loadTreeRoot` type and the
   `rootDoc` stamp immediately before `replaceOne`, and `store.ts`'s two call sites' generic type
   change — all read in full and consistent with the manifest's description; no discrepancy found.

6. **The fixture gap claim.** `git diff` on `apps/api/src/indexing.test.ts` confirms the fake DB's
   `sessions.find()` previously returned `[]` unconditionally (so `buildTree([], [])` produced no
   root and `replaceOne` never fired for `tree_index` in any existing test) and now returns a real
   `SESSION` object. This is independently corroborated by Mutation A/B above: both mutations'
   assertions fire on `call.docs`/`call.filter` recorded from an actual `replaceOne` call, which
   could only happen if the write path is genuinely exercised — confirming the fix is real, not
   just asserted.

7. **Fresh, independent runs, all clean:**
   - `pnpm -r test`: `packages/core 7, packages/db 8, packages/ai 56, packages/ingest 41,
     packages/index 43, packages/ask 32, packages/meeting-bot 40, apps/api 77, apps/web` (vitest,
     ran clean) — matches the claimed 344/344, 0 fail.
   - `pnpm -r typecheck`: 10 of 11 workspace projects (workers has no typecheck script), all
     `Done`, 0 errors.
   - `python schema/validate.py`: `PASS: 24 collection schema(s) validated correctly`, including
     `tree_index` — valid fixture passes, invalid fixture rejected for 3 reasons (schema
     requirement isolated to `tenantId`, independently confirmed via a standalone `jsonschema`
     check: removing `tenantId` from the valid fixture produces exactly 1 new error,
     `'tenantId' is a required property`).
   - `node scripts/gen-types.mjs --check`: `OK: 24 generated type file(s) + index.ts match
     schema/`.
   - `pnpm lint:structure`: all 7 sub-checks OK, `docs/SNAPSHOT.md` matches a fresh regeneration,
     `depcruise` reports 0 violations.

## Judgment on each item the dispatch asked me to investigate

- **Orphaned scratch-tenant documents (`chk060-A-aa9c3020`, `chk060-A-fc1ebd22`):** confirmed to
  exist, confirmed correctly backfilled with `tenantId` by this migration (it `$set`s any doc
  missing the field regardless of tenant, which is correct — a migration should not silently
  exclude data it doesn't recognize), and **independently confirmed genuinely orphaned**: ran a
  read-only script counting documents for both tenant ids across `sessions`, `claims`, `turns`,
  `session_pages`, `sources` — all zero, in every collection, for both tenants. Only `tree_index`
  still carries rows for them. **Ruling: correctly filed rather than deleted.** A schema-migration
  unit should only ever add/backfill fields, never delete data as a side effect, however clearly
  disposable that data looks — cleanup is a separate, deliberate action. Filed as **ISS-067**
  (severity: low — the leftover rows are harmless and consume no meaningful storage, and this
  unit's migration behaves correctly toward them either way).

- **The pre-existing `indexSession` test-fixture gap** (`replaceOne` never firing before this
  unit): the claim about the PRE-EXISTING state is true — verified via the git diff on
  `indexing.test.ts` and by the mechanics of Mutation A/B both requiring a real `replaceOne` call
  with real doc/filter content to fire before their assertions can even execute. The fix (a real
  session returned by the fake) genuinely closes it — confirmed both mutations now redden as
  designed, which they structurally could not have done under the old fake. This is a real,
  disclosed, non-hidden finding about prior units (ISS-060/ISS-061/ISS-063), consistent with the
  manifest's own framing; no new issue needed beyond what the manifest already discloses, since it
  is retroactive and does not change the verdict on any of those already-PASSed units.

- **`down()` as a deliberate no-op:** the right call, for the stated reason. Application code
  (`treeIndexRootFilter`'s filter, now matched by `loadTreeRoot`/`store.ts`'s two call sites)
  requires `tenantId` to find a tenant's root at all — an automatic `$unset` on rollback would make
  every tenant's tree invisible to the running application, which is a strictly worse failure mode
  than "the schema decoration is still present after a rollback." A real rollback, if ever needed,
  should be its own deliberate commit that reverts the application code in lockstep with the
  schema — exactly what the comment in the migration file says. No finding.

## Contract note

Contract criterion 3a's disclosed interim exception named its first condition ("every `tree_index`
access goes through a single shared filter definition") as already satisfied (ISS-063) and its
underlying schema gap as tracked by ISS-062. This unit closes ISS-062 for real — `tree_index` now
has a real `tenantId` field, enforced by the schema and matched by the filter — which is why I have
flipped ISS-062 `open → fixed` in the ledger with the evidence above (a later re-check, not this
same unit, would be needed to move it to `verified`). Criterion 3a's exception clause itself is not
amended by this verdict — I read it as fully satisfied now (both its named conditions hold, and
the underlying gap the exception was tolerating is closed) but a wording update to reflect that
the exception's *rationale* is now historical rather than current is a routine (tightening/
clarifying) amendment, not required to PASS this unit, and left for a future dispatch or the next
Mode B sweep's contract-staleness check rather than made unilaterally here mid-verdict.
