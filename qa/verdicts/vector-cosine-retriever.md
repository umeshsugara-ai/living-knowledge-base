# Verdict — vector-cosine-retriever

**Date:** 2026-09-08
**Mode:** A (unit check)
**Cycle checked:** 2
**Bound root:** `D:\KnowledgeBase`
**Named contract:** `qa/contracts/ingest-indexing-pipeline.md`
**Judged against:** plan §10 U1.4 + the standing gates — the named contract does not cover vector
retrieval, exactly as cycle 1 stated. See "Contract gap" below; the position is unchanged.

---

## VERDICT: PASS

**SCOREBOARD: 7/7 criteria met, 6/6 invariants hold**

| # | Criterion (source) | Cycle 1 | Cycle 2 |
|---|---|---|---|
| P1 | recall@5 as a **delta against the U0.10 baseline** (plan §10 U1.4 *Verify*) | MET | **MET** — re-reproduced |
| P2 | **p95 latency recorded** (plan §10 U1.4 *Verify*) | NOT MET (ISS-123) | **MET** |
| P3 | **dep-cruiser green** (plan §10 U1.4 *Verify*) | MET | **MET** — re-run |
| P4 | **DECISIONS entry superseding D-003** (plan §10 U1.4 body) | NOT MET (ISS-124) | **MET** |
| P5 | Lives in `packages/index`, satisfies `RetrieveFn`, drops into the recall harness | MET | **MET** |
| P6 | Standing gate — no regression (`pnpm -r typecheck`, `pnpm -r test`) | MET | **MET** |
| P7 | Standing gate — mutation-killable unit coverage | MET (6/6 killed) | **MET** — code byte-identical, coverage intact |

Both cycle-1 failures are genuinely closed. Nothing regressed.

---

## Contract gap (restated, unchanged)

`qa/contracts/ingest-indexing-pipeline.md` covers **summarize → claims → tree_index →
status.index**; its criteria 1–8 name `summarize.ts`, `claims.ts`, `indexing.ts` and the two ingest
composition roots. **None of them is about vector retrieval.** So this unit is judged, as in cycle
1, against plan §10 U1.4's own *Verify:* line and body deliverables plus the project's standing
gates. I have not amended the ingest contract to absorb vector retrieval; the two are different
features.

**I still recommend `/checker init-contract vector-retrieval` before U1.5 begins**, and I still have
not created it — initial contract creation is human-gated under the criticality gate, so this is a
recommendation to the Approver and nothing more. The reason has if anything strengthened: U1.5 is
the hybrid merge and the `vectorSearchFn` composition-root injection, it will inherit this unit's
0.935 as an input to a `≥ 0.85` exit criterion, and `packages/index/src/vector/` still has no
criteria of its own for the next checker to judge against.

---

## What I re-ran myself (nothing below is taken from the manifest)

### 1. ISS-124 (high) — the D-021 supersession. **Genuinely closed, and correctly scoped.**

**The entry exists and is well-formed.** `docs/DECISIONS.md` carries
`## D-021 | 2026-09-08 | type: decision | status: ACTIVE` with all of What / Why / Result /
Supersedes / Changes-authorized / Links populated.

**The supersession really is scoped to Q5 and does not quietly revoke the rest of D-003.** This was
the thing I most wanted to catch, because a broad supersession would silently unpin the whole stack.
It does not. The scoping is stated three separate times and each is explicit about what survives:

- *What:* "This replaces the answer to ARCHITECTURE Open Question Q5 only. Every other part of D-003
  (the TypeScript pnpm monorepo, Python confined to ML workers, JSON Schemas as the single source of
  truth with generated TS types, and the CI budgets) is untouched and remains in force."
- *Supersedes:* "…deliberately leaves the whole of D-003's stack, language-split, schema-source and
  CI-budget content in force."
- *Result:* confined to re-answering Q5.

I checked the effect rather than the wording too: `ARCHITECTURE.md` Q2 still reads **"CLOSED by
D-003: TS pnpm monorepo"** and is untouched by this unit, so the stack answer D-003 owns is still
attributed to D-003 and still standing. Only Q5 moved.

**`Changes-authorized` genuinely covers the ARCHITECTURE edit, and the edit stayed inside it.** The
field reads `ARCHITECTURE.md section 6 Q5 (re-answer: brute-force cosine over chunks, no Atlas);
packages/index/src/vector/cosine.ts`. I diffed the actual edit rather than trusting that:

