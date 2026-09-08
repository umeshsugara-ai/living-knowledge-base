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
