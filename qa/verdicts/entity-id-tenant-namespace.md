# Verdict — entity-id-tenant-namespace

**Date:** 2026-09-09
**Contract:** qa/contracts/entity-promotion.md (FIRST unit judged against it)
**Manifest:** qa/manifests/entity-id-tenant-namespace.md
**Cycle checked: 1**
**Bound to:** `D:\KnowledgeBase`
**Mode:** A (unit check), plus a live two-tenant reproduction against `mongodb://13.202.206.101:27017` db `lkb`

```
VERDICT: FAIL
SCOREBOARD: 8/9 criteria met, 3/4 invariants hold
FAILURES:
- [C3] sev: high · the mandatory (c) mutation — `scopedCollection` → a bare `db.collection(...)`
  handle — SURVIVES on `topics` and on `orgs`: 159/159 green, clean typecheck. Only the `claims`
  handle is covered. Root cause: no test ever executes a topics/orgs write through `indexSession`
  (that path issues zero topics/orgs calls, measured), and the direct unit tests assert the update
  BODY's tenantId, never the handle. · fix: give `fakeDb`'s SESSION an `org` and give the
  summarize fixture a keyInsight so `indexSession` actually promotes ≥1 topic and ≥1 org, so
  `assertAllCallsConfined` covers them; or add a direct assertion that every topics/orgs
  `updateOne` filter carries `tenantId`. · issue: ISS-154
ISSUES-WRITTEN: ISS-154, ISS-155
EXPLANATION: C6 — the criterion this unit exists to close — is genuinely MET, and I settled it
myself rather than on the manifest's word: I reproduced the E11000 live with the pre-fix bare-slug
shape and confirmed the shipped `<tenantId>:<slug>` shape lets both tenants through, then read the
cleanup back to zero. The design choice (namespace the id, not a compound index) is the right one,
and the contract's second remedy turns out not to be independently viable. The FAIL is a single
tenancy-class coverage gap that the contract itself marks mandatory, and that this repo's severity
gate says is never round-capped: the exact ISS-078 substitution still stays invisible on two of the
three collections this file writes.
```

---

## 1. What I re-ran myself (nothing below is the maker's pasted output)

| Gate | My result |
|---|---|
| `pnpm --filter @lkb/api test` | **159 pass / 0 fail** |
| `pnpm -r test` | exit **0** — db 14, ai 74, ask 32, index 203, ingest 97, meeting-bot 40, api 159 |
| `pnpm -r typecheck` | exit **0** |
| `npx depcruise` | exit **0** — no violations, 349 modules / 1127 dependencies |

**Mutation re-derivation (C6).** Armed through `node scripts/lib/mutate.mjs apply`, mutated
`entityId` to `return slug`, ran the suite, restored, `assert-clean`:

```
MUTATION: entityId -> bare slug   ->  155 pass / 4 fail
  ✖ ISS-126(4): tagClaims writes the session's REAL topicRefs onto each of its claims
  ✖ ISS-C-TARGETING: topic and org upserts target their own _id, not an open filter
  ✖ C6: two tenants promoting the SAME slug write to different _ids
  ✖ C6: org ids are namespaced too — the same collision applies to orgs
RESTORED: verified identical to HEAD · MUTATIONS CLEAN: none outstanding
```

The manifest's 155/4 reproduces exactly, and two of the four reddened tests are the C6 tests
themselves with hard-coded `tenant-a:visa-rules` expectations — not self-referential through
`entityId`, so the mutation is genuinely detected rather than tautologically passed.

## 2. My own live two-tenant reproduction (C6)

Driver/TCP probe, no ICMP. Checker-authored script, not the maker's. Scratch tenants
`chk-c6-a` / `chk-c6-b`, scratch slug `chk-uk`, real `lkb.topics` / `lkb.orgs`.