```
$ git diff 6da5251 HEAD -- ARCHITECTURE.md
-- **Q5:** ... **CLOSED by D-003:** Mongo Atlas Vector Search on `chunks` — one DB until measured otherwise.
++ **Q5:** ... **CLOSED by D-003 → D-021:** brute-force exact cosine in `packages/index/src/vector/`
++   over `chunks`, behind `vectorSearchFn`. Atlas Vector Search is unavailable (self-hosted mongod,
++   no `+srv`), and at 1452×3072 an exhaustive scan is exact.
```

**That single hunk is the entire ARCHITECTURE change.** No Frozen §2 edit, no `contracts/` edit, no
drive-by elsewhere in §6. `ARCHITECTURE.md` is 131 lines against its 150 budget.

**Written BEFORE the edit.** Both land in one commit (`59d0579`), so commit order cannot prove
sequence on its own. What I can verify is that the only write path was taken: the entry is in
`docs/DECISIONS.md` in `append_decision.ps1`'s schema shape, and the maker's own account of the
D-019 collision — that the guard *refused* its first attempt because the concurrent lane had already
taken D-019/D-020 — is corroborated independently by git: `05b93cc` (D-019) and `6a57bae` (D-020)
both pre-date `59d0579` and belong to the other lane. A maker that had bypassed the guard would not
have hit its id allocator. Combined with `Changes-authorized` naming the ARCHITECTURE section that
was then edited and nothing else, the Lab Protocol ordering requirement is satisfied as well as it
can be evidenced.

**`docs/DECISIONS.md` remains additions-only.**

```
$ git diff d8850c2 HEAD -- docs/DECISIONS.md | grep -E "^-" | grep -v "^---"
(no output — zero deletion lines)
```

Eight added lines, nothing removed or altered. No prior entry touched.

**`cosine.ts` cites the real id.** `cosine.ts:4` now reads *"WHY BRUTE FORCE (D-021, which supersedes
D-003 on ARCHITECTURE Q5 only)"*.

**"D-a" does not remain in the vector code — but it does still remain in the schema.** See ISS-125
below. It is not a shortfall against ISS-124's recorded reproduction and it is not this unit's doing.

### 2. ISS-123 (medium) — p95. **Measured for real, and the framing is honest.**

I re-ran the harness myself rather than reading the maker's number back:

```
$ node scripts/eval-recall.mjs --retriever vector
...
wrote D:\KnowledgeBase\data\eval\recall-report-vector.json

$ (latency block from that report, my run)
  { unit: "ms", note: "ranking only, 1452 chunks x 3072 dims, excludes the batched embed",
    n: 92, p50: 25.39, p95: 78.11, max: 139.02 }
```

| | maker | my re-run |
|---|---|---|
| p50 | 28.84 | **25.39** |
| p95 | 62.35 | **78.11** |
| max | 127.55 | **139.02** |

**The numbers are real and in the stated region.** They are not byte-identical, and they should not
be — unlike the ranking itself (which is deterministic and *was* byte-identical), wall-clock timing
on a shared machine is not reproducible to two decimals. My p95 is 25 % above the maker's, which is
ordinary variance for 92 CPU-bound samples on a laptop, and both land in the same tens-of-ms band.
What matters is that the conclusion is robust to that spread: D-021's revisit threshold is ~500 ms
and even my slower p95 is **6.4× inside it**. A number this far from its threshold does not need
precision.

The instrumentation is genuine and I read it rather than inferring it: `scripts/eval-recall.mjs`
times 92 `retrieve()` calls with `performance.now()`, sorts, and emits p50/p95/max into the report.
No new script file was added (respecting the D-018 `scripts/` budget), and the timing loop is
separate from the scored run, so it cannot contaminate recall.

**Is excluding the batched embed honest framing or convenient framing? Honest — with one boundary
worth naming.** Three reasons I accept it:

1. It is what the issue itself asked for. ISS-123's `fix_direction`, written by cycle-1 me, said:
   *"Report ranking latency alone, not ranking+embedding … mixing them measures neither."* The maker
   is complying with the recorded fix direction, not inventing a flattering denominator.
2. It measures the thing the decision rests on. The p95 exists to justify **brute force over ANN**.
   An ANN index would change ranking cost and would not change embedding cost at all, so the embed
   term is common to both arms of the comparison and cancels. Including it would make the number
   *less* informative about the decision it supports.
