# QUEUE — top-3 recommended next units (checker sweep 2026-09-08, Mode B safety net)

> Range: `git log c11515a..HEAD` — **6 commits**, 5 units + 1 reconcile. Every manifest/verdict
> pair re-read from disk, not inferred from commit messages. A sixth unit,
> `search-store-injectable-handle`, was **in flight** at sweep start and **its checker returned
> mid-sweep** — its verdict file appeared in my working-tree scan between checks 1 and 7. That
> timing produced both a retraction and the sweep's main finding; both are recorded below.

## Terminal state: FINDINGS: 2

1. **The `search-store-injectable-handle` verdict's bookkeeping never landed.** A PASS verdict on
   disk declares five new ledger rows, two status flips, and a contract amendment. **None of the
   three exist.** The verdict file itself is untracked.
2. **The sweep/mutation collision recurred — for the second consecutive sweep, and to me.** I
   read `search-store.ts` while its checker was mutation-testing it, and drafted a high-severity
   cross-tenant finding against a state that never existed in any commit. **Retracted in full
   below.** The remedy for exactly this was written into `qa/feedback-inbox.md` *this session* and
   did not prevent the recurrence.

Everything committed in range is otherwise clean: no bypass, all four close-outs accurate, ledger
well-formed under three independent parses, enforcement live, human gate correctly unanswered.

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** All five committed units re-read from disk:

| commit | unit | manifest Fix cycle | manifest Status | verdict Cycle checked | verdict |
|---|---|---|---|---|---|
| `fcc2863` | eval-baseline-control | 1 of max 3 | `checked-PASS` (L178) | 1 | PASS 9/9, 4/4 |
| `8d0734c` | search-prefilter | 1 of max 3 | `checked-PASS` (L156) | 1 | PASS 15/15, 5/5 |
| `af8a346` | search-prefilter-coverage | 1 of max 3 | `checked-PASS` (L132) | 1 | PASS 15/15, 6/6 |
| `b1fd6b9` | search-prefilter-bypass-pin | 1 of max 3 | `checked-PASS` (L117) | 1 | PASS 15/15, 6/6 |
| *(uncommitted)* | search-store-injectable-handle | 1 of max 3 | `ready-for-check` (L126) | 1 | PASS 15/15, 6/6 — **landed mid-sweep, untracked** |

