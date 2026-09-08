# Verdict — vector-gap-record

**Contract:** qa/contracts/ingest-indexing-pipeline.md
**Manifest:** qa/manifests/vector-gap-record.md
**Cycle checked:** 1
**Date:** 2026-09-08
**Checker:** Mode A, fresh context, bound to `D:\KnowledgeBase`
**Unit commit:** f8cdfab

## VERDICT: PASS

SCOREBOARD: 8/8 applicable criteria met, 3/3 invariants hold (tenant confinement, schema
additivity, no-regression). ISSUES-WRITTEN: ISS-121 (medium).

## What I re-ran myself (nothing below is the maker's pasted output)

| Command | Result |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | exit 0 — `apps/api` **128/128**, `packages/db` **14/14** (matches the manifest) |
| `python schema/validate.py` | exit 0 — `PASS: 24 collection schema(s)` |
| `pnpm gen:types` then `git status --porcelain packages/core/src/generated schema` | **empty** — regenerated output is byte-identical to what was committed |
| `node scripts/lint-{loc,dirsize,root,dupes,migrations}.mjs`, `scripts/snapshot.mjs --check` | each exit 0 individually (ISS-100) |
| `npx depcruise --config .dependency-cruiser.cjs packages apps workers` | `✔ no dependency violations found (281 modules, 855 dependencies cruised)` — the `no-circular` violation is genuinely gone |
| `pnpm lint:structure` | exit 1 — **solely** `tracker-audit --gate G1`, both lines naming **U2.4** (the other lane's ISS-117). Not attributable to this unit. |

## Press point 1 — `tenantScope.updateOne` gained `options` (attacked, not read)

I did not trust the maker's test. I mutated the helper to skip the tenant merge **only on the
upsert path** — the precise defect the widened signature makes possible:

```
raw.updateOne(options?.upsert ? filter : withTenant<T>(tenantId, filter), update, options ?? {})
```

- `packages/db`: **13 pass / 1 fail** — `updateOne's UPSERT still merges the tenantId into the
  filter (ISS-118)`. The maker's test catches exactly this attack and nothing weaker.
- `apps/api` under the same mutation: **126 pass / 2 fail** — defence in depth, the gap tests
  catch it independently.
- Restored via `scripts/lib/mutate.mjs restore` → verified identical to HEAD.

Read confirms it too: the merge is unconditional and `withTenant` spreads `tenantId` last, so a
caller-supplied one still loses (criterion 3a). `raw` stays removed (ISS-065) — the parameter is
options-only and adds no escape hatch. **The upsert path does not create a tenant-less row.**

## Press point 2 — the "no live verification" disclosure: I did the live run

The manifest's own strongest objection is that the gap row had never been written against real
Mongo. Given this project's history (a capability PASSing three times while producing zero real
rows), fixture-only evidence is **not** sufficient here, so I wrote and ran my own script against
the real database (`lkb` at `13.202.206.101:27017` — TCP probe, not ping, which is filtered),
scratch tenants `chk118-a`/`chk118-b`:

```
AFTER-FAIL    [{"_id":"vector-pending:chk118-sess-1","tenantId":"chk118-a","kind":"vector-pending",
               "status":"open","sourceRef":"chk118-sess-1","requestedAt":"2026-09-08T12:16:16.932Z",
               "description":"Session chk118-sess-1 indexed but has no embedding vectors
               (embedding-failed); it is absent from vector search."}]
ASSERT tenantId==A: true | kind: vector-pending | status: open
ASSERT row count still 1 after a re-index: true          <- idempotent by derived _id, live
ASSERT status==received after a later success: true | count 1: true   <- resolves, no stale open gap
ASSERT tenant B (never failed) has NO row: true []       <- success path really does not upsert
ASSERT no tenant-less gap rows anywhere in the collection: true (count 0)
ASSERT schema required present: true missing: [] | kind in enum: true
CLEANUP read back from server: remaining scratch rows = 0
```

**A real `vector-pending` row now demonstrably exists in production Mongo's shape.** Every claim
in the manifest's mutation section reproduces, and the disclosure is retired rather than accepted.

## Press point 3 — `GET /gaps` + Dashboard end to end

Verified both by read and live. `apps/api/src/store.ts:108` is `gapsColl(tenantId).find({})` — no
`kind` filter anywhere; `routes/brain.ts:50` returns it verbatim; `DashboardPage.tsx:102` and
`routes/pages.ts:237` render `g.kind` as free text with no allowlist that could drop a new kind.
Live, through the **real** `gaps(tenantId)` accessor the route uses:

```
GET /gaps (tenant A) -> [{"_id":"vector-pending:chk118-sess-1","tenantId":"chk118-a",
                          "kind":"vector-pending","status":"open", ...}]
GET /gaps (tenant B, must NOT see A's row) -> []
```