3. It is disclosed at every layer — in the report's own `note` field, in the code comment, and in
   the manifest. Convenient framing hides its exclusion; this one is stamped into the artifact.

The boundary: **this is not end-to-end `/ask` latency**, where one embed round-trip per question is
real and unamortised, and nothing in this unit measures that. That is correctly U1.5's problem (the
composition-root injection), and the manifest does not claim otherwise. I am recording it so U1.5
cannot inherit 62–78 ms as a user-facing figure.

**The "milliseconds" overclaim was corrected, and the correction is unusually good.** The old comment
read *"an exhaustive scan is a few million multiply-adds, which is milliseconds"*. The new one:

> MEASURED, not asserted (2026-09-08, 1452 chunks × 3072 dims, ranking only, 92 real questions):
> **p50 29 ms · p95 62 ms · max 128 ms**. An earlier draft of this comment said "milliseconds",
> which understated it by an order of magnitude — the number is now taken from
> `data/eval/recall-report-vector.json` rather than from an intuition.

It does not quietly swap the wrong claim for the right one; it names its own error, states the
magnitude of the error, and cites where the replacement comes from. That is the correction I would
want to find.

### 3. No regression in the retriever — verified with git, not by reading

```
$ git diff 6da5251 HEAD --stat -- packages/index/src/vector/
 packages/index/src/vector/cosine.ts | 19 ++++++++++++-------
 1 file changed, 12 insertions(+), 7 deletions(-)
```

**One file, and the full diff is entirely inside the leading `/** … *\/` block comment.** Not one
line of executable code changed: `retriever.ts` is untouched, and in `cosine.ts` every `+`/`-` line
begins with ` *`. The maker's claim that "the retriever the checker attacked and could not break is
byte-identical" is **true of the code**, and I am satisfied that cycle 1's 6/6 mutation kills still
describe the shipped artifact — the same 194 tests exercise the same functions.

The recall number reproduced exactly, including the misses:

```
recall@5 = 0.935 (86/92 hits)
control (question-blind) = 0.217 | chance floor = 0.217
filter bias: none — 0 candidates rejected, so kept === combined
VERDICT: INFORMATIVE — 0.935 vs a 0.217 question-blind control (+0.717), 6 miss(es) left to move
```

All six misses are the **same six** as cycle 1, with the same ordered top-5 `got` lists
(`atlas-skilltech-gq01`, `atlas-skilltech-gq03`, `in-focus-1-gq03`,
`entrance-exams-pathways-india-part1-gq01`, `cept-university-gq01`, `ashoka-university-gq04`). The
heuristic baseline `data/eval/recall-report.json` is still on disk and still 0.391 (36/92); the
cycle-2 commit `59d0579` does not list it among its seven changed files, so the clobber fix continues
to hold. **Delta +0.543 re-confirmed.**

### 4. The gates, each individually by exit code

```
$ pnpm -r typecheck                                    → exit 0
$ pnpm -r test                                         → exit 0
$ pnpm --filter @lkb/index test                        → exit 0   tests 194  pass 194  fail 0
$ npx depcruise --config .dependency-cruiser.cjs packages apps
    ✔ no dependency violations found (284 modules, 867 dependencies cruised)   → exit 0
$ pnpm lint:structure                                  → exit 1  (see below)
    lint-loc        OK (267 files within budget)
    lint-dirsize    OK (78 dirs within budget)
    lint-root       OK (15 loose root files)
    lint-dupes      OK (290 unique exports, 24 unique schema $ids)
    lint-migrations OK (1235 files scanned)
    snapshot        OK (docs/SNAPSHOT.md matches a fresh regeneration, 114 lines / budget 200)
    tracker-audit --gate G1  → 2 findings
$ wc -l ARCHITECTURE.md                                → 131  (budget 150)
```

**`lint:structure`'s exit 1 is still not attributable to this unit.** Both G1 findings are the same
pre-existing one cycle 1 documented — `U2.4 uses unknown status "partial" in TASKS.md`, plus its
mirror `U2.4 is "pending" in goal.json but "partial" in TASKS.md`. `U2.4` belongs to the concurrent
speaker lane; `TASKS.md` and `.goal/goal.json` are files I was instructed not to touch and did not.
Every sub-gate the manifest claims green **is** green, and each was confirmed by its own output line
rather than by the wrapper's exit code. Not charged.

---

