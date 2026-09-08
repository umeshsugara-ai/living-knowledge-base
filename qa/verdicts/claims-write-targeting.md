# Verdict — claims-write-targeting

**Cycle checked: 1**
**Date:** 2026-09-08
**Contract:** qa/contracts/tree-index-v2.md
**Manifest:** qa/manifests/claims-write-targeting.md (Status: ready-for-check, Fix cycle 1)
**Unit commit:** 5addd42
**Mode:** A (unit check), bound to `D:\KnowledgeBase`

## VERDICT: PASS

```
VERDICT: PASS
SCOREBOARD: 1/1 applicable criteria met, 2/2 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: ISS-C-TOPICREFS-ARG-001 (medium)
EXPLANATION: I re-derived both recorded reproductions of ISS-C-CLAIMS-TARGETING-001 myself with
mutate.mjs rather than trusting the pasted counts, and both are now killed at the manifest's
stated counts (141/1 and 140/2) by two distinct tests. The test-fake change is sound and weakens
nothing: only four call sites seed `claims:` at all and every one of them seeds on the session
being indexed, so no test now silently degrades to the empty branch. One further mutation
survives — the sessionId ARGUMENT to `topicRefsForSession` — but it is a fixture limitation of
medium severity in a non-live, intra-tenant, independently-tested path, so per this repo's
severity gate it is a ledger line, not a fix cycle.
```

## What I re-ran myself

Every command below was executed by me in `D:\KnowledgeBase`. Nothing here is the maker's pasted
output. Every mutation was armed with `node scripts/lib/mutate.mjs apply`, tested, restored with
`mutate.mjs restore` ("verified identical to HEAD"), and the run closed on `MUTATIONS CLEAN: none
outstanding`.