Full-repo scan of all 79 manifests: `76 checked-PASS · 2 superseded-by · 1 ready-for-check`. The
one `ready-for-check` is `search-store-injectable-handle`, whose PASS verdict now exists — a
close-out gap **minutes old at sweep time, not a finding**, but see finding 1: it is the same
manifest whose bookkeeping is otherwise unlanded, so the close-out and the ledger writes should be
done together. (The prior sweep's "catalogue-input-integrity prose false-positive" does not recur:
matching `Status:` inside the `**bold**` wrapper yields no false positive to rule out — the same
pattern trap the maker's own regex hit in `6e9f728`.)

**The four close-outs in `6e9f728` are accurate — verified, not accepted.** For each I confirmed
independently that (a) the cited verdict file exists, (b) it reads `VERDICT: PASS`, (c) its
`Cycle checked` is `1` against manifest `Fix cycle: 1` — a genuine match, and (d) **`git show --stat`
on the cited commit actually lists that verdict file as added**. All four check out. **No manifest
was flipped without a real, matching, committed verdict.**

**On whether the four-tick drift deserves its own ledger row: no.** It was self-detected,
self-corrected and correctly diagnosed in the same tick; it had **zero artifact consequence** (no
unit mis-certified, no PASS fabricated); and it is already recorded on the better-fitting surface,
`qa/feedback-inbox.md`. A duplicate row in a second system is the "two rows for one defect" the
last sweep declined for the same reason. **Stated threshold for the next sweep, so this is not
re-judged from scratch: a fifth occurrence, after the pattern is written down, IS a row** — it
would prove the written pattern does not change behaviour. *(Finding 2 below is that exact
threshold being crossed by a different pattern, which is why it is stated as a rule rather than a
courtesy.)*

### 2 — Feedback-inbox fold-in

**Nothing unfolded.** Two new entries, both `— folded 2026-09-08`: the false-green
regression-test pattern, and the **mutation-with-proof-of-application hazard**.

I re-verified the second rather than accepting it: `baseline.ts:63` now genuinely computes
`saturated` from `measured.recallAtK >= 1 && measured.misses.length === 0`, the `"saturated"`
branch is reachable, and the real-data verdict is `SATURATED`. **The previous sweep's hedged
handoff is closed on evidence.** Its caution was correct — and, as finding 2 records, its lesson
did not transfer.

### 3 — Ledger integrity

```
$ node scripts/tracker-audit.mjs
tracker-audit: 1 finding(s)
  G2 unverified: 26 issue(s) are "fixed" with no verified_date — ISS-006, ISS-007, ISS-011, …

$ node scripts/tracker-audit.mjs --gate g1
tracker-audit: OK (gate G1)
```

**G1 clean. G2 is the project's known shape** (no `verified_date` backfill on batch closures).
G3 did not fire.

**Three independent parses, because a plain parse cannot prove the absence of the bug a previous
sweep actually found** (`JSON.parse` silently keeps the last value on a duplicate key):

- `python3 json.loads` per line — **77 lines, 0 invalid**
- `node JSON.parse` per line — **77 lines, 0 invalid, 0 duplicate ids**
- **raw key-occurrence regex scan** (counts `"key":` per line — the only check that can *see*
  duplication) — **0 duplicate-key lines**

**Recomputed from the file: 77 issues — 7 open, 28 fixed, 42 verified** (18 high, 37 medium, 22
low). **ISS-071..077 are all well-formed** — all eight schema fields present on every row:

| id | sev | status | subject |
|---|---|---|---|
| ISS-071 | high | open | golden set saturates recall@5 at 1.000, zero misses |
| ISS-072 | high | fixed | `createMongoSearchDeps` token derivation unpinned by any test |
| ISS-073 | low | open | pre-filter superset has a narrow Unicode case-folding bound |
| ISS-074 | medium | fixed | ISS-072's gap narrowed, not eliminated — delegation unpinned |
| ISS-075 | low | fixed | `search-prefilter.ts` docstring contradicted its own escapeRegex finding |
| ISS-076 | medium | **open** | source-text pin constrains source text, not behaviour |
| ISS-077 | medium | **open** | property test is example-based over six hard-coded cases |

#### FINDING 1 — a PASS verdict whose ledger and contract writes never landed

`qa/verdicts/search-store-injectable-handle.md` (PASS, cycle 1, on disk) declares:

- `ISSUES-WRITTEN: ISS-078 (high), ISS-079 (medium), ISS-080 (medium), ISS-081 (low), ISS-082 (low)`
- `ISSUES-CLOSED: ISS-076, ISS-077 (status open -> fixed)`
- §9: *"`qa/contracts/search-route.md` amended (routine, auto-gate) — [I6] gains a clause … and a
  new **[I7]** records the tenant-scoping invariant"*

**All three are absent from disk, verified individually:**

| declared | actual |
|---|---|
| ISS-078…082 written | `qa/issues.jsonl` is **77 lines, last row ISS-077** — the five rows do not exist |
| ISS-076, ISS-077 → `fixed` | both still `"status":"open"` |
| `search-route.md` [I7] added | `grep` finds **no [I7]**; `git status qa/contracts/` is **clean** — the file was never modified |

The verdict file itself is **untracked**, which is the QA-1445 shape the protocol names by name
(43 verdicts sat untracked at `d:/erp`, one `git clean` from being the transcript-only failure the
write-and-commit step exists to prevent).

**Why this is a real finding and not a race I misread.** The protocol orders ledger writes
(step 6) *before* the verdict file (step 7). The verdict exists; the ledger writes do not. On that
ordering the writes were dropped, not pending. I record the caveat honestly — the checker returned
during my sweep and I cannot prove it is not still writing — but the ordering is evidence, and a
PASS whose findings exist only inside a prose verdict is exactly the failure mode both halves of
this pair are built to prevent. **Five issues, one of them `high`, currently exist only as prose.**

**I did not write the rows myself, deliberately, and this is the one place I declined ledger
authority.** Two reasons: appending to `qa/issues.jsonl` while another process may hold it open
risks producing the interleaved/duplicate-key corruption a previous sweep already had to repair —
the precise damage class my three-parse check exists to detect; and the content is the other
checker's to author (I did not run its mutations and would be transcribing conclusions I cannot
attest to). Reopen-power lets me flip rows on evidence; it does not make me the scribe of another
checker's findings. **Queued as item 1** — it is a two-minute fix and it is the highest-value thing
on this list.