## FAILURES

None.

**ISSUES-WRITTEN: ISS-125** (medium — filed as a ledger row only, per this repo's severity gate; it
is not a failure of this unit and does not gate the PASS).

Ledger updates made: **ISS-123 → `fixed`**, **ISS-124 → `fixed`** (both with the verifying evidence
recorded on the row; only a later re-check moves them to `verified`).

---

## Notes that are NOT failures

- **ISS-125 (medium, new): "D-a" survives in the schema.** D-021's *Result* declares the shorthand
  retired, and `cosine.ts` was repointed — but `grep -rn "D-a\b"` still hits
  `schema/chunks.schema.json:5` and its generated `packages/core/src/generated/chunks.ts:8`
  (*"the embedding VECTOR is stored inline because brute-force cosine (D-a) must read the numbers"*).
  I am explicitly **not** charging this to the unit, for two reasons. First, per D-015 I measured the
  fix against the issue's own recorded reproduction: ISS-124's row names exactly three artefacts —
  the entry, `ARCHITECTURE.md:126`, `cosine.ts:4` — and **all three are closed**; the schema is
  outside what was recorded. Second, it pre-dates this unit (introduced at `821341b`, U1.2). It earns
  a ledger row only because D-003 makes JSON Schemas the single source of truth, so the one file
  class that is definitionally authoritative now cites an id D-021 says is retired. Fix is one word
  plus `pnpm gen:types`; U1.5 is the natural place, and it must be the schema that is edited, never
  the generated file.
- **D-021's `Changes-authorized` field ends with a stale id: "replace the 'D-a' citation with
  D-019".** That is the refused first attempt's number showing through into the entry that actually
  landed as D-021. It is cosmetic — the field's *scope* (which files may be edited) is correct and
  was honoured, and What / Why / Result / Supersedes all say D-021 — but a future reader chasing
  "D-019" from this field lands on the concurrent lane's per-lane-ledger decision instead. I am
  raising it **only as a note and deliberately not as a fix request**: `docs/DECISIONS.md` is
  append-only, so the entry cannot be corrected in place, and appending a whole new decision to fix
  one stale token in a non-load-bearing field would be worse governance than leaving it. Recorded
  here so the record of the discrepancy exists somewhere mutable.
- **Round cap (D-014).** This is PASS **1** on the vector-retrieval seam (cycle 1 was a FAIL and does
  not count as a PASS). The non-security cap of 2 PASSes is not in play. ISS-125 is non-security
  class and has been *filed* rather than promoted into a round 3, which is what D-014 asks for.
- **`Issues addressed: ISS-124, ISS-123`** is accurate — both were raised by the cycle-1 FAIL and
  both are genuinely closed by this cycle, verified above rather than accepted.
- **Cycle-1's substantive findings stand and were not re-litigated.** The 0.935-is-a-floor caveat,
  the `atlas-skilltech` 4-chunk contributor, and the prohibition on using this number to close gate
  condition 4 or settle U1.5's `≥ 0.85` while precondition 1 is open — the manifest carries all three
  forward verbatim in "The checker's findings I am carrying forward rather than closing". That is the
  correct disposition and I am re-affirming the constraint here so it travels with the PASS:
  **0.935 may be cited as a floor with disclosure 1 attached; it may not close the golden-set gate.**

---

## EXPLANATION

Both cycle-1 failures are genuinely closed and I verified each against its own recorded
reproduction rather than against the maker's account. D-021 exists, is well-formed, and its
supersession is **scoped to Q5 three times over** with D-003's stack, language-split, schema-source
and CI-budget content explicitly left in force — which I confirmed by effect as well as by wording,
since ARCHITECTURE Q2 still attributes the stack to D-003 untouched; `Changes-authorized` names the
ARCHITECTURE section that was then edited and the git diff shows that Q5 block is the *only* hunk;
and `docs/DECISIONS.md` took eight added lines with zero deletions. On the p95, my own re-run gives
25.39 / 78.11 / 139.02 ms against the maker's 28.84 / 62.35 / 127.55 — not identical, correctly so
for wall-clock timing, same band, and even my slower p95 is 6.4× inside D-021's 500 ms revisit
threshold. Excluding the batched embed is honest framing: it is what ISS-123's own fix direction
demanded, the embed term cancels between the brute-force and ANN arms the number exists to compare,
and the exclusion is stamped into the report, the comment and the manifest — though it is *not*
end-to-end `/ask` latency and U1.5 must not inherit it as one.

