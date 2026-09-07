# Verdict — score-input-trust-complete

**Unit:** qa/manifests/score-input-trust-complete.md
**Contract:** qa/contracts/catalogue-progress-score.md (I12, I13 effective this cycle; I1–I11 no regression)
**Project root:** D:/KnowledgeBase (bound)
**Date:** 2026-09-07
**Cycle checked: 1**
**Checker:** Mode A, fresh context, read-only toward the artifact. Every number below was produced by
this checker's own execution; nothing in the manifest was taken on trust.

---

```
VERDICT: FAIL
SCOREBOARD: 16/16 verify steps executed, 11/13 invariants hold
FAILURES:
- [I13] sev: high · SEVENTH LAYER — the three code scrapers (apps/api/src/routes/*.ts,
  apps/web/src/App.tsx, the package tree) are score-raising inputs with NO trust check, so
  UNCOMMITTED source edits move the headline 20.2% → 30.7% (machine-derived 28.9% → 39.5%,
  +10.5/+10.6 points) with `--check` exit 0, `pnpm lint:structure` exit 0, 23/23 green and no
  banner · fix: derive SCORE_INPUTS from what the scorer actually reads instead of hand-listing
  one path · issue: ISS-047
- [I12] sev: medium · The CLI upgrade/invalid-verdict refusal (I2/I3's "exit ≠ 0" half) has no
  behavioural test: `if (score.upgrades.length > 0)` → `if (false)` leaves 23/23 green ·
  fix: spawn the CLI against a tampered catalogue and assert status 2 · issue: ISS-044
- [I12] sev: medium · The ISS-043 line-ending normalisation shipped THIS cycle is load-bearing but
  unpinned: deleting `lf()` leaves 23/23 green while a CRLF checkout goes STALE again ·
  fix: one spawn test over a CRLF-materialised doc · issue: ISS-045
- [I8/manifest] sev: medium · The suite DOES dirty what it measures when a test throws:
  docs/PROGRESS.md is left carrying the inflated "EDITED SINCE COMMIT" doc and `--check` exit 1,
  because its restore sits OUTSIDE the `finally` (catalogue.test.mjs:253, :264) ·
  fix: move the doc regeneration into the finally · issue: ISS-046
ISSUES-WRITTEN: ISS-044, ISS-045, ISS-046, ISS-047 (new) · ISS-038, ISS-041, ISS-042, ISS-043 → fixed
EXPLANATION: All four issues this unit claimed are independently confirmed fixed, decisively — the
exact one-token mutation that defeated the last cycle now reddens two tests, and the +42.1-point
catalogue lever is closed at the mechanism. But I13 is categorical ("EVERY input that can raise the
score carries the I11 trust check") and the maker asked me to judge its hand-maintained SCORE_INPUTS
list directly. The answer is empirical: that list is already incomplete by three input surfaces
worth +10.5 points today, uncommitted, with every gate green. Six layers held; the seventh does not.
```

---

## 1. What I re-ran (all commands executed by me in D:/KnowledgeBase)

| # | Command | Result |
|---|---|---|
| 1 | `node --test scripts/catalogue.test.mjs` | **23 pass / 0 fail** (manifest claimed 23) |
| 2 | `pnpm test:lint` | **37 pass / 0 fail** (manifest claimed 37) |
| 3 | `pnpm lint:structure` | **exit 0** |
| 4 | `node scripts/catalogue-score.mjs` | `20.2% adjusted / 28.9% machine-derived, 57 features` |
| 5 | `node scripts/catalogue-score.mjs --check` | `OK … (20.2% of 57 features)` exit 0 |
| 6 | non-blank LOC | catalogue-score **158** · lib/catalogue **194** · lib/evidence **115** · catalogue.test **278** — all ≤300 |

Every figure in the manifest's "Suite, lint, LOC, score" block reproduces exactly.

## 2. ISS-041 — the +42.1-point attack, re-run independently ✅ FIXED

