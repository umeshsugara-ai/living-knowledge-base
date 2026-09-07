# Verdict — catalogue-progress-score

**Date:** 2026-09-07
**Checker:** /checker Mode A, fresh context, bound to `D:/KnowledgeBase`
**Manifest:** qa/manifests/catalogue-progress-score.md
**Contract:** qa/contracts/catalogue-progress-score.md — **NEW this cycle; ADOPTED as drafted, then AMENDED** (see below)
**Cycle checked: 2**
**Verdict: PASS**

All five cycle-1 issues (ISS-029…ISS-033) independently confirmed fixed by execution, not by
reading the manifest. Two new inflation levers found and filed (ISS-034, ISS-035) plus one low
edge (ISS-036); none of them is a failure of the fixes under check, and all three are covered by
contract amendments effective from cycle 3.

---

## Contract decision (I am the contract owner)

**ADOPTED I1–I8 exactly as the maker drafted them.** They state this unit's acceptance criteria
correctly, every one is machine-checkable, and none softens anything the cycle-1 verdict found —
the drafting is faithful to the findings rather than shaped to pass them. This closes the
governance gap the cycle-1 verdict flagged: there is now a document stating the honesty rules, so
the next checker judges instead of re-deriving.

**AMENDED (tightening → auto per the criticality gate)** with **I9** (scoring scale pinned and
self-describing) and **I10** (collection evidence bounded and attributable), both **effective from
cycle 3**. They were added after this cycle's work was submitted; judging cycle 2 against
goalposts I moved mid-verdict would be exactly the thing the protocol forbids in the other
direction. Amendment log written into the contract.

---

## What I re-ran myself

Every command below was executed by me in `D:/KnowledgeBase`. No manifest output was trusted.
**Working tree byte-restored afterwards** — `.goal/catalogue.json` md5 `881b1343956e9a5fa393012c3a8d466b`,
`docs/PROGRESS.md` `99fb58643e83f8e9965b12348ee9992a`, `scripts/lib/catalogue.mjs`
`f8662b9506fe7bf4cadd8761e5969efe`, `scripts/catalogue-score.mjs` `3f40f3f77d6979e0a421c4bfa3231723`,
`scripts/catalogue.test.mjs` `d95275300469203a4304b2f99b5286c4`; `git status --porcelain` identical
to session start.

### ISS-029 — denominator inflation — **FIXED** (I re-ran my own cycle-1 attack, plus 4 variants)

| my attack | result |
|---|---|
| delete the 19 probe-less rows (the cycle-1 attack, 57→38) | **exit 2**, names all 19 ids, `docs/PROGRESS.md` md5 **unchanged** |
| same attack under `--check` | **exit 2** (refuses in both modes, not just on write) |
| rename `A6` → `A99` | **exit 2** — `dropped feature(s): A6` + `unknown feature(s): A99` |
| add an extra id `G1` (58 rows) | **exit 2** — `unknown feature(s): G1` |
| duplicate an existing id (58 rows) | **exit 2** — `duplicate id(s): A4` |
| **reorder the rows** (shuffled, seed 7) | **exit 0, still 20.2%** — correctly HARMLESS, not over-strict |

The maker only demonstrated the first of these. The three variants it did not cover are all caught,
and the one case that *should* be harmless is harmless. `assertDenominator` is called before any
scoring (`catalogue-score.mjs:33`), so a drifted catalogue never reaches the writer.

### ISS-030 — no tests — **FIXED, and the tests have teeth**

```
node --test scripts/catalogue.test.mjs   → 10/10 pass
pnpm test:lint                           → 24 pass, 0 fail   (registered: package.json:17)
```

A passing suite proves nothing on its own, so I **mutation-tested every guard** — neutering each
one in `scripts/lib/catalogue.mjs` and re-running:

