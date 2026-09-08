# Verdict — promote-tree-entities

**Date:** 2026-09-08
**Manifest:** `qa/manifests/promote-tree-entities.md`
**Contract named:** `qa/contracts/tree-index-v2.md`
**Cycle checked: 1**
**Bound to:** `D:\KnowledgeBase`

## Contract coverage note (read this before the scoreboard)

`qa/contracts/tree-index-v2.md` does **not** cover entity promotion. Its C1–C5 are about
`extract-topics.ts`, `buildTree`'s topic/org node levels, `regenerate()`, a real-data tree
integration test, and the standing no-regression gate. Nothing in it mentions the `topics` or
`orgs` **collections**, `claims.topicRefs`, or a writer. Its own Non-goals section says
"**No live Mongo write of the tree**".

Per the dispatch I therefore judged against **plan §10 U2.1** plus this repo's standing gates.
This is not `CONTRACT_MISMATCH` — the unit is coherent and the tree contract is its upstream —
but the maker should not treat a tree-index-v2 PASS as covering a persistence layer that contract
never described. A promotion contract is owed before U2.2/U2.3 build on this.

Plan §10 U2.1 verbatim, which is the standard applied:

> **U2.1 — Promote `topics` + `orgs` from the tree (no LLM).** Tree topic nodes already carry
> `evidence.sessionRefs`; org nodes come from `session.org`. Write the rows, and backfill
> `claims.topicRefs` (a schema field nothing has ever written). Cheapest real win in Phase 2.

---

## VERDICT: FAIL

**SCOREBOARD: 3/6 U2.1 deliverables met, 5/6 standing gates hold**

Deliverables (plan §10 U2.1): D1 pure promotion from tree nodes ✅ · D2 org promotion ✅ ·
D3 writer wired into `indexSession` ✅ · D4 `topics`/`orgs` rows written ❌ (declined) ·
D5 `claims.topicRefs` backfilled ❌ (declined) · D6 the shipped mechanism evidenced ❌ (untested writer).

Gates: typecheck ✅ · tests ✅ · structure/snapshot ✅ · dep-cruiser ✅ · ISS-056 invariant ✅ ·
mutation coverage of new code ❌.

---

## What I re-ran myself (nothing below is the maker's pasted output)

| Command | My result |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | exit 0 — `@lkb/index` 203/203, `@lkb/api` 130/130 |
| `pnpm lint:structure` | exit 0 — lint-loc/dirsize/root/dupes/migrations all OK, SNAPSHOT.md fresh |
| `npx depcruise` | exit 0 |
| `node scripts/backfill.mjs --dry-run` | `26 session(s) would produce 1452 chunk(s)` — rename intact |
| `node scripts/backfill.mjs entities --dry-run` | `would write: 137 topic(s), 1 org(s)` · `DRY RUN: nothing written` |
| Live Mongo, TCP driver (no ping) | `topics = 0`, `orgs = 0`, `claims = 81`, all 81 `topicRefs` empty/absent |
| Independent walk of the live `tree_index` root | **137 topic slugs · 131 single-session · 6 multi-session · 1 org** |
| The six multi-session slugs | `new-zealand(2) inr(2) toc-s(3) toc(2) amrita-ghulati(2) uk(2)` |
| `extract-topics.ts:24` | `PHRASE_RE` = runs of 1–4 capitalised words — confirmed in source |
| `git log --follow -- scripts/backfill.mjs` | reaches `36d0496`; rename detected, history preserved |
| `git ls-tree 0e4fd53^ apps/api/src/indexing.ts` | **absent** — the stale import was genuinely broken |

`node scripts/lib/mutate.mjs assert-clean` → `MUTATIONS CLEAN` at start and at end. The only
working-tree change I leave behind is nothing; `.goal/goal.json` was already modified by the
concurrent lane and I did not touch it, `TASKS.md`, `qa/.last-tick`, or any `speaker-*` path.

---

## 1. The central judgement — I uphold the refusal to write, and reject the reasoning for it

**The measurement is fully upheld.** Every number is reproducible off the live tree, the six
multi-session slugs are exactly as claimed, three of them are junk, one is a person, and the
root cause is real and structural rather than a tuning knob. Measuring the data before writing
it was the right first move and it is the best thing in this unit.

**But the two arguments the manifest builds on top of that measurement are both wrong, and they
are wrong in a way that would become precedent** (ISS-127):

**(a) The trap-list citation does not apply.** Plan §10 reads: *"Do not chase `media`, `programs`,
`tenants`, `consent_policies`, `features_event`, `watched_sources` to non-empty."* Six collections
are named. `topics` and `orgs` are not among them — and the same section's U2.1 entry instructs
the exact opposite for these two: *"Write the rows, and backfill `claims.topicRefs`."* The manifest
invokes a rule against filling collections to defeat the one instruction that says fill these
collections, and the rule's own text excludes them. This is the part I would not have caught by
accepting a principled-sounding argument, which is why the maker was right to ask.