I rebuilt the attack from scratch (not the maker's script): repointed the 19 probe-less rows at
`collections: ["claims"]` and nulled all 11 `manual` downgrades in `.goal/catalogue.json`, uncommitted.

```
repointed 19  nulled 11
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 62.3% adjusted / 62.3% machine-derived, 57 features
docs/PROGRESS.md:12 > **EDITED SINCE COMMIT — `.goal/catalogue.json` no longer matches the
                       version in git, so this score is not the one the repository supports**
$ node scripts/catalogue-score.mjs --check
REFUSED: .goal/catalogue.json is not what the repository holds (modified). …
exit=2
$ pnpm lint:structure
REFUSED: .goal/catalogue.json is not what the repository holds (modified). … exit 2
```

Write mode names the file in the banner; `--check` and `lint:structure` both refuse. Restored from
my own pre-attack copy: `.goal/catalogue.json` **byte-identical**, `docs/PROGRESS.md`
**byte-identical** after regeneration, `--check` back to exit 0. **ISS-041 → fixed.**

## 3. ISS-038 — the decisive disproof ✅ FIXED

The exact mutation that previously left 19/19 + 33/33 green:

```
occurrence 3 of 3 of `process.exit(2)` → `process.exit(0)`   (the refusal branch's own exit)
  ✖ `--check` EXITS 2 on untrusted evidence — asserted by running the CLI, not by reading it
  ✖ `--check` EXITS 2 when the CATALOGUE itself is tampered — every score-raising input is trusted
```

**Two tests RED.** The gate is now pinned by behaviour. I mutated it three further ways, all caught:

| mutation | result |
|---|---|
| `untrusted.length > 0` → `untrusted.length < 0` (invert) | RED |
| delete `...score.inputs.filter(i => !i.trusted)` (neuter the block for the catalogue) | RED |
| `SCORE_INPUTS = [".goal/catalogue.json"]` → `[]` | RED |

**ISS-038 → fixed.**

## 4. ISS-042 — staged tamper, my own throwaway repo ✅ FIXED

Built a fresh `git init` repo with one committed `preflight.json`, then drove `trustOf` directly:

```
clean          -> committed
tampered       -> modified
tampered+added -> modified   trustworthy= false
```

`git add` does not launder the tampering. And dropping `HEAD` from the diff call
(`["diff","--quiet","HEAD","--",rel]` → `["diff","--quiet","--",rel]`) **reddens the suite**.
**ISS-042 → fixed.**

## 5. ISS-043 — CRLF materialisation ✅ FIXED

I did not `git checkout --` the doc (the builder has it uncommitted-modified); instead I
materialised the *current* doc with CRLF line endings, which is byte-for-byte what an
`core.autocrlf=true` checkout produces, isolating the line-ending variable from content:

```
CRLF count now 103
$ node scripts/catalogue-score.mjs --check
OK: docs/PROGRESS.md is current (20.2% of 57 features)     exit=0
```

Control (proving the fix is load-bearing, not incidental): replacing line 149's
`const lf = (t) => t.replace(/\r\n/g, "\n")` with `const lf = (t) => t` and repeating gives
`STALE: docs/PROGRESS.md differs from a fresh regeneration` **exit 1**. **ISS-043 → fixed** — but
see ISS-045: that same mutation leaves the whole suite green.

## 6. Mutation-testing the guards, including five the manifest did NOT list

| # | mutation | listed? | caught? |
|---|---|---|---|
| M1 | 3rd `process.exit(2)` → `exit(0)` | yes | ✅ 2 tests RED |
| M2 | invert the `untrusted.length > 0` condition | no | ✅ RED |
| M3 | drop the catalogue from the `untrusted` set | no | ✅ RED |
| M4 | drop `HEAD` from the trust diff | yes | ✅ RED |
| M5 | `SCORE_INPUTS = []` | yes | ✅ RED |
| U1 | remove `assertDenominator(catalogue)` (I4) | no | ✅ RED |
| U2 | `POINTS.STUB: 0 → 0.5` (I9) | no | ✅ RED |
| U3 | `isTrustworthy` accepts `modified` (I11) | no | ✅ RED |
| U4 | neuter the CLI upgrade refusal, `if (false)` (I2/I3) | no | ❌ **0 tests red → ISS-044** |
| U5 | remove the future-date refusal (I10) | no | ✅ RED |
| U6 | remove the `lf()` normalisation (ISS-043) | no | ❌ **0 tests red → ISS-045** |

## 7. Does the suite leave the repo clean?

**On a green run: yes, fully.** After the full suite, `.goal/catalogue.json`,
`qa/evidence/live-2026-09-07-01-58-41/preflight.json` and `docs/PROGRESS.md` are all
**byte-identical** to my pre-run copies, and `git diff` reports no content change to either tracked
tamper target. `whileTampered` restores a `Buffer`, so it does not even convert line endings. The
standing ` M` on `preflight.json` in `git status` is genuine stat-cache noise — `git diff --quiet
HEAD --` on it exits **0** and `trustOf` reports `committed`. (Minor manifest inaccuracy: `git
update-index --refresh` does **not** clear that flag here; I ran it.)

**On a failing run: no.** This is a finding. I forced the write-mode test's assertion to fail
(`/EDITED SINCE COMMIT/` → a never-matching pattern) and measured the aftermath:

```
✖ write mode still produces the doc when evidence is untrusted, but says so
catalogue byte-identical
preflight byte-identical
!!! docs/PROGRESS.md LEFT DIRTY  (differs at line 5)
$ node scripts/catalogue-score.mjs --check
STALE: docs/PROGRESS.md differs from a fresh regeneration.   exit=1
$ grep -c "EDITED SINCE COMMIT" docs/PROGRESS.md → 1
```

The two `finally`-protected files restore correctly — the manifest is right about those. But
`docs/PROGRESS.md` is a **third tracked file the tests write**, and its restoration
(`spawnSync(CLI)` at `catalogue.test.mjs:253` and `:264`) sits **outside** the `finally`. So any red
run leaves the committed generated artifact carrying an inflated score and an "EDITED SINCE COMMIT"
banner on a clean tree, and leaves the gate STALE — which will be read as a second failure while
diagnosing the first. The manifest's claim *"Each tampering is undone in a `finally`, so the suite
cannot leave the repo dirty"* is false for this file. Recoverable with `pnpm progress`, hence
medium, not high. **ISS-046.**

## 8. No regression on I1–I11

| inv | evidence I produced |
|---|---|
| I1 | `rm docs/PROGRESS.md` + regenerate → **byte-identical** to the pre-delete file |
| I2 | Setting C2 `manual.verdict="REAL"` → `REFUSED: … tries to UPGRADE …` **exit 2, and no file write** (doc byte-identical after). Substance separately confirmed: forcing **46** rows to `manual REAL` with the CLI refusal neutered still yields **20.2%** — the upgrade is never applied |
| I3 | covered by the vocabulary test; U-mutation of `assertDenominator` and `POINTS` both red |
| I4 | U1 red; denominator = 57 |
| I5 | probe fingerprint `9acec0d56307` printed; my ISS-041 attack moved it |
| I6 | **verified against source**, not the doc: `GET /search` and `GET /citations/:claimId` are both rows in `apps/api/src/routes/stubs.ts` (501) → C8/C9/C4 STUB ✅; A10 `@lkb/meeting-bot` STUB ✅ |
| I7 | `--check` exit 1 on a stale doc; present in `lint:structure` (confirmed by its exit 2 during the ISS-041 attack) |
| I8 | 23 tests; every guard except U4 and U6 reddens under mutation |
| I9 | doc line 6 now reads `REAL=1, PARTIAL=0.5, STUB=0, MISSING=0` — rendered from `POINTS` (U2 red) |
| I10 | future-date refusal red under U5; evidence content hash `78a2fc2b0743` printed with path + run stamp |
| I11 | `trustOf` is content-vs-HEAD (§4); fingerprint is canonical-content, CRLF-invariant |

**≥3 verdicts re-verified against reality (I checked five):**

| row | doc says | what I found |
|---|---|---|
| C8/C9 Universal Search | STUB | `apps/api/src/routes/stubs.ts:22` — a 501 stub row ✅ |
| C4 Evidence & Provenance Audit | STUB | `apps/api/src/routes/stubs.ts:23` — 501 ✅ |
| A3 Transcript Review UI | MISSING | `find apps/web -ipath "*transcript-review*"` → nothing ✅ |
| B5 Tree index generator | REAL | `apps/api/src/routes/graph.ts:25` real handler + `tree_index: 1` in the evidence ✅ |
| A8 WhatsApp Connector | REAL | `whatsapp/groups` + `whatsapp/ingest` routes and a real page ✅ |

Score unchanged at **20.2% adjusted / 28.9% machine-derived**. No verdict row moved.

## 9. The disclosed limitation the maker asked me to judge — direct answer

> *"`SCORE_INPUTS` is a hand-maintained list of one. If a future input starts feeding the score it
> must be added there or it inherits the ISS-041 hole. No gate catches that omission — the same
> class of gap as an under-specified probe."*

**No. It is not an acceptable answer, and it is not the same class as an under-specified probe.**
Three reasons, the third measured:

1. **A probe requires judgement; the input list does not.** "Is feature C7 built?" is a human call,
   which is why visibility is the right mitigation there. "Which files did this program read?" is a
   fact the program already knows at runtime. A hand-maintained list of a *derivable* set is a
   choice to keep a machine-checkable thing hand-checked.
2. **The failure is silent and one-directional.** An under-specified probe *under*-scores and shows
   as MISSING in a printed list of 19 ids. An omitted input *over*-scores and prints nothing.
3. **It is not a future risk — it is already wrong.** `generate()` reads far more than
   `.goal/catalogue.json` and the evidence file. `scrapeRoutes` reads every
   `apps/api/src/routes/*.ts`; `scrapePages` reads `apps/web/src/App.tsx`; `reachablePackages` walks
   the package tree. None is in `SCORE_INPUTS`. See §10 — that is the seventh layer, and it is worth
   +10.5 points today.

The fix is not "remember to add entries." It is to stop hand-maintaining the list: wrap the reads
`generate()` performs, collect the repo-relative paths actually opened, and assert in a test that
that set is a subset of the trusted set. Then adding an input without trusting it fails a test
instead of quietly inflating a number.

## 10. Is there a seventh layer? — **Yes, and I found it**

The chain so far: verdicts → numerator → denominator → inputs → the trust check on the inputs → the
other input nobody had checked. The seventh is **the inputs nobody counted as inputs.**

`.goal/catalogue.json` and the evidence file are now both content-trusted against HEAD. But three of
the four scoring signals do not come from either — they come from **source code read as text**, with
no trust check of any kind:

- `scrapeRoutes(root)` — regex over `apps/api/src/routes/*.ts` for `.get("/x"` / `.post("/x"`
- `scrapePages(root)` — regex over `apps/web/src/App.tsx` for `path="…"`
- `reachablePackages(root)` — a walk of the package tree

**Probe A (modest, 6 lines of plausible source):** one new untracked file
`apps/api/src/routes/zz-probe.ts` declaring `GET /topics`, `/speakers`, `/decisions`, plus three
`<Route path=…>` lines added to `App.tsx`:

```
20.2% adjusted / 28.9% machine-derived   →   27.2% adjusted / 36% machine-derived
grep -c "EDITED SINCE COMMIT|UNCOMMITTED" docs/PROGRESS.md → 0     (no banner)
--check              → OK, exit 0
pnpm lint:structure  → exit 0
node --test          → 23 pass / 0 fail
```

**Probe B (the ceiling of this lever):** declare every route and page any probe references — 15
routes in one untracked file, 13 `<Route path=…>` lines in `App.tsx`, all uncommitted:

```
20.2% adjusted / 28.9% machine-derived   →   30.7% adjusted / 39.5% machine-derived
+10.5 adjusted points / +10.6 machine-derived points
no banner · --check exit 0 · pnpm lint:structure exit 0 · 23/23 green
```

(The adjusted figure is held down only because the 11 `manual` downgrades still apply — and those
are now gated, which is exactly the point: the gate that works is the reason this lever is visible.)

Why this is genuinely the same pattern and not a different complaint:

- **Same shape.** Trust was applied to one input class and not the next one over — precisely the
  ISS-037 → ISS-041 progression, now at ISS-047.
- **Same invisibility.** No banner, no fingerprint, no refusal. The doc's "derived from" column
  prints `route GET /topics` and looks entirely ordinary; a reviewer reading `docs/PROGRESS.md`
  cannot tell that route does not exist in git.
- **Strictly cheaper than the ceiling the manifest admits to.** The manifest's disclosed ceiling is
  *"committed fabricated inputs still defeat this … the cost is now a genuine commit, to a reviewed
  history."* This attack needs **no commit at all** — an uncommitted working-tree edit, which is the
  same cost as the original ISS-035 attack. That claim is falsified in the same way the previous
  manifest's ceiling claim was.
- **It is a live hazard, not just an attack.** Nobody has to be malicious. A developer with a
  half-built feature branch runs `pnpm progress` and commits a doc claiming 30.7% — the score
  silently measures the working tree instead of the repository, which is the exact confusion between
  "what exists" and "what someone has locally" that this whole unit exists to eliminate.

Bounded honestly: this lever is **+10.5 points**, smaller than ISS-041's +42.1 and ISS-037's +19.3.
It cannot manufacture a majority. But it comfortably manufactures "we're at a third", and it does so
with less effort than any previous layer.

I set out to conclude the chain had terminated and would have said so. It has not.

## 11. Also observed (not failures)

- **I13's "trust state … printed"** — when `.goal/catalogue.json` is `committed` the doc prints
  nothing about it; only the warning path prints. I judge this **met in substance**: `hashProbes`
  covers `f.probes` + `f.manual?.verdict` for all 57 rows (i.e. exactly the fields the ISS-041 attack
  moved) and is printed as the probe fingerprint, and the previous checker's own I13 text says the
  printing is the weak half — *"only a refusal is a gate"* — which is fully implemented and tested.
  Consider printing a `committed` label for symmetry with the evidence row.
- `scripts/catalogue.test.mjs` is at **278/300** as disclosed. ISS-044/045 must extract, not append.
- `catalogue.test.mjs` **is** wired into a gate (`pnpm test:lint`) — checked, since a behaviour test
  nothing runs would be worth nothing.
- ISS-036 and ISS-040 (earlier low-severity findings) remain open and untouched by this unit; neither
  is a regression.

## 12. Restoration

Every attack in this verdict was run against the working tree and reverted from copies I made before
starting (never `git checkout --`, since the builder has uncommitted work in flight). Final state
verified: `.goal/catalogue.json`, `qa/evidence/live-2026-09-07-01-58-41/preflight.json`,
`docs/PROGRESS.md`, `apps/web/src/App.tsx`, `scripts/catalogue-score.mjs`, `scripts/lib/catalogue.mjs`
and `scripts/lib/evidence.mjs` all **byte-identical** to their pre-check state;
`apps/api/src/routes/zz-probe.ts` removed; `git status --porcelain` matches the pre-check listing
exactly; `--check` exit 0 at 20.2%.

## 13. Contract amendment made this cycle (routine / tightening — auto per the criticality gate)

**[I14]** added, effective the next cycle: `SCORE_INPUTS` must be **derived, not hand-maintained**.
Nothing was softened; I12 and I13 are unchanged.

## 14. Recommended next unit (one unit, four small items)

1. Close ISS-047 — instrument the reads `generate()` performs and trust every repo-relative path it
   opens; make `--check` refuse on any untrusted one. That single change also retires the
   `SCORE_INPUTS` limitation of §9.
2. ISS-044 — spawn the CLI against an upgraded catalogue, assert status 2.
3. ISS-045 — spawn `--check` against a CRLF-materialised doc, assert status 0.
4. ISS-046 — move the doc regeneration inside the `finally`.

Extract the spawn helpers into `scripts/lib/` or a second test file first; `catalogue.test.mjs` has
22 lines of budget left.