| # | What | Result |
|---|---|---|
| 0 | `pnpm --filter @lkb/api test` (baseline) | **142 pass / 0 fail** |
| A | `.find({"evidence.sessionId": sessionId})` → `.find({})` | **141 pass / 1 fail** — killed |
| B | `.updateOne({_id: c._id}, …)` → `.updateOne({}, …)` | **140 pass / 2 fail** — killed |
| C | `claimsColl(tenantId)` → `claimsColl("ATTACKER")` in `tagClaimsForSession` | **141 / 1** — killed |
| D | topics+orgs upsert filters `{_id: t._id}`/`{_id: o._id}` → `{}` | **141 / 1** — killed |
| E | `catch (err) {` → `catch (err) { throw err;` (the never-throws path) | **141 / 1** — killed |
| F | `topicRefsForSession(sessionId, topics)` → `topicRefsForSession("s2", topics)` | **142 / 0 — SURVIVES** |
| G | `pnpm -r typecheck` | clean (all workspaces Done) |
| H | `pnpm -r test` (whole repo) | all workspaces green, apps/api 142/142 |
| I | `pnpm lint:structure` | `tracker-audit: OK (gate G1)` · no dependency violations (289 modules) |
| J | live Mongo read-only probe (my own script, not the maker's) | topics 0 · orgs 0 · claims 81 · claims with non-empty `topicRefs` **0** |

### 1. Both recorded reproductions are killed — re-derived, not trusted

The manifest's headline claim is the one that mattered, and it holds exactly as written. Failing
test names, from my own runs:

- Mutation A → `✖ ISS-C-TARGETING: the claims read is scoped to THIS session, not the whole collection`
- Mutation B → the same test **plus** `✖ ISS-C-TARGETING: each claim update targets ONE claim by _id, never an open filter`

The different counts are load-bearing and the maker was right to point at them: B failing two tests
while A fails one proves the two assertions pin two distinct defects rather than both tripping on a
single shared symptom. Had B failed only the same one test as A, the second assertion would have
been decorative.

**Measured against the ledger's own recorded reproductions (D-015):** ISS-C-CLAIMS-TARGETING-001
records exactly two reproductions, (a) the `find` widening and (b) the `updateOne` widening.
**ISS-C-CLAIMS-TARGETING-001: 2/2 killed.** None left open, none omitted. The manifest does not use
the by-issue-id numeric format D-015 asks for, but it re-runs and reports both recorded cases with
their individual counts, so the substance of the rule is satisfied; the formatting gap is already
filed as ISS-134 and the maker discloses it as owed. Not charged here.

The issue's `fix_direction` listed four asks. All four landed: (1) the `find` filter is asserted
(`assert.deepEqual(find!.filter?.["evidence.sessionId"], "s1")`); (2) each `updateOne` filter is
asserted pairwise against the seeded fixture (`writes.map(w => w.filter?._id)` deep-equalled to
`["mine"]`, and to `["c1","c2"]` in the two-claim case); (3) `fakeDb.find` now filters; (4) the
cycle-3 clearing test that seeded `sessionId: "other"` and expected it visited — the one that
encoded unscoped behaviour as expected — now seeds on `s1`.

**ISS-C-CLAIMS-TARGETING-001 → `fixed`** in `qa/issues.jsonl`. Its hard precondition ("must close
BEFORE U2.2/U2.3 enables any live entity backfill") is **satisfied**: the two widenings it named
are now both defended, and nothing has been written live in the interim (probe J).

### 2. The test-fake change (the maker asked for this specifically, and was right to)

Changing the fake is test-infrastructure and it can cut both ways, so I checked both directions.

**Does it weaken any other test?** No. `fakeDb` is used at 46 call sites across three test files,
but the new filtering only ever affects a call site that passes `claims:` — with the default `[]`
the filter runs over an empty array and returns an empty array either way. There are exactly four
such call sites, all in `promote-entities.test.ts`, and every one seeds evidence on `s1`, the
session actually being indexed:

- line 121 — two claims on `s1`; still asserts `claimWrites.length === 2` and `res.claimsTagged === 2`
- line 145 — one claim on `s1`; still asserts the claim is visited
- the two new targeting tests — one deliberately seeds a second claim on `s-other` and asserts it is *not* written

That last point is the important one: no test now silently drops to zero rows and passes on a
vacuous assertion. Each surviving claims test still asserts a **positive** write count, so if the
filter were over-aggressive the suite would redden rather than quietly assert nothing. Empirically
the whole repo is green (run H), which is consistent.

**Is the new filtering itself correct?** Yes, on the three points that matter.

- **Array semantics match Mongo.** `claims.evidence` is an array of `{turnId, sessionId}`
  (`packages/core/src/domain/purge-policy.ts:81`, `Claims["evidence"]`). Mongo's dotted
  `{"evidence.sessionId": x}` on an array of subdocuments matches when *any* element matches; the
  fake's `Array.isArray(ev) && ev.some(e => e.sessionId === want)` is exactly that. A fake that
  filtered on `ev[0]` only would have been the "filters wrongly" failure mode — it doesn't.
- **The `want === undefined` fall-through is deliberate and is what makes mutation A visible.**
  Under `.find({})` the recorded filter is `{tenantId: "t"}` (merged by `scopedCollection`), the
  key is absent, so the fake returns *both* seeded rows, `claimsTagged` becomes 2, and the
  scoped-read test fails. That is the branch doing its job.
- **It does not model tenantId, and that is fine here** — but only because tenant scoping of this
  read is covered elsewhere, which I verified rather than assumed. Mutation C (`claimsColl(tenantId)`
  → `claimsColl("ATTACKER")` on both the read and the write) reddens
  `EVERY query AND every write indexSession issues is confined to its own tenant (ISS-060, ISS-061)`
  in `session.test.ts`, which asserts over the recorded filters. So the security-class property on
  this seam is defended by a different test, not by the fake's row filtering.

One narrow note, not a finding: the fake compares `want` with `===`, so if production ever addressed
claims with `{$in: [...]}` or a regex the fake would return `[]` and a test could silently assert on
the empty branch. No current code does. Worth a comment if the query shape ever changes.

### 3. The hunt for the next unreachable path

The dispatch was right that this deserved pressing on — this maker has now shipped three guards
whose branch never executed, so I mutated rather than reading. I probed each path named in the
dispatch plus the obvious neighbours.

**Covered (mutation killed):** the topics upsert filter and the orgs upsert filter (D — killed by
the unit's own new third test, which is therefore not decorative); the promotion's never-throws path
(E — `ISS-126: promotion NEVER THROWS` genuinely reddens when the catch rethrows, so that guard is
live, unlike its three predecessors); the claims read *and* write tenant confinement (C).

One methodological note on E, because it nearly produced a false clean: my first attempt to insert
the `throw` used a `perl -0pi` substitution that silently matched nothing against this file's CRLF
line endings, and the suite came back 142/142. That would have read as a surviving mutation. I
confirmed the edit landed by reading the file back before believing the result — a no-op mutation
looks exactly like a well-defended one, which is worth stating out loud in a repo that judges by
mutation.

**Not covered (mutation survives) — the one finding:**

`promote-entities.ts:96` — `topicRefsForSession(sessionId, topics)` → `topicRefsForSession("s2", topics)`
leaves the suite at **142 pass / 0 fail**.

The cause is the fixture, not the assertions. `treeRoot()` in `promote-entities.test.ts:24-30`
builds exactly one topic node whose `evidence.sessionRefs` is `["s1", "s2"]`, so
`topicRefsForSession` returns `["visa-rules"]` for either session and no test can distinguish which
sessionId was passed. No test builds a tree containing a topic that *excludes* the indexed session.

This is the same class the unit exists to close — an unasserted predicate deciding what a write
carries — but one layer in: the targeting of the tag *content* rather than of the *row*. I am
filing it **medium**, not high, and deliberately not opening a unit for it:

- `topicRefsForSession` itself is independently and well tested at
  `packages/index/src/tree/promote-entities.test.ts:114-121`, including the exact negative case
  (`"an unknown session links to nothing, never to everything"`). The function's logic is defended;
  only the argument wiring at this one call site is not.
- The shipped argument is correct. This is coverage, not a live defect.
- It is intra-tenant data correctness — not tenancy, auth, cross-tenant read, or credential
  handling — so it is **not** the never-capped security class under D-014's class-based round cap.
- The path is not live (probe J).

Per the severity gate: one-line ledger entry, verified inside the next unit that touches
`promote-entities.ts`. Filed as **ISS-C-TOPICREFS-ARG-001**. Prior PASSed verdicts naming this seam:
one (`promote-tree-entities` cycle 3), so the 2-PASS cap is not reached either way — but a medium
finding does not become a unit regardless.

### 4. No regression, and no live write

`pnpm -r typecheck` clean, `pnpm -r test` green across every workspace with apps/api at 142/142,
`pnpm lint:structure` clean (`tracker-audit: OK (gate G1)`; no dependency violations, 289 modules /
883 dependencies cruised).

Live state, read with my own probe against `mongodb://13.202.206.101:27017` db `lkb` via the
MongoDB driver (ICMP is filtered there; I did not ping):

```json
{ "dbName": "lkb", "topics": 0, "orgs": 0, "claims": 81,
  "claims_with_nonempty_topicRefs": 0, "claims_without_topicRefs_field": 9 }
```

`topics` and `orgs` are still **0 rows**, and **0 of 81 claims** carry a non-empty `topicRefs` —
the U2.1 deferral is intact and this unit wrote nothing live, exactly as disclosed. (9 of the 81
lack the `topicRefs` field entirely rather than carrying `[]`. That predates this unit and is not
attributable to it; noting it only because a future backfill's idempotency check should not assume
the field exists on every row.)

## Scoreboard reasoning, stated plainly

`tree-index-v2` is a contract about the tree-index *generator* in `packages/index`; C1–C4 address
topic/org extraction, tree levels, `regenerate()`, and the real-data integration test, none of which
this unit touches. Only **C5 (no regression: typecheck, tests, gen:types, schema validation,
lint:structure all clean)** genuinely applies, and it holds. I judged the rest of the unit against
the issue it exists to close and against the two standing invariants it could have broken — no live
write on a deferred path, and no weakening of an existing test — both of which hold.

I am **not** returning `CONTRACT_MISMATCH`, because the precedent is settled: `promote-tree-entities`
was PASSed against this same contract at cycle 3, so the project has already accepted it as the
umbrella for this persistence layer. But the maker's own disclosure is correct and this is now the
**fourth** consecutive check in which a checker has graded this writer against a plan bullet rather
than criteria written for it. That is a real gap in the ground truth, not a formality — a unit
whose applicable-criteria count is 1 is a unit whose contract is doing almost no work. It stays on
the owed list, unchanged by this PASS.

## Ledger

- `ISS-C-CLAIMS-TARGETING-001` → **fixed** (2026-09-08). Both recorded reproductions re-derived and
  killed; all four `fix_direction` asks landed. Moves to `verified` only on a later re-check.
- `ISS-C-TOPICREFS-ARG-001` → **open**, medium, new. See §3.
