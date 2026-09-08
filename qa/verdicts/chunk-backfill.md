# Verdict — chunk-backfill

**Date:** 2026-09-08
**Mode:** A (unit check)
**Contract:** qa/contracts/ingest-indexing-pipeline.md (+ qa/contracts/schema-v2.md [C8], which the
manifest's live evidence actually discharges)
**Manifest:** qa/manifests/chunk-backfill.md
**Cycle checked:** 1
**Checked at:** HEAD = 36d0496 ("U1.0: backfill chunks (0 -> 1452) + fix Gemini's 100-per-batch embed limit")
**Bound to:** D:\KnowledgeBase

---

## VERDICT: PASS

**SCOREBOARD:** 8/8 contract criteria met (C1–C8 incl. 1a/2a/3a, judged over the unit's blast
radius), 3/3 C8 row-level clauses discharged live, 4/4 mutation probes behaved as required.

---

## What I re-ran myself (nothing below is the maker's pasted output)

| Check | My result |
|---|---|
| `pnpm -r typecheck` | **exit 0** (10 projects) |
| `pnpm --filter @lkb/ai test` | **exit 0 — 74 pass / 0 fail** (matches claim) |
| `pnpm --filter @lkb/api test` | **exit 0 — 121 pass / 0 fail** (matches claim) |
| `pnpm -r test` (full workspace) | **exit 0** — core 7, db 13, ai 74, ask 32, ingest 41, index 178, meeting-bot 40, api 121 |
| `node scripts/backfill-chunks.mjs --dry-run` | **exit 0**, `26 session(s) would produce 1452 chunk(s)`, no writes |
| `lint-loc` / `lint-dirsize` / `lint-root` / `lint-dupes` / `lint-migrations` / `snapshot --check` / `depcruise` — each **individually by exit code** (ISS-100) | **all exit 0** |
| `tracker-audit --gate g1` | **exit 1** — see "The g1 failure" below |
| Live corpus probe — **checker-authored script, not the maker's** | see below |

### Live corpus — my own probe, driver-level (not ping)

The contract's "Disclosed limitation" block is stale: it says `13.202.206.101:27017` is unreachable
based on a `ping` with 100% loss. ICMP is filtered on that host; a TCP/driver connection succeeds.
I connected with the MongoDB driver directly and scanned every row rather than trusting `distinct`:

```
total chunks: 1452
distinct sourceRef (sessions with chunks): 26 | sessions in db: 26
dims values: [ 3072 ] | models: [ 'gemini-embedding-001' ] | tenants: [ 'toc' ]
rows scanned: 1452
rows where vector.length != dims: 0
empty vectors: 0
rows with forbidden text field: 0
distinct turnRefs: 2118 | resolving to real turns: 2118 | dangling: 0
total turns in db: 2118
sessions with NO chunks: 0 []
```

Every number in the manifest reproduces exactly. **schema-v2 [C8] is now fully discharged:**
(a) `chunks` non-empty for **26/26** sessions — this is the clause the previous sweep measured
FAILING at 23/26; (b) `vector.length === dims` for **100% of 1452 rows**, checked row-by-row rather
than by `distinct` (a `distinct` on `dims` cannot see a per-row mismatch, so I did not rely on the
maker's framing of it); (c) **2118/2118** turnRefs resolve, 0 dangling — and 2118 is the exact total
turn count, so every turn in the corpus is reachable from the vector index. ADR-0001's struck `text`
field is absent from all 1452 rows.

---

## The four things the manifest asked me to press on

### 1. Is the extraction genuinely behaviour-preserving? — YES, and the guarantees are mutation-proven

I diffed `writeSessionChunks`'s extracted body against the block it replaced in `indexSession`
line-for-line. It is a **move, not a rewrite**: same `buildChunks`, same arity assertion, same
per-chunk dims assertion, same delete-then-insert order, same `console.warn` text, same swallow.
The only additions are the `{written, skipped}` returns. `indexSession` calls it and ignores the
result, which is exactly the prior behaviour.

Both standing guarantees survive, and I did not take that on reading alone:

- **ISS-112** (C8 assertions must sit INSIDE the try, so a contradictory batch cannot throw past the
  catch and skip `tree_index` + the status flip) — the assertions are inside the `try` at lines
  103–127, and the `catch` at 133 is the only exit. Mutating `skipped: "embedding-failed"` →
  `skipped: null` killed **2** tests, one of which is specifically the ISS-112 contradictory-batch
  case.
- **ISS-056 / ISS-060 / criterion 3a** (tenant-confined via `scopedCollection`, never the raw
  handle) — the extracted function opens with
  `scopedCollection<Chunks>(db as never, "chunks")`. I mutated it to a raw
  `db.collection<Chunks>("chunks")` that ignores the tenant; the suite went red on
  *"every chunk write is tenant-scoped — the same guard the claims path needed"*. The security-class
  invariant is genuinely fenced, not merely re-typed.
- The delete still runs only after every assertion passes, so ISS-056's "delete without a
  replacement in hand" shape is not reintroduced.

`buildRouting()` extraction in `production.ts` is likewise a pure move — `buildProductionDeps()` now
destructures exactly what it used to build inline, and the backfill imports the same function, so the
offline job cannot drift from the server's chain config or provider set. That was the right call and
the alternative (a script registering its own providers) is the drift this avoids.

### 2. Are the 4 new `providers.test.ts` tests a guard or documentation? — **A REAL GUARD.** Proven by mutation.

I did not judge these by reading them. Two independent mutations:

- **`MAX_BATCH` 100 → 1000** (i.e. the fix effectively removed): **3 of the 4 fail** —
  the split test, the cross-batch dimension-change test, and the short-second-batch/offset test.
- **`vectors.push(...batch)` → `vectors.unshift(...batch)`** (concatenation order corrupted, split
  intact): **the 4th fails** — *"a split batch preserves ORDER across call boundaries"*.

So all four are load-bearing, and between them they pin every property the fix claims. I especially
credit that each case is sized **over** the boundary (237 / 250 / 150 / 150 texts): the reason this
bug survived U1.1–U1.3 is that every fixture ran at 2–3 texts, and these tests fix that specific
blind spot rather than re-testing what already worked. The cross-batch dimension test is the subtle
one and it is correct — per-batch arity genuinely cannot see it, which is why keeping the combined
check after the split was necessary.

The bug itself is real and well-characterised: the failure set was **exactly the three largest
sessions**, a monotone cutoff between 230 and 134 turns — size-dependent, not content-dependent.
576 chunks / 40% of the corpus, and the most content-rich sessions, would have been silently absent
from a vector index that looked populated. I accept the maker's framing that the `{written, skipped}`
return is the only reason this surfaced instead of being reported as a completed backfill; the
mutation at §1 (flipping `skipped` to `null`) demonstrates precisely that.

### 3. D-018, the SECOND dirsize override raise in one day — **I ACCEPT IT, on the record, with a bound**

D-017 reserved a reviewer's right to reject the override and require consolidation instead. I am
that reviewer and I considered rejecting it. I accept, for reasons I will state so a later reviewer
can hold me to them:

- The mechanism is **not** loosened. `dirsize.maxFiles` stays 30; only `overrides.scripts` moves
  31 → 32. I verified `lint-dirsize` exits 0 at 32 and that no other directory gained room. D-016's
  actual defect (a global raise disguised as a per-directory one) is not repeated.
- D-017's condition was that **consolidation be checked first**, and D-018 discharges it with a
  specific, checkable reason rather than a gesture: no existing script performs an indexing
  operation, so folding a backfill into one would couple unrelated concerns purely to dodge a file
  count. I read all 32 entries of `scripts/` and agree — the plausible merge candidates
  (`transcribe-*`) belong to an unrelated concern and to other work in flight; demanding this unit
  refactor them would be off-topic churn, not consolidation.
- The distinction D-018 draws — a **durable entrypoint**, not a one-shot migration — is correct.
  Any chunker or embedding-model change requires a re-embed, so the file does not become deletable
  after one run.
- The accretion is visible in the diff and in the log precisely because D-017 chose an explicit map.
  The mechanism is working as designed.

**The bound I am attaching:** D-018's own sentence — *"if a third raise is proposed, that should be
treated as a signal to consolidate rather than to widen again"* — is now a checker-recorded
condition, not merely the maker's good intention. A future unit proposing `overrides.scripts` 32 → 33
should expect this criterion to be judged as consolidate-or-justify-at-length, and I would not
accept a third raise on the strength of "the mechanism keeps it visible" alone. Visibility is not a
budget.

I also credit that the raise was disclosed in the manifest as something a checker is entitled to
reject, rather than buried in a config diff.

### 4. The `tracker-audit --gate g1` failure — **claim VERIFIED, not accepted on assertion**

The manifest says g1 is pre-existing and owned by the concurrent `lane/a-speakers`. I checked rather
than believed:

- g1 fails with exactly 2 findings, both about `U2.4`: status `"partial"` is not in the known set,
  and it diverges from `goal.json`'s `"pending"`.
- `git log -- TASKS.md` shows the `"partial"` value was introduced in **388edf0** *("qa: record U2.4
  as partial, not done")*, which **pre-dates** this unit's commit 36d0496.
- At 388edf0, `goal.json` already read `pending` for U2.4 — so the divergence existed in full before
  this unit.
- `git show --stat 36d0496` touches **neither** `TASKS.md` **nor** `.goal/goal.json`.

The claim holds completely. ISS-117 is filed with the correct owner and a sane fix direction. I am
**not** failing this unit for it: the maker cannot fix it without editing another lane's in-flight
tracker row, which is the collision the lane rule exists to prevent. The maker was right to file and
not fix.

**But it must be said plainly, because the manifest is right that it matters:** `pnpm lint:structure`
is **red for every session in this repo** until ISS-117 is closed, and that is a definition-of-done
gate. ISS-117 stays **open** and I am raising its practical urgency in this verdict — a repo-wide red
gate is worth more than its `medium` label suggests, because a permanently-red gate is one people
learn to skip.

---

## Contract criteria

| # | Criterion | Verdict |
|---|---|---|
| 1 / 1a | `summarize.ts` no-fabrication + fallback must not overwrite a good page | **met** — untouched by this unit; re-confirmed still present, full suite green |
| 2 / 2a | `claims.ts` `{claims, degraded}`; delete and insert under the same condition | **met** — untouched; re-confirmed |
| 3 | `indexSession` writes pages/claims, updates `tree_index`, flips status | **met** — extraction is behaviour-preserving (§1) |
| 3a | every query tenant-confined via `scopedCollection`, never the raw handle | **met — mutation-proven** (§1); the extracted function preserves it |
| 4 | ingest stores swallow a rejected indexing call | **met** — untouched |
| 5 | `production.ts` wires a real bound indexer | **met** — `buildRouting()` extraction preserves it and is now shared with the offline job |
| 6 | No regression: typecheck / `pnpm -r test` / `lint:structure` exit 0 | **met for this unit** — typecheck 0, full suite 0, and every structure gate 0 **except** the pre-existing `tracker-audit g1` proven above to belong to another lane (ISS-117) |
| 7 | Real unit-test coverage | **met, and exceeded** — 8 new tests, all 8 mutation-proven load-bearing |
| 8 | Real live verification | **met** — my own driver-level probe over 1452 real rows |
| **schema-v2 [C8](a)(b)(c)** | chunks non-empty 26/26 · `vector.length===dims` 100% · turnRefs resolve | **all three discharged live** (26/26 · 0/1452 mismatch · 0 dangling) |

---

## FAILURES

None.

## ISSUES-WRITTEN: none

Per this repo's verdict rule (`.claude/CLAUDE.md`), `ISSUES-WRITTEN: none` is a complete and
creditable check. I looked for a reason to fail this unit — including the two disclosures that
invited it — and did not find one I would defend. I am not manufacturing a finding to look diligent.

**Ledger updates made:**
- **ISS-116** (high) `open → fixed` — the >100 batch rejection, mutation-proven fixed.
- **ISS-113** (medium) `open → fixed` — C8 row-level; (a) was measured failing at 23/26 by the prior
  sweep and is now **26/26**; (b) and (c) re-discharged on my own probe.
- **ISS-117** (medium) stays **open** — correctly owned by `lane/a-speakers`; see §4.

## Low-severity notes (NOT backlog items, per the repo's severity gate)

1. `apps/api/src/indexing.ts:157` — `indexSession` still declares
   `const chunksColl = scopedCollection<Chunks>(db as never, "chunks");`, which became **dead** when
   the chunk block moved into `writeSessionChunks`. Zero behavioural impact, no lint breach, no
   tenancy implication. Worth deleting in the next unit that opens this file; not worth a unit.
2. The contract's "Disclosed limitation" block still asserts the Mongo host is unreachable on the
   strength of a `ping`. ICMP is filtered there; the host answers a driver connection fine, as this
   check demonstrates. That block is now historical and slightly misleading to a future reader. Not
   amended here — it is a narrative section, not a criterion, and I do not edit contracts inside a
   pending verdict without cause.
3. The manifest cites C8 against `ingest-indexing-pipeline.md` while C8 actually lives in
   `schema-v2.md`. The evidence is correct and complete; only the citation is loose. Noted so a
   future reader following the reference does not conclude the criterion is missing.

## EXPLANATION

This is the strongest unit I have checked in this repo, and the reason is methodological: the batch
bug was found **by running the thing against the real corpus**, not by reasoning about it, and the
`{written, skipped}` return that surfaced it was added by the same unit. Three PASSed units
(U1.1–U1.3) had shipped a capability that never produced a single row, and every one of their
fixture tests would have kept passing forever — the failure was invisible precisely because it was
size-dependent and the fixtures were small. That is a real lesson about this project's test
convention, not just about Gemini's API.

I verified rather than accepted every disclosure: all four mutation probes behaved as the manifest
implies (3 tests die on `MAX_BATCH`, the 4th on concatenation order, 2 on the `skipped` return, 1 on
tenant scoping), the g1 failure is provably pre-existing and belongs to another lane, and all six
live corpus numbers reproduce under a probe I wrote myself. On D-018 I exercised the review right
D-017 reserved and accepted the raise on its merits, while recording that a third raise must
consolidate — the accretion warning is now the checker's condition and not only the maker's promise.

The one thing that should not be lost in a PASS: `pnpm lint:structure` is red repo-wide on ISS-117,
which is another lane's row but everyone's gate.