Nothing regressed. `git diff` over `packages/index/src/vector/` since the cycle-1 commit is one file
and **entirely inside a block comment** — no executable line moved — so cycle 1's 6/6 mutation kills
still describe what shipped; recall reproduced at 0.935 (86/92) with the identical six misses and
identical top-5 lists, the heuristic baseline is intact at 0.391, and typecheck / test / 194 index
tests / dep-cruiser are each green by their own exit code. `lint:structure`'s exit 1 is the same
pre-existing concurrent-lane `U2.4` tracker row cycle 1 documented, in files I was told not to touch.
One new medium finding (ISS-125: "D-a" still in `schema/chunks.schema.json`) is filed as a ledger row
only — it is outside ISS-124's recorded reproduction, pre-dates this unit, and under this repo's
severity gate a medium is verified inside the next unit that touches the file rather than given its
own ceremony. **PASS, 7/7.** I renew the cycle-1 recommendation, unchanged and still human-gated:
`/checker init-contract vector-retrieval` before U1.5 starts, not after.

---
---

# ARCHIVE — cycle 1 verdict (FAIL), preserved verbatim

# Verdict — vector-cosine-retriever

**Date:** 2026-09-08
**Mode:** A (unit check)
**Cycle checked:** 1
**Bound root:** `D:\KnowledgeBase`
**Named contract:** `qa/contracts/ingest-indexing-pipeline.md`
**Judged against:** plan §10 U1.4 + the standing gates — see "Contract gap" below.

---

## VERDICT: FAIL

**SCOREBOARD: 5/7 criteria met, 6/6 invariants hold**

Criteria are U1.4's, taken from the plan, since the named contract does not cover this unit.

| # | Criterion (source) | Result |
|---|---|---|
| P1 | recall@5 reported as a **delta against the U0.10 baseline** (plan §10 U1.4 *Verify*) | **MET** — reproduced independently |
| P2 | **p95 latency recorded** (plan §10 U1.4 *Verify*) | **NOT MET** — ISS-123 |
| P3 | **dep-cruiser green** (plan §10 U1.4 *Verify*) | **MET** — reproduced |
| P4 | **Write the DECISIONS entry superseding D-003** (plan §10 U1.4 body) | **NOT MET** — ISS-124 |
| P5 | Lives in `packages/index`, satisfies the existing `RetrieveFn`, drops into the recall harness | **MET** |
| P6 | Standing gate — no regression (`pnpm -r typecheck`, `pnpm -r test`) | **MET** |
| P7 | Standing gate — real unit-test coverage that a mutation can kill | **MET** — 6/6 mutations killed |

Invariants checked: ranking determinism · dimension-mismatch refusal · zero-magnitude ≠ NaN ·
dedupe-before-truncate · missing-embedding throws rather than scoring as a miss · the baseline
report is not clobbered. All six hold, each verified by mutation or by re-derivation.

---

## Contract gap (stated plainly, as instructed)

`qa/contracts/ingest-indexing-pipeline.md` is the contract for the **summarize → claims →
tree_index → status.index** pipeline. Its criteria 1–8 name `summarize.ts`, `claims.ts`,
`indexing.ts` and the two ingest composition roots. **Not one of them is about vector retrieval**,
and nothing in it constrains `cosine.ts` or `retriever.ts`. Forcing this unit through it would
have produced either a vacuous PASS (all eight criteria untouched and therefore unviolated) or a
nonsense CONTRACT_MISMATCH against a maker that submitted the only contract that exists.

So this check is judged against **plan §10 U1.4's own *Verify:* line and body deliverables**, plus
the project's standing gates (typecheck, test, dep-cruiser, mutation-killable coverage). I have
**not** amended the ingest contract to absorb vector retrieval — the two are genuinely different
features and merging them would make the ingest contract's criteria harder to check, not easier.
**The gap is that `packages/index/src/vector/` has no contract at all**, and U1.5 (hybrid merge)
is about to build on it. Recommend `/checker init-contract vector-retrieval` before U1.5, not
after; I have not created it inside a unit check, since initial contract creation is human-gated
under the criticality gate.

---

## What I re-ran myself (nothing below is taken from the manifest)

### 1. The headline number — reproduced exactly

