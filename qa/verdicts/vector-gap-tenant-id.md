# Verdict — vector-gap-tenant-id

**Date:** 2026-09-08
**Contract:** qa/contracts/ingest-indexing-pipeline.md
**Manifest:** qa/manifests/vector-gap-tenant-id.md
**Cycle checked:** 1
**Mode:** A (unit check), bound to `D:\KnowledgeBase`
**Checked at commit:** `07a6f04` (working tree carried only the other lane's `.goal/goal.json`)

```
VERDICT: PASS
SCOREBOARD: 11/11 criteria met, 0/0 invariants hold (this contract declares no [I*] section)
FAILURES: none
ISSUES-WRITTEN: ISS-122
```

---

## What I re-ran myself (nothing below is the maker's pasted output)

| Check | My result |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | exit 0 · `apps/api` **130 pass / 0 fail** |
| `python schema/validate.py` | exit 0 |
| `lint-loc` / `lint-dirsize` / `lint-root` / `lint-dupes` / `lint-migrations` | 0 / 0 / 0 / 0 / 0 |
| `snapshot.mjs --check` | exit 0 |
| `depcruise` | exit 0 |
| `tracker-audit --gate g1` | 2 findings, **both on the other lane's `U2.4`** (ISS-117) — not this unit's, as disclosed |
| `mutate.mjs assert-clean` (before and after every mutation) | `MUTATIONS CLEAN: none outstanding` |

All mutations were armed and restored through `scripts/lib/mutate.mjs`; the file was verified
byte-identical to HEAD after each one.

### Mutation 1 — drop `${tenantId}` from `vectorGapId`
`tsc` exit 0, **128 pass / 2 fail**. The guard is load-bearing and the compiler cannot see it.

### Mutation 2 — rethrow from the catch
**129 pass / 1 fail**, failing exactly:
```
✖ ISS-121: a FAILING gap write must not strand the session — the tree and status flip still run
  Error: E11000 duplicate key
```

### Mutation 3 (mine, not the manifest's) — empty the catch body
See the ruling on disclosure #3 below. **130 pass / 0 fail**, `tsc` exit 0.

---

## Disclosure #1 — the exploding-collection fixture. **Re-derived; it is genuine.**

The manifest asked me not to take mutation 2 on faith. I did not.

The concern with `{ ...real, updateOne: throw }` is that the test could pass because the gaps
write is never reached at all — the assertions only check that `tree_index` and `sessions` were
written, which a fixture that quietly bypasses `gaps` would also satisfy.

Mutation 2 settles it, and the *error text* is what settles it. Under the rethrow the test does
not merely fail an assertion — it fails with **`Error: E11000 duplicate key`**, a string that
exists nowhere in this repo except that fixture's own injected `updateOne`. So the exploding
method was invoked, the throw propagated out of `recordVectorGap`, and the catch is the only
thing that stops it. The fixture exercises the intended path. Confirmed.

The spread itself is safe here: `fakeDb`'s `collection()` returns a fresh object literal whose
methods are own enumerable properties, so `{...real}` copies all of them, and the shared `calls`
array is closed over rather than held on the object — which is why `tree_index` and `sessions`
calls are still recorded through the exploding handle.

## Disclosure #2 — live cross-tenant verification. **Done. The fix holds live.**

The manifest's own strongest caveat was that it had verified only at fixture level. I wrote my
own script (never re-ran the maker's; the maker had none for this), using the **real**
`recordVectorGap` and the **real** `scopedCollection` accessor against the real `lkb` database at
`13.202.206.101:27017`. TCP/driver probe, not `ping` (ICMP is filtered on that host — the
contract's "Disclosed limitation" section is measuring the wrong thing and should not be read as
evidence the host is down).

```
PRE  vector-pending rows total=0  legacy(2-part id)=0  tenantless rows=0
PRE  leftovers chk121-*: 0
POST rowsA=1 idA=vector-pending:chk121-a:chk121-sess-1
POST rowsB=1 idB=vector-pending:chk121-b:chk121-sess-1
ISOLATION crossRowsInA=0 crossRowsInB=0
TENANTLESS rows from this run=0
IDEMPOTENT rowsA after re-record=1
RESOLVE statusA=received statusB=open
CLEANUP deleted=2 remaining=0 remainingById=0
POSTCLEAN vector-pending rows total=0
```

Two tenants recording a gap for the **same** `sessionId` each get their own row; neither tenant's
accessor can see the other's; no tenant-less row is produced; the upsert stays idempotent; and
resolving A's gap left B's `open`, so the per-tenant resolution path is intact too.

**I also re-derived the defect on the same live path**, rather than trusting the previous
checker's report of it. With both halves of the fix undone (`mutate.mjs`, restored after), the
identical script reproduced the original failure exactly:

```
E11000 duplicate key error collection: lkb.gaps index: _id_ dup key:
  { _id: "vector-pending:chk121-sess-1" }
  at async recordVectorGap (apps/api/src/indexing/vector-gap.ts:64:7)
```

So the live PASS above is attributable to this unit's change and not to a quiet environment.

Scratch rows were deleted and **the deletion was read back from the server**: `remaining=0`,
`remainingById=0`, and `vector-pending` rows in `gaps` back to `0` total. The one row left behind
by the aborted pre-fix run was located and removed in a separate pass, also read back. The
checker's scratch script was deleted; `git status` shows only the other lane's `.goal/goal.json`.

## Disclosure #4 — "no migration needed". **Verified on the server, not accepted.**

Counted directly against `lkb.gaps` before touching anything: `vector-pending` rows total **0**,
rows matching the legacy two-part id shape `^vector-pending:[^:]+$` **0**, tenant-less rows **0**.
The maker's claim is correct and the previous checker's cleanup did land. Nothing is stranded by
the id change.

---

## Disclosure #3 — the blanket catch. **Ruled: the trade is right. The missing surface is not.**

This is the one the manifest most wanted ruled on rather than assumed, and it deserves both
halves of an answer.

**The trade is correct, and I would keep it.** The two outcomes are not symmetric. A throw out of
`recordVectorGap` leaves the session `status.index: "pending"` forever while `POST /ingest` still
returns 201 (criterion 4 swallows the indexing rejection) — the session is *silently absent from
the index while the API reports success*, which is precisely the ISS-116 state this whole line of
work exists to end. A swallowed error costs one bookkeeping row about a degradation that is still
independently discoverable: `writeSessionChunks` still returns its `ChunkWriteResult`,
`indexSession` still returns it to the caller, and the underlying condition is still visible by
querying `chunks`. Bookkeeping about a degradation must not be able to cause a worse one. It is
the same degrade-safe stance `writeSessionChunks` already takes, and the maker was right to fix
both halves rather than only the id — the id fix alone would have left the *next* unforeseen
write error with identical stranding power.

**But the manifest is also right that this looks safe while hiding the next bug, and I can
measure it.** I replaced the entire catch body with an empty block — deleting the whole
operator-facing surface of a gap-write failure — and got **130 pass / 0 fail** with `tsc` at exit
0. That is byte-for-byte the reproduction ISS-118 used to establish that a `console.warn` is not a
guarantee, now reappearing inside the record-keeper ISS-118 itself introduced. The catch is also
untyped and unfiltered, so it swallows programming errors as readily as Mongo faults.

**Why this is a filed issue and not a FAIL.** No criterion in this contract requires a durable or
tested surface for a *gap-write* failure; criterion 3 governs `indexSession`'s writes and
criterion 4 governs ingest's swallow, and both are met. Failing the unit on a rule that does not
exist would be inventing the criterion and charging the maker for it in the same breath — and the
correct code here is the code that shipped. So: **ISS-122, severity medium**, with a fix direction
that explicitly says *do not remove the catch* and points at the two ways to add the surface
(return whether the bookkeeping landed and assert it against the exploding-collection fixture that
already exists; and/or move the `session.ts:237` call after the tree/status steps so the catch is
defence-in-depth). Under this repo's severity gate a medium is a ledger row verified inside the
next unit touching this file — not a unit of its own, and explicitly not a third round on this
seam.

I considered whether this belongs in the **security class** (never capped). It does not: it is
availability and observability of bookkeeping, with no tenancy, auth, disclosure, or data-loss
consequence — the same grading the previous checker correctly applied to ISS-121 itself.

---

## Criteria

| # | Verdict | Evidence |
|---|---|---|
| 1, 1a | met | `summarize.ts` unchanged by this unit; suite green under my own run |
| 2, 2a | met | `claims.ts`/`session.ts` degradation branches unchanged; suite green |
| 3 | met | `indexSession` still writes pages/claims, updates `tree_index`, flips `status.index`; the stranding test now pins that the last two survive a gap-write fault |
| 3a | met | `gaps` is reached through `scopedCollection`, the id is now tenant-namespaced, and my live two-tenant run showed 0 cross-tenant rows and 0 tenant-less rows |
| 4, 5 | met | ingest/composition roots untouched; suite green |
| 6 | met | typecheck 0, `pnpm -r test` 0, all seven structure gates 0 individually (ISS-100) |
| 7 | met | +2 real tests, both mutation-killable and **failing independently** (2 vs 1) — they pin two distinct defects, not one shared symptom |
| 8 | met (carried) | live Gemini evidence from the contract's own cycle-1 PASS; this unit touches no pipeline function, so I did not re-run it. Stated rather than implied. |

## Issues

- **ISS-121** → `open` → `fixed` (live-verified; a later re-check may move it to `verified`).
- **ISS-122** → new, medium, open. See the ruling above.
- The manifest's claimed `Issues addressed` is honest: ISS-121 is genuinely closed by this unit,
  both the id half and the stranding half.

## Round cap note

This is the **second** PASS on the vector-gap seam (after `vector-gap-record`). Per
`.claude/CLAUDE.md`'s class-based cap, non-security findings on this seam are now at the cap:
ISS-122 is filed and must **not** be promoted into a round-3 unit on its own. It is verified
inside the next unit that touches `vector-gap.ts` for another reason. A security-class finding
here would still be uncapped.