```
CONNECTED (tcp/driver probe, no ICMP)
PRE  topics= 0 orgs= 0
PRE  claims= 81 claims with non-empty topicRefs= 0

BARE  tenant A upsert -> OK
BARE  tenant B upsert -> THREW: E11000 duplicate key error collection: lkb.topics
                                index: _id_ dup key: { _id: "chk-uk" }
NS    both tenants upserted OK; topics rows: 2  orgs rows: 2

CLEANUP deleted topics= 3 orgs= 2
READBACK leftover topics= 0 orgs= 0
POST topics= 0 orgs= 0
POST claims= 81 with non-empty topicRefs= 0
```

**C6 is MET.** The criterion was recorded by its author as "believed UNMET, not live-reproduced";
it is now live-reproduced in both directions — the defect exists without the fix, and does not with
it — by a checker who did not write the fix. Cleanup read back from the server, not assumed.

## 3. Ruling — namespaced `_id` vs a compound unique index (manifest Disclosed §3)

**The maker's choice is correct, and it is more correct than the contract gave it credit for.**

The contract offers "either tenant-namespace the `_id`, **or** carry a compound unique index and
prove the upsert path uses it." Re-derived against the live server, **the second branch does not
work on its own.** The rejection comes from `_id_`, the collection's own implicit unique index on
`_id`, which cannot be dropped or made partial. Adding a unique `(tenantId, slug)` index does not
stop tenant B's insert of `_id: "uk"` from colliding with tenant A's; it only adds a second
constraint on top of the one that already rejected it. A compound-index remedy is only viable if
`_id` *also* stops being a bare slug — at which point it is the first remedy plus an extra index.
So the "or" in C6 is a false alternative; see §7.

Live evidence that this is not theoretical: `orgs` **already carries** a unique
`tenantId_1_name_1`, and `topics` carries no unique index beyond `_id_`:

```
topics indexes: [{_id_ ,unique:false}, {tenantId_1, unique:false}]
orgs   indexes: [{_id_ ,unique:false}, {tenantId_1, unique:false},
                 {tenantId_1_name_1, unique:TRUE}]
```

That existing unique index did not prevent the bare-slug collision, which is the point.

The maker's stated reasons for declining (migration + boot index assertion, no live rows) are also
true, and the "no migration needed" claim is verified, not assumed — see §6.

## 4. Ruling — the pure layer returns bare slugs, namespacing at the write boundary (Disclosed §2)

**Right call. Keep it.** `promoteTreeEntities` is a pure tree→rows function; a `tenantId`
parameter it only forwards into a string template would be a parameter it does not use for
anything else, and it would put a storage-layer id convention inside the package that is
deliberately I/O-free. The write boundary is where the id has to be correct because that is where
`_id` means something. C7's "stable `_id` order" is unaffected: `${tenantId}:` is a constant
prefix within a tenant, so the sort order is identical either way.

The one real hazard in the split is naming, and the maker already neutralised the live instance of
it: `topicRefsForSession` returns bare slugs, and `tagClaimsForSession` maps them through the
**same** `entityId` — one function, so rows and refs cannot drift. Verified by mutation (the
`entityId → slug` mutation reddens the `topicRef resolves to a real topics._id` test).

Non-blocking suggestion, not a criterion and not an issue: the pure interfaces call the bare value
`_id` (`PromotedTopic._id`), which is now the one thing it is *not*. Renaming that field to `slug`
would make a future caller unable to mistake it for a storable id. I am not filing this — it is a
low observation and this repo's overrides say low never becomes a unit.

## 5. The next unreachable path (the FAIL) — ISS-154

Four checkers have found a guard whose branch never executed. Here is the fifth, and it is the
mutation **C3 itself marks mandatory** because ISS-078 was exactly this substitution passing green.

I replaced each of the three `scopedCollection` handles in `promote-entities.ts` with a bare
`db.collection(...)` handle, one at a time, restoring between each:

| Mutation | Suite |
|---|---|
| `claimsColl = scopedCollection<Claims>(…)` → bare handle | **158/1 — reddens** (`EVERY query AND every write indexSession issues is confined to its own tenant`) |
| `topicsColl = scopedCollection<Topics>(…)` → bare handle | **159/0 — SURVIVES** |
| `orgsColl = scopedCollection<Orgs>(…)` → bare handle | **159/0 — SURVIVES** |

