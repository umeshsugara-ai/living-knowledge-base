# Verdict — search-store-tenant-assertion

**VERDICT: PASS**

**Cycle checked:** 1
**Date:** 2026-09-08
**Contract:** qa/contracts/search-route.md ([I6], extended to the `tenantId` half of the filter object)
**Manifest:** qa/manifests/search-store-tenant-assertion.md

```
VERDICT: PASS
SCOREBOARD: 8/8 new tests real and discriminating, 5/5 documented mutations now caught, 3/3 sixth-bypass candidates from the manifest caught, standard build gates 4/4 green
FAILURES: none
ISSUES-WRITTEN: ISS-083, ISS-084 (both new, medium, non-blocking — see below)
EXPLANATION: The fake now genuinely filters find/findOne on tenantId/_id/$or (confirmed by reading
matches()), the corpus carries a second tenant sharing the query term "2026", and all five
previously-undetected mutations (5A tenant-scope removal, 5B k ignored, 5C wrong session, 5D wrong
turn, 5F dedup removed) are independently reproduced as caught, each via a diff-confirmed,
byte-restored mutation. The three sixth-bypass candidates the manifest itself suggested (sessions-
handle scope removal, same-tenant cross-session mixup) plus a fourth I added (score corruption) and
a fifth (coordinated id/score rotation) were tried: sessions-handle removal and the cross-session
mixup are both caught by the existing assertions; score corruption and the id/score rotation are NOT
caught and are filed as ISS-083/ISS-084 (medium, non-blocking — same-tenant relevance-integrity
defects, no cross-tenant disclosure, and outside this unit's declared scope of ISS-078/079/080).
Full build gates all green: 107/107 api, 59/59 index, typecheck exit 0 (10 projects), lint:structure
clean. Live parity against real production Mongo (tenant toc, 3 queries, 15 hits) reproduced
independently: 100% tenant-scoped.
```

## What I re-ran myself (Mode A discipline — nothing pasted was trusted)

### 1. Fake genuinely filters (not just records)
Read `apps/api/src/search-store.test.ts`. `matches(filter, doc)` (lines 56-62) checks `tenantId`,
`_id`, and `$or` (via the already-shipped `prefilterMatches`) and both `find`/`findOne` route every
row through it (lines 69-76) rather than returning the corpus unconditionally. Corpus (`SESSIONS`,
`CORPUS`) carries a second tenant `"other"` (`s9`/`t9`) sharing the query term `"2026"` with tenant
`"toc"` — confirmed by inspection and by the passing "no other tenant's turn or session can ever be
returned" test, which asserts against `t9`/`s9` by name.

### 2. Replayed all five documented mutations against `search-store.ts`
Each mutation: backup taken first, `diff` confirmed the file genuinely changed, full suite run,
restored, `diff` confirmed byte-identical restoration, SHA256 re-confirmed identical
(`92370fdaa32854d02a5459a4bc9e8f1de3b5cd871ecd06f85e239de874747948` before and after every cycle),
8/8 new tests + full 107/107 suite reconfirmed green before moving to the next mutation.

| # | Mutation | Result this cycle |
|---|---|---|
| 5A | `scopedCollection` removed from turns handle | 103/107 (4 new-file tests red: tenant-confined, no-cross-tenant-leak, own-turn/session, end-to-end) — matches manifest's claimed "4 pass / 4 fail" exactly |
| 5B | `k` ignored (`turns.length` passed instead) | 106/107 (1 red: k-honoured test) — matches manifest's "7 pass / 1 fail" |
| 5C | every hit given `sessions[0]` | 106/107 (1 red: own-turn/session test, `'s1' !== 's3'`) — matches |
| 5D | every hit given `turns[0]` | 106/107 (1 red: own-turn/session test, `'t1' !== 't4'`) — matches |
| 5F | `Set` dedup removed from `sessionIds` | 106/107 (1 red: session-dedup test, `3 !== 2`) — matches |

All five now caught, exactly as the manifest claims.

### 3. Sixth-bypass hunt (PRIMARY ASK)

Tried the manifest's three named candidates plus two of my own:

1. **Sessions-handle `scopedCollection` removal** (candidate 1) — CAUGHT. 106/107, the tenant-
   confined test fails with `sessions.findOne issued a query with no tenantId`. `assertAllCallsConfined`
   checks every call regardless of collection name, so this is not a coverage gap.
2. **Score corruption while keeping turnId/sessionId correct** (candidate 2) — **NOT CAUGHT.**
   Changed `score: hit.score,` to `score: 0.5,` in `search-store.ts:78`. Full suite stayed
   **107/107 green.** Grepped every test file for `.score` assertions against a returned `SearchHit`:
   the only occurrence (`search-store.test.ts:139`) reads `hit.score` from `lexicalSearchTurns`'
   own output inside an assertion *message string*, never asserting the store's returned value.
   Filed as **ISS-083 (medium)**.
