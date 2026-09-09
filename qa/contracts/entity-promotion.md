# Contract — entity-promotion

> **Status:** ACTIVE. Created by **/checker** on 2026-09-09 under `/checker init-contract`, authorized
> by the human answer recorded in `qa/gates/vector-retrieval-contract.md` (**Answered: 2026-09-09 —
> Option 1, both layers**, Umesh). The AMENDED section of that gate makes this layer the second half
> of a single decision, not a separate ask.
>
> **Criteria in this file may be changed only by a checker, never by the maker** (`.claude/CLAUDE.md`;
> ISS-006). Maker feedback goes to `qa/feedback-inbox.md`.
>
> **Derivation.** From the **code** (`packages/index/src/tree/promote-entities.ts`,
> `apps/api/src/indexing/promote-entities.ts`, `packages/db/src/lib/tenantScope.ts`), from the ledger
> (ISS-056, ISS-060, ISS-065, ISS-121, ISS-126, ISS-127, ISS-C-CLAIMS-TARGETING-001), from plan §10
> U2.1, and from the four verdicts that graded this layer against a plan bullet
> (`promote-tree-entities` cycles 1–3, `claims-write-targeting` cycle 1). Not transcribed from the
> manifests.

## North star

This layer turns tree nodes that already exist into **persisted, corpus-wide entity rows** —
deterministically, with no LLM, and without ever being able to destroy what another session
contributed or to strand the ingest it runs inside. It is a *bookkeeping* layer attached to a
critical path: everything it does is optional, and nothing it does may be fatal.

**Why this contract exists at all.** Across seven checks of this layer and the vector layer, the
loop produced one cross-tenant duplicate-key bug (ISS-121), one session-stranding bug, and **three
separate guards whose branch never executed** — every one found by a checker's mutation, none by a
passing suite. The criteria below are written so those *classes* are checkable, not so that those
three specific bugs are re-checked.

## Scope

**In scope**
- `packages/index/src/tree/promote-entities.ts` — `promoteTreeEntities`, `topicRefsForSession` (pure)
- `apps/api/src/indexing/promote-entities.ts` — `promoteAndPersistEntities`, `tagClaimsForSession`
  (the writer), and its call site inside `indexSession`
- `scripts/backfill.mjs` **`entities` sub-command** — dry-run and live paths

**Out of scope — a future checker must NOT grade these against this contract**
- **`buildTree` and `extract-topics.ts`.** Topic/org *quality* is upstream and belongs to
  `qa/contracts/tree-index-v2.md`. This layer promotes what the tree already holds; it may not
  improve, filter or re-slugify it (see I3).
- **`GET /graph`, `flatten-graph.ts`, the BrainPage.** They read `tree_index` directly and read
  nothing from `topics` — verified in cycle 1. Person-name exposure on that surface is a
  `tree-index-v2` / `brain-explorer-pages` concern, not this one.
- **U2.2 (precision measurement) and U2.3 (turn-level topic attribution / the LLM pass).** C8's
  precondition references U2.2; it does not grade it.
- **`docs/PROGRESS.md` catalogue scoring.** Whether B9/B12 move is decided by rows existing, not by
  this contract.
- **Plan §10 prose as such.** Four consecutive checks graded this layer against the U2.1 bullet. That
  ends here: grade the criteria below.

## Acceptance criteria

### C1 — Upsert, never delete-then-insert, for corpus-wide rows — and the reason is the criterion
`topics` and `orgs` are written with `updateOne(..., { upsert: true })`. **No `deleteMany` /
`deleteOne` on `topics` or `orgs` may occur on any promotion path.**
**Why this is not style:** the chunks path may clean-replace because a chunk belongs to exactly one
session. **A topic row spans sessions** — its `sessionRefs` is a union across every session that
surfaced it — so deleting before writing would drop every *other* session's contribution on any
single-session re-index. The risk knowingly accepted in exchange is a stale row outliving its last
session; that is strictly better than actively destroying live cross-session evidence, which is the
ISS-056/ISS-060 shape this project has already paid for twice.
*Verified by:* mutations that must each redden a **named** test — (a) `{ upsert: true }` →
`{ upsert: false }` at **both** sites (a writer that writes nothing must not be indistinguishable from
the shipped one — it was, at cycle 1, with apps/api 130/130 green); (b) `sessionRefs: t.sessionRefs`
→ `[sessionId]`, killing the union. Plus an assertion of **zero** delete calls recorded by `fakeDb`
— and the checker must confirm `fakeDb` actually *records* deletes, or the assertion is vacuous.

### C2 — Promotion never throws; a failure costs entity rows, never the session
`promoteAndPersistEntities` catches everything, logs, and returns
`{ topics: 0, orgs: 0, claimsTagged: 0, skipped: "promotion-failed" }`. It runs inside `indexSession`,
where an escaping throw leaves the session at `status.index: "pending"` **forever** while ingest still
returns 201 — the exact ISS-121 consequence.
*Verified by:* a **named** assertion (not an incidental unhandled-rejection crash, which is what
cycle 1 found and rejected) — force the promotion body to throw and assert the function resolves with
`skipped: "promotion-failed"`, and that `indexSession` still reaches the `status.index` flip.