```
$ node scripts/eval-recall.mjs --retriever vector
filter bias: none — 0 candidates rejected, so kept === combined
recall@5 = 0.935 (86/92 hits)
control (question-blind) = 0.217 | chance floor = 0.217
VERDICT: INFORMATIVE — 0.935 vs a 0.217 question-blind control (+0.717), with 6 miss(es) left to move
6 miss(es): [the same six, listed below]
wrote D:\KnowledgeBase\data\eval\recall-report-vector.json
```

0.935 (86/92) against the on-disk heuristic baseline 0.391 (36/92). **Delta +0.543 confirmed.**

### 2. It is not a harness, golden-set or stale-file artifact

I checked each of the four ways this number could have been fake:

- **Stale report file?** No. The run above regenerated the report; the recall value is identical
  to the committed one and `generatedAt` moved. The number comes from the run, not the file.
- **Are 1452 chunks really being scored?** Yes, verified independently of the harness by my own
  query against live Mongo (`scopedCollection(getDb(),"chunks")("toc")`): **1452 documents, 26
  distinct `sourceRef` sessions, every vector 3072-dim, zero zero-magnitude vectors.** The
  retriever label the harness prints is therefore accurate rather than decorative.
- **Could a session be unreachable, inflating or deflating the score?** No. Every one of the 92
  questions' `expectedSessionId` has chunks in the corpus (`expected sessions with NO chunks: []`).
  No question is unanswerable by construction.
