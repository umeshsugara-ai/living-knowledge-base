# Verdict — live-verify-protocol

**VERDICT: PASS**
**Cycle checked: 2** (matches the manifest's `Fix cycle: 2 of max 3`)
**Date:** 2026-09-07
**Checked by:** /checker, Mode A, fresh context — bound to `D:\KnowledgeBase`
**Contract:** qa/contracts/developer-api.md (the routes exercised; the contract does not itself
cover verification apparatus — judged, per the dispatch, on whether the apparatus is HONEST and
REPRODUCIBLE, same frame as cycle 1)
**Manifest:** qa/manifests/live-verify-protocol.md
**Supersedes:** the cycle-1 FAIL on this slug (commit `fbda37b`)

---

## SCOREBOARD

**12/12 criteria met, 5/5 invariants hold.**

| # | Claim under test | Result |
|---|---|---|
| 1 | ISS-024 — jobs delta is MEASURED, and the measured number is what lands in `summary.md` | **PASS** |
| 2 | ISS-024 — no `"one real jobs ledger row"` constant survives in the script or a fresh summary | **PASS** |
| 3 | ISS-025 — vacuous citation PASS closed (reproduced against my own fake API) | **PASS** |
| 4 | ISS-026 — a formerly-stubbed route returning 200 is PASS-with-note, not FAIL | **PASS** |
| 5 | ISS-027 — `--skip-ask` on a dirty tree exits **4**, headline carries the caveat | **PASS** |
| 6 | ISS-027 — `qa/evidence/` excluded; dirty count does not grow across runs | **PASS** |
| 7 | ISS-028 — manifest LOC figures match `countLoc`, the metric `lint-loc` enforces | **PASS** |
| 8 | LOC budget — `live-verify.mjs` 292 ≤ 300 after the fixes | **PASS** |
| 9 | No regression — no seeding / tree rebuild / ingest; zero collection writes | **PASS** |
| 10 | No regression — reproducible across two independent runs | **PASS** |
| 11 | No regression — DIRTY-TREE still cannot mask a real failure | **PASS** |
| 12 | `pnpm lint:structure` exit 0 | **PASS** |

Invariants: read-only toward application content · remote Mongo reachable throughout (no
INCONCLUSIVE warranted) · verdict vocabulary unchanged · exit-code ladder total and unambiguous ·
every FAIL in my adversarial runs was reachable and correct.

---

## What I re-ran myself (nothing below is taken from the manifest)

**Environment.** `apps/api` on :3300 (401 without a key, 200 with one) and `apps/web` on :5173
were already up against the real remote Mongo. I minted my own credential —
`node scripts/mint-key.mjs` → `lv_74240e3c…21592c5d15bc`, accepted by `GET /sessions` (HTTP 200).
Remote Mongo was reachable on every probe; no check was downgraded to INCONCLUSIVE.

### 1. ISS-024 — measured, not asserted — **FIXED (verified)**

The fix is at `scripts/live-verify.mjs:217-223`: `countDocuments("jobs")` immediately before the
`/ask` call, again after, and the delta recorded as its own check and interpolated into
`summary.md:277`. I did not take the tool's word for the delta — I bracketed the whole run with
my own independent Mongo count, via my own script, not the tool's:

```
$ node --input-type=module <<< 'connect(); count jobs'      # BEFORE
jobs=190
$ LKB_API_KEY=lv_74240e3c… node scripts/live-verify.mjs
[PASS] POST /ask side effect measured — appended 12 real `jobs` ledger row(s)
overall: PASS (DIRTY-TREE — not attributable to fbda37b4)   EXIT=4
$ node --input-type=module <<< 'connect(); count jobs'      # AFTER
jobs=202
```

**202 − 190 = 12**, exactly the number the tool reported and exactly the number written into
`qa/evidence/live-2026-09-07-01-51-33/summary.md`:

```
- `POST /ask` exercised — appended 12 real `jobs` ledger row(s) this run (measured, not assumed)
```

That is a fourth distinct value across four sessions (20, 26, 12, 12), which is itself the
standing proof that no constant was ever right here.

**Constant elimination.** `grep -rn "one real"` over `scripts/`, `qa/evidence/`, `qa/manifests/`
returns only: (a) `scripts/live-verify.mjs:213`, a comment *describing the historical defect*;
(b) three cycle-1 evidence folders generated **before** the fix (`live-…01-35-54`, `01-38-36`,
`01-39-11`), which are historical artifacts, not live output; (c) the manifest quoting itself;
(d) an unrelated line in `seed-demo-server.mjs` about minting a key. No freshly generated
`summary.md` — I generated four — contains the constant. The header block (lines 18-20) now
states the measure-don't-assert rule instead of a figure.

### 2. ISS-025 — vacuous PASS closed — **FIXED (verified)**

I did not reuse the maker's fake. I stood up my own trivial `node:http` server on :3999 returning
`sources:{internal:[{node_id:"a"},{node_id:"b"}],web:[]}` with **no** `evidence.sessionRef`, and
pointed the real tool at it with an out-of-repo `--out`:

```
$ LKB_API_KEY=fakekey node scripts/live-verify.mjs --api http://localhost:3999 --out <scratch>
[PASS] POST /ask returns at least one citation — 2 internal + 0 web · verdict=correct
[FAIL] POST /ask citations resolve to real sessions
       — 2/2 cited source(s) carried no evidence.sessionRef — unverifiable
overall: FAIL (DIRTY-TREE — not attributable to fbda37b4)   EXIT=2
```

Under the cycle-1 code this identical response produced `refs=[]`, `0 === 0`, **PASS**. The guard
at `:249` (`unref === 0 && refs.length > 0 && found === refs.length`) closes it, and `:246`'s
`found = refs.length === 0 ? -1 : …` removes the arithmetic that made the hole possible.

### 3. ISS-026 — progress no longer penalised — **FIXED (verified)**

Same self-built fake server, `GET /search` returning **200** where the suite recorded a 501 stub:

```
[PASS] GET /search (scope: search) — HTTP 200 — was 501, now implemented: promote this to a real check
```

`:169-175` now reads as a not-worse-than assertion (`expect !== 200 && res.ok` → PASS + note).
`/citations/none` (still 501) stayed **STUB** and `/health` (still 404) stayed **MISSING** in the
same run, so the relaxation is scoped to genuine improvement — it did not flatten the vocabulary.
An unexpected non-ok status on a stub route still FAILs.

### 4. ISS-027 — exit code + self-dirtying — **FIXED (verified, both halves)**

```
$ LKB_API_KEY=lv_74240e3c… node scripts/live-verify.mjs --skip-ask >/dev/null 2>&1; echo $?
4
```
and the headline/summary carry the caveat (from that run's `summary.md`):
```
**Overall: PASS (DIRTY-TREE — not attributable to fbda37b4)** · DIRTY-TREE: 1 · PASS: 11 · STUB: 2 · MISSING: 1
- `POST /ask` skipped (--skip-ask)
```

**Self-dirtying half.** `:73-76` filters `qa/evidence/` out of the dirty-file list. I ran the tool
**three** times, each creating a new untracked evidence folder; the reported count was
**9, 9, 9** — flat — while raw `git status --porcelain` grew to 17 lines. Under cycle-1 code the
count grew 10 → 11 from the tool's own output. The tool no longer dirties the tree it measures.

### 5. ISS-028 — LOC figures — **FIXED (verified)**

Measured with `countLoc` from `scripts/lib/walk.mjs` (the exact function `lint-loc.mjs:20`
calls), not `wc -l`:

```
live-verify.mjs  countLoc=292  countLines=311
mint-key.mjs     countLoc=46   countLines=54
demo-live.mjs    countLoc=67   countLines=75
```

Manifest says **292 / 46 / 67** — exact match on the enforced metric. Budget is
`structure.config.json → loc.max = 300`, so **292/300 is within budget**; the fixes did not push
it over. The manifest's own note that "the next addition should split, not stretch" is correct
and I endorse it — 8 lines of headroom is one bug fix.

### 6. No regression (cycle-1 properties re-established, not assumed)

- **No seeding / tree rebuild / ingest.** `grep -n "insertOne|updateOne|updateMany|insertMany|
  deleteMany|replaceOne|bulkWrite|drop("` over `scripts/live-verify.mjs` → **zero hits**. Every
  Mongo touch is `countDocuments` or a `find`-side `countDocuments({_id:{$in:refs}})`. The only
  write in the whole protocol is `mint-key.mjs`'s `api_keys` delete-by-label + insert — a
  credential, not content, and it is deliberately kept out of `live-verify.mjs` (read the file;
  its header states the reason and it does not import `seed-demo-server.mjs`).
- **Reproducibility.** Two full runs (`live-2026-09-07-01-51-33`, `…-01-52-10`) produced two
  fresh folders with **identical verdict lines** on all 19 checks, including the same measured
  jobs delta of 12 and the same `api=26 mongo=26` reconcile.
- **DIRTY-TREE cannot mask a failure.** Both adversarial fake-server runs printed DIRTY-TREE at
  preflight *and still* ended `overall: FAIL` with **EXIT=2**. DIRTY-TREE is assigned at exactly
  one check and sits outside the FAIL/INCONCLUSIVE ladder, so it can only ever *add* a caveat.
- **Fabricated citation still caught.** Second fake server (:3998) returning one real sessionRef
  (`2026-04-21-visa-blueprint-part2-italy-france-nz`) and one invented one
  (`2026-99-99-totally-fabricated-session-id`):
  `[FAIL] POST /ask citations resolve to real sessions — 1/2 cited sessionRef(s) exist in Mongo`.
- **Reconcile check is real, not decorative:** against a fake returning one session it reported
  `[FAIL] … api=1 mongo=26`, and against another returning none, `api=0 mongo=26`.

### 7. `pnpm lint:structure` — **exit 0**

```
lint-loc: OK (209 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (239 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1154 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (239 modules, 702 dependencies cruised)
LINT_EXIT=0
```

---

## Not failures — observations for whoever touches this next

These are below the >80%-confidence FAIL bar and are recorded as questions, not charges:

1. **The dirty-file exclusion is a regex, not a path predicate.** `:76` tests
   `/\s+qa\/evidence\//` against `" " + trimmedLine`. It would also exclude a rename whose
   *destination* is under `qa/evidence/`, and a hypothetical `docs/qa/evidence/…` path. Neither
   exists today; a `startsWith("qa/evidence/")` on the parsed path would be tighter if this file
   is ever touched again.
2. **The measured jobs delta is bracketed around the `/ask` call, not isolated to it.** Any other
   writer against the same DB during the window would be attributed to `/ask`. That is inherent
   to measuring a shared ledger and is strictly more honest than the constant it replaced; worth
   one clause in `summary.md` if this ever runs concurrently with a worker.
3. **292/300 LOC.** Repeating the manifest's own warning because it is load-bearing: the next
   change to `live-verify.mjs` should extract, not append.
4. **Pre-existing, unrelated to this unit:** `qa/issues.jsonl` line 17 is not valid JSON
   (`Invalid \escape` at char 449) and breaks any strict JSONL consumer. I left the line
   byte-intact rather than rewrite evidence text I did not author. Flagging it for a sweep; it
   predates this unit and is not charged against it.
5. The three pre-fix evidence folders (`…01-35-54`, `…01-38-36`, `…01-39-11`) still contain the
   false "one real jobs ledger row" line. They are correct as *historical* records of what the
   tool said at the time; if any of them is ever cited as current evidence, that line is stale.

---

## Ledger

`ISS-024`, `ISS-025`, `ISS-026`, `ISS-027`, `ISS-028` → **verified** (2026-09-07). Each was
independently reproduced-as-fixed above, not accepted on the manifest's word. No new issues
opened by this check.

## Judgement

The unit's premise is that a claim which cannot be regenerated by one command does not count. The
cycle-1 FAIL was that the tool itself violated its own premise in one place. It no longer does:
the side effect is measured and the measured number is what ships, the one path that could pass
without evidence now fails loudly, the suite no longer punishes someone for implementing a stub,
and the attribution caveat is finally legible to a machine. All four fixes reproduced under my own
instruments against my own fake servers, and none of them cost a cycle-1 property.

**PASS.**