### C3 — Every write is tenant-scoped on **both** the filter and the body
All three collections are reached through `scopedCollection`, never a raw handle; `tenantId` appears
in the `$set` body of the entity upserts.
*Verified by:* mutations that must redden a named test — (a) `claimsColl(tenantId)` →
`claimsColl("ATTACKER")`; (b) drop `tenantId` from the topic `$set`; (c) replace `scopedCollection`
with a bare `db.collection(...)` handle. **(c) is mandatory**: ISS-078 showed that exact substitution
leaving 102/102 green, a clean typecheck and clean lint — a cross-tenant read of every tenant's
verbatim transcript, invisible to the whole suite.

### C4 — Writes are **targeted**, not merely well-formed
Asserting what an update *body* contains and how *many* calls happen does not constrain **what the
write is aimed at**. Both must be asserted:
- the claims read is scoped — `.find({ "evidence.sessionId": sessionId })`, not `.find({})`;
- each claim update targets one claim — `.updateOne({ _id: c._id }, …)`, not `.updateOne({}, …)`;
- each entity upsert targets one row — `{ _id: t._id }` / `{ _id: o._id }`, not `{}`.
*Verified by:* mutating each filter to `{}` and confirming a named test reddens. `fakeDb` records
`calls[].filter` already, so these assertions cost about two lines each; at cycle 3 the first two
**survived with 139/139 green**, which is ISS-C-CLAIMS-TARGETING-001. A precondition of this
criterion: `fakeDb.find` must **honour its filter** rather than returning seeded docs
unconditionally — otherwise the scoping regression is structurally invisible and a test that seeds a
claim with a foreign `evidence.sessionId` and expects it visited **encodes the bug as expected
behaviour**.
**Consequence if unmet:** indexing one session rewrites `topicRefs` on every claim in the tenant —
last-session-wins, corpus-wide, silent — on every real ingest.

### C5 — The ISS-056 invariant: a degraded claims run performs **no** claims operation of any kind
When claims extraction degraded, the caller passes `tagClaims: false` and `tagClaimsForSession` is not
reached. The invariant is deliberately broad — *no claims write of ANY kind* — and tagging is not
exempt merely because it is a non-destructive `$set`: a degraded run holds **stale** claims, and
tagging stale claims with topics derived from a fresh tree silently mixes two vintages of data.
*Verified by:* mutation — force `tagClaims: true` unconditionally and confirm the existing named
ISS-056 assertion reddens (it did: *"no claims write of any kind may happen on a degraded run"*).
Weakening or narrowing this invariant is a **critical** amendment requiring human approval.

### C6 — Corpus-wide entity `_id`s must not collide across tenants
`topics._id` and `orgs._id` are bare slugs (`internships`, `uk`), while `scopedCollection` merges
`tenantId` into the **filter** only. So for a slug tenant A already holds, tenant B's filter
`{ _id: "uk", tenantId: "B" }` matches nothing, the upsert attempts an insert, and Mongo's `_id_`
index rejects it: `E11000 duplicate key`. This is **exactly** ISS-121, whose fix was to
tenant-namespace the id (`vectorGapId(tenantId, sessionId)`, `vector-gap.ts:54`); the same shape is
un-namespaced here. Because C2's catch swallows it, tenant B loses **all** entity promotion silently
and forever, reporting `skipped: "promotion-failed"`.
*Verified by:* a two-tenant test (or a live scratch-tenant run, as ISS-121 was found) writing the same
slug for two tenants and asserting both rows exist. Either tenant-namespace the `_id`, or carry a
compound unique index and prove the upsert path uses it.
**Recorded honestly: this criterion is believed UNMET at the time of writing.** I derived it from the
code and the ISS-121 precedent; I did **not** execute a live two-tenant reproduction, so it is stated
as a criterion for the next check to settle, not as a verdict. It is in the security/tenancy class
under `.claude/CLAUDE.md`'s severity gate and is therefore **never round-capped**.

### C7 — The pure layer is pure, deterministic, and cannot invent a link
`promoteTreeEntities` performs no I/O; dedupes topics and orgs by slug; derives the slug from
`node_id`'s last path segment (**never** by re-slugifying the title, so it cannot drift from
`buildTree`'s own rule); unions `sessionRefs` across nodes; and returns rows in stable `_id` order.
`topicRefsForSession` links a claim to a topic only when the claim's session is in that topic's
`sessionRefs` — a deliberately weak rule that may over-include but **cannot invent**, because both
sides are ids that already exist.
*Verified by:* mutations on the union, the sort, and `slugOf`; plus an empty-tree boundary case.
Over-inclusion is **by design here** and is U2.3's to narrow — do not file it as a defect.