Each mutation genuinely removes tenant scoping: `scopedCollection`'s value is the
`withTenant`-merge on the filter (`tenantScope.ts:38-68`), and a bare handle drops it.

**Why it survives — the branch nobody executes.** I instrumented an `indexSession` run against
`fakeDb` and dumped every recorded collection op:

```
turns.find · session_pages.deleteMany · session_pages.insertOne · claims.deleteMany ·
claims.insertMany · gaps.updateOne · sessions.find · session_pages.find ·
tree_index.findOne · tree_index.replaceOne · claims.find · sessions.updateOne
topics/orgs calls: 0
```

The blanket `assertAllCallsConfined` test can only confine calls that happen, and **no test in the
repo ever drives a topics or orgs write through `indexSession`** — the fixture session has no
`org` and its summarize fixture yields no topic phrases, so both loops iterate zero times. The
direct unit tests in `promote-entities.test.ts` do exercise the writes, but they assert the update
*body*'s `tenantId` (`assertUpdateBodyConfined`) and the filter's `_id` — never that the filter
carries a `tenantId` at all. Body-confinement and handle-confinement are different assertions, and
only the first exists here.

This is I2 verbatim ("coverage is absent until a mutation proves it present") and C3's own
"(c) is mandatory". It is a **coverage** defect, not a live one — the shipped code does use
`scopedCollection` — but it is in the tenancy class, so this repo's severity gate says full
ceremony and **no round cap**. It is cheap: one fixture line and the existing blanket test starts
covering both collections.

## 6. C8 / U2.1 deferral — no regression

Read live off the server in the same probe, before and after my writes:

- `topics` = **0** rows, `orgs` = **0** rows (both before and after; my three scratch rows deleted
  and read back at 0 leftover)
- `claims` = **81**, of which **0** carry a non-empty `topicRefs`

So the `<tenantId>:<slug>` convention change strands no stored id, exactly as the manifest claims —
and I verified that rather than accepting it. C8 holds; `--dry-run` remains the default path in
`scripts/backfill.mjs`.

**One thing the deferral is now hiding (ISS-155, medium).** `backfill.mjs entities`' dry-run prints
`topic ${t._id}` straight off `promoteTreeEntities`, i.e. the **bare** slug, while its live path
writes `<tenant>:<slug>` through `promoteAndPersistEntities`. The dry run no longer previews the id
it would write. It also passes no `tagClaims` option, so the live path always tags claims regardless
of claims-extraction health, and the sub-command has no test of any kind. Medium under this repo's
gate — a ledger line, verified inside the next unit that touches that file, not a unit of its own.

## 7. Is the contract USABLE? (first use of `entity-promotion.md`)

Largely yes — it is the most checkable contract in this repo's `qa/contracts/`, because every
criterion names the mutation that settles it, and that is what made this check mechanical rather
than argumentative. C3 and C4 in particular converted "is it tenant-safe?" into a command with an
exit code. Specific rulings:

- **C6's "or" is a false alternative — the one real defect in the contract.** As shown in §3, a
  compound unique index cannot fix a collision that `_id_` raises; it can only accompany a change
  of `_id`. As written, a future maker could satisfy C6 by adding an index and "proving the upsert
  path uses it" while the bug remained. **I have amended C6** to say so (routine amendment:
  recording an edge case / tightening, per the criticality gate — it strictly narrows the criterion
  and does not weaken any invariant).
- **C6's "believed UNMET, not live-reproduced" self-disclosure worked exactly as intended** and
  should be the house style. It told this check precisely what to go settle, and it was settleable.
- **C1's `deleteOne` caveat is honest but currently unfalsifiable.** `fakeDb` exposes no
  `deleteOne`, so "zero delete calls recorded" can only ever observe `deleteMany`. The contract
  already flags this and correctly parks it with whoever owns `testutils.ts`. No change.
- **C9 is checkable and its `lint:structure` carve-out is right** — the concurrent lane has
  `scripts/lib/tracker-audit.mjs` and `ledger-union.test.mjs` modified in this tree right now, and
  the carve-out kept that off this unit's ledger.