**(b) The harm model is factually false, and this is the finding that decides the point.**
The manifest's load-bearing claim is *"`topics` is user-facing, and a misfiled person is worse
than a blank page."* It is not user-facing, and the blank page protects nobody:

- `packages/index/src/tree/flatten-graph.ts:66-70` emits a graph node for **every** topic child
  of every session, read **straight off the tree**.
- `apps/api/src/routes/graph.ts` serves that at `GET /graph` (and its own header comment says so:
  "this route reads ONLY `tree_index`… does not read [`topics`], on purpose").
- `apps/web` BrainPage renders `kind: "topic"` nodes from that payload.
- `grep -rn '"topics"' --include=*.ts apps packages` hits exactly two places: the writer this unit
  added, and `packages/db/src/collections/topics.ts`, which nothing calls.

So **`anju-jayraj` and `aastha-chhikara` are already on the user-facing surface today**, via the
Brain explorer, without a single row in `topics`. Withholding the collection does not spare one
user one misfiled person. What withholding actually buys is narrower and worth stating honestly:
it avoids standing up a *second, authoritative* representation of the same noise before U2.2 has
put a precision number on it. That is a defensible reason. It is not the reason given.

**Ruling.** I do **not** order the live write. The precision problem is real, U2.2 exists to
measure it, and a dry-run dump serves as U2.2's fixture just as well as live rows do — so the
refusal costs the roadmap nothing that U2.2 cannot recover. But the unit must be recorded as
**U2.1-partial**, not U2.1, because two of its three named deliverables are declined; and the
manifest's justification must be corrected before it is cited again. If the person-name leak is
judged unacceptable, that is an issue against `extract-topics.ts`/`flatten-graph.ts` — where the
exposure actually is — not a reason to hold back this collection.

## 2. The narrowed test assertion — honest clarification, not a loosening. Proven, not accepted.

The maker asked to be checked here, so I attacked it rather than read it.

The concern would be that narrowing `claimOps` to writes lets a real regression through. It does
not. Mutation: `mutate.mjs apply apps/api/src/indexing/session.ts`, then made the claims insert
conditional on summarize succeeding (`if (!claimsDegraded && !summaryDegraded && …)`) — precisely
the regression the test is named for. Result:

```
✖ a DEGRADED SUMMARIZE run does not take the claims write down with it — the two paths are independent
ℹ fail 1
```

The narrowed assertion still catches its own stated failure. The reasoning in the manifest is
also correct on the merits: a `find` cannot destroy data, and comparing writes keeps the assertion
stable against unrelated reads. **This one is fine — call it a clarification.**

One residual, in EXPLANATION territory rather than a FAIL: `WRITE_OPS` is a hand-maintained
allow-list (`deleteMany, insertMany, insertOne, updateOne, replaceOne`). It omits `deleteOne`,
`updateMany`, `bulkWrite`, `findOneAndDelete`. Today that is harmless because `fakeDb` exposes only
seven methods, so an unlisted destructive op would crash rather than pass silently — but the day
someone adds `deleteOne` to the fake, this assertion goes quiet about it. Worth deriving the set
from the fake's own surface. Not filed as an issue; not reproducible as a defect today.

## 3. ISS-056 invariant — HOLDS, proven by mutation

Mutation: flipped the guard back to unconditional, `{ tagClaims: claimsDegraded === null }` →
`{ tagClaims: true }`. Result:

```
✖ a DEGRADED claims extraction must NOT delete the session's existing claims
  AssertionError: no claims write of any kind may happen on a degraded run
ℹ fail 1
```

The guard is live, the existing test genuinely enforces it, and the maker did **not** weaken it —
it responded by skipping tagging on a degraded run, with the right reason (a degraded run holds
stale claims; tagging them from a fresh tree mixes vintages). Restored and verified identical to
HEAD. This is the system working and it should be said plainly.

## 4. `scripts/backfill.mjs` — rename genuine, repair genuine, blind spot real → ISS-128

Real `git mv` with history preserved (`--follow` reaches `36d0496`; git reports
`scripts/{backfill-chunks.mjs => backfill.mjs}`, 68 insertions / 2 deletions, not add+delete).
The `chunks` path works: 26 sessions / 1452 chunks on my own run. And the maker's claim that
U1.0c had silently broken it is **true** — I confirmed `apps/api/src/indexing.ts` was absent at
`0e4fd53^` while line 46 still imported it, with no `index.ts` barrel to save it.