**No other ledger correction needed. Reopen-power not exercised** — no PASSed unit's claim was
found unbacked.

### 4 — Enforcement liveness

**222 commits** (not zero-history). **6** `.ps1` hooks registered in `.claude/settings.json`, all
six present on disk: `decisions-append-guard`, `features-snapshot-session-end`, `lab-session-end`,
`lab-session-start`, `mc-precommit`, `mc-sessionstart`. `docs/DECISIONS.md` **untouched across the
entire range** (`git diff c11515a..HEAD` empty) — append-only trivially intact. `qa/loop.md`
present; `qa/adapter.json` absent (default coding adapter), no contradiction.

**Full suite green: 8 packages, `fail 0` in every one** (apps/api 102/102).

Loop-design triad:
- **Can it spin?** No. Five real close-outs in range; the maker's tick ended by stopping at a human
  gate rather than manufacturing a next unit.
- **Can it Goodhart the verifier?** This range *is* the answer: five successive rounds of closing
  progressively subtler ways for a green suite to certify a broken filter, each found by a checker.
  The instrument is being hardened, not gamed. See the convergence assessment.
- **Can it run a wrong answer to completion?** **Yes — the standing open item**: `T-021`'s
  `recall@5 >= 0.85` against a set that returns 1.000 by construction. Queued as item 2.

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks, **26 done / 9 pending**. `git diff` shows **only** deterministic
recompute fields moved (`updated`, `velocity_per_day` 4.38→3.72, `eta_days`,
`last_deterministic_tick`) — **zero task-row edits**. North star unchanged. `T-021`/`T-022` both
correctly `pending` with their REVERTED notes intact.

**Re-assessing the prior sweep's judgment, as asked: I affirm the analysis and escalate the action
to a queued unit.** The prior sweep was right that U0.10 *is* `T-021`+`T-022`, and right that
retro-adding `T-*` rows for shipped work is cosmetic accounting. It left the real action — amending
the unfailable `>= 0.85` — as a note, because a new threshold seemed to require knowing the new
question set, i.e. the human.

**`eval-baseline-control` (`fcc2863`) removed that dependency.** `assessBaseline` returns a verdict
— `informative` / `saturated` / `at-chance` — that is a **property of the instrument, not a
threshold on the score**. So `T-021`'s `done_check` can be re-expressed as *"the recall report's
baseline verdict is `informative`"*, which is:

- **correct under every option A–D** the human might pick in the gate (A/B/C all yield a
  non-saturated set; D retires the metric and the task with it),
- **failable today** — it evaluates to `saturated` against the current set, i.e. **not done**,
  which is exactly what the reverted task status already asserts,
- **maker-buildable with no human input and no LLM spend**, because the machinery shipped this range.

That converts a standing note into a small unblocked unit. **Item 2 below.**

### 6 — Goal-drift / re-grill

`qa/.regrill-due` **absent**. All ticks `ADVANCED` or `HUMAN_GATE`; none `STALLED`/`EXHAUSTED`, so
no missing `qa/debug/` report. No unit re-PASSed twice on the same evidence.

**`qa/gates/golden-set-redesign.md` — confirmed still OPEN and unanswered.** No `Answered:` line
anywhere in the file (only the how-to-answer template specifying the format). The gate has been
*sharpened* since it was raised: the `eval-baseline-control` checker corrected its scope in both
directions — narrower (only the recall@5 half of U0.10 is blocked; T-022 and the heuristic-proxy
retraction are not) and wider (the same saturation disarms the **U1.4** delta gate and the **U1.5**
`>= 0.85` gate). A gate being refined by evidence rather than rotting.