| guard neutered | tests that went red |
|---|---|
| vocabulary check (I3) | 1 — *an unknown verdict string cannot bypass the ordering check* |
| manual-upgrade ordering (I2) | 1 — *a manual upgrade is refused* |
| `assertDenominator` (I4) | **2** — *dropping a feature…*, *an unknown or duplicated id…* |
| dead-package → STUB (I6) | 1 — *a package imported by nothing scores STUB* |
| 501-stub subtraction (I6) | 1 — *a stub route scores STUB, not REAL* |
| probe fingerprint (I5) | 1 — *editing a probe changes the fingerprint* |

6/6 mutations killed at least one test. **I8 holds**: every guard in I2–I6 has a test that fails
when the guard is removed. Library restored byte-identically after each mutation.

### ISS-031 — vocabulary bypass — **FIXED**

```
C2.manual.verdict = "EXCELLENT"  → exit 2  'manual verdict "EXCELLENT" is not one of MISSING/STUB/PARTIAL/REAL'
C2.manual.verdict = "SHIPPED"    → exit 2  (same)
C2.manual.verdict = "REAL"       → exit 2  'C2: manual "REAL" > auto "MISSING"'   (I2 still holds)
```

In every case `docs/PROGRESS.md` md5 **unchanged** — refused *and* no write. No row labelled
"lowered", no `NaN%` headline. The vocabulary is validated **before** the ordering comparison
(`catalogue.mjs:184`), which is the correct order and the actual root-cause fix, not a patch on
the symptom.

### ISS-032 — probe weakening — **FIXED as far as it honestly can be; my assessment below**

`docs/PROGRESS.md:8` carries `Probe fingerprint 9acec0d56307`, and it moved on every probe edit I
tried:

| edit | score | fingerprint |
|---|---|---|
| baseline | 20.2% | `9acec0d56307` |
| repoint B6 `chunks` → `turns` (cycle-1 attack C) | 21.9% | `b8a7ff971f9f` |
| strip every failing probe repo-wide (cycle-1 attack B, maximal) | 21.9% (machine 28.9→31.6) | `58ce6cab990a` |

**Honest assessment, as asked: this is still a live inflation path — no gate refuses it — and I
accept it anyway.** Probes are hand-authored statements of what would *prove* a feature real; no
machine can decide that a probe is the *wrong* probe without a second, equally hand-authored
oracle. Reviewability is therefore the theoretical ceiling for this class, and the fingerprint
reaches it: any probe edit now lands as a one-line diff in a committed generated file, so it must
be argued for rather than slipped in. The contract (I5) says exactly this rather than overclaiming
prevention, which is the right disclosure. I would have refused a fix that *called* itself
prevention.

### ISS-033 — the wrong count — **FIXED, and derived**

`docs/PROGRESS.md:10` prints `19 feature(s) declare no probe … : A12, B12, C5, C6, C7, C10, C11,
C12, C13, C14, D2, D4, D5, D6, E4, E5, E7, F1, F2.` It is **computed**
(`catalogue.mjs:208`, a filter over rows with an empty `probes` object), not typed — and it matches
my own independent enumeration of `.goal/catalogue.json` exactly: 19, same ids, same order.

**The other numbers, re-derived by me** using the project's own `walk.mjs countLoc` (not `wc -l`):

| file | countLoc | manifest claims | budget |
|---|---|---|---|
| `scripts/catalogue-score.mjs` | **120** | 120 | 300 |
| `scripts/lib/catalogue.mjs` | **200** | 200 | 300 |
| `scripts/catalogue.test.mjs` | **87** | 87 | 300 |

All three correct and within budget — the third-time-lucky re-derivation is real. One nit, not an
issue: the manifest says `docs/PROGRESS.md` is "104 lines"; `countLines`/`wc -l` both say **103**
(104 is `split("\n").length`, counting the trailing empty). Noted only because this unit's subject
is numbers that match reality.

### No regression on the cycle-1 properties — all hold