- **Nothing is redundant or out-of-layer.** The "Out of scope" list did real work: it stopped me
  grading `GET /graph`'s person-name exposure here (I checked it for a *different* reason — see
  below — and found nothing to file).
- **One gap worth a future amendment, not filed now:** the contract says nothing about the *third*
  id vocabulary for the same entity — tree `node_id` (`…/topic:<slug>`), pure `_id` (bare slug),
  stored `_id` (`<tenant>:<slug>`). Nothing consumes across the boundary today (verified in §8), so
  there is no criterion to write yet; if a future unit joins `topics` rows to graph nodes, that is
  the moment C6 should grow a mapping clause.

## 8. Convention-change blast radius (manifest Disclosed §1) — nothing else parses these ids

Searched every file mentioning `topics` or `topicRefs` outside `node_modules`:

- **`apps/api/src/routes/graph.ts`** — mentions `claims.topicRefs` in a *comment* only; serves
  nodes off `tree_index`, reads neither collection. No parse, no split, no prefix assumption.
- **`packages/index/src/tree/flatten-graph.ts`** — operates on `node_id`, an untouched vocabulary.
- **`apps/web/src/pages/BrainPage.tsx`** — consumes `GET /graph` node kinds; never sees `topics._id`.
- **`packages/db/src/collections/topics.ts`** — a thin `scopedCollection` accessor; no id parsing.
- **`packages/index/src/eval/heuristic-retriever.ts`, `search/lexical.ts`** — comment references to
  `extract-topics.ts`, no entity ids.
- **`scripts/backfill.mjs`** — counts rows and delegates writes to `promoteAndPersistEntities`, so
  its live path is namespaced correctly; the dry-run print is ISS-155.
- **`schema/topics.schema.json` / `orgs.schema.json`** — `_id` is `{"type":"string"}` with no
  pattern, so `<tenant>:<slug>` conforms.

**No `split(":")`, no prefix strip, no id-shaped regex anywhere.** No ref is broken. Confirmed
against live data too: zero stored ids of either shape exist (§6).

## 9. One thing I probed and am NOT filing

`orgs` carries a live unique index on `(tenantId, name)`. Two org rows in one tenant with the same
`name` but different slugs would raise E11000 → swallowed by C2's catch → that tenant silently
loses the rest of its promotion. I reproduced that live (`E11000 … index: tenantId_1_name_1`).
**But it is unreachable from this code:** `build.ts:150` derives `orgSlug = slugify(session.org)`
from the same string it stores as the name, so equal names always yield equal slugs and dedupe to
one row. Recorded here as a standing hazard for whoever changes the slug rule or adds an aliasing
pass, not filed as an issue — I would not defend it at >80 % as a reachable defect today.

## 10. Ledger

| Issue | Sev | What |
|---|---|---|
| ISS-154 | high | C3(c)'s mandatory mutation survives on `topics` and `orgs`; no test drives an entity write through `indexSession` |
| ISS-155 | medium | `backfill.mjs entities` dry-run previews the bare slug while the live path writes the namespaced id; no `tagClaims` option; sub-command untested |

`Issues addressed` in the manifest was "contract C6" — that is genuinely closed by this unit and I
have credited it in full. No ledger row was claimed fixed that is not.

Fix cycle 1 of max 3 consumed. The fix for ISS-154 is one fixture change plus a re-run; C6 does not
need to be revisited.

---
---

# CYCLE 2 — independent re-check