- **Is the 92 an apples-to-apples comparison?** Yes. `golden-set.json` is 92 questions and
  `golden-set-rejected.json` is now **empty**, so `filterBias` reports `kept === combined` for
  *both* retrievers. The heuristic 0.391 and the vector 0.935 are scored over the identical
  92 questions with the identical control. This also **discharges the gate's precondition 2**
  (ISS-093's downward-biased floor): with 0 rejections there is no post-filter selection bias left
  to bias anything. ISS-093 is `fixed` in the ledger, consistent with what I measured.

### 3. Run-to-run stability (the maker's disclosure 2) — stronger than disclosed

The maker measured once and honestly said so. I re-ran and diffed my report against the committed
one:

```
recall prev 0.9347826086956522  now 0.9347826086956522
misses identical incl got-lists: true
```

**Not merely the same score — byte-identical misses, including the full ordered top-5 `got` list
for every one of the six.** The only field that changed in the whole report was `generatedAt`.
Across two runs against a live embedding API, the ranking did not move at all. Disclosure 2 is
answered: on this corpus the number is reproducible, and the determinism claim in `cosine.ts` is
supported by observation and not only by a unit test.

### 4. The clobber fix — verified in git, not just on disk

- Both reports exist and are tracked: `data/eval/recall-report.json` (heuristic) and
  `data/eval/recall-report-vector.json` (vector).
- **The restored baseline is genuinely the pre-existing one.** `git diff 67527fa HEAD --
  data/eval/recall-report.json` is **empty** — the heuristic report is byte-identical to the
  version committed by `67527fa` ("fix(eval): one filter predicate, derived provenance, guarded
  restore"), which predates this unit. It was not re-generated and re-presented as a baseline.
- **The U1.4 commit did not touch it.** `git show --stat 6da5251` lists eight files; the heuristic
  report is not among them. The clobber is fixed in the state that shipped, not only in prose.
- **No other writer exists.** `grep -rn "recall-report"` across `scripts/`, `packages/`, `apps/`
  and `package.json` returns four hits in `eval-recall.mjs` (two of them comments) and one
  comment in `packages/index/src/eval/baseline.ts`. `eval-recall.mjs` is the only file that writes
  either report, and it now routes by retriever. Nothing else can overwrite either number.

This was the right thing for the maker to catch and the right thing to disclose. It is closed.

### 5. The maths — attacked by mutation, 6/6 killed

Via `node scripts/lib/mutate.mjs apply|restore`, one mutation at a time, `git checkout` between
each, `mutate.mjs assert-clean` green at the end and `git status --porcelain packages/` empty.

| # | Mutation | Result |
|---|---|---|
| M1 | dedupe **after** truncate (`rankByCosine(…, chunks.length)` → `k`) | **KILLED** 193/194, 1 fail |
| M2 | drop the deterministic tie-break (comparator → `y.score - x.score`) | **KILLED** 193/194, 1 fail |
| M3 | dimension mismatch no longer throws (`a.length !== b.length` → `false`) | **KILLED** 193/194, 1 fail |
| M4 | remove the zero-magnitude guard (re-admit `NaN`) | **KILLED** 178/180, 2 fail |
| M5 | keep each session's **worst** chunk (drop the `!best.has` guard) | **KILLED** 193/194, 1 fail |
| M6 | `retriever.ts`: missing embedding silently returns `[]` instead of throwing | **KILLED** 193/194, 1 fail |

The two behaviours the manifest asked to be scrutinised are the two I most wanted to break, and
both are genuinely defended: **dedupe-before-truncate (M1, M5) and the deterministic tie-break
(M2)** each have a test that reddens the moment the behaviour is removed. Combined with §3's
byte-identical re-run, "a silently wrong ranking looks exactly like a correct one" is not a
live risk here.

### 6. Regression gates

```
$ pnpm --filter @lkb/index test   →  tests 194  pass 194  fail 0
$ pnpm -r typecheck               →  exit 0
$ pnpm -r test                    →  exit 0
$ npx depcruise --config .dependency-cruiser.cjs packages apps
  ✔ no dependency violations found (284 modules, 867 dependencies cruised)   exit 0
```

`pnpm lint:structure` exits **1**, on `tracker-audit --gate G1`: *U2.4 uses unknown status
"partial" in TASKS.md*. **This is not attributable to this unit.** I confirmed it pre-exists:
`git show 6da5251^:TASKS.md | grep -c "| U2.4 | partial |"` returns 1, so the row was already
there before the U1.4 commit, and it belongs to the concurrent speaker lane (`TASKS.md`, U2.4),
which I am instructed not to touch and did not. It is the same class as the already-`verified`
ISS-100; I am not filing a duplicate. The manifest does not claim `lint:structure` is clean, so
it makes no false statement here.

---

## Disclosure #1 — can 0.935 be cited at all? My independent read

**Yes, but only with the sibling-ambiguity caveat attached — which the manifest does attach, in
the right direction.** Reasoning:

The gate `qa/gates/golden-set-redesign.md` is answered (Option C) and its conditions 1–3 are
satisfied. Condition 4 — "only then may U1.4's delta be re-pointed at the new set" — carried two
preconditions. **Precondition 2 (ISS-093, the biased post-filter) is now discharged**: the
current set rejects 0 candidates, so `kept === combined` and the bias term is nil, which I
verified from the run rather than from the ledger. **Precondition 1 (sibling-session ambiguity) is
genuinely still open.** So one of the two blockers on condition 4 is gone and one is not.

I read all six residual misses myself and formed my own view. The questions are:

1. `atlas-skilltech-gq01` — "What kind of support is available for students looking for internships?"
2. `atlas-skilltech-gq03` — "Does the teaching style follow an international model or is it more traditional for the region?"
3. `in-focus-1-gq03` — "…Are there options for students to participate remotely or is everything on-site?"
4. `entrance-exams-part1-gq01` — "Is it better to pick a top-ranked college even if it's for a less popular course…?"
5. `cept-university-gq01` — "What's the relative importance of high school grades compared to standardized test scores…?"
6. `ashoka-university-gq04` — "If there's an aptitude test as part of the process, what kind of skills does it measure?"

**My view: none of the six is a clean retrieval failure, and at least four are ambiguous ground
truth.** Every one is phrased generically enough that it names no entity unique to its labelled
session — (1), (2) and (6) are questions any of the seven `uniaccess-*` sessions could answer on
its face, and (4) is generic Indian-admissions advice with no institution in it at all. That is
precisely precondition 1, and it is visible in the retrieved lists: (1) returns
`uniaccess-cept-university` first and (6) returns `uniaccess-cept-university` first — sibling
sessions, not unrelated ones.

I found **one non-ambiguity contributor the manifest did not name**, and it cuts the same way:
`2026-05-23-uniaccess-atlas-skilltech` has only **4 chunks** in the corpus, against 21–45 for the
other missed sessions. Two of the six misses are that one thin session. A session represented by
four chunks has far less surface for any chunk to be a question's nearest neighbour, so those two
misses are partly a corpus-coverage artifact rather than a ranking defect.

**Conclusion on the citation.** 0.935 is honestly citable as a **floor**, exactly as the manifest
frames it, and must be cited with disclosure 1 attached. What it may **not** yet be used for is
closing condition 4 of the gate or clearing U1.5's `≥ 0.85` as a settled exit criterion — the
sibling ambiguity is still open and a gate should not be closed by the unit it gates. The maker
did not claim either of those, and the restraint is correct. The delta (+0.543) is the more robust
statement anyway: both retrievers face the identical ambiguity on the identical 92 questions, so
whatever share of the six is mislabelled subtracts from both sides.

---

## FAILURES

- **[P4] sev: high** · U1.4 reverses D-003 in shipped code, cites a decision id (`D-a`) that does
  not exist, and leaves `ARCHITECTURE.md:126` asserting *"CLOSED by D-003: Mongo Atlas Vector
  Search on `chunks`"* while `cosine.ts:4-8` deliberately does not use it — the plan makes "Write
  the DECISIONS entry superseding D-003" part of U1.4 itself · **fix:** append one entry via
  `scripts/append_decision.ps1` with `Supersedes: D-003 (Q5 only)` and
  `Changes-authorized: ARCHITECTURE.md §6 Q5`, then repoint Q5 and replace `D-a` in `cosine.ts:4`
  with the real id · issue: **ISS-124**
- **[P2] sev: medium** · p95 latency is not recorded, though plan §10 U1.4's *Verify:* line names
  it alongside the two items that were done; the brute-force-over-ANN choice in `cosine.ts:2-13`
  rests on an unmeasured "milliseconds" claim · **fix:** time the 92 `rankSessionsByCosine` calls
  inside the existing `eval-recall.mjs` (ranking only, not the batched embed) and write
  p50/p95/max into the report · issue: **ISS-123**

**ISSUES-WRITTEN: ISS-123, ISS-124**

---

## Notes that are NOT failures

- **`production.ts` injection is deferred to U1.5.** The plan's U1.4 body mentions the injection
  point, but its *Verify:* line does not, and the manifest says plainly it was not smuggled in.
  I accept the split; the seam exists and `RetrieveFn` is satisfied, which is what makes U1.5 an
  injection rather than a rewrite. Not charged.
- **A comment in `eval-recall.mjs` is now slightly inaccurate.** It states the control "faces
  exactly the candidate pool the real retriever does". True for the heuristic (tree built from 23
  sessions), but the vector retriever ranks over **26** sessions with chunks while the control
  draws from 23. The direction is conservative — the vector retriever faces the harder pool, so
  0.935 is if anything understated — so this is an accuracy note only, filed here per this repo's
  verdict rule rather than in the backlog.
- **Round cap.** This is the first PASS-attempt on the vector-retrieval seam; the cap is not in
  play. Both findings are non-security class.
- **`Issues addressed: none`** is accurate — this is roadmap tier-3 work, and I confirmed no
  ledger issue was claimed as closed by it.

---

## EXPLANATION

The retrieval work itself is the strongest I have checked in this repo: I reproduced 0.935 (86/92)
exactly, confirmed against live Mongo that 1452 real 3072-dim chunks over 26 sessions are actually
being scored, established that the number is not a stale file, not a coverage artifact and not an
apples-to-oranges comparison (both retrievers now score the identical 92 with zero post-filter
rejections), and found the ranking **byte-identically stable across runs including every miss's
full top-5** — which answers disclosure 2 more strongly than the maker claimed. All six mutations
I aimed at the maths died, including both behaviours the manifest asked to be scrutinised, and the
clobber fix is verified in git history rather than on disk alone. My own read of the six residual
misses agrees with disclosure 1 and adds one contributor it missed: two of them are a session with
only 4 chunks.

It fails on two of U1.4's **own** stated requirements, neither of them about retrieval quality.
The high one is a Lab Protocol breach rather than paperwork: the repo's ground-truth
`ARCHITECTURE.md` still says the adopted vector path is Mongo Atlas Vector Search, this unit ships
the deliberate opposite, and the authority its source code cites (`D-a`) does not exist — so a
future session reading ARCHITECTURE.md is misled by the file this project treats as ground truth,
and the plan named writing that entry as part of U1.4. The medium one is the missing p95, which
matters because the brute-force-over-ANN decision is justified on a speed claim nobody measured.
Cycle 2 should be small: one `append_decision.ps1` entry plus two one-line repoints, and a few
lines of timing in the existing harness. **No code in `packages/index/src/vector/` needs to
change** — I could not break it.

Separately, and not charged to this unit: `packages/index/src/vector/` has no contract of its own,
and U1.5 is about to build on it. That gap should be closed before U1.5, not after.
