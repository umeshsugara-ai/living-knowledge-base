# QUEUE — top-3 recommended next units (checker sweep 2026-09-07, Mode B safety net)

> Previous sweep stamp read `2026-09-07T17:41:28Z` (commit `dc88316`). Range verified by
> `git log dc88316..HEAD`, not by trusting timestamps: **6 commits** confirmed —
> `5a535c1`, `c2a5a9f`, `277c021`, `40f0666`, `b2d7618` (this sixth commit,
> `catalogue-cli-clean-check`/ISS-064, landed concurrently WHILE this sweep was running — its
> checker dispatch and this sweep were explicitly launched in parallel, same turn, per
> `qa/.last-tick`'s final line; it is included below since it closed before this sweep's findings
> were written).

## Terminal state: CLEAN

### 1 — Bypass detection + pair-state reconciliation

**No bypass.** Five units landed in range, each a manifest + matching-cycle verdict, all re-read
from disk (not trusted from any prior session's prose):

| commit | unit | manifest Fix cycle | verdict Cycle checked | Status |
|---|---|---|---|---|
| `5a535c1` | orphaned-scratch-tenant-cleanup | 1 | 1 | checked-PASS |
| `c2a5a9f` | bom-and-unreadable-evidence | 1 | 1 | checked-PASS |
| `277c021` | empty-manual-verdict-refusal | 1 | 1 | checked-PASS |
| `40f0666` | tracker-audit-g1-gate | 1 | 1 | checked-PASS |
| `b2d7618` | catalogue-cli-clean-check | 1 | 1 | checked-PASS |

Full-repo scan of every manifest's Status line (`grep -riE "^(## )?Status:" qa/manifests/*.md`)
found **zero** manifests stuck at `ready-for-check` — every one reads `checked-PASS` or
`superseded-by`. `catalogue-cli-clean-check.md` (line 97: `**Status: checked-PASS**`) was the
one genuinely in flight at sweep start — verified it landed with a real, independently-run
verdict (`qa/verdicts/catalogue-cli-clean-check.md`: fresh mutation test performed by the
checker itself — reverted `watchedInputsClean()` to the old two-path list, confirmed via `diff`
against a backup that content genuinely changed, re-ran, got exactly 12/13 with the new
regression test reddening, restored, 13/13 green again) — not raced, not double-checked.

`qa/.last-tick`'s final line explicitly records dispatching the checker for this unit **and**
this Mode B sweep in parallel, same turn — the correct call per "the maker's own dispatched
subagent gets first claim," and this sweep did not attempt its own Mode A check on the same unit
while that was live.

### 2 — Feedback-inbox fold-in

`qa/feedback-inbox.md` — 4 entries, all 4 carry an explicit `— folded <date>` marker (grep count
of "folded" = 4, matching the entry count). **No new entries since the last sweep, nothing
unfolded.**

### 3 — Ledger integrity (`node scripts/tracker-audit.mjs`, full + `--gate g1`)

```
$ node scripts/tracker-audit.mjs
tracker-audit: 2 finding(s)
  G2 unverified: 13 issue(s) are "fixed" with no verified_date — ISS-036, ISS-053, ISS-054,
  ISS-056, ISS-058, ISS-059, ISS-060, ISS-061, …
  G3 stale sweep: qa/.last-sweep predates HEAD by 0.0 day(s)

$ node scripts/tracker-audit.mjs --gate g1
tracker-audit: OK (gate G1)
```

**G1 clean.** **G2 is the expected shape** — `fixed`-not-yet-`verified` rows per the ledger's own
rule (`fixed → verified` only on a *later* re-check); own count (below) confirms 16 `fixed` total.
**G3 is transient-expected** — resolves the moment this sweep's `.last-sweep` commit lands.

**G1-gate refactor confirmed sound.** `scripts/tracker-audit.mjs` is now a 30-line thin CLI
(`main()` → `parseGateArg` + `audit` + `filterByGate` from `scripts/lib/tracker-audit.mjs`, the
110-line module holding the real G1/G2/G3 logic) — wired into `pnpm lint:structure` via
`node scripts/tracker-audit.mjs --gate g1` (confirmed present at `package.json:16`) and it
**passes** as part of a full green `pnpm lint:structure` run (lint-loc, lint-dirsize, lint-root,
lint-dupes, lint-migrations, snapshot --check, tracker-audit gate G1, depcruise — all OK, 242
modules / 712 deps cruised, zero violations). `--json` mode still supported for programmatic
consumers.

**Ledger status vocabulary re-confirmed consistent** across `scripts/lib/tracker-audit.mjs:73`
(`if (r.status === "fixed" && !r.verified_date)`) and `.claude/hooks/mc-sessionstart.ps1:8`
(`'"status":\s*"(open|Open)"'`) — unchanged, no conflation, no third consumer added.

**JSON-validity re-check (superseding a stale open finding):** re-parsed all 69 `issues.jsonl`
lines with both `node`'s `JSON.parse` and `python3 json.loads` — **0 invalid lines**, including
line 17 (ISS-017's row), which **ISS-020 claims is broken** ("an unescaped backslash... breaks
strict JSON parsing"). Direct re-test of ISS-020's own cited evidence command
(`python3 -c "import json; [json.loads(l) for l in open('qa/issues.jsonl')]"`) raised **no
error** this sweep. ISS-020 appears to be a stale/false-positive finding as currently written —
flagged for the next hygiene unit to verify and close, not closed unilaterally by this sweep
(the sweep does not edit the ledger's own findings without a matching build/verify unit).

**Own count, verified by direct scan:** 69 total — **11 open, 16 fixed, 42 verified.** Arithmetic
checks out against last sweep's 16/11/42: exactly the 5 units this range closed (ISS-067, ISS-040,
ISS-036, ISS-053, ISS-064) moved `open → fixed`, net effect −5 open / +5 fixed, verified count
unchanged (none of the 16 `fixed` rows had a *later* re-check land in this range).

### 4 — Enforcement liveness

204 commits on HEAD (not zero-history). `.claude/settings.json` hooks present in `-File` form
(D-010, 6 `.ps1` references) — unchanged since last sweep. `qa/loop.md` present with
`Stop:`/`Human gate:` lines, uncontradicted by `qa/adapter.json` (absent — default coding
adapter, unchanged). Loop-design triad: **can it spin** — no, this range's Stop signal was five
real manifest close-outs, not busywork. **Can it Goodhart the verifier** — no; every unit this
range was checked by the checker's own mutation-tested reproduction (see #1 and the
catalogue-cli-clean-check verdict's independent mutation run), not a maker self-report. **Can it
run a wrong answer to completion** — no; every `done_check` this range was at least as strong as
its criterion (the ISS-064 fix specifically *closed* a done_check gap that had been weaker than
its criterion). **Live.**

### 5 — Goal coverage

`.goal/goal.json`: 35 tasks / 26 done / 74% — unchanged from last sweep (the `updated` timestamp
and `analytics.velocity_per_day`/`eta_days` moved as part of a routine deterministic recompute,
`git diff .goal/goal.json` shows no task-row edits). All five units this range are ledger-driven
with no goal task (each is a hygiene/robustness fix on a shared primitive, not a T-* closure) —
confirmed still true. No new missing requirement surfaced; no `GRILL:` row.

### 6 — Goal-drift / re-grill

`qa/.regrill-due` absent. No `qa/gates/` directory — no gate to have been answered off-disk.
Reopen-power: no unit re-PASSed twice on the same evidence this range. No `STALLED`/`EXHAUSTED`
tick since the last sweep — all ticks in range are `ADVANCED`. North star unchanged since the
last contract amendment. **CLEAN.**

### 7 — Silent-failure hunt

Read the touched surface in range: `scripts/lib/evidence.mjs`, `scripts/lib/catalogue.mjs`,
`scripts/lib/tracker-audit.mjs` (new file), `scripts/catalogue-cli.test.mjs`,
`scripts/catalogue-score.mjs`, `scripts/catalogue.test.mjs`, `package.json`. **Zero hits.**

- `evidence.mjs`'s BOM-strip fix (ISS-040) pushes unreadable candidates into a returned
  `unreadable[]` array that the caller renders as a warning line — the exact opposite of a
  swallow (previously it silently `continue`d past unparseable files with no record at all).
- `catalogue.mjs`'s guard fix (ISS-036) changed a truthy check (`f.manual?.verdict`) to a
  key-presence check (`f.manual && "verdict" in f.manual`) so an empty-string verdict now hits
  the same vocabulary-refusal path as any other bad value — closes a silent-bypass, doesn't add
  one.
- `tracker-audit.mjs`'s two `try {} catch { /* not a git checkout */ }` blocks are deliberate,
  narrow control flow (falling back to a documented "unknown"/skip state, commented inline), not
  error-swallowing of a failure the caller needed.
- No lost-cause re-raise, no unawaited/untimed side effect introduced anywhere in this surface.

Also specifically verified per this sweep's brief: the `orphaned-scratch-tenant-cleanup` unit's
production Mongo delete. **Independently re-queried the live database** (read `.env` for
`MONGODB_URL`, `db.collection("lkb").collection("tree_index")`, ran from `packages/db` so the
`mongodb` driver resolved) rather than trusting the manifest:

```
Total tree_index documents: 1
{"_id":"6a9d7b9033ea455b49422cb8","tenantId":"toc"}
Remaining chk060-A-* scratch docs: 0
```

Exactly 1 document (the real `toc` tenant), zero scratch-tenant documents remain — the manifest's
claim holds under independent live re-verification, not just a re-read of its own evidence.

---

## Standing issue, unchanged this sweep

**ISS-006** (segregation of duties — high, open since prior sweeps): `ingest-indexing-pipeline.md`
was formally adopted before this range began; `whatsapp-ingestion-first-slice.md`,
`web-whatsapp-tab.md`, `post-review-fixes-2026-09-06.md` are still maker-drafted with no checker
adoption recorded. Untouched this sweep — no commit in range touches these three contracts.

---

## Top-3 recommended next units

1. **`contract-adoption-backfill`** (closes **ISS-006**, high) — *checker work.* Adopt-or-amend
   `whatsapp-ingestion-first-slice.md`, `web-whatsapp-tab.md`, `post-review-fixes-2026-09-06.md`
   the same way `ingest-indexing-pipeline.md` was done. Highest severity in the open backlog and
   the oldest standing item — untouched for multiple sweeps now.
2. **`manifest-close-out-and-contract-shape-sweep`** (closes **ISS-017** + **ISS-055**, both
   medium) — `real-llm-scorer.md`'s manifest close-out gap and four contracts still carrying no
   append-only amendment log (blocks routine amendment/prune on any of them). Re-checked this
   sweep: still open, still the next-highest severity after ISS-006.
3. **`ledger-hygiene-pass`** (closes **ISS-020** + **ISS-057**, both low) — this sweep re-tested
   ISS-020's own cited evidence command and got **no error**: `qa/issues.jsonl` parses clean end
   to end on both `node` and `python3 json.loads` (0/69 invalid lines). Verify that finding is
   genuinely stale (not just transiently fixed) and close it if so; separately,
   `qa/verdicts/regenerate-year-migration.md` still carries no `Cycle checked: N` line (ISS-057).
   Small, low-risk, clears two of the longest-standing low-severity rows.

Also queued, low, unchanged from last sweep: **ISS-007**, **ISS-011**, **ISS-021**, **ISS-050**,
**ISS-051**, **ISS-052**.

ISS-036, ISS-040, ISS-053, ISS-064, ISS-067 (last sweep's queue) are now closed/fixed by the five
units this range covers — removed from the queue.
