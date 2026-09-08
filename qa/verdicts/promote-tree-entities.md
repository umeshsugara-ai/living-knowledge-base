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

---
---

# Verdict — promote-tree-entities (CYCLE 2)

**Date:** 2026-09-08
**Manifest:** `qa/manifests/promote-tree-entities.md`
**Contract named:** `qa/contracts/tree-index-v2.md`
**Cycle checked: 2**
**Bound to:** `D:\KnowledgeBase`
**Prior verdict:** cycle 1 = FAIL (3/6), preserved above byte-intact.

Same coverage caveat as cycle 1: `tree-index-v2.md` does not describe a writer, the `topics`/`orgs`
collections, or `claims.topicRefs`, and its Non-goals say "no live Mongo write". I judged against
**plan §10 U2.1** and the three issues the cycle-1 FAIL raised. A promotion contract is still owed
before U2.2/U2.3 build on this.

---

## VERDICT: FAIL

**SCOREBOARD: 2/3 issues closed, 6/7 standing gates hold**

- **ISS-127 — CLOSED.** The retraction is honest, complete, and better than what I would have
  accepted.
- **ISS-128 — CLOSED.** The deviation from my stated fix is **upheld**; the maker's version is the
  better engineering call and I verified it against the real breakage.
- **ISS-126 — STILL OPEN.** The three mutations the manifest names are genuinely killed — I
  re-derived all three rather than reading the counts. But the issue's own recorded `fix_direction`
  item (4) is half-implemented: **the `tagClaims: true` path is asserted nowhere, and cannot be**,
  because `fakeDb`'s `find` returns `[]` for `claims`. I blanked the claims write to
  `{ $set: { topicRefs: [] } }` and apps/api reported **137 pass / 0 fail**. ISS-126's premise — "a
  mutation that makes the writer write nothing leaves apps/api green" — is still literally true of
  the claims half of the same writer. That row's fix_direction even ends with the warning that was
  not taken: *"fakeDb exposes only 7 collection methods, so extend it rather than assuming an
  untested op is unreachable."*

Standing gates: typecheck OK · `pnpm -r test` OK · lint-loc/dirsize/root/dupes/migrations OK ·
snapshot `--check` OK · depcruise OK · `mutate.mjs assert-clean` OK · `tracker-audit --gate g1`
FAILS (pre-existing, the concurrent lane's U2.4, ISS-117 — not this unit's).

---

## What I re-ran myself (nothing below is the maker's pasted output)

| Command | My result |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | exit 0 — `@lkb/api` **137/137**, `@lkb/index` **203/203** |
| `node scripts/lint-loc.mjs` … `lint-migrations.mjs` (5 gates) | exit 0 each |
| `node scripts/snapshot.mjs --check` | exit 0 — SNAPSHOT.md fresh |
| `node scripts/tracker-audit.mjs --gate g1` | **exit 1** — 2 findings, both `U2.4` (other lane) |
| `npx depcruise --config .dependency-cruiser.cjs packages apps workers` | exit 0 |
| `node --test scripts/lint.test.mjs` | exit 0 — **12/12** |
| `pnpm test:lint` | **exit 1** — see section 4, NOT this unit's fault |
| `pnpm lint:structure` | exit 1, aborting at `tracker-audit --gate g1` |
| `node scripts/lib/mutate.mjs assert-clean` (start and end) | `MUTATIONS CLEAN: none outstanding` |
| Live Mongo `mongodb://13.202.206.101:27017`, TCP driver, no ping | `lkb`: **topics=0 · orgs=0 · claims=81 · claims with non-empty `topicRefs`=0** |

Working tree left byte-identical to how I found it. `.goal/goal.json`, `TASKS.md`, `qa/.last-tick`,
`qa/gates/*`, `qa/issues.jsonl` and every `speaker-*` path belong to the concurrent lane; I touched
none of them. (I regenerated `docs/PROGRESS.md` while diagnosing section 4 and restored it with
`git checkout --`.)

---

## 1. ISS-126 — three mutations re-derived by me, and a fourth that survives

I did not accept the pasted counts. Each mutation was armed with `mutate.mjs apply`, applied,
`apps/api` tested, then `mutate.mjs restore` + `assert-clean`.

