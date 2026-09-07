# Verdict — derived-input-trust

**Unit:** qa/manifests/derived-input-trust.md
**Contract:** qa/contracts/catalogue-progress-score.md (judged against **I14**; I1–I13 must not regress)
**Cycle checked: 1**
**Date:** 2026-09-07
**Checker:** /checker Mode A, fresh context, bound to `D:/KnowledgeBase`
**Mode:** Mode A unit check. Two prior dispatches died on network errors without writing a verdict;
this is still Fix cycle 1.

```
VERDICT: FAIL
SCOREBOARD: 13/14 invariants hold (I1–I13 all re-verified; I14 half-met)
FAILURES:
- [I14] sev: medium · The mechanism is real and works, but I14's own test clause — "assert that
  the set of repo-relative paths read during a real generate() is a SUBSET of the trusted set" —
  is not implemented, and a one-token mutation proves the consequence: changing
  `reachablePackages(root, reader.read)` to `reachablePackages(root)` in
  scripts/catalogue-score.mjs:60 survives the ENTIRE gate set (44/44 tests, `pnpm lint:structure`
  exit 0) while silently dropping ~460 of the 472 scraped files from the trust check — with the
  mutation applied, a modified `packages/ai/src/index.ts` gives `--check` exit 0 and no banner.
  That is the ISS-047 hazard reopened, one scraper over, by a plausible refactor.
  · fix: add the subset test ISS-047's own fix_direction prescribed — assert the recorded read set
  ⊆ the trusted set — and/or one behavioural test that tampers a `packages/**`-only file and
  asserts `--check` exit 2. ~10–15 lines. · issue: ISS-048
ISSUES-WRITTEN: ISS-048 (new, medium) · ISS-049 (new, low) · ISS-050 (new, low) ·
  ISS-044 → fixed · ISS-045 → fixed · ISS-046 → fixed · ISS-047 → fixed
EXPLANATION: Everything the manifest claims, I reproduced independently — the ISS-047 attack, the
gitignore blind spot and its fix, all five listed mutations plus the ls-files one, the ISS-046
throw-mid-tamper restore, the ISS-045 CRLF case, I1–I13 with no regression, 44 tests, exit-0
lint:structure and the five LOC figures to the digit. The maker's proportionality proposal is
CORRECT and I endorse stopping — see §Proportionality. This FAIL is deliberately narrow and is not
another hardening layer: it is the missing pin on the layer just shipped, explicitly demanded by
I14 and by ISS-047's own fix_direction, and it is the only reason this is not a PASS. Fix it, do
not hunt for anything else on this instrument, and move to §10 U0.6.
```

---

## What I re-ran (all commands executed by me, in `D:/KnowledgeBase`, nothing pasted)

### 1. ISS-047 — untracked route file + uncommitted App.tsx edits  ✅ confirmed

Created untracked `apps/api/src/routes/smuggled.ts` (POST /gmail/scan, POST /webhooks/register,
GET /citations/:claimId) and added 5 `<Route path=…>` lines to `apps/web/src/App.tsx` (10 → 15
route lines):

```
$ node scripts/catalogue-score.mjs --check
REFUSED: apps/api/src/routes/smuggled.ts is not what the repository holds (untracked). …
REFUSED: apps/web/src/App.tsx is not what the repository holds (modified). …
rc=2                                                     <- both files NAMED

$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 28.9% adjusted / 37.7% machine-derived, 57 features
docs/PROGRESS.md:12  > **UNCOMMITTED — `apps/api/src/routes/smuggled.ts` …**
docs/PROGRESS.md:14  > **EDITED SINCE COMMIT — `apps/web/src/App.tsx` …**
```

Restored byte-identically: `md5 docs/PROGRESS.md 84f0c37124e4a4fd18457f71660e3cc4`,
`md5 App.tsx 9b5fa249dd1f55143c0d5c8abeb7c0f8` — both equal to the pre-attack hashes;
`--check` back to exit 0 at 20.2%.

### 2. The gitignore blind spot  ✅ fix confirmed · ⚠️ the maker's claim audited and partly understated

**Fix verified.** Appended two paths to `.gitignore`, created gitignored
`apps/api/src/routes/ghost.ts` (GET /search, GET /citations/:claimId, POST /webhooks/register,
POST /gmail/scan) and gitignored `apps/web/src/ghostmod.ts` (`import … from "@lkb/meeting-bot"`):

```
$ git status --porcelain --untracked-files=all -- <both ghost paths>   -> 0 lines   (invisible)
$ git status --porcelain -- .gitignore                                 ->  M        (and .gitignore is not itself an input)
$ node scripts/catalogue-score.mjs --check
REFUSED: apps/api/src/routes/ghost.ts is not what the repository holds (untracked).
REFUSED: apps/web/src/ghostmod.ts is not what the repository holds (untracked).
rc=2
```

**Then I attacked the maker's key claim** ("not convertible into points today"), by neutering the
new membership check to reproduce the pre-fix world — `if (!tracked.has(rel))` →
`if (false && !tracked.has(rel))`, proof of application: occurrence count of the neutered form = 1
— and re-running with the same ghost payload:

```
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 20.2% adjusted / 29.8% machine-derived, 57 features
$ grep -c 'UNCOMMITTED|EDITED SINCE'  -> 0 banners
$ node scripts/catalogue-score.mjs --check   -> OK: docs/PROGRESS.md is current (20.2%)  rc=0
```

**Result of the audit — the maker is right on the headline and understated on the second number.**

- **Adjusted headline 20.2%: immovable.** I searched the whole payload space, not just the
  maker's. Every route probe reachable by a new route file is either already live
  (`GET /calendar/upcoming`, `POST /gmail/scan` — A7 is *already* auto REAL) or in the 501 stub
  list (`GET /search`, `GET /citations/:claimId`, `POST /webhooks/register` — stubs.ts:22–24),
  and `evaluate()` checks `stubs` before `live`, so a stub cannot be un-stubbed by declaring it.
  `scrapePages` reads only the tracked `App.tsx`. The one package probe (`@lkb/meeting-bot`, A10)
  is manually capped at STUB. So the maker's conclusion — blind spot, not a live inflation path —
  **holds for the number the project reports as "how much of the product exists".**
- **Machine-derived headline: it does move, +0.9 points (28.9% → 29.8%), silently.** A10's auto
  verdict goes PARTIAL → REAL on the ghost import; the manual STUB caps `adjusted` but not `auto`,
  and `Machine-derived alone: 29.8%.` is printed as a headline line in the generated doc with
  `--check` exit 0 and no banner. The manifest's phrasing ("A10's package-reachability gain is
  manually downgraded anyway") skips that the auto number is still published.
  Filed as **ISS-049 (low, fixed)** for the record, not as a failure: the magnitude is 0.9 points
  against levers of +42.1 / +19.3 / +10.5, and the hole is closed. The maker's *decision* — fix it
  anyway because "not exploitable" is a luck-dependent defence — was correct, and the reasoning it
  used to get there was 90% right.

Everything restored: `.gitignore`, `scripts/lib/evidence.mjs` and `docs/PROGRESS.md` all back to
their pre-test md5s; ghost files deleted; `--check` exit 0.

### 3. A file the scrapers do NOT read must not trip the gate  ✅ confirmed (both directions)

```
untracked new file at repo root (README.md)          -> --check rc=0
modified TRACKED ARCHITECTURE.md (" M ARCHITECTURE.md") -> --check rc=0
```
The gate is selective, not a blanket dirty-tree check.

### 4. A file only `reachablePackages` reads  ✅ confirmed caught

```
modified tracked packages/ai/src/index.ts   -> REFUSED: packages/ai/src/index.ts … (modified)  rc=2
new untracked packages/core/src/checkerprobe.ts -> REFUSED: … (untracked)               rc=2
```
This is the variant the manifest called "the least exercised" — the shipped code handles it. It is
also the exact variant with **no test**, which is finding ISS-048 below.

### 5. Mutation tests — 6 listed + 1 of mine. Each edit PROVEN applied before the result was read.

Suite = `node --test scripts/catalogue.test.mjs scripts/catalogue-cli.test.mjs` (30 tests).

| # | mutation | proof the edit applied | result |
|---|---|---|---|
| M1 | upgrade refusal `if (score.upgrades.length > 0)` → `if (false)` | `if (false)` count 0→1; old pattern count 1→0 | **CAUGHT** 29/30, 1 fail |
| M2 | `lf()` normalisation → identity | `const lf = (t) => t;` count 0→1; `replace(/\r\n/g` count 1→0 | **CAUGHT** 29/30, 1 fail |
| M3 | scraped-source trust check removed (`untrustedAmong(root, scraped)` → `[]`) | `of [])` count 0→1; old call count 1→0 | **CAUGHT** 28/30, 2 fail |
| M4 | the recorder stops recording (`files.add(…)` deleted) | `files.add(` count 1→0; marker count 0→1 | **CAUGHT** 28/30, 2 fail |
| M5 | the gate's own `process.exit(2)` → `exit(0)` in the trust-refusal branch | `exit(2)` 3→2, `exit(0)` 0→1, target line 157 printed | **CAUGHT** 26/30, 4 fail |
| M6 | `ls-files` membership check neutered | neutered form count 0→1 | **CAUGHT** 29/30, 1 fail |
| **M7 (mine)** | `reachablePackages(root, reader.read)` → `reachablePackages(root)` | unrecorded form 0→1, recorded form 1→0 | **SURVIVED — 30/30, and 44/44 on `pnpm test:lint`, `lint:structure` exit 0** |

**The manifest's methodology warning bit me too, and its own way.** My first M4 attempt used
`perl` and reported GREEN at 30/30 — but the occurrence count showed `files.add(` still at 1: the
edit never landed, because `scripts/lib/catalogue.mjs` is CRLF on disk (`git ls-files --eol` →
`w/crlf`) and my pattern was anchored to `$`. A second attempt with a Python literal replace also
failed to match for the same reason. Only a line-index replacement applied it, printing the target
line (`32: '      files.add(relative(root, abs).replace(/\\\\/g, "/"));\r'`) — and then it came
back **RED**. Two GREENs that meant nothing. The manifest is right that a mutation without proof of
application is not evidence; on this repo the trap is line endings, and the occurrence-count
discipline is what caught it both times.

**M7 in detail (the FAIL).** With the mutation applied I then tampered a real file:

```
$ printf '\n// tamper\n' >> packages/ai/src/index.ts
$ git status --porcelain -- packages/ai/src/index.ts   ->  M packages/ai/src/index.ts
$ node scripts/catalogue-score.mjs --check
OK: docs/PROGRESS.md is current (20.2% of 57 features)     rc=0     <- no refusal, no banner
```

`reachablePackages` is the scraper that reads ~460 of the 472 recorded files (the whole
`apps/**` + `packages/**` tree); `scrapeRoutes` and `scrapePages` between them cover ~12. The two
behavioural tests that exist cover `App.tsx` (scrapePages) and a route file (scrapeRoutes) — so
the largest of the three scrapers can be silently un-recorded with every gate green. `grep` for
`reader`, `createRecordingReader`, `scrapedCount`, `subset` or `inputs` across both test files
returns **zero** matches: nothing tests the derived-input mechanism as a mechanism.

I14 asks for exactly this and names it: *"This carries its own test in the I12 sense: assert that
the set of repo-relative paths read during a real `generate()` is a **subset** of the trusted set,
so an input added without trust fails a test rather than quietly inflating a number."*
ISS-047's `fix_direction` says the same thing in the same words. It was not done. Practical
exploit ceiling today is the same +0.9 on the machine-derived number (A10 is the only probe
`reachablePackages` feeds), so this is **medium**, not high — but the point of I14 is not the
current point value, it is that the mechanism cannot silently disappear.

### 6. ISS-046 — a test throwing mid-tamper  ✅ confirmed

Changed the scraped-source test's assertion to `assert.equal(status, 999, "CHECKER-INDUCED THROW
mid-tamper")` (proof: marker count 1) and ran the CLI suite: 10 pass / **1 fail** with the induced
AssertionError raised *inside* `whileTampered`, i.e. while `App.tsx` was corrupted. Afterwards:

```
apps/web/src/App.tsx: OK   docs/PROGRESS.md: OK      (md5 -c against pre-run hashes)
$ node scripts/catalogue-score.mjs --check  -> OK … 20.2%   rc=0
```
The `finally` restores both the tampered input and the generated doc. ISS-046 closed.

### 7. ISS-045 — CRLF materialisation of docs/PROGRESS.md  ✅ confirmed

Rewrote the doc with 103 CRLF pairs (0 → 103, verified by counting), byte-for-byte what a
`core.autocrlf=true` checkout produces (`git config core.autocrlf` = true):
`node scripts/catalogue-score.mjs --check` → **exit 0**. M2 above proves the `lf()` that makes it
work is now pinned. Restored to the LF original (md5 unchanged).

### 8. No regression on I1–I13, verdicts re-verified, score unchanged

| invariant | how I re-verified | result |
|---|---|---|
| I1 | regenerate; delete + regenerate | md5 `84f0c37124e4a4fd18457f71660e3cc4` all three times |
| I2 | live: set B6 `manual.verdict=REAL` | `REFUSED: … tries to UPGRADE …` rc=2, doc byte-unchanged (no write) |
| I3 | live: set B6 `manual.verdict=EXCELLENT` | `… "EXCELLENT" is not one of MISSING/STUB/PARTIAL/REAL` rc=2 |
| I4 | suite test "dropped feature" + "unknown/duplicated id" | green |
| I5 | fingerprint test | green |
| I6 | source: `/search` in stubs.ts (1 hit); `@lkb/meeting-bot` imported by 0 files outside its own package | C8/C9/C4 STUB, A10 STUB — correct |
| I7 | `--check` present in `lint:structure`; staleness test exits 1 | green, `lint:structure` rc=0 |
| I8–I9 | POINTS/scale tests | green; doc renders `REAL=1, PARTIAL=0.5, STUB=0, MISSING=0` from POINTS |
| I10 | live: dropped `qa/evidence/live-2099-01-01-00-00-00/preflight.json` with 4242 counts | `REFUSED: evidence run … is dated in the future` rc=2 |
| I11 | live: rewrote every zero count to 4242 **inside the already-committed** preflight.json | `REFUSED: … (modified)` rc=2; restored, `git diff --quiet HEAD` rc=0 |
| I12 | M1/M2/M5 above (behaviour, not source text) | all RED |
| I13 | suite test "`--check` EXITS 2 when the CATALOGUE is tampered" | green |

**Feature verdicts re-verified independently against reality (7, ≥3 required)** — read from
`preflight.json` and from source, not from the doc: A2 REAL (sessions 26, turns 2118) · B6 MISSING
(chunks 0) · B3/B10 MISSING (speakers 0) · B5 REAL (`router.get("/graph"` present, tree_index 1) ·
C8 STUB (`/search` in the 501 list) · A10 STUB (`@lkb/meeting-bot` imported by nothing outside
itself) · A3 MISSING (`/transcript-review` absent from App.tsx). All match the generated table.

**Score: 20.2% adjusted / 28.9% machine-derived — unchanged. No verdict row moved.**

### 9. Suite, lint, LOC  ✅ every number matches to the digit

```
$ pnpm test:lint        -> tests 44, pass 44, fail 0
$ pnpm lint:structure   -> exit 0  (…snapshot OK; "OK: docs/PROGRESS.md is current (20.2% of 57 features)"; depcruise 239 modules, 0 violations)
non-blank LOC:  catalogue-score 172 · lib/catalogue 213 · lib/evidence 160 ·
                catalogue.test 209 · catalogue-cli.test 168      (claimed 172/213/160/209/168 — exact)
$ git status --porcelain --untracked-files=all  -> byte-identical to session start, before and after the suite
```

---

## Proportionality — the answer, plainly

**Yes. Stop. The maker is right, and I am not going to manufacture a reason to keep going.**

The argument is quantitative, not a mood. The measured value of each successive layer on this
instrument:

| cycle | largest lever found | cost to the attacker |
|---|---|---|
| 2 | +19.3 pts (evidence folder name) | none |
| 3 | +19.3 pts (edit the committed evidence in place) | none |
| 4 | +42.1 pts (catalogue.json untrusted) | none |
| 5 | +10.5 pts (three code scrapers untrusted) | none |
| **6 (this one)** | **+0.9 pts, and only on the SECONDARY number** | none |

That is a decay from 42.1 to 0.9 points, and — this is the part that matters — I could not find
**any** payload that moves the 20.2% adjusted headline without a commit, with the shipped code in
place. I attacked routes, pages, packages, gitignored files, staged files, future-dated evidence,
in-place evidence edits and the catalogue, and every one now lands on a refusal that names the
file. The "attack vs hazard" line the maker proposes is the right line, and it is now the true
boundary of this instrument rather than an aspiration: everything left genuinely requires
committing a fabrication to a reviewed history.

So, adopting the maker's proposal with one bounded exception:

1. **Fix ISS-048 (the M7 pin) in cycle 2 and nothing else.** ~10–15 lines: assert the recorded
   read set ⊆ the trusted set, or tamper a `packages/**`-only file and assert `--check` exit 2.
   This is not layer nine — it is the pin on layer eight, demanded verbatim by I14 and by
   ISS-047's own fix_direction, and without it the entire derived-input mechanism can be deleted
   by a refactor with 44/44 green. Cost: minutes.
2. **Then STOP hardening the scorer.** Next unit: **plan §10 U0.6 — tracker honesty**, then
   `/health` + `/search`, the five db accessors, and the honest LLM eval baseline.
3. **From here, FILE don't FIX**, exactly as proposed: any further inflation path gets a ledger
   issue with its measured point value and stays open — *unless* it is exploitable without a
   commit, which is the only thing that earns an immediate cycle. ISS-036, ISS-040, ISS-049 and
   ISS-050 are already sitting there correctly under that rule.
4. **I am amending nothing in the contract this cycle.** I14 as written already demands the test
   that is missing; adding I15 would be goalpost-moving, and the seven-layer chain of tightenings
   has reached the point where the instrument is ahead of the product it measures.

A note on the meta-question the maker actually asked ("tell me if I'm wrong"): the maker was not
wrong to follow the chain — every layer was real and each was found by an adversary, not invented.
It is right to stop now, and it would have been wrong to stop three cycles ago at +42.1.

## Ledger

- **ISS-044 → fixed** (M1 reddens a test; live upgrade refusal rc=2 with no write)
- **ISS-045 → fixed** (M2 reddens a test; CRLF materialisation keeps `--check` exit 0)
- **ISS-046 → fixed** (induced throw mid-tamper leaves App.tsx and docs/PROGRESS.md byte-clean)
- **ISS-047 → fixed** (attack independently re-executed: both files named, exit 2, banners in
  write mode; the mechanism is derived, not declared). Its second half — the subset test — is
  refiled as ISS-048.
- **ISS-048 (new, medium, open)** — I14's subset test is missing; `reachablePackages(root)`
  survives 44/44 + lint:structure and reopens the ISS-047 hazard for `packages/**`.
- **ISS-049 (new, low, fixed)** — the gitignore blind spot was worth +0.9 pts on the published
  machine-derived headline pre-fix (A10 package reachability), which the manifest's "not
  convertible into points" account did not cover; the adjusted headline was indeed immovable.
- **ISS-050 (new, low, open)** — `git status --porcelain` and `git diff --quiet HEAD` disagree on
  `qa/evidence/live-2026-09-07-01-58-41/preflight.json` in this working tree right now (status
  reports ` M`, diff reports clean, `ls-files --eol` reports `i/lf w/lf`). The two trust
  instruments can therefore differ; the direction is over-refusal, so it fails safe, and it is not
  firing on any scraped path today (`--check` exit 0). Raised as a "cries wolf" hazard of the
  ISS-039/ISS-043 class, not as a defect of this unit.

## Environment

Mongo was never contacted — the scorer is offline by design and reads only files, so no
INCONCLUSIVE applies. Every command above ran to completion; nothing in this verdict rests on a
pasted or remembered result. Working tree returned to exactly its session-start state (verified by
`git status --porcelain --untracked-files=all` and by md5 on every file I touched).
