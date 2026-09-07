# Verdict — live-verify-protocol

**VERDICT: FAIL**
**Cycle checked: 1** (matches the manifest's `Fix cycle: 1 of max 3`)
**Date:** 2026-09-07
**Checked by:** /checker, Mode A, fresh context — bound to `D:\KnowledgeBase`
**Contract:** qa/contracts/developer-api.md (the routes exercised; the contract does not itself
cover verification apparatus — judged, per the dispatch, on whether the apparatus is HONEST and
REPRODUCIBLE)
**Manifest:** qa/manifests/live-verify-protocol.md

---

## SCOREBOARD

5/6 dispatch criteria met, 0 blocking design defects, 1 honesty defect in the shipped artifact.

| # | Claim under test | Result |
|---|---|---|
| 1 | Reproducibility — two runs, two fresh folders, same verdicts | **PASS** |
| 2 | Never seeds or mutates application content | **PASS (design)** / **FAIL (disclosure)** |
| 3 | Collection counts are true (11 populated / 13 empty, named) | **PASS** |
| 4 | `DIRTY-TREE` cannot mask a real failure | **PASS** |
| 5 | Self-caught bug: `sources:{internal,web}` + sessionRef resolution | **PASS** |
| 6 | `pnpm lint:structure` exit 0 | **PASS** |

---

## What I re-ran myself (nothing below is taken from the manifest)

**Environment.** `apps/api` was already listening on :3300 (PID 43448) and `apps/web` on :5173
(PID 43936) against the real remote Mongo. Nothing needed starting. Remote Mongo was reachable
throughout — no INCONCLUSIVE was warranted on any check.

**1. Reproducibility — PASS.**
Minted my own credential rather than reusing the maker's:
```
$ node scripts/mint-key.mjs --label checker-live-verify
lv_690b4d28…f625455b2ae2e
$ curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer lv_690b…" localhost:3300/sessions
200
$ curl -s -o /dev/null -w "%{http_code}" localhost:3300/sessions      # no key
401
```
Then two full runs, back to back:

| | run 1 | run 2 |
|---|---|---|
| evidence folder | `qa/evidence/live-2026-09-07-01-38-36/` | `qa/evidence/live-2026-09-07-01-39-11/` |
| exit code | 0 | 0 |
| overall | PASS | PASS |
| verdict lines | 18 | 18 |

Every one of the 18 check lines carried an identical verdict across both runs (DIRTY-TREE ×1,
PASS ×13, STUB ×2, MISSING ×1, plus the two /ask assertions). Two fresh dated folders appeared,
each with `preflight.json`, `summary.md`, and 13 raw response bodies under `api/`. The only
between-run difference was the dirty-file count (10 → 11), and that is the tool counting its own
previous evidence folder — see ISS-027. **The reproducibility claim, which is this unit's entire
reason to exist, holds.**

**2. Never seeds or mutates — design PASS, disclosure FAIL.**
Read `scripts/live-verify.mjs` line by line and grepped it for every write verb
(`insert|update|delete|replace|drop|seed|createIndex|bulkWrite|buildTree|ingest|PUT|PATCH`):
the only hits are in comments and in the `summary.md` string literals. Confirmed positively:
- It does **not** import or invoke `seed-demo-server.mjs` (no reference of any kind).
- It does **not** rebuild `tree_index` and does **not** ingest.
- Its Mongo use is `connect()` + `countDocuments()` only (:103–110, :210).
  `packages/db/src/client.ts` `connect()` is a bare `MongoClient.connect` — no migrations, no
  index creation, no write on connect. Verified by reading the file.
- HTTP surface is 12 GETs plus exactly one `POST /ask`. No write route is touched.

Keeping key-minting in its own script is the right call and it is what made this check possible
for me at all — I never had to run the seeder.

**But the disclosed magnitude of the one permitted side effect is wrong, and the wrong number is
written into every evidence artifact the tool emits.** `live-verify.mjs:236` writes into each
`summary.md`: *"`POST /ask` exercised — appends one real `jobs` ledger row"*. I measured the real
delta directly in Mongo, per run window:

```
run1 (01:38:36–01:39:05)  jobs +20   {ask:2, ask.select_nodes:1, evaluator:8,  ask.score:8,  ask.answer:1}
run2 (01:39:11–01:40:00)  jobs +26   {ask:2, ask.select_nodes:1, evaluator:11, ask.score:11, ask.answer:1}
```

20–26 rows, not one — and non-deterministic between runs. `jobs` is one of the 24 collections
whose counts this same tool reports as headline evidence, so each run measurably contaminates a
number it prints, by 20–26× what it discloses. In a unit built specifically so that claims are
measured rather than asserted, an asserted constant that is off by an order of magnitude is the
defect the unit exists to eliminate, shipped inside the unit itself. **This is the FAIL.**
(ISS-024 — the fix is small and makes the tool better: measure `countDocuments('jobs')` either
side of the /ask call and print the real delta.)

**3. Collection counts — PASS, exactly.**
Queried Mongo independently, with my own script against the `mongodb` driver directly (not the
project's `packages/db` wrapper, not the maker's script), driving the collection list off
`schema/*.schema.json` the same way:

```
TOTAL: 24
POPULATED(11): api_keys=5 | claims=81 | eval_runs=4 | jobs=178 | meeting_candidates=13 |
               session_pages=24 | sessions=26 | sources=26 | tree_index=1 |
               trusted_senders=1 | turns=2118
EMPTY(13):     chunks | consent_policies | decisions | features_event | gaps | graph_edges |
               media | orgs | programs | speakers | tenants | topics | watched_sources
```

**Both lists match the manifest name-for-name.** 11 populated, 13 empty, 24 total. The headline
finding — no vector layer (`chunks`), and no `topics`/`speakers`/`decisions`/`graph_edges`
despite all four having schemas — is confirmed true. Absolute counts have moved since the
manifest snapshot (`jobs` 108→178, `api_keys` 4→5) but that is expected drift plus my own two
runs and my own minted key; the populated/empty partition is unchanged and correct.

One honest nuance the tool handles gracefully rather than hides: `db.listCollections()` returns
23 collections, and `features_event` and `gaps` do not physically exist yet. `countDocuments` on
a non-existent collection returns 0, so they land in EMPTY, which is the truthful answer.

**4. `DIRTY-TREE` cannot mask a real failure — PASS.**
Reasoned through the code rather than trusting the manifest's assurance. `DIRTY-TREE` is assigned
at exactly one site (:86–92), the preflight attribution check, where it replaces that check's
`PASS`. It is never assigned anywhere else and never consulted by any other check. `overall`
(:223–227) is `FAIL` if **any** check is FAIL, else `INCONCLUSIVE` if any is INCONCLUSIVE, else
`PASS`. A genuinely broken app therefore still produces FAILs at the route/reconcile/citation
checks, and any single one of those drives `overall: FAIL` with exit 2, dirty tree or not.
**No, a broken app cannot ride a dirty tree to PASS.** The design is sound and the manifest's
reasoning for splitting DIRTY-TREE out of FAIL is correct — conflating "this evidence isn't
attributable to a commit" with "the app is broken" would have been the worse bug.

Related but distinct, and filed rather than failed (ISS-027): DIRTY-TREE sits in neither ladder,
so a run whose own summary says it is *"not valid as final acceptance evidence"* still prints
`overall: PASS` and exits 0. That does not hide a failure, but it does hide a caveat from any
machine consumer reading the exit code.

**5. The self-caught bug — PASS, both halves, and the fabricated-citation case demonstrated.**
Read the current code at :191–216 and confirmed it does both things claimed:
- It asserts the real shape — `ask.sources?.internal ?? []` and `ask.sources?.web ?? []`, not a
  flat array. I checked the raw body this run actually produced
  (`api/POST_ask.json`): top-level keys `verdict, reason, scored, web_used,
  insufficient_coverage, sources, answer, auditLog`, with `sources.internal` an array of
  `{node_id, evidence:{sessionRef}}` and `sources.web: []`. So the manifest's account of the
  false FAIL is accurate: a flat-array assertion would indeed have produced `0 citations` against
  a perfectly good answer.
- It resolves every cited ref in Mongo (:207–215).

I did not take the resolution check's efficacy on faith — I ran its exact query myself against
the live DB with the three real refs, and again with one substituted for a plausible-looking
fabrication:
```
real             3/3  PASS
with-fabricated  2/3  FAIL    (id: 2026-09-01-totally-fabricated-session)
```
**A hallucinated citation id would be caught.** One residual gap, filed not failed (ISS-025):
the comparison is `found === refs.length`, and `refs` is built with `.filter(Boolean)`, so if
internal sources existed but none carried an `evidence.sessionRef`, `refs` would be `[]`,
`found` would be `0`, and `0 === 0` records PASS vacuously.

**6. `pnpm lint:structure` — PASS, exit 0.**
```
lint-loc: OK (209 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (239 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1080 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (239 modules, 702 dependencies cruised)
EXIT=0
```
I verified the three new scripts really are subject to the budget rather than silently exempt:
`structure.config.json` has `roots` including `scripts` and `loc.extensions` including `.mjs`,
`loc.max` 300 — so yes, covered, and yes, within budget. (Their stated LOC figures in the
manifest are nonetheless wrong — ISS-028.)

---

## FAILURES

- **[honesty] sev: high** · `live-verify.mjs:18-19,236` discloses that `POST /ask` "appends one
  real `jobs` ledger row"; measured reality is 20–26 rows per run and non-deterministic, and the
  false figure is written into every generated `summary.md`. `jobs` is one of the 24 counts the
  tool reports, so each run contaminates its own evidence by 20–26× the disclosed amount ·
  Fix: measure `countDocuments('jobs')` before and after the /ask call and print the real delta —
  a measured side effect instead of an asserted one, which is this unit's own principle ·
  issue: ISS-024

## Non-blocking findings (filed, not charged against this cycle)

- **sev: medium** · citation-resolution passes vacuously when `refs` is empty · ISS-025
- **sev: medium** · STUB/MISSING pinned to exact status codes — implementing `/health` or
  `/search` would flip them to FAIL, so the suite penalises progress · ISS-026
- **sev: medium** · DIRTY-TREE absent from the overall/exit-code ladder; also each run's own
  evidence folder dirties the tree the next run measures · ISS-027
- **sev: low** · manifest's LOC figures for all three scripts match neither total nor non-blank
  lines · ISS-028

**ISSUES-WRITTEN:** ISS-024, ISS-025, ISS-026, ISS-027, ISS-028

---

## Assessment

This is good, genuinely useful apparatus, and I want to be clear that the FAIL is narrow. The
reproducibility claim — the thing the unit was built for — holds under an independent double run
with my own credential. It does not seed, does not rebuild `tree_index`, does not ingest, and
keeping key-minting in a separate script is exactly the right structural answer to the bypass
that motivated this work; I could complete this entire check without ever touching the seeder,
which is the proof that the separation works. The 11/13 collection split is true to the name.
`DIRTY-TREE` genuinely cannot mask a failure. The self-caught false FAIL is real, correctly
diagnosed, correctly fixed, and the hardening that followed it demonstrably catches a fabricated
citation id — I reproduced that rather than trusting it.

It fails on one thing, and it is the thing this unit is *about*. The tool writes a specific
quantitative claim about its own side effect into every piece of evidence it produces, and that
claim is wrong by 20–26×, against a collection whose count the same document reports as a
headline fact. A verification apparatus does not get graded leniently on the accuracy of its own
disclosures; that is the whole product. The remedy is a few lines and leaves the unit strictly
better — measure the delta instead of asserting it. Re-submit as cycle 2 with ISS-024 fixed
(ISS-025–028 are worth folding in at the same time but are not what is blocking the PASS), and
ideally re-run once the tree is clean so the next cycle's evidence is attributable to a commit.

Manifest's "Issues addressed: none pre-existing" — confirmed against the ledger; nothing in
qa/issues.jsonl was claimed by this unit, so nothing was wrongly closed.