**Confirmed nothing has been built past it.** Nothing in range touches `data/eval/golden-set.json`;
no new recall claim was made; `eval-baseline-control` instruments the metric rather than redefining
it (it *reports* the saturation, it does not resolve it); the five `search-*` units are retrieval
plumbing, unrelated to evaluation. **The gate is holding.**

**No `GRILL:` row raised — deliberately, same as last sweep.** The question is already on disk,
already with the human, already escalated by the maker's own tick. A second gate for the same
question is the D-006 re-ask loop this project has paid for once.

### 7 — Silent-failure hunt

Read the full surface, all five files. **Nothing filed against the PASSed range.**

- **`packages/index/src/eval/baseline.ts`** — clean. Pure, total, no I/O, no catch. Division guarded
  (`sessionCount === 0 ? 0 : …`). `at-chance` deliberately outranks `saturated`, documented and
  correct: reporting a retriever that fails to beat its own control as merely "saturated" would
  flatter it. `saturated` genuinely computed (§2).
- **`packages/index/src/search/lexical.ts`** — pure, no I/O, no error handling to get wrong.
  `queryTokens.size === 0 → []` is the documented contract the pre-filter's `null` mirrors, not a
  masking fallback. Clean.
- **`apps/api/src/search-prefilter.ts`** — clean. `buildTurnPrefilter` returns `null` (not `$or: []`)
  for a token-less query — both Mongo-required and contract-matching. `escapeRegex` honestly
  disclosed as currently-unreachable defence-in-depth, with a stated reason for keeping it (ISS-075
  corrected the earlier overclaim). No swallow, no default-value mask.
- **`apps/api/src/search-prefilter-single-source.test.ts`** — a source-text pin, honest about its own
  narrowness in its header ("does not prove the query is correct in general").
- **`apps/api/src/search-store.ts`** — **clean, committed and working tree alike.** See the
  retraction below.

Sub-threshold, not filed: `session: null` / `turn: null` in the hit mapping is the disclosed
citation shape, not a swallow. The last sweep's unbounded-scan watch-item is **substantially
resolved** by `8d0734c` — median fetch 1064ms → 663ms — with the honest ceiling (still an unindexed
scan; no text index on `turns`) disclosed in the file's own header.

---

## FINDING 2 — RETRACTION, and the recurrence it exposes

**Retracted in full: mid-sweep I drafted a high-severity finding that `GET /search` had become a
cross-tenant read. It was false.** I record it rather than deleting it, because the *reason* it was
false is the actual finding.

What I read at `apps/api/src/search-store.ts:59`:

```ts
const turnsColl = (_tid: string) => db.collection<Turns>("turns");   // tenantId discarded
```

What the file actually contains, and has contained in every commit:

```ts
const turnsColl = scopedCollection<Turns>(db as never, "turns");
```

I read the file **during its checker's mutation test** — bypass "5A", which removes
`scopedCollection` from the turns handle to prove the object-level test reddens. Confirmed three
ways: the current file is correct; `git log --all -S'(_tid: string) => db.collection'` is **empty**,
so the state I saw was **never committed anywhere**; and that checker's own verdict filed the same
observation deliberately, as **ISS-078 (high)** — the fifth bypass — having *authored* the mutation
rather than stumbled on it.

**This is the second consecutive sweep destroyed by the same collision, and the remedy was already
written down.** The previous sweep read `baseline.ts` mid-mutation and reported `saturated = false`
as a possible shipped defect. The maker folded the lesson into `qa/feedback-inbox.md` **this same
session**, with an explicit remedy: *"do not dispatch a sweep or checker that reads the same files
you are about to mutate. Sequence it… If the overlap is genuinely unavoidable, say so in the
dispatch prompt so the reader knows a transient broken state is expected."* My dispatch named
`apps/api/src/search-store.ts` in check 7's surface list **and** said the unit's checker was still
running — the collision was predictable from the dispatch alone, and no sequencing or warning was
applied.

