# Verdict — orphaned-scratch-tenant-cleanup

**Contract:** qa/contracts/ingest-indexing-pipeline.md (data-hygiene housekeeping; no criterion
changes)
**Manifest:** qa/manifests/orphaned-scratch-tenant-cleanup.md
**Date:** 2026-09-07
**Cycle checked:** 1
**Checked by:** /checker, Mode A unit check, fresh context, bound to `D:/KnowledgeBase`

```
VERDICT: PASS
SCOREBOARD: 3/3 checks met (filed-evidence match, zero code/schema diff, live re-query)
FAILURES: none
ISSUES-CLOSED: ISS-067 (open -> fixed)
EXPLANATION: Independently confirmed the two node_ids/_ids named in ISS-067's original filing
match this manifest's claimed delete targets exactly. Confirmed via `git status`/`git diff` that
no tracked code or schema file changed - only ledger/bookkeeping files (.goal/goal.json,
qa/.last-tick, qa/evidence/.../preflight.json) plus the new manifest itself. Connected to live
production Mongo myself with a fresh throwaway read-only script (not the manifest's script) and
confirmed: tree_index has exactly 1 document total, node_id=tenant:toc (the real tenant, same
_id as recorded in the prior tree-index-tenant-id-migration verdict); zero documents match
/^tenant:chk060-A-/; and zero documents with tenantId in
[chk060-A-aa9c3020, chk060-A-fc1ebd22] exist in sessions, claims, turns, session_pages, or
sources. Temp script deleted immediately after use, nothing left behind.
```

## What I independently verified

1. **ISS-067 filed evidence vs. manifest's claimed delete targets.** Read `qa/issues.jsonl`
   directly:
   ```
   ISS-067: node_id=tenant:chk060-A-aa9c3020 _id=6a9ea31c8dfa86dc4dd2d2dd
            node_id=tenant:chk060-A-fc1ebd22 _id=6a9ea3288dfa86dc4dd2d35d
   ```
   These match the manifest's "before" block exactly (same `_id`s, same `node_id`s, same
   `tenantId` values). No discrepancy.

2. **Zero tracked code/schema diff.** Ran at repo root:
   ```
   $ git status --porcelain=v1
    M .goal/goal.json
    M qa/.last-tick
    M qa/evidence/live-2026-09-07-01-58-41/preflight.json
   ?? qa/manifests/orphaned-scratch-tenant-cleanup.md
   $ git diff --stat
    .goal/goal.json |  8 ++++----
    qa/.last-tick   | 16 ++++++++++++++++
    2 files changed, 20 insertions(+), 4 deletions(-)
   ```
   Only repo bookkeeping (goal tracker, tick file, evidence snapshot) plus the new manifest — no
   `apps/`, `packages/`, `schema/`, or `migrations/` file touched. Confirms this was a pure
   data-plane operation as claimed.

3. **Live re-query of production Mongo, own script, read-only.** Wrote
   `apps/api/src/_temp-checker-verify-iss067.mjs`, ran `npx tsx apps/api/src/_temp-checker-verify-iss067.mjs`
   against `mongodb://13.202.206.101:27017` db `lkb`:
   ```
   tree_index scratch-tenant count: 0
   tree_index total count: 1
   tree_index doc: node_id= tenant:toc _id= 6a9d7b9033ea455b49422cb8
   sessions scratch-tenant count: 0
   claims scratch-tenant count: 0
   turns scratch-tenant count: 0
   session_pages scratch-tenant count: 0
   sources scratch-tenant count: 0
   ```
   All 5 collections (`sessions`, `claims`, `turns`, `session_pages`, `sources`) return 0 for both
   scratch tenant ids. `tree_index` holds exactly one document, and it is the real `toc` tenant's
   root (same `_id` as recorded independently in the prior `tree-index-tenant-id-migration`
   verdict, `6a9d7b9033ea455b49422cb8`) — not a coincidental match. Deleted the temp script
   immediately after (`rm apps/api/src/_temp-checker-verify-iss067.mjs`); confirmed no `_temp*`
   files remain in `apps/api/src/`.

## Ledger

`ISS-067` flipped `open -> fixed` in `qa/issues.jsonl`, `fixed_date: "2026-09-07"`, citing this
manifest and verdict as evidence. Manifest's own `Status:` line flipped `ready-for-check ->
checked-PASS`.

## Judgment

This is exactly the surgical, evidence-matched, reversibility-acknowledged delete the manifest
claimed: no pattern-wide delete, pre-delete tenantId assertion described, exact `_id`s recovered
matching the original filing, and — independently, from this checker's own fresh connection —
zero collateral damage across every collection that could plausibly have been touched by the
original scratch two-tenant proof. No findings. PASS.