- **Determinism (I1):** two consecutive runs, md5 `99fb58643e83f8e9965b12348ee9992a` both times.
- **Re-derivable from deletion (I1):** `rm docs/PROGRESS.md` then regenerate → same md5. Nothing in
  the document survives deletion that is not computed from a probe.
- **Staleness gate (I7):** `--check` exit 0 fresh; exit 1 after an appended line; exit 1 after a
  silent **in-place verdict swap** (`C2 MISSING → REAL` inside the table). Proven to be genuinely in
  the chain by *breaking* it, not by reading `package.json`: with a tampered doc,
  `pnpm lint:structure` **exits 1** on the `STALE:` line. Clean: `pnpm lint:structure` **exit 0**.
- **Manual-upgrade refusal (I2):** holds (above). All **11** remaining `manual` entries (A1, A4, A6,
  A7, A10, A13, B8, C1, D1, D7, E2) are downgrades — exit 0 proves it, since any upgrade exits 2.
  B3 and E1 still carry `manual: null` with the reasoning demoted to a non-verdict-changing note.
- **`<!-- GENERATED … DO NOT EDIT -->` header** present.

### Verdicts re-checked against reality — 6 of 6 correct (3 required)

| row | claim | my independent check | ok |
|---|---|---|---|
| C2 | `/ask` page absent → MISSING | `apps/web/src/App.tsx` — 10 `path=` routes, **no `/ask`** | yes |
| C8 | `GET /search` is a 501 stub → STUB | `apps/api/src/routes/stubs.ts:22` in `STUB_ROUTES`, `:29` `res.status(501)` | yes |
| A10 | `@lkb/meeting-bot` dead code → STUB | `grep -rn '@lkb/meeting-bot' apps packages` excluding its own package → **zero hits** | yes |
| B6 | `chunks` empty → MISSING | **live Mongo `lkb.chunks` = 0** | yes |
| B4 | `claims` 81 → REAL | **live Mongo `lkb.claims` = 81** | yes |
| B3 / E1 | speakers / tenants empty → MISSING | **live Mongo `speakers` = 0, `tenants` = 0** | yes |

Mongo (13.202.206.101) was reachable this run. I counted `lkb` myself: chunks 0, claims 81,
sessions 26, turns 2118, tree_index 1, speakers 0, tenants 0 — **every one matches
`qa/evidence/live-2026-09-07-01-58-41/preflight.json`**. Only `jobs` drifted (214 → 226), which is
live activity and touches no verdict. The committed evidence file is accurate *today* (see ISS-035
for why that is a matter of trust rather than of proof).

---

## Adversarial pass: is there any remaining way to inflate this score? Yes — two.

Neither is a defect in the five fixes above; both are levers I1–I8 do not reach. Both are filed
and both now have a contract invariant.

**1. Rewrite the scoring scale (ISS-034, medium, +8.3 points).** Changing `POINTS` at
`catalogue.mjs:30` from `{STUB:0, PARTIAL:0.5}` to `{STUB:0.5, PARTIAL:0.75}` moves the headline
**20.2% → 28.5%** with **all 10 tests still passing**, `--check` exit 0, `lint:structure` exit 0,
and the probe fingerprint **unchanged** (it hashes probes and manual verdicts, not the scale). The
aggravating part: `catalogue-score.mjs:50` prints the scale as a **hardcoded string**, so the
tampered document still asserts `Scoring: REAL=1, PARTIAL=0.5, STUB/MISSING=0` while actually
scoring STUB at 0.5. A generated document that misstates its own arithmetic is worse than one that
has none. Fix is two lines: render the scale from `POINTS`, and pin `POINTS` in a test.

