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
