# Verdict — catalogue-progress-score

**Date:** 2026-09-07
**Checker:** /checker Mode A, fresh context, bound to `D:/KnowledgeBase`
**Manifest:** qa/manifests/catalogue-progress-score.md
**Contract:** qa/contracts/snapshot-features-ledger.md
**Cycle checked: 1**
**Verdict: FAIL** (core instrument is sound and the headline number is honest; four gaps in the
guard that is this unit's entire value proposition, one of them undisclosed)

---

## What I re-ran myself

Every command below was executed by me in `D:/KnowledgeBase`. No manifest output was trusted.
The working tree was byte-restored afterwards (`.goal/catalogue.json` diff-identical to its
pre-check state; `docs/PROGRESS.md` md5 `ec826bd6141dcc84f24b3415dd1bad26`; `git status --porcelain`
unchanged from session start).

### 1. Determinism — PASS
```
node scripts/catalogue-score.mjs   (x2)
wrote docs/PROGRESS.md — 20.2% adjusted / 28.9% machine-derived, 57 features
md5: ec826bd6141dcc84f24b3415dd1bad26   (both runs)
diff run1 run2 → empty
```
Byte-identical across runs.

### 2. Staleness gate — PASS
```
node scripts/catalogue-score.mjs --check              → exit 0  "OK: docs/PROGRESS.md is current"
echo "tampered" >> docs/PROGRESS.md ; --check         → exit 1  "STALE: ... differs from a fresh regeneration"
in-place verdict swap (C2 MISSING→REAL in the table); --check → exit 1  STALE
restored ; --check                                    → exit 0
```
Catches both an appended line and a silent in-place verdict edit. Not a trivially-passing check.

### 3. Verdicts derived, not hand-written — PASS
```
rm docs/PROGRESS.md ; node scripts/catalogue-score.mjs
md5 docs/PROGRESS.md = ec826bd6141dcc84f24b3415dd1bad26   (identical to pre-delete)
```
Nothing in the document survives deletion that is not reproducible from the probes.

### 4. THE HONESTY RULE — the stated guard HOLDS, but I broke it three other ways

**Stated guard holds.** Setting a MISSING feature's `manual.verdict` to `"REAL"`:
```
node scripts/catalogue-score.mjs
REFUSED: .goal/catalogue.json tries to UPGRADE a derived verdict:
  C2: manual "REAL" > auto "MISSING"
→ exit 2, and docs/PROGRESS.md md5 UNCHANGED (it genuinely refused to write)
node scripts/catalogue-score.mjs --check → exit 2 as well (the gate refuses in both modes)
```

**Inflation paths the guard does NOT cover** — all three verified by execution, all three leave
`node scripts/catalogue-score.mjs --check` and `pnpm lint:structure` at **exit 0** afterwards:

| # | attack | measured effect | caught? |
|---|---|---|---|
| A | delete the 19 probe-less feature rows from `.goal/catalogue.json` | **20.2% → 30.3%** (denominator 57→38) | **no** |
| B | strip only the *failing* probes from the 3 PARTIAL features | **20.2% → 23.7%** | no (disclosed) |
| C | repoint B6's probe `chunks` → `turns` | B6 **MISSING → REAL**, 20.2% → 21.9% | no (disclosed) |
| D | `manual.verdict: "SHIPPED"` (any string outside the ORDER map) | row printed `**SHIPPED** _(auto: MISSING, lowered)_`, headline `NaN%`, **exit 0, file written** | **no** |

Attack A is the serious one and is **not disclosed anywhere in the manifest**. Nothing pins the
catalogue to plan §4c's 57 features, so the cheapest way to raise the number is to delete the rows
that score zero — and the generated document then truthfully reports "30.3% of the 38-feature
product catalogue", which reads as progress rather than as deletion.

Attack D is a genuine bypass of the ordering comparison: `ORDER["SHIPPED"]` is `undefined`,
`undefined > 0` is `false`, so `scoreCatalogue` (scripts/lib/catalogue.mjs:135) takes the *else*
branch and assigns the upgraded verdict — then labels it `lowered`. Only an accidental `NaN`
(POINTS lookup miss) makes it visible; the per-row lie is silent and the process exits 0.

Attacks B and C are the class the manifest does disclose ("a too-easy probe scores higher") and the
"derived from" column does expose them to a reader — `collection turns (2118 docs)` under a feature
named "Vector index" is visibly wrong. Residual, mitigated, but the `--check` gate is no defence.

### 5. Probes attacked against reality — PASS, 7/7 correct (5 required)

| row | claim | my independent check | ok |
|---|---|---|---|
| C2 | `/ask` page absent → MISSING | `grep path= apps/web/src/App.tsx` — 10 routes, no `/ask` | yes |
| B6 | `chunks` empty → MISSING | **live Mongo `lkb.chunks.countDocuments()` = 0** | yes |
| B4 | `claims` 81 → REAL | **live Mongo `lkb.claims` = 81**, exactly matches the evidence file | yes |
| A10 | `@lkb/meeting-bot` dead code → STUB | `grep -rn '@lkb/meeting-bot' apps packages` — only its own package.json/src | yes |
| C8 | `GET /search` a 501 stub → STUB | `apps/api/src/routes/stubs.ts:22` `STUB_ROUTES` + `res.status(501)` | yes |
| A8 | 2 routes + page → REAL | `whatsapp.ts:48,53` literal `.get/.post`, `/whatsapp` in App.tsx | yes |
| E3 | 3 of 6 routes → PARTIAL | POST /ask, GET /sessions, GET /sources literal; /search, /citations/:claimId, /webhooks/register only in STUB_ROUTES | yes |

Mongo was reachable this run. I independently counted `lkb`: chunks 0, claims 81, sessions 26,
turns 2118, speakers 0, tenants 0, tree_index 1 — **every one matches
`qa/evidence/live-2026-09-07-01-58-41/preflight.json`**. Only `jobs` drifted (214 → 226), which is
live activity and touches no verdict. The committed evidence file is trustworthy.

### 6. The guard catching the BUILDER (B3, E1) — PASS
Both now carry `manual: null` with the reasoning demoted to a non-verdict-changing `note`, and both
score MISSING. I enumerated every `manual` entry in the file: 11 remain (A1, A4, A6, A7, A10, A13,
B8, C1, D1, D7, E2) and **all 11 are downgrades or equal** — the scorer's exit 0 proves it, since any
upgrade exits 2. **No `manual` upgrade remains anywhere in the file.**

### 7. Lint / LOC — PASS
```
pnpm lint:structure → exit 0   (lint-loc OK 211 files, SNAPSHOT OK, "OK: docs/PROGRESS.md is current", depcruise clean)
```
`catalogue-score --check` is **genuinely** in the chain, proven by breaking it rather than by
reading package.json: with a tampered `docs/PROGRESS.md`, `pnpm lint:structure` **exits 1** on the
`STALE:` line. LOC via the project's own `scripts/lib/walk.mjs countLoc` (not `wc -l`):
`scripts/catalogue-score.mjs` = **106**, `scripts/lib/catalogue.mjs` = **151**, budget **300**. Both
within budget and both match the manifest's figures exactly.

`docs/PROGRESS.md` is 99 lines with the required `<!-- GENERATED ... DO NOT EDIT -->` header.

### 8. Contract criterion 8 (tests) — FAIL
The contract requires tests for its generated-doc discipline and `scripts/snapshot.test.mjs` exists
for the analogous `snapshot.mjs`. For this unit:
```
grep -rln "catalogue|scoreCatalogue|upgrades" scripts/*.test.mjs → NO MATCH
pnpm test:lint → runs scripts/lint.test.mjs scripts/snapshot.test.mjs only
```
**There is no test anywhere covering the honesty guard, the ORDER comparison, determinism, or the
staleness gate for this scorer.** The one property the unit exists to provide has zero regression
coverage: a future refactor of `scoreCatalogue` that drops the `upgrades` check would break nothing
in CI. Every finding above is a test that should exist.

---

## Contract-coverage note (not scored as a failure)

`qa/contracts/snapshot-features-ledger.md` is a contract about `docs/FEATURES.jsonl` +
`docs/SNAPSHOT.md`. Criteria 1, 2, 5, 6, 7 and 9 have no bearing on this unit. The maker reused it
as a *discipline template* (generated doc + GENERATED header + staleness gate in `lint:structure` +
tests), which is reasonable and I judged those transferable parts — but it means **no contract
states this unit's own acceptance criteria**, so there is no ground truth for the honesty rule
itself. I did not rule CONTRACT_MISMATCH because the work is substantially checkable and good;
declaring it would burn a cycle for a governance defect. Recommend the next cycle add
`qa/contracts/catalogue-progress-score.md` stating the honesty invariants (denominator integrity,
verdict-vocabulary validity, probe-change reviewability) so they can be checked rather than
re-derived by each checker.

## Assessment of the manifest's disclosed limitations

Mostly honest and unusually forthcoming — recording the guard catching the builder rather than
tidying it away is exactly right, and I verified that story is true. Two problems:

- **The "13 features declare no probe" figure is wrong.** The real count is **19** (A12, B12, C5,
  C6, C7, C10, C11, C12, C13, C14, D2, D4, D5, D6, E4, E5, E7, F1, F2). The manifest's own
  parenthetical list enumerates **17**, omitting A12 and B12, and is labelled 13. In a unit whose
  subject is not inflating numbers, a hand-counted disclosure that is wrong by six matters. The
  limitation itself is adequately disclosed and is *not* a hidden weakness — probe-less rows score
  MISSING, the conservative direction, and the generated table prints "no probe declared" for each.
- **The denominator is not listed as a limitation at all**, and it is the largest single lever on
  the number (attack A: +10.1 points). That is the gap, not the 19 probe-less rows.

The remaining two disclosures (evidence freshness, regex route scraping vs live probe) are accurate
and correctly scoped; `pnpm verify:live` is a real complement and I confirmed its evidence matches
Mongo today.

## Incidental (pre-existing, NOT charged to this unit)

`qa/issues.jsonl` is not fully machine-readable: line 17 (**ISS-017**, dated 2026-09-03) fails
`JSON.parse` — *"Bad escaped character at position 450"* — because it embeds the regex
`'VERDICT:\s*PASS'` with a raw `\s`, which is an invalid JSON escape. 32 of 33 lines parse; that one
does not. Any consumer that reads the canonical ledger line-by-line will crash or silently skip it.
Recorded here rather than as a new issue because it predates this unit by four days and belongs to
the enforcement/ledger feature; the next Mode B sweep should fix the escape in place.

---

```
VERDICT: FAIL
SCOREBOARD: 6/7 dispatch criteria met, 3/4 honesty invariants hold
FAILURES:
- [C8-analogue] sev: high · No test anywhere covers the scorer — the honesty guard, ORDER comparison, determinism and staleness gate have zero regression coverage, so a later refactor can silently delete the guard · add scripts/catalogue.test.mjs asserting exit 2 on upgrade, byte-identical double run, exit 1 on tamper; register it in test:lint · issue: ISS-030
- [honesty] sev: high · Denominator inflation is unguarded and undisclosed: deleting the 19 probe-less rows moves the score 20.2% → 30.3% and both --check and lint:structure stay exit 0 · pin the catalogue to plan §4c (assert features.length and the id set against a committed manifest; fail the run on drift) · issue: ISS-029
- [honesty] sev: medium · A manual.verdict outside {MISSING,STUB,PARTIAL,REAL} bypasses the ordering guard entirely (ORDER lookup is undefined, `undefined > 0` is false), writing an UPGRADED verdict labelled "lowered" with exit 0 · validate the verdict vocabulary in scoreCatalogue and exit 2 on an unknown value · issue: ISS-031
- [honesty] sev: medium · Probe weakening/repointing silently inflates (strip failing probes 20.2→23.7%; repoint B6 chunks→turns makes it REAL) with --check green · disclosed but unmitigated by any gate; make probe edits reviewable (hash the probe set into PROGRESS.md, or diff probes in the staleness check) · issue: ISS-032
- [manifest] sev: low · "13 features declare no probe" is wrong — the real count is 19 and the manifest's own list enumerates 17 (A12, B12 omitted) · re-derive the figure from the file · issue: ISS-033
ISSUES-WRITTEN: ISS-029, ISS-030, ISS-031, ISS-032, ISS-033
EXPLANATION: The instrument itself is good and the 20.2% headline is honest — I independently
confirmed 7 of 7 spot-checked verdicts against source and live Mongo, the score is byte-deterministic
and fully re-derivable from a deleted file, the staleness gate is genuinely wired into
lint:structure (proven by breaking it), and the advertised guard really does exit 2 and refuse to
write on a manual upgrade, including the B3/E1 rows where it caught the builder. It FAILs because
the guard that is this unit's whole value proposition has no test at all, and because I found an
undisclosed inflation path that beats it outright: deleting probe-less rows raises the number ten
points with every gate still green. Both fixes are small and the unit should pass cycle 2 easily.
```