**2. Substitute the collection evidence (ISS-035, medium, +19.3 points — the largest lever in
either cycle).** `loadCollectionCounts` picks the **lexically last** `qa/evidence/live-*` folder
(`catalogue.mjs:94-95`), so the folder *name* is attacker-controlled. Adding one folder
`live-2026-12-31-23-59-59/preflight.json` with every zero count replaced by `4242` moves the score
**20.2% → 39.5%** (machine 28.9% → 50%) with `--check` exit 0, `lint:structure` exit 0, all tests
passing and the fingerprint unchanged. It is *reviewable* — the chosen path is printed at
`PROGRESS.md:12`, the per-row "derived from" column would show absurd counts, and `preflight.json`
is git-tracked so it lands as a diff — but the score's single largest input is hashed by nothing
and bounded by nothing. This is the same shape as ISS-029: guard the numerator and the verdicts,
and the *input* is left open.

**Also filed: ISS-036 (low).** A falsy `manual.verdict` (`""`) is inert rather than refused —
`f.manual?.verdict` at `catalogue.mjs:179` is falsy, so the vocabulary check at `:184` is never
reached. **Not scored as a cycle-2 failure**: I3's stated regression is genuinely fixed (no bogus
verdict can reach the output), and the impact is bounded — deleting a downgrade only restores the
machine verdict, which can never exceed the machine-derived percentage the document already prints
next to the headline, and the edit still moves the fingerprint and empties the "Human downgrades"
section. It is a hardening nit, and it is written down rather than tidied away.

**What I could NOT find a way to do:** raise the adjusted score above the machine-derived score
without touching source; drop, rename, duplicate or smuggle a feature id; write any verdict not
computed from a probe; or edit `docs/PROGRESS.md` by hand and survive `lint:structure`. The core
claim — *the number cannot be inflated without tripping a gate or leaving a diff* — is now true for
the data file. For the source file and the evidence file it is "without leaving a diff" only, which
I9/I10 are there to close.

---

## Ledger

ISS-029, ISS-030, ISS-031, ISS-032, ISS-033 → **verified** (each with the evidence I produced).
ISS-034, ISS-035, ISS-036 → **open**, new this cycle.

The pre-existing malformed `qa/issues.jsonl` line 17 (ISS-017, a raw `\s` in a JSON string) is
still the only unparseable line of 36 and I left it byte-intact — it is append-only history, it
predates this unit, and it is already tracked as ISS-020 for a Mode B sweep. Correctly untouched by
the maker.

---

```
VERDICT: PASS
SCOREBOARD: 10/10 verify steps met, 8/8 invariants hold (I1-I8; I9-I10 added this cycle, effective cycle 3)
FAILURES: none
ISSUES-WRITTEN: ISS-034 (medium), ISS-035 (medium), ISS-036 (low) — all NEW findings, none a regression of the fixes under check
ISSUES-CLOSED: ISS-029, ISS-030, ISS-031, ISS-032, ISS-033 → verified
EXPLANATION: All five cycle-1 issues are independently confirmed fixed by execution. The
denominator guard refuses my original attack in both write and --check mode and also catches
rename, extra-id and duplicate-id variants the maker never demonstrated, while correctly leaving a
row reorder harmless. The new test suite is not decorative: I neutered six guards one at a time and
every single mutation turned a test red, which is what ISS-030 actually asked for. The vocabulary
bypass, the probe fingerprint and the derived probe-less count all check out, and the manifest's
LOC figures are correct for the first time this session. No cycle-1 property regressed: determinism,
re-derivability from deletion, the staleness gate proven by breaking lint:structure, the
manual-upgrade refusal, and six verdicts re-confirmed against source and live Mongo. It PASSes.
Thinking adversarially once more, I found two levers I1-I8 do not reach - rewriting POINTS (+8.3
points, all tests green, and the doc then lies about its own scale) and substituting a future-dated
evidence file (+19.3 points, the biggest lever in either cycle). Both are new findings rather than
defects in this cycle's work, both are filed, and I amended the contract with I9/I10 effective
cycle 3 so the next unit is judged on them.
```