3. **Same-tenant cross-session mixup** (candidate 3) — CAUGHT. Rotated the `sessionById` map by one
   position (`s1`/`s3` swap for hits in the same tenant); 106/107, the own-turn/session test fails
   with `'s3' !== 's1'`.
4. **(My own) coordinated id/score rotation** — **NOT CAUGHT.** Rotated `turnId`/`sessionId`/`turn`/
   `session` together across hit positions while keeping each hit internally self-consistent (its
   own `turn._id === turnId`, `session._id === sessionId`) and keeping the original `score` at each
   position. This means a hit's reported content no longer matches what was actually scored at that
   rank, while every existing assertion (which only checks internal self-consistency, never cross-
   checks against `lexicalSearchTurns`' actual turnId/score pairing) still passes. Full suite:
   **107/107 green.** The single-hit end-to-end test is rotation-invariant for a 1-element array and
   cannot see this. Filed as **ISS-084 (medium)**.

Both new findings are **same-tenant relevance-integrity defects, not cross-tenant disclosures** —
judged medium, not high, on their own merits (no live security implication; a future consumer that
trusts the returned score or assumes rank-content fidelity, e.g. the named U1.5 hybrid-merge unit,
would silently get wrong answers). Neither is in this unit's declared scope (ISS-078/079/080), so
neither blocks this PASS — they are new coverage gaps for a future unit, exactly the role ISS-081/082
already play in this contract's amendment history.

### 4. Standard build gates — all re-derived, not pasted
- `pnpm --filter @lkb/api test`: **107/107** (99 pre-existing + 8 new, replacing the prior file's 3 — matches manifest).
- `pnpm --filter @lkb/index test`: **59/59**, untouched.
- `pnpm -r typecheck`: exit 0, all 10 workspace projects.
- `pnpm lint:structure`: clean (0 dependency violations / 264 modules, SNAPSHOT fresh at 116 lines, tracker-audit G1 OK).

### 5. Live Mongo parity — reproduced independently, not pasted
Read `.env` for `MONGODB_URL` (`13.202.206.101:27017`) and confirmed the db name (`lkb`) from
`apps/api/src/index.ts:20`. TCP reachability confirmed via a real `mongodb` driver connect+ping.
Wrote a throwaway script (`apps/api/src/_temp-check.mjs`, deleted immediately after) exercising the
real un-injected `getDb()` path (read-only `find`/`findOne` only, no writes) against tenant `toc`
for 3 queries (`"visa student university funding"`, `"AI in counselling"`, `"2026 intake"`):

```
visa student university funding -> 5 hits, all tenant toc: true
AI in counselling -> 5 hits, all tenant toc: true
2026 intake -> 5 hits, all tenant toc: true
```

All 15 returned hits' `turn.tenantId` and `session.tenantId` equal `"toc"` — genuinely tenant-scoped
against real production data, not merely against the fixture.

## Judgment on item 5 — `assertAllCallsConfined` reuse

**Not quite what the manifest claims, but the right call in substance.** The manifest's language
("reusing indexing.test.ts's existing assertAllCallsConfined helper... rather than reinventing it",
"copied rather than reinvented") overstates what happened: `search-store.test.ts`'s version
(lines 84-92) is a **new, smaller function** — it checks only `call.filter.tenantId === tenantId`
over `find`/`findOne` calls, with none of `indexing.test.ts`'s write-op handling (`$unset`,
`docs`, the `tree_index` special-case for its root-document convention). It shares a name and the
core idea, not an implementation — it was not literally copied. That said, the *decision* is sound:
the two call shapes genuinely differ (search-store is read-only; indexSession performs multi-
collection writes), so a single shared function would either need write-handling branches the
read-only caller never exercises, or a config object to suppress them — added complexity for two
current call sites and marginal duplication (9 lines). I would not block on this, but the manifest's
own doc comment overclaims what it did; a one-line correction ("same name and idea, not the same
function") would be honest bookkeeping. Not worth a third instance appearing before extracting a
shared `qa`-style test-helpers module — recommend revisiting only if a third caller needs the same
assertion shape.

## Ledger

Closed (this cycle, per manifest instruction, backed by the mutation replays above): **ISS-078**,
**ISS-079**, **ISS-080** — `status: fixed`, `fixed_date: 2026-09-08`.

New findings from the sixth-bypass hunt: **ISS-083** (score value unasserted, medium), **ISS-084**
(coordinated id/score rotation undetected because existing assertions only check internal self-
consistency, medium). Both `status: open`.

Untouched: ISS-073, ISS-081, ISS-082 (as instructed).

## Goal wiring

`.goal/goal.json` has no matching task for this unit slug — no `goal_cli.py done` call made (skip
condition met, per checker/SKILL.md's "idempotent; skip if no matching task").