The blind spot deserves its own issue and I filed one at **high**: `scripts/` has neither a
`typecheck` nor a `test` script, so every `.mjs` under it — including the two that touch
production Mongo — is ungated, and the only reason this break surfaced is that a maker happened
to run it. A spawn-each-script-with-`--dry-run`-and-assert-exit-0 smoke test would have caught it.

## 5. Nothing was written live — confirmed

`topics = 0`, `orgs = 0`, and all **81** claims still carry empty or absent `topicRefs`
(distinct observed shapes: `[]` and absent). The maker's claim is honest. No FAIL here.

## 6. Upsert-never-delete and never-throws — attacked by mutation, and this is what fails the unit

Both are stated as load-bearing design invariants in `apps/api/src/indexing/promote-entities.ts`,
each citing an issue this project already paid for (ISS-056, ISS-121). **Neither is asserted
anywhere.** `grep -rln promoteAndPersistEntities --include=*.test.ts` returns nothing — the 102-line
writer has no test file, and the ten new tests all cover the pure function in `packages/index`.

Mutation A — turned the writer into a total no-op (`{ upsert: true }` → `{ upsert: false }`, both
sites, so nothing is ever inserted):

```
ℹ pass 130
ℹ fail 0
```

**A writer that writes nothing is indistinguishable from the shipped one.** So `upsert`-vs-delete
is unprotected, and so is the union-across-sessions behaviour the whole design rests on.

Mutation B — made promotion throw and the catch rethrow: `pass 100 / fail 2`, but as a
`session.test.ts` file-level crash (unhandled rejection), not a named assertion. So never-throws
is *incidentally* protected, not deliberately.

Combined with §1, this is the decisive problem: because no live write happened **and** no
synthetic write is asserted, **the persistence half of U2.1 has never executed against anything.**
The dry-run the manifest offers as evidence exercises `promoteTreeEntities` and the planner, not
`updateOne`. "Built, tested and wired" is true of the pure function and not true of the writer.
The restraint was defensible; shipping the untested writer alongside it is what turns the two
together into an unevidenced unit. Filed as ISS-126 with a concrete four-assertion test plan
against the existing `fakeDb`.

---

## FAILURES

- **[D6] sev: high** · The entity-promotion writer (`apps/api/src/indexing/promote-entities.ts`,
  102 lines) has no test; mutating `{ upsert: true }` → `{ upsert: false }` at both sites makes it
  a complete no-op and apps/api still reports 130/130 green — so upsert-never-delete, the
  cross-session union, and never-throws are all unasserted, and with no live write either, the
  persistence path has never run. · **Fix:** add
  `apps/api/src/indexing/promote-entities.test.ts` over `fakeDb()` asserting upsert-with-no-deleteMany,
  one-updateOne-per-topic with unioned `sessionRefs`, a named never-throws case, and the
  `tagClaims:false` / `true` split. · issue: **ISS-126**
- **[D4/D5] sev: high** · The stated grounds for declining U2.1's write are unsound: the plan's
  trap list names six other collections and U2.1 explicitly instructs writing these two, and the
  "`topics` is user-facing" harm claim is falsified by `GET /graph`, which already serves all 137
  slugs including `anju-jayraj` straight off the tree while reading nothing from `topics`. · **Fix:**
  keep the deferral, correct the justification (second authoritative surface before U2.2 measures
  precision — not first user exposure) and record the unit as U2.1-**partial** with D4/D5 deferred
  to after U2.2. · issue: **ISS-127**
- **[gate] sev: high** · `scripts/` is neither typechecked nor in `pnpm -r test`; a stale
  `apps/api/src/indexing.ts` import left the chunks backfill dead from U1.0c until a maker happened
  to run it. · **Fix:** smoke test spawning each `scripts/*.mjs` with `--dry-run`, asserting exit 0;
  no new script file (D-018 cap). · issue: **ISS-128**

**ISSUES-WRITTEN: ISS-126, ISS-127, ISS-128**

**EXPLANATION:** The measurement behind the refusal is completely reproducible and the refusal
itself stands — but the two arguments supporting it do not: the trap list names six other
collections while U2.1 instructs writing these two, and `topics` is not user-facing, because
`GET /graph` already serves all 137 noisy slugs off the tree. The unit fails on evidence rather
than on judgement: with no live write and no test on the 102-line writer, a mutation making it
write nothing at all still leaves apps/api 130/130 green, so the persistence half of U2.1 has
never executed. Credit where due and proven by mutation: the ISS-056 invariant genuinely holds,
and the narrowed `DEGRADED SUMMARIZE` assertion still catches its own regression — that one is an
honest clarification, not a loosening.