## Press point 4 — the 5-file relocation

Behaviour-preserving. `git show -M` renders both moves as renames (`indexing.ts → indexing/
session.ts`, 95% similarity; `indexing.test.ts → indexing/session.test.ts`), so history is
preserved. The only semantic deltas in `session.ts` are the type definitions moving to `types.ts`
and **being re-exported from `session.ts`** (`export type { IndexEmbedFn, ChunkSkipReason,
ChunkWriteResult, IndexSessionResult }`), so no importer loses a symbol; all three call sites
(`ingest-store.ts`, `whatsapp-store.ts`, `production.ts`) are import-path-only edits. Nothing was
silently dropped. `depcruise` confirms the cycle is really broken, not suppressed.

The dirsize claim holds and **no budget override was added**: `structure.config.json` still reads
`{"maxFiles":30,"overrides":{"scripts":32}}`, unchanged by f8cdfab (the `scripts` override predates
it, commit 36d0496), and `apps/api/src` now holds **28** files. The consolidation, not a fourth
raise — D-018's own recorded bound respected.

## Press point 5 — schema + generated types

`schema/gaps.schema.json`'s only change is `enum: [... , "vector-pending"]` plus a description.
Strictly **additive** — no field added, removed, or made required, both existing kinds untouched,
`required` unchanged. `pnpm gen:types` re-run produced **no diff** against the committed
`packages/core/src/generated/gaps.ts`, and `python schema/validate.py` passes 24 collections. The
live row validates against the schema's `required` set and its `kind` is in the enum.

## Additional mutations I ran

| Mutation | Result |
|---|---|
| `if (chunks.skipped)` → `if (false)` in `vector-gap.ts` | 126 pass / **2 fail** |
| delete the `await recordVectorGap(...)` line from `indexSession` | 124 pass / **4 fail** |

Both restored via the guard; `mutate.mjs assert-clean` → `MUTATIONS CLEAN: none outstanding`, and
`git status --porcelain` shows only the other lane's `.goal/goal.json`. **ISS-118's actual
complaint — that the operator surface could be deleted in silence — is closed: it now reddens
tests from two independent directions.** ISS-118 → `fixed`.

## Finding — ISS-121 (medium; not a criterion failure)

The gap `_id` is `vector-pending:<sessionId>`, globally unique in `gaps` while the *filter* is
tenant-merged. Live-reproduced: tenant B upserting a gap for a sessionId tenant A already holds
gets `E11000 duplicate key error collection: lkb.gaps index: _id_ dup key`. **Tenant isolation
holds** — A's row stayed A's, B created nothing, zero tenant-less rows — so this is availability,
not disclosure, which is why it is not a FAIL. But it is reachable, not theoretical:
`whatsapp-store.ts:132` sets `sessionId = source._id`, a sha256 of `(groupJid, ownerUserId)` with
no tenant in it. The throw escapes `recordVectorGap`, and `session.ts` places that call **before**
the `tree_index` update and the `status.index` flip, so the affected session stays `"pending"`
forever while ingest still returns 201. One-line fix available (namespace the id by tenant). Filed
medium per the severity gate; verify inside the next unit touching this file.

## Notes (not failures)

- The success path issues an `updateOne` on `gaps` on **every** successful index, even for
  sessions that never failed. It is correctly non-upserting so it writes nothing, but it is one
  extra round-trip per index. Cost note only.
- `recordVectorGap`'s `$set` includes `tenantId` redundantly (the accessor already merges it into
  the filter). Harmless, and `assertUpdateBodyConfined` pins that it can never be a *different*
  tenant — including via `$unset` (ISS-066). Good defensive shape.
- `pnpm lint:structure` is red only on `tracker-audit --gate G1`, both lines about U2.4. I
  confirmed this is the other lane's ISS-117/ISS-120 and left every file that lane owns untouched.

---

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 3/3 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-121
EXPLANATION: Re-ran every verify command myself: typecheck, tests (api 128/128, db 14/14), schema
validate, gen:types (no diff), each structure gate individually, depcruise clean. Attacked the
widened tenantScope.updateOne by mutating the merge to be skipped ONLY on the upsert path — the
maker's dedicated test caught exactly that, and the api suite caught it independently. Retired the
manifest's two live-verification disclosures rather than accepting them: my own script wrote a real
vector-pending gap row to production Mongo (scratch tenants), proved idempotence, resolution, the
no-upsert-on-success guarantee, schema validity and the real GET /gaps read path, then cleaned up
and read the cleanup back. The relocation is a genuine rename with all types re-exported, the cycle
is really broken, and apps/api/src came off 30/30 by consolidation with no budget override added.
One medium finding (ISS-121): the gap _id is not tenant-namespaced, which is an availability bug,
not a disclosure — isolation held under a live cross-tenant attack.
```
