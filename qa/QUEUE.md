# QUEUE — top-3 recommended next units (checker sweep 2026-09-07T~15:35Z, Mode B safety net)

> Previous sweep: `2026-09-04T15:10:00Z` — **2.8 days stale**, which is itself what G3 in the new
> `scripts/tracker-audit.mjs` was reporting. This sweep clears G3. Run in the same dispatch as the
> Mode A check of `tracker-honesty` (PASS, cycle 1), after that verdict was written and committed.

## Terminal state: FINDINGS: 6

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** 27 commits since the last sweep stamp. Every feature commit resolves to a manifest
*and* a matching-cycle verdict on disk:

| commit | unit | verdict cycle |
|---|---|---|
| `34eb5cb` | derived-input-trust | 2 ✅ |
| `c07d474` | catalogue-progress-score | 2 ✅ |
| `21909a8` | live-verify-protocol | 2 ✅ |
| `5382ca5` | whatsapp-chat-view-speaker-names | 1 ✅ |
| `0edf042` | api-server-env-config-fix | 2 ✅ |
| `9c6ff41` | post-review-fixes-2026-09-06 | 1 ✅ |
| `3a998d3` | ingest-indexing-pipeline | 1 ✅ |
| `d568daa` | web-whatsapp-tab | 1 ✅ |
| `b549f37` | whatsapp-ingestion-first-slice | 1 ✅ |

`738b6df` / `f554dfa` are hook changes carrying their own Lab-Protocol authorisation (D-010, D-011);
`7f1df0d`, `f51f490`, `5974533`, `527d8f7`, `5dd77e5`, `ce15a02`, `67217d9`, `b5596e6`, `f2e9927`,
`fbda37b`, `cd9e320`, `d43f3ab`, `0f18dc9`, `b60353b` are qa/ledger/housekeeping.

**Handshake state:** every `qa/manifests/*.md` reads `checked-PASS` or `superseded-by`, except
`tracker-honesty.md` at `ready-for-check` — whose PASS verdict was written minutes earlier in this
same dispatch. **Close-out pending on that one unit only, and it is minutes old, not a gap.**

**Maker liveness — FINDING (high).** `qa/.last-tick` last stamped `2026-09-04T14:39:19Z`, three days
old, backlog non-empty (9 pending tasks, 11 open issues), no `qa/.paused`. Real maker work *has*
happened since — which makes this worse, not better: the maker is running and not stamping, so the
one file liveness is supposed to be read from says dead. → **ISS-054**.

### 2 — Feedback-inbox fold-in

All four `qa/feedback-inbox.md` entries carry an explicit `— folded <date>` marker with the reason
(three folded 2026-09-03 into `ingestion-source-seam` / `TASKS.md`, one recorded as reinforcing the
existing D-008/T-019 provider-chain design with no amendment needed). **Nothing unfolded. CLEAN.**

### 3 — Contract staleness + shape

No criterion found referencing a removed feature, and no contradiction against a newer amendment.
But the *shape* check fails on four files: **`whatsapp-ingestion-first-slice`, `web-whatsapp-tab`,
`ingest-indexing-pipeline`, `post-review-fixes-2026-09-06` carry no append-only amendment log at
all** — so no adoption, amendment or prune has ever been recorded against them. → **ISS-055**.

**And this exposed a live recurrence of a closed issue — see reopen-power below.**

### 4 — Enforcement liveness

Repo has commits (HEAD `a51b9c8`). Hooks registered and in the `-File` form D-010 mandates; D-006
authorises the mc wiring with `Approved-by: Umesh`, so the approval question is settled and is not
re-asked. `qa/loop.md` present, `Stop:` line at :41, `Human gate:` line at :50, no `qa/adapter.json`
contradicting it. **Loop-design triad:** *can it spin* — no, the Stop line reads real progress
signals (units closed, backlog empty). *Can it Goodhart the verifier* — materially reduced this
week: `catalogue-progress-score` → `derived-input-trust` was a five-cycle campaign that ended with
the score un-inflatable without a commit, and the honest number (20.2%) replacing 79%. *Can it run
a wrong answer to completion* — the `done_check`-vs-criterion gap is exactly what the Mode A check
in this dispatch found and fixed in T-021/T-022 (a PASS against a scoped-down contract had been
closing a task whose own text named a stronger deliverable). **Live.**

### 5 — Goal-coverage gap analysis

North star Phase-1 exit: *"POST /ask over the 23 TOC sessions returns speaker+timestamp-cited
internal answers, with web-fallback for off-corpus questions."*