**Date:** 2026-09-09
**Contract:** qa/contracts/entity-promotion.md
**Manifest:** qa/manifests/entity-id-tenant-namespace.md (`Fix cycle: 2`)
**Cycle checked: 2**
**Bound to:** `D:\KnowledgeBase`
**Mode:** A (unit check), plus a live probe against `mongodb://13.202.206.101:27017` db `lkb`
*(Cycle 1's verdict is preserved above, byte-intact.)*

```
VERDICT: PASS
SCOREBOARD: 9/9 criteria met, 4/4 invariants hold
FAILURES: none
ISSUES-WRITTEN: ISS-156 (medium — ledger line only, not a unit)
EXPLANATION: C3's mandatory (c) mutation is genuinely dead. I re-derived it three ways —
topics alone, orgs alone, and both together — and each reddens at 158/3, where cycle 1 measured
159/0 on two of the three collections. The tests that die are the right ones: all three are
tenancy assertions (the new ISS-154 filter test, the ISS-060/061 blanket confinement test, and
the degraded-run confinement test), none is an incidental crash. I instrumented `indexSession`
and it now records `topics.updateOne` x2 and `orgs.updateOne` x1 against zero at cycle 1, so the
`sessionRef` -> `sessionId` fixture bug is really fixed and BOTH entity writes execute. I ran the
contract's full mutation battery (12 mutations) against the richer fixture hunting for a
newly-vacuous assertion and found no assertion weakened — one uncovered sub-case surfaced instead
and is filed medium as ISS-156. C8 holds live: topics 0, orgs 0, topicRefs empty on all 81 claims.
```

---

## 1. What I re-ran myself (nothing here is the maker's pasted output)

| Gate | My result |
|---|---|
| `pnpm --filter @lkb/api test` | **161 pass / 0 fail** |
| `pnpm -r test` | exit **0** |
| `pnpm -r typecheck` | exit **0** |
| `npx depcruise --config .dependency-cruiser.cjs packages apps workers` | exit **0**, no violations |

Every mutation below was armed through `node scripts/lib/mutate.mjs apply`, applied, run, then
restored; `assert-clean` reports **`MUTATIONS CLEAN: none outstanding`** and `git status` shows the
tree carrying only the concurrent lane's `.goal/goal.json`. I touched none of the reserved paths.

## 2. The C3(c) mandatory mutation — re-derived three ways, not one (brief item 1)

The manifest claims 158/3 for the combined mutation. It reproduces exactly. But a combined
mutation cannot tell you whether *both* collections got covered or only one, so I also ran each
alone:

| Mutation (`scopedCollection` to bare `db.collection(...)`) | Cycle 1 | Cycle 2 |
|---|---|---|
| `topicsColl` **alone** | 159/0 SURVIVED | **158/3 — KILLED** |
| `orgsColl` **alone** | 159/0 SURVIVED | **158/3 — KILLED** |
| both together | (not run) | **158/3 — KILLED** |
| `claimsColl` | 158/1 reddens | reddens (unchanged) |

**The tests that die are the right ones.** All three are tenant-scoping assertions, and none is an
incidental unhandled rejection:

```
x ISS-154: every entity write is tenant-scoped ON THE FILTER, not merely in the body
    AssertionError: topics.updateOne filter lost its tenantId — a bare db.collection()
    handle would look exactly like this   ·   undefined !== 't'
x EVERY query AND every write indexSession issues is confined to its own tenant (ISS-060, ISS-061)
x a DEGRADED run's writes are tenant-scoped too — the guard must not be a bypass
```

The failure message names the exact substitution, and the blanket `assertAllCallsConfined` test now
has entity calls to confine on **both** the healthy and the degraded branch. Note what does *not*
die: the sibling "REACHES the entity writes" test stays green, correctly — a bare handle still
writes, it just writes unscoped. The maker's claim that the two tests "fail for different reasons
on purpose" is true, and I verified it rather than accepting it.

## 3. BOTH entity writes really execute — the `sessionRef`/`sessionId` bug (brief item 3)

I instrumented a real `indexSession` run against `fakeDb` and dumped every recorded op. Cycle 1's
dump ended `topics/orgs calls: 0`. This is cycle 2's:

```
ENTITY CALL: topics updateOne {"_id":"t:new-zealand","tenantId":"t"}
             {"$set":{"tenantId":"t","name":"New Zealand","sessionRefs":["s1"]}} {"upsert":true}
ENTITY CALL: topics updateOne {"_id":"t:notes","tenantId":"t"}
             {"$set":{"tenantId":"t","name":"Notes","sessionRefs":["s1"]}} {"upsert":true}
ENTITY CALL: orgs   updateOne {"_id":"t:acme-university","tenantId":"t"}
             {"$set":{"tenantId":"t","name":"Acme University"}} {"upsert":true}

ALL OPS: turns.find · session_pages.deleteMany · session_pages.insertOne · claims.deleteMany ·
claims.insertMany · gaps.updateOne · sessions.find · session_pages.find · tree_index.findOne ·
tree_index.replaceOne · topics.updateOne · topics.updateOne · orgs.updateOne · claims.find ·
sessions.updateOne
```

**Two topic rows and one org row, both collections, filters carrying `tenantId` and the namespaced
`_id`.** `testutils.ts:58` writes the page with `sessionId: "s1"`, matching `buildTree`'s lookup and
`schema/session_pages.schema.json`. The fixture bug the maker disclosed is real and is fixed; the
disclosure was accurate. Had it shipped, `orgs` would have promoted and `topics` would not — and the
combined mutation would still have shown 3 failures, which is exactly why running each collection's
mutation *alone* was worth doing.

## 4. Does the richer fixture make anything else vacuous? (brief item 2 — the main risk)

This was the cycle's real question: the fix is to the **fixture**, and `fakeDb` has ~46 call sites,
several asserting exact op lists. A fixture change that quietly makes another assertion vacuous
trades one blind spot for another. I checked three ways.

**(a) The full contract mutation battery — 12 mutations, one survivor.** If the richer fixture had
weakened an assertion, a mutation that used to redden would now survive. Only one survived, and it
is not one that used to redden (see §5):

| Mutation | Result |
|---|---|
| C3(a) `claimsColl(tenantId)` to `claimsColl("ATTACKER")` | 160/1 reddens |
| C3(b) drop `tenantId` from **topic** `$set` | 160/1 reddens |
| C3(b') drop `tenantId` from **org** `$set` | **161/0 SURVIVED** -> ISS-156 |
| C1(a) `{upsert:true}` to `{upsert:false}`, both sites | 160/1 reddens |
| C1(b) `sessionRefs: t.sessionRefs` to `[sessionId]` | 160/1 reddens |
| C4(a) claims `.find({"evidence.sessionId":...})` to `.find({})` | 160/1 reddens |
| C4(b) claim `updateOne({_id:c._id})` to `updateOne({})` | 159/2 reddens |
| C4(c) topic upsert filter to `{}` | 158/3 reddens |
| C4(d) org upsert filter to `{}` | 159/2 reddens |
| C5 force `tagClaims` true unconditionally | 159/2 reddens |
| C2 force the promotion body to throw | 148/13 reddens |
| C6 `entityId` to `return slug` | 157/4 reddens |

**(b) The exact-op-list assertions are untouched.** The three `deepEqual(pageOps(calls), [...])`
assertions (`session.test.ts:114,124,134`) are scoped to `session_pages` and read *op names*, not
returned content. `session_pages.find` was already being recorded before this change — the fixture
only changed what it *returns*, from `[]` to `[PAGE]`. The op sequences are byte-identical, which is
why those three stayed green without being edited. The ISS-056 assertion
(`deepEqual(claimOps(calls), [])`) is likewise unaffected and still live: the C5 mutation reddens it.

**(c) The blanket assertions got stronger, not weaker.** `session.test.ts:81` is
`writes.length >= 4` — a lower bound, so more recorded writes can only tighten it; `:83` requires a
non-empty insert, unaffected. `assertAllCallsConfined` now walks three more calls than it did. The
direct tests in `promote-entities.test.ts` build their own trees and call
`promoteAndPersistEntities` directly, so the `SESSION`/`PAGE` fixture does not reach them at all —
none of them can have been made vacuous by this change.

**Conclusion: no assertion was weakened.** The maker also put a load-bearing comment on both fixture
fields (`testutils.ts:50-58`) so a future tidy-up cannot silently delete them, which is the right
defence given this is the fifth gap of this shape in the layer.

## 5. The next unreachable path (brief item 4) — ISS-156, and two paths I cleared

**Found: the org `$set` body is uncovered where the topic one is not.** Dropping `tenantId` from the
topic `$set` reddens; the identical mutation on the org `$set` **survives at 161/0**. It is the same
topics-vs-orgs asymmetry class as ISS-154, one layer in — the fix covered the *filter* on both
collections but the *body* on only one.

**It is not a C3 failure, and I want to be exact about why.** C3's property is stated for "the
entity upserts", and the shipped code does carry `tenantId` in both bodies — the code is correct.
C3's *Verified-by* list names mutation (b) as "drop `tenantId` from the topic `$set`", and that one
reddens. So C3 as written is met. Its live impact is also nil: `scopedCollection.updateOne` merges
`withTenant` into the **filter** (`tenantScope.ts`), and Mongo builds an upsert-inserted document
from the filter's equality fields, so the row still carries `tenantId` even with the `$set` stripped.
Filed **medium** — a ledger line, verified inside the next unit that touches this test file, per this
repo's severity gate. It is a one-line extension of an assertion that already exists.

**Cleared — the never-throws catch (C2).** I mutated the catch to `throw err` with a forced throw in
the body. It reddens 24 tests **including the named one** — `promote-entities.test.ts:94`,
`assert.equal(res.skipped, "promotion-failed", "the failure must be reported, not thrown")`. That is
a named assertion, not the incidental unhandled-rejection crash C2 explicitly refuses to accept.
C2 holds.

**Cleared — the `tagClaims:false` branch (C5).** Forcing `tagClaims` true unconditionally reddens
the named ISS-056 assertion "no claims write of any kind may happen on a degraded run" plus the
direct `tagClaims:false` test. The branch executes and is asserted.

**One observation I am NOT filing.** C2's second clause asks that a failing promotion still let
`indexSession` reach the `status.index` flip. No test names *that* pairing — `session.test.ts:309`
asserts it for the **chunks** path (ISS-112), not the promotion path. I am not filing it: the catch
returns a literal, so the function is structurally incapable of throwing, cycle 1 already graded C2
met, and this unit did not touch that code. I would not defend it at >80 % as a reachable defect —
it is a note for whoever next widens C2's coverage, not a finding.

## 6. C8 / U2.1 deferral — no regression (brief item 5)

Driver/TCP probe against `mongodb://13.202.206.101:27017`, db `lkb`. **No ICMP** — the host filters
it. Checker-authored script, scratch tenants `chk2-a` / `chk2-b`, scratch slug `chk2-uk`.

```
CONNECTED (driver/TCP probe, no ICMP)
PRE  topics= 0 orgs= 0
PRE  claims= 81 with non-empty topicRefs= 0

NS   both tenants upserted OK; scratch rows: 2

CLEANUP deleted= 2   READBACK leftover= 0
POST topics= 0 orgs= 0
POST claims= 81 with non-empty topicRefs= 0
```

`topics` and `orgs` are still **0 rows**; `topicRefs` is empty on **all 81** claims. C8's deferral
holds and the `<tenantId>:<slug>` convention still strands no stored id. C6 re-verified in passing
under the shipped shape — both tenants upsert the same slug without collision. Cleanup was **read
back from the server**, not assumed.

## 7. The C6 contract amendment's provenance (D-022) — properly recorded

Asked to confirm this, since a contract edited mid-unit by a checker is exactly the provenance
problem D-022 was written about. It is clean:

- The amendment log at `qa/contracts/entity-promotion.md:214-222` carries a full entry in the
  required shape — **date** (2026-09-09) · **class** (`routine`) · **what** (C6's second remedy
  narrowed from an independent alternative to a note) · **why** (the E11000 is raised by the
  implicit `_id_` index, which no added index can relax; `orgs`' existing unique
  `tenantId_1_name_1` did not prevent the collision) · **where found** (this contract's first use)
  · and it **cites the verdict** `qa/verdicts/entity-id-tenant-namespace.md`.
- It also records C6's status change from "believed UNMET" to **MET**, with the live evidence in
  both directions — which is the honest thing to do, since the contract's author had explicitly
  flagged that criterion as unverified.
- **It is committed**, in `816a48d` ("checker: FAIL entity-id-tenant-namespace (cycle 1) +
  ISS-154/155") — `git diff HEAD` on the contract is empty. Not a working-tree-only edit.
- **The criticality gate is right.** This is a *narrowing* — it removes a way to satisfy C6 while
  leaving the bug in place. Under the gate that is "tighten / record edge case" -> routine,
  auto-apply with a reason. It weakens no invariant and reverses no goal direction, so it correctly
  did not need a human. Had it gone the other way — adding an alternative remedy — it would have
  been critical.

Provenance is sound: written by a checker, not the maker; logged with its reason; committed;
verdict-linked; correctly classified.

## 8. Criterion-by-criterion

| | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | upsert, never delete-then-insert | **MET** | `upsert:false` and `sessionRefs`->`[sessionId]` both redden; `fakeDb` genuinely records `deleteMany` (`testutils.ts:65`), so the zero-deletes assertion is not vacuous |
| C2 | promotion never throws | **MET** | named assertion `promote-entities.test.ts:94`; rethrow mutation reddens it |
| C3 | every write tenant-scoped, filter **and** body | **MET** | (a) reddens · (b) reddens · **(c) reddens on topics alone, orgs alone, and both** — the cycle-1 FAIL is closed |
| C4 | writes are targeted, not merely well-formed | **MET** | all four filter-to-`{}` mutations redden; `fakeDb.find` honours its filter (`testutils.ts:79-92`), so the precondition holds |
| C5 | degraded run performs no claims op | **MET** | forcing `tagClaims` true reddens the named ISS-056 assertion |
| C6 | entity `_id`s cannot collide across tenants | **MET** | re-verified live this cycle; `entityId`-to-bare-slug reddens 4 |
| C7 | pure layer pure and deterministic | **MET** | unchanged this cycle (diff touches only `apps/api` tests + `testutils.ts` + the manifest); graded MET at cycle 1 |
| C8 | no live entity backfill | **MET** | live: topics 0, orgs 0, topicRefs empty on 81/81 |
| C9 | standing gates | **MET** | `pnpm -r test` 0 · `pnpm -r typecheck` 0 · `depcruise` 0 |

**Invariants.** I1 holds (C2). **I2 holds, and this cycle is I2 being enforced** — coverage was
absent until a mutation proved it present, and the fix was made because the mutation said so, not
because a test looked missing by inspection. I3 holds — the change adds no filtering or
re-slugifying; it is fixture and test only. I4 holds — C8 records the deferral together with the
condition that returns it (U2.2's precision number).

## 9. Ledger

| Issue | Sev | Movement |
|---|---|---|
| ISS-154 | high | **open -> fixed.** Independently re-derived, not taken on the manifest's word. |
| ISS-155 | medium | stays open — `backfill.mjs` untouched this cycle, correctly out of a tenancy unit's scope |
| ISS-156 | medium | **new** — org `$set` body coverage asymmetry; ledger line only, not a unit |

The manifest's `Issues addressed` were "contract C6 (met, cycle 1) · contract C3 / ISS-154". Both
are genuinely closed and I have credited them in full. No row was claimed fixed that is not.

## 10. Notes for the maker

- **Close-out:** flip the manifest to `Status: checked-PASS`. Fix cycle 2 of max 3; one unused.
- **Goal task U2.1c:** I did **not** run the `/goal` close. `.goal/goal.json` is reserved to the
  concurrent lane in this dispatch, and a reserved-path write is not worth a task-status field.
  Whoever owns that lane should close U2.1c.
- **The carried-forward `PromotedTopic._id` -> `slug` rename** remains a good idea and remains
  correctly out of a tenancy unit. It belongs with whatever unit next opens `packages/index`.
- **The habit worth keeping:** the maker found its own fixture bug because it wrote an assertion
  strong enough to fail — `entityWrites.some(topics)` **and** `some(orgs)` rather than
  `entityWrites.length > 0`. A weaker assertion would have shipped a fixture exercising half the
  path while looking complete. That is the same lesson as ISS-154 itself, one level up.