### C8 — Standing precondition: no live entity backfill while the topic source is the capitalised-phrase regex
**`scripts/backfill.mjs entities` may not be run live, and `indexSession` may not promote to live
`topics`/`orgs`, until the topic source improves or U2.2 has put a precision number on it.**
Measured off the live tree: **137 topic slugs, 131 of them single-session**, six multi-session
(`new-zealand(2) inr(2) toc-s(3) toc(2) amrita-ghulati(2) uk(2)`) — of which three are junk and
**one is a person's name**. The source is `extract-topics.ts:24` `PHRASE_RE`, runs of 1–4 capitalised
words, which cannot distinguish a topic from a person.
The honest justification for holding back is **not** "topics is user-facing" — that was checked and
falsified in cycle 1, since `GET /graph` already serves all 137 slugs straight off the tree,
`anju-jayraj` included, while reading nothing from `topics`. It is the narrower and correct one:
**do not stand up a second, authoritative representation of known noise before its precision is
measured.**
*Verified by:* live counts — `topics = 0`, `orgs = 0`, claims' `topicRefs` empty/absent — until this
precondition is lifted; and `--dry-run` remaining the default path. Lifting it requires U2.2's
precision number, and is a **critical** amendment.

### C9 — Standing gates
`pnpm -r typecheck`, `pnpm -r test`, and `npx depcruise` each exit 0 by their **own** exit code.
`lint:structure` failures traceable to the concurrent lane's `TASKS.md` / `.goal/goal.json` tracker
rows are not chargeable here — name them and move on.

## Invariants

- **[I1] Bookkeeping may never be fatal to the path it rides on.** C2 is the instance; any future
  promotion side effect inherits it.
- **[I2] Coverage is absent until a mutation proves it present.** Three guards in this layer shipped
  with a branch that never executed, and the suite was green for all of them. Assertions about a
  *body* or a *call count* are not assertions about *targeting* (C4) — the two must be checked
  separately.
- **[I3] This layer promotes; it does not improve.** No filtering, re-slugifying, renaming or
  LLM-assisted cleanup of tree entities belongs here. Fixing noisy topics is upstream work
  (`extract-topics.ts`) or U2.3's; doing it here would create a second slug rule that agrees with
  `buildTree` only until someone edits one.
- **[I4] Deferred deliverables are recorded on disk with the condition that returns them.** Cycle 2
  found the deferral recorded but *not* the fact that D4/D5 return specifically after U2.2. A
  deferral whose release condition exists only in a verdict is a deferral that becomes permanent.

## Deliberately NOT criteria, and why

- **"Write the rows live" as a criterion.** Plan §10 U2.1 does instruct it, and cycle 1 correctly
  demolished the *reasons* first given for declining — but the deferral itself was **upheld** by the
  checker on the narrower ground now recorded as C8. Turning "write live" into a criterion would put
  this contract in direct conflict with its own C8.
- **A precision or noise threshold for topic slugs (e.g. "≥ 80 % non-person").** No precision number
  exists yet; U2.2 is the unit that produces one. Inventing a threshold here would be exactly the
  fabricated-floor problem C6 of the vector contract guards against.
- **Anything about `speakers`, `decisions`, `graph_edges`.** They are named in the same plan
  paragraph and share the "schema but never a row" symptom, but no code in scope writes them.
- **A `WRITE_OPS` allow-list requirement.** Cycle 1 noted the hand-maintained list omits `deleteOne`,
  `updateMany`, `bulkWrite`, `findOneAndDelete`. It is harmless **today** only because `fakeDb`
  exposes seven methods and an unlisted op would crash rather than pass silently. It is a real
  latent gap, but it is a property of `testutils.ts` and belongs to whatever unit next owns the fake —
  not a criterion this layer can satisfy or violate.
- **`scripts/` gating (ISS-128).** Ruled on in cycles 2–3 and settled in favour of the import-resolution
  guard inside `lint:structure`. It is `structure-lint.md`'s, not this contract's.

## Amendment log

- 2026-09-09 · **START (human-approved)** · contract CREATED by /checker under `/checker
  init-contract entity-promotion`, per `qa/gates/vector-retrieval-contract.md` (2026-09-09, Umesh,
  Option 1, both layers). Criteria derived from both `promote-entities.ts` files, `tenantScope.ts`,
  the ISS-056/060/065/078/121/126/127 and ISS-C-CLAIMS-TARGETING-001 ledger rows, and the four
  verdicts that previously graded this layer against plan §10 U2.1. C4 and C6 are the two criteria
  written specifically so that the *classes* of defect this layer has produced — unasserted write
  targeting, and non-tenant-namespaced ids on corpus-wide rows — are checkable rather than
  rediscovered by mutation each cycle. C6 is recorded as believed-unmet and unverified by live
  reproduction; it is stated as a criterion, never as a verdict.