**By the threshold I stated in check 1, this earns a ledger row**: a written pattern that recurs
after being written down is evidence the writing did not change behaviour. It is *more* serious
than the close-out drift, because the drift produced late bookkeeping while this produces **false
high-severity findings against colleagues' work** — and it has now cost two sweeps. The previous
sweep hedged and I hedged (I verified before filing rather than after); both times the hedge held,
but the control is "the reader happened to be careful", which is not a control.

**Row not written for the same reason as finding 1** — I will not append to `qa/issues.jsonl` while
another process may be writing it. Queued as item 1 alongside the unlanded writes, since both are
resolved by the same pass over the ledger.

**Structural remedy worth more than the row** (the maker's own note stops one step short): the
sequencing rule is unenforceable by memory, because the maker dispatches the sweep and the checker
independently and neither knows the other's file set. The enforceable version is a **lock**: a
checker running mutation tests writes `qa/.mutating` listing the files it will mutate; the sweep
reads it and either defers those files or annotates them as untrusted. That is a small unit and it
converts a rule people must remember into a file they cannot miss. Folded into item 1.

---

## Converging or churning? — the judgment asked for

**Converging — and now essentially complete. Land the last assertion, then close the class.**

This is my answer *after* the retraction above; the fifth round is real (ISS-078), it was found by
the unit's own checker, and I have re-derived the reasoning on true facts rather than on the
mutated file I initially read.

**Why it is convergence and not re-litigation.** Each round closed a *structurally different*
class, and the classes are strictly nested — each a superset of the last:

| round | unit | class closed | how a green suite still lied afterwards |
|---|---|---|---|
| 1 | `search-prefilter` (ISS-069→072) | **derivation** — how tokens are computed | the shipping file could stop calling the builder at all |
| 2 | `search-prefilter-coverage` (ISS-074) | **delegation** — that the builder is called | the call could stay while the object was corrupted after it |
| 3 | `search-prefilter-bypass-pin` (ISS-076/077) | **source text** — the syntax of the call site | a source pin only ever pins the *previous* attack's syntax |
| 4 | `search-store-injectable-handle` (ISS-078) | **behaviour** — the object that reaches `find()` | the test asserts `$or` but not the *other keys* of that same object |
| 5 | *(ISS-078, unbuilt)* | **completeness** — every key of the captured object | — |

That is not the same ground five times; it is a pin escalating from *what the code says* to *what
the code does*. Round 4 **subsumes** rounds 2 and 3: once you assert on the object passed to
`find()`, the source-text pin is redundant. **A chain whose later rounds make its earlier ones
unnecessary is converging by definition — churn re-adds, convergence absorbs.**

**The measured evidence settles it against the churn reading.** Round 3's checker demonstrated three
distinct bypasses that each kept every source-text assertion satisfied, typecheck green and all 99
tests passing — **one losing 6 of 20 real hits against production data**. A defect that survives the
entire suite and silently drops 30% of real results is not academic, and the round that closed it
was not cosmetics. Every round was found by a checker, never the maker: segregation of duties
working as designed, not thrash.

**The decisive signal that it is finishing — the cost curve has collapsed.** This is the test I
would apply to any such chain, and it is what separates this from churn:

- rounds 1–4 each needed a **new mechanism**: extract a module · add a source pin · make the db
  handle injectable. Rising cost.
- round 5 needs **one assertion** on an object the test **already captures**. `search-store.test.ts`
  captures the filter and asserts its `$or` key; ISS-078 is that it does not assert `tenantId` in
  the same object. Near-zero cost, no new architecture.

Churn looks like each round costing as much as the last and buying less. This looks like the
opposite: the fifth round is an order of magnitude cheaper than the fourth **because the fourth
built the machinery that makes it cheap**. That is a class actually closing.

*(I withdraw the argument I had drafted before the retraction — that round 4 introduced a worse
defect than it closed. That rested on the mutated file. Round 4 introduced no defect; its checker
authored a mutation and filed the gap it exposed. The stop-signal rests on the cost curve, which is
the better argument anyway, since it does not depend on a defect existing at all.)*

**Recommendation: build ISS-078's assertion (one line, in item 3), then declare the pre-filter pin
class CLOSED.** Rule the residuals file-don't-fix rather than leaving them as standing invitations
to a sixth and seventh round:

- **ISS-073** (Unicode case-folding, low, **0 occurrences in 2118 real turns**) — the fix needs
  Mongo-side collation for a case the corpus cannot produce.
- **ISS-079 / ISS-080** (medium: `k` unasserted; post-fetch resolution unasserted) — real, but they
  are *different* invariants that happen to be observable through the same fake, not further rounds
  of the pre-filter class. If they are worth building, build them **once, together**, as a single
  "assert the whole captured interaction" unit — not as two more rounds of this chain.

The chain earned its five rounds. It has not earned a sixth, and the way to guarantee there isn't
one is to close the last assertion and rule the remainder rather than leaving them open.

---

## Top-3 recommended next units

1. **`ledger-writeback-and-mutation-lock`** — *maker work, no human, highest value on this list.*
   Two bookkeeping repairs plus one small guard:
   (a) **land the `search-store-injectable-handle` verdict's declared writes** — append ISS-078…082
   from the verdict's §8, flip ISS-076/077 `open → fixed`, apply the §9 `search-route.md` [I6]
   clause + new **[I7]**, flip the manifest to `checked-PASS`, and **commit the untracked verdict
   file** (narrow pathspec). Five findings, one `high`, currently exist only as prose in an
   untracked file.
   (b) **file the sweep/mutation collision** as a `process` row — second consecutive sweep, remedy
   already written and not applied (finding 2).
   (c) **add the `qa/.mutating` lock**: a checker running mutation tests writes the file listing
   the files it will mutate; the sweep reads it and defers or annotates those files. This is what
   converts a remembered rule into an unmissable one. Small, and it protects every future sweep.

2. **`goal-t021-failable-done-check`** — *maker work, no human, no LLM spend, newly unblocked.*
   Re-express `T-021`'s acceptance as **"the recall report's `assessBaseline` verdict is
   `informative`"** instead of `recall@5 >= 0.85`. The machinery shipped this range (`fcc2863`), so
   it no longer waits on the golden-set gate: the verdict is a property of the *instrument*, valid
   under every option A–D, and it evaluates to `saturated` today — correctly reporting **not done**,
   which is what the reverted status already claims. Converts the project's one surviving unfailable
   criterion into a failable one. (§5.)

3. **`search-prefilter-close-the-class`** — *maker work, small, then stop.* Add the single missing
   assertion for ISS-078 (`tenantId` present in the captured filter object — the test already
   captures it and already asserts `$or`), plus a second-tenant fixture so the property is
   assertable rather than invisible. **Then close the class**: rule ISS-073 file-don't-fix, and if
   ISS-079/080 are worth doing, do them once together as "assert the whole captured interaction" —
   not as rounds six and seven. (Convergence assessment above.)

**Explicitly NOT queued:** `golden-set-redesign` remains a **HUMAN_GATE with Umesh** — open,
unanswered, well-formed, correctly scoped. It needs one option letter A–D plus a scope note,
appended as `Answered: <ISO date> — <choice> — <where>`. Do not build past it. Item 2 is
deliberately designed to be correct whichever letter is chosen, so this gate now blocks strictly
less than it did last sweep — but the golden set itself cannot be replaced without it.

## Standing issues

ISS-050 / ISS-051 / ISS-052 (low, `catalogue-progress-score`) — ruled "FILE, don't FIX" by prior
checker rulings. ISS-071 (high, open) — the saturation record; owned by the human gate, not
buildable. ISS-073 — recommended for a file-don't-fix ruling. ISS-076 / ISS-077 — the verdict
declares them fixed; **the ledger does not yet reflect it** (finding 1, item 1). ISS-078…082 — not
yet in the ledger at all (finding 1, item 1).