| requirement | status | evidence |
|---|---|---|
| 23 TOC sessions ingested | **covered** | independently counted this dispatch: 23/23 real, 0 placeholders |
| `POST /ask` real endpoint | **covered** | `apps/api/src/routes/ask.ts:28`, T-009 PASS |
| speaker + timestamp citations | **covered** | T-005/T-005b ask-router, whatsapp-chat-view-speaker-names |
| web-fallback for off-corpus | **covered** | ask-web-fallback-tavily, commit `bedd090`, PASS cycle 1 |
| **answers are actually good enough** | **partial** | T-021/T-022 were the measurement, and this dispatch correctly reverted both to not-done — the harnesses exist, the real-provider runs do not |
| unstructured/vector search | **missing-by-plan** | T-008, sequenced, not orphaned |

No requirement is missing that no contract and no inbox entry can source. **No `GRILL:` row.**

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent; north star unedited since `created: 2026-09-03` while contracts were
amended after it (so the goal did not move out from under the contract); no unit re-PASSed twice on
the same evidence; last tick was `BACKLOG_EMPTY`, not `STALLED`/`EXHAUSTED`, so no `qa/debug/` report
is owed; `qa/gates/` is empty, so no gate was answered off-disk. **CLEAN.**

### 7 — Silent-failure hunt

Read the 18 non-test source files touched since the last sweep. One hit:

**`packages/index/src/pipeline/claims.ts:66-68`** — `catch { return []; }` with no log, no marker,
no signal. A session ingested during a provider-chain outage lands with zero claims and is
indistinguishable on disk from one that genuinely has none; downstream claim counts and `/ask`
citations silently understate. Its sibling `summarize.ts:80-88` degrades to a *clearly labelled*
`"(fallback, LLM summary unavailable) …"` string, and the contract (line 19) *requires* that label
for summarize while blessing no such unmarked result for claims. The asymmetry is a gap, not a
design. → **ISS-056**.

The other error paths checked (`ingest-store.ts:71`, `whatsapp-store.ts:169`,
`routes/whatsapp.ts:62`, `routes/pages.ts:104/184/253`) all bind `catch (err)` and propagate or
report. No empty catch, no lost cause, no unawaited side effect found.

---

## Reopen-power exercised — ISS-006 REOPENED (fixed → open, severity raised to high)

Segregation of duties on the ground truth. Since ISS-006 was closed, **four contracts were created
and committed inside maker feature commits**:

| contract | created in | +lines |
|---|---|---|
| `whatsapp-ingestion-first-slice.md` | `b549f37` (feat) | 160 |
| `web-whatsapp-tab.md` | `d568daa` (feat) | 85 |
| `ingest-indexing-pipeline.md` | `3a998d3` (feat) | 149 |
| `post-review-fixes-2026-09-06.md` | `9c6ff41` (fix) | 147 |

Three of the four invite adoption in their header — *"Drafted by the maker; /checker adopts or
amends on first check"* — and **no checker adoption was ever recorded on any of them**. None carries
an amendment log, so on disk the rules those units were judged against are still maker-authored,
which is precisely what ISS-006 named. The project CLAUDE.md rule (`qa/contracts/` — *maker never
edits it*) is being honoured in the recent checker commits (`5974533`, `527d8f7`, `5dd77e5`,
`f2e9927`) but was not honoured for these four.

**The counter-example is in this very dispatch and is the pattern to generalise:**
`qa/manifests/tracker-honesty.md` declined to draft its own contract, said so in the manifest, and
asked the checker to rule — which produced `qa/contracts/tracker-integrity.md`, checker-authored.

Remedy (one unit): the checker reads each of the four and appends an adoption-or-amendment entry.
Bounds respected — ISS-006 reopened once this sweep; no code, manifest or verdict touched.

---

## Top-3 recommended next units

1. **`contract-adoption-backfill`** (closes reopened **ISS-006** high + **ISS-055** medium) —
   *checker work, not maker work.* Read the four maker-authored contracts, adopt or amend each with
   a dated amendment-log entry stating what was checked against the plan/approval it claims to rest
   on. Until this lands, four units' ground truth has no independent owner.
2. **`maker-tick-liveness`** (closes **ISS-054** high) — stamp `qa/.last-tick` at the end of every
   `/maker continue` tick regardless of terminal state, including `ADVANCED` ticks that end in a
   dispatch. Small. The current signal is unreliable in the dangerous direction: it reads "dead"
   while the maker is working, which trains everyone to ignore it.
3. **Phase-1 U0.10 — the real-provider `T-021`/`T-022` runs** (the work reverting those rows now
   demands, and the only `partial` in the goal-coverage table). Recall@5 against the real
   `selectNodes` chain vs the 0.85 target, and a genuinely hand-scored 30-pair calibration set.

Also queued, low: **ISS-056** (claims silent degradation), **ISS-053** (wire G1 into
`lint:structure`), **ISS-057** (missing `Cycle checked:` line on `regenerate-year-migration.md`).