| Mutation | Manifest claims | **My result** |
|---|---|---|
| `{ upsert: true }` to `{ upsert: false }`, both sites | 136 / 1 | **136 pass / 1 fail** — killed by `ISS-126: topics and orgs are UPSERTED…` |
| `sessionRefs: t.sessionRefs` to `[sessionId]` | 136 / 1 | **136 pass / 1 fail** — killed by `…carries the UNIONED sessionRefs…` |
| tagClaims guard removed (`options.tagClaims === false ? 0 : …` to always tag) | 135 / 2 | **135 pass / 2 fail** — killed by the new `tagClaims:false` case *and* the existing ISS-056 case |

All three counts are exactly reproducible. That is a real improvement over cycle 1 and it should be
said plainly: the mutation that survived cycle 1 is dead, and the union behaviour the whole design
rests on is now defended.

I also checked two mutations the manifest does not name:

- **`$set` drops `tenantId`** on the topic write — **killed** (136/1) by the unioned-sessionRefs
  case, which also asserts `set.tenantId`. Good.
- **`{ $set: { topicRefs: refs } }` to `{ $set: { topicRefs: [] } }`** in `tagClaimsForSession`
  — **137 pass / 0 fail. SURVIVES.**

### Why it survives, and why it is not a nit

`testutils.ts:56-63` — `find()` returns `[TURN]` for `turns`, `[SESSION]` for `sessions`, and `[]`
for everything else. So `tagClaimsForSession` sees **zero claims in every one of the 137 tests**,
issues zero `updateOne`s, and its entire body is unreachable. Test 4 ("every write is tenant-scoped
on filter and body") iterates `claims` calls that never exist. Test 6 asserts the `false` branch
correctly; nothing asserts the `true` branch, and nothing can until `fakeDb` seeds a claim.

The consequence is the same shape ISS-126 was opened for: `claims.topicRefs` is a **live data-write
path inside `indexSession`** that could write the wrong value, or nothing, on every real ingest, and
the suite would stay green. Under this repo's own severity gate (`.claude/CLAUDE.md`), "anything
touching auth, tenancy, or **data writes**" gets full ceremony regardless of severity, so I am not
waving this through as a medium.

**Fix (small, and it is item (4) of ISS-126's existing fix_direction, not a new demand):** extend
`fakeDb` so `find` on `claims` returns one or two seeded claim docs (or accept them via `opts`, the
pattern `existingSessionPage` already establishes), then assert that `tagClaims` unset/`true`
issues **one `updateOne` per claim** whose `$set.topicRefs` equals `topicRefsForSession`'s output —
i.e. the mutation `topicRefs: refs` to `[]` must fail. ISS-126 stays **open**; no new issue id is
minted (see section 5).

### On coverage of the real risk surface, beyond the named mutations

Asked to judge whether 7 cases cover the writer's risk surface or only the mutations named: mostly
the former, with the one hole above. `deleteMany` **is** recorded by `fakeDb`, so the
never-delete case (test 2) is meaningful rather than vacuous — I checked, because "assert zero
calls to an op the fake cannot make" is the classic false green. The never-throws case is now
a named assertion rather than cycle 1's incidental crash. The empty-tree case is a genuine
boundary. Residual gaps I am **not** filing (EXPLANATION territory, not defensible as failures):
`orgs` has no multi-session/union analogue because orgs carry no `sessionRefs`; nothing asserts the
`updateOne` filter is `{ _id }` rather than something broader; and cycle 1's `WRITE_OPS`
hand-maintained allow-list note still stands unaddressed but still harmless.

## 2. ISS-127 — the retraction is honest and complete. Closed.

I looked for a refuted claim still standing unmarked anywhere in the manifest and did not find one.

- The original section "Why not running it is the right call" is **struck through in place** with a
  `RETRACTED, cycle 2` block above it, and the manifest says explicitly why it was left visible
  rather than rewritten. That is the right call and it is the harder one.
- Disclosed item 1 ("the central judgement is mine and is contestable… `topics` is user-facing and
  a misfiled person is worse than a blank page") is struck through and annotated **"OVERRULED IN
  CYCLE 1 AND I WAS WRONG"** — with the correct distinction that the *action* was upheld and the
  *reasoning* was not. It does not overstate what I ruled.
- The new section "Cycle 2 — I was right to defer, and wrong about why" dismantles both arguments in
  the maker's own words, correctly: it names all six collections the trap list actually lists, quotes
  U2.1's "Write the rows" against itself, and concedes `topics` is not user-facing because
  `flatten-graph.ts` to `routes/graph.ts` to BrainPage already ships all 137 slugs. *"My reasoning
  had the comfortable shape of a principle and did not survive one grep"* is an accurate
  self-assessment.
- The deferral is now justified on the narrower ground I supplied — **do not stand up a second
  authoritative surface before U2.2 measures precision** — and attributed rather than absorbed.

**Catalogue NOT upgraded — verified, not accepted:** `docs/PROGRESS.md:52` `B9 … **MISSING** |
collection topics (empty)`; line 55 `B12 … **MISSING** | no probe declared`. B10 is `PARTIAL` off
`speakers` (2 docs), which is the other lane's, not this unit's. Nothing moved.

**On "recorded as U2.1-partial":** substantively yes, literally no. `TASKS.md:103` and
`.goal/goal.json` both carry `in_progress`, and the goal task's `evidence` field states the
deferral in full ("backfill DELIBERATELY NOT RUN … Catalogue must NOT be upgraded"). I am **not**
failing this: `partial` is not a valid status in this repo's tracker vocabulary — the very
`tracker-audit` G1 finding that is red right now is *"U2.4 uses unknown status `partial` in
TASKS.md — known: open, pending, in_progress, blocked, done"* — so demanding the literal string
would demand a value the gate rejects. One thing genuinely missing and worth a line when D4/D5 are
picked up: nothing on disk records that **D4/D5 are deferred to after U2.2 specifically**; the
evidence field says they were not run, not when they return.

## 3. ISS-128 — the deviation is UPHELD. Ruling, since I was asked for one explicitly.

**I rule for the maker.** My cycle-1 fix ("spawn each `scripts/*.mjs` with `--dry-run`, assert exit
0") was the worse instrument, and the maker's objection is factually correct, not a convenient
excuse:

- `node scripts/backfill.mjs --dry-run` is the exact command cycle 1 ran, and it returned real
  corpus numbers (26 sessions / 1452 chunks) — meaning **dry-run connects to production Mongo**.
  A `lint:structure` that opens a production connection on every invocation is a gate this project
  would be right to disable, and it sits badly beside this repo's read-only-production discipline.
- The import-resolution guard catches **precisely the class that bit** — a moved module still named
  in an import specifier — which is the whole content of the U1.0c defect.
- Adding it to `scripts/lint.test.mjs` instead of a new `scripts/smoke.test.mjs` correctly honours
  D-018's "consolidate, don't widen".

**And I verified it against the real breakage rather than trusting the claim:**

```
mutate.mjs apply scripts/backfill.mjs
  "../apps/api/src/indexing/session.ts" -> "../apps/api/src/indexing.ts"   (the U1.0c path)
node --test scripts/lint.test.mjs  ->  exit 1
  x every scripts/*.mjs resolves its imports ...
    +   'backfill.mjs -> ../apps/api/src/indexing.ts'
mutate.mjs restore scripts/backfill.mjs
node --test scripts/lint.test.mjs  ->  exit 0, pass 12 / fail 0
```

It catches it, by name, and goes green on restore. Disclosing a deviation and offering to be failed
for it is how this should be done; the narrower guard that runs beats the thorough one that gets
switched off.

Two honest limits of the guard, recorded so nobody over-reads it later — neither a failure:
it is a static regex over import specifiers, so a computed/template-literal path is invisible to
it, and it verifies existence only, not that the imported *binding* exists (a renamed export still
slips through). It is an import-resolution gate, which is what the maker says it is.

## 4. `pnpm test:lint` currently exits 1 — diagnosed, and NOT attributable to this unit

The manifest's cycle-2 output block says *"12/12 in `scripts/lint.test.mjs`, now inside
`lint:structure`"*. `scripts/lint.test.mjs` alone is 12/12 (I ran it). But the `test:lint` script
runs six files, and it exits 1 on two cases in `scripts/catalogue-cli.test.mjs`:

```
x baseline: `--check` exits 0 on a clean tree
   STALE: docs/PROGRESS.md differs from a fresh regeneration
x the suite leaves the repo clean - no tracked file is left modified
```

I traced the cause: regenerating produces a **two-line deletion** — removal of the banner
"EDITED SINCE COMMIT — `.goal/catalogue.json` no longer matches the version in git".
`.goal/catalogue.json` was uncommitted when PROGRESS.md was last generated and is committed now, so
the banner is stale. That is the concurrent lane's state, not U2.1's, and the second failure is
just the same lane's uncommitted `qa/` files. I restored PROGRESS.md and filed nothing.

**One observation on the wiring, at medium, not a FAIL:** `pnpm test:lint` was appended **last** in
`lint:structure`'s `&&` chain, behind `tracker-audit --gate g1`, which is red today. So
`pnpm lint:structure` aborts before ever reaching the new guard — the gate the unit added to "make
it actually gate" does not gate right now. Moving `pnpm test:lint` ahead of `tracker-audit` in that
chain costs nothing and fixes it. Per this repo's severity gate a medium is a ledger line verified
inside the next unit touching the file, not a pulled unit — and I am deliberately not letting it
influence the verdict, which turns on section 1 alone.

## 5. Regression check — clean, and the ledger

`topics = 0`, `orgs = 0`, `claims = 81`, and **0 of 81** carry a non-empty `topicRefs`. Nothing was
written while the manifest claims nothing was written. The manifest is honest about this for the
second cycle running.

**Ledger:** I minted **no new issue id**. The finding in section 1 is ISS-126's own recorded
`fix_direction` item (4), unimplemented — so ISS-126 correctly stays `open` rather than being
closed and immediately reopened under a fresh number. This also avoids allocating from the
`max(existing)+1` counter while a concurrent lane holds it, which is the exact structural cause
recorded in `qa/gates/ledger-id-collision.md` (ten findings silently replaced on the last merge).
ISS-127 and ISS-128 are verifiably fixed by this unit; their status flip to `fixed` is stated here
and left to the sweep to apply, for the same concurrency reason.

Note for the record, since the sweep filed it against this very manifest today: **ISS-134** asks
manifests to report reproductions **by issue id**. This manifest reports three mutation counts but
never states them as `ISS-126: 3/4 recorded reproductions re-run`. Had it done so, item (4) would
have been visibly missing before it reached me. That is D-015's whole point, and it is the second
time on this unit that the measurement — not the code — is the defect.

---

## FAILURES

- **[ISS-126] sev: high** · The `tagClaims: true` write path is unasserted and structurally
  unreachable: `testutils.ts:56-63` returns `[]` from `find` on `claims`, so
  `tagClaimsForSession` issues zero `updateOne`s in all 137 tests. Mutating the claims write to
  `{ $set: { topicRefs: [] } }` leaves apps/api at **137 pass / 0 fail** — the same "a writer that
  writes nothing is indistinguishable from the shipped one" defect ISS-126 was opened for, on a
  live data-write path inside `indexSession`. This is item (4) of ISS-126's own recorded
  fix_direction, and that row's closing warning ("extend fakeDb rather than assuming an untested op
  is unreachable") names the exact reason it was missed. · **Fix:** seed one or two claim docs into
  `fakeDb`'s `find` for `claims` (mirroring `opts.existingSessionPage`), then assert one `updateOne`
  per claim with `$set.topicRefs` equal to `topicRefsForSession`'s output, so the
  `refs` to `[]` mutation fails. · issue: **ISS-126 (stays open)**

**ISSUES-WRITTEN: none** — ISS-126 remains open on its existing row; no new id minted (ledger-id
collision gate).

**EXPLANATION:** Two of the three cycle-1 issues are genuinely closed and I re-derived rather than
read every claim: all three named mutations kill, the ISS-128 guard catches the real U1.0c
breakage by name and goes green on restore, the retraction of ISS-127's reasoning is honest and
complete, the catalogue was not upgraded, and live `topics`/`orgs` are still 0 with all 81 claims
untagged. I rule **for** the maker on the ISS-128 deviation — its objection is factually right
(`backfill.mjs --dry-run` really does open a production Mongo connection), and a narrow guard that
runs beats a costly one that gets disabled. The unit fails on one thing only: a fourth mutation
I derived myself blanks `claims.topicRefs` to `[]` on every write and leaves apps/api 137/137
green, because `fakeDb.find` returns `[]` for `claims` and the `tagClaims: true` path — item (4)
of ISS-126's own fix_direction — can never execute. One seeded fixture closes it.
