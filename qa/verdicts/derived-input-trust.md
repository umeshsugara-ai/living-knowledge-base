# Verdict — derived-input-trust

**Unit:** qa/manifests/derived-input-trust.md
**Contract:** qa/contracts/catalogue-progress-score.md (judged against **I14**; I1–I13 must not regress)
**Cycle checked: 2**
**Date:** 2026-09-07
**Checker:** /checker Mode A, fresh context, bound to `D:/KnowledgeBase`
**Mode:** Mode A unit check. Supersedes the cycle-1 FAIL verdict (commit `ce15a02`) at this path.

```
VERDICT: PASS
SCOREBOARD: 14/14 invariants hold (I1–I13 re-verified with no regression; I14 now fully met,
            test clause included)
FAILURES: none
ISSUES-WRITTEN: ISS-051 (new, low, open) · ISS-052 (new, low, open) ·
  ISS-048 → verified (fixed and independently confirmed) · ISS-050 re-checked, stays open
EXPLANATION: The single cycle-1 FAIL is genuinely closed. My exact M7 mutation —
`reachablePackages(root, reader.read)` → `reachablePackages(root)` — is now RED with a message
that names the territory it dropped, where last cycle it survived 44/44 plus lint:structure. The
maker's two "these mutations survive and that is CORRECT" claims are true, and I proved them
behaviourally rather than accepting the argument: with the recorder dropped from scrapeRoutes and
from scrapePages in turn, a modified route file, a modified App.tsx and an untracked route file are
each still REFUSED at exit 2, because reachablePackages independently re-reads all of them. The
corrected 228 / 22-43-21-142 breakdown is exact. Residual: the shipped test is a territory+floor
PROXY for I14's literal subset clause, and two deliberate partial mutations of the scorer's own
source slip past it — filed as ISS-051 (low) under the FILE-don't-FIX rule, because both require
editing the instrument itself and neither moves the adjusted headline at all. Stopping here is
still the right call and I am restating that recommendation unchanged.
```

---

## What I re-ran (every command executed by me in `D:/KnowledgeBase`; nothing pasted)

Baseline: `pnpm test:lint` 45/45, `pnpm lint:structure` exit 0, `--check` exit 0 at 20.2%,
`docs/PROGRESS.md` md5 `84f0c37124e4a4fd18457f71660e3cc4`.

### 1. ISS-048 — the decisive test  ✅ FIXED

My cycle-1 mutation, re-applied with proof of application (occurrence counts, not `git diff`, since
`scripts/lib/evidence.mjs` is untracked and `catalogue-score.mjs` is uncommitted-modified):

```
recorded form `reachablePackages(root, reader.read)`  1 -> 0
mutated  form `reachablePackages(root)`               0 -> 1

$ node --test scripts/catalogue.test.mjs scripts/catalogue-cli.test.mjs
  tests 31 · pass 30 · fail 1
✖ EVERY scraper reads through the recorder — dropping one from generate() must fail
  AssertionError: package scraper (packages/) did not read through the recorder — its files are untrusted
```

**RED, and the failure message names the exact territory that was dropped.** Last cycle this same
edit was green at 44/44 + `lint:structure` exit 0. Restored; md5 of `scripts/catalogue-score.mjs`
back to `4883b2a102409e094f1e7ca59bc86451`.

### 2. Trying to defeat the new test another way  ⚠️ two survivors, both filed as ISS-051

The dispatch asked whether trust coverage for `packages/` can be dropped while the test stays green.
It can — but only by editing the scorer's own source in ways no refactor produces.

| # | mutation | proof applied | suite | exploit |
|---|---|---|---|---|
| **M8** | keep `scrapedFiles` complete, filter `packages/` out of the TRUST call only: `untrustedAmong(root, scraped)` → `untrustedAmong(root, scraped.filter((f) => !f.startsWith("packages/")))` | target 1→0, filter form 0→1 | **31/31 GREEN** | modified tracked `packages/ai/src/index.ts` → `--check` **exit 0**, no refusal, no banner; `lint:structure` exit 0 |
| **M11** | `reachablePackages` scans only apps/api: `for (const app of ["api", "web"])` → `["api"]` | target 1→0, mutated 0→1 | **31/31 GREEN** (recorded set falls 228 → 186, still above the 150 floor; the `apps/web/src/App.tsx` territory is still satisfied by `scrapePages`) | untracked `apps/web/src/ghostmod.ts` importing `@lkb/meeting-bot` goes untrusted-but-unreported, `--check` exit 0 — **but the score does not move at all: 20.2% / 28.9%, both unchanged** |

**Why this is ISS-051 (low) and not a FAIL.** The cycle-1 FAIL was a *plausible unintentional
refactor* (dropping an argument) that silently deleted the mechanism; that is now caught. M8 and M11
are deliberate edits to the scorer's own source, which no self-check can reach — the instrument can
always be rewritten to lie, and neither the contract nor the unit ever claimed otherwise. Both
require a commit to affect anyone else, which is precisely the "hazard, not attack" line this
project adopted last cycle. Measured payload: **0 points on the adjusted headline**, and M11 moved
the machine-derived number not at all. The honest statement is that the shipped test is a
territory+floor **proxy** for I14's literal "read set ⊆ trusted set" clause; the proxy catches the
realistic failure mode and misses partial-coverage sabotage.

### 3. The two mutations the manifest says SURVIVE and should  ✅ the reasoning holds — verified behaviourally

I did not accept the argument; I applied each mutation and then attacked.

```
M9  scrapeRoutes(root, reader.read) -> scrapeRoutes(root)      target 1->0, mutated 0->1
    recorded set still 228 (22 route files intact — reachablePackages re-reads them)
    $ printf '\n// checker tamper M9\n' >> apps/api/src/routes/ask.ts
    $ node scripts/catalogue-score.mjs --check
      REFUSED: apps/api/src/routes/ask.ts is not what the repository holds (modified).   rc=2

M10 scrapePages(root, reader.read)  -> scrapePages(root)       target 1->0, mutated 0->1
    $ modified apps/web/src/App.tsx (10 -> 11 <Route path=> lines)
      REFUSED: apps/web/src/App.tsx is not what the repository holds (modified).         rc=2
    $ untracked apps/api/src/routes/smuggled.ts (GET /topics, GET /speakers)
      REFUSED: apps/api/src/routes/smuggled.ts is not what the repository holds (untracked). rc=2
```

**I could NOT make a route file or App.tsx untrusted-but-unreported through either mutation.** The
maker's stated reason is the true one, and I confirmed the mechanism rather than the conclusion:
`reachablePackages` scans `apps/api`, `apps/web` and `packages/*` (`scripts/lib/catalogue.mjs:143–147`),
so it re-reads every file the other two scrapers touch. Only `packages/` is exclusive territory —
which is exactly why M7 was the mutation that mattered and why these two are correctly green. The
maker checked rather than assuming in either direction, and was right.

### 4. The corrected numbers  ✅ 228 confirmed exactly, breakdown to the digit

Read from `generate(REPO).score.scrapedFiles` directly, not from the manifest:

```
TOTAL = 228          (duplicates: 0; unclassified: 0)
  routes  apps/api/src/routes/   22
          apps/web/              43
  other   apps/api/              21
          packages/             142
                          22+43+21+142 = 228 ✓
```

The manifest's corrected figure and every component of its breakdown are exact, and the old "472"
was indeed wrong. The measurement is recorded in the test's own comment, which is the right place.

**Is the `>150` floor set sensibly, and would it catch a scraper going silent?** Partly, and the
manifest slightly over-claims what the floor does:

- `reachablePackages` going silent entirely: 228 → 22. Caught twice over (floor **and** the
  `packages/` territory assertion). This is the failure mode that mattered — confirmed in §1.
- The recorder going dead altogether (M4): caught.
- `scrapeRoutes` or `scrapePages` going silent: count stays 228, no assertion fires — and that is
  **correct**, per §3: nothing becomes untrusted.
- **Partial** degradation of `reachablePackages` (M11): 186 survives the floor, and every territory
  still has a representative. So the floor's 34% headroom is generous for total collapse and blind
  to partial collapse.

Net: the floor is set from a real measurement with sensible headroom for the thing it is aimed at,
and it does catch a scraper going silent. It does not catch a scraper going *quiet*. That is the
ISS-051 residual, not a defect in the threshold choice.

### 5. Mutation set M1–M6 — no regression, all six still CAUGHT

Each edit proven applied by occurrence count before the result was read. (M5's target is LF on disk,
not CRLF — `git ls-files --eol` reports `w/lf` for `catalogue-score.mjs` and `w/crlf` for
`lib/catalogue.mjs`; my first M5 attempt reported "target not found" and I fixed the pattern rather
than recording a survivor. The manifest's methodology warning is correct and bit me again.)

| # | mutation | ISS | result |
|---|---|---|---|
| M1 | `if (score.upgrades.length > 0)` → `if (false)` | ISS-044 | **CAUGHT** 30/31 — *`--check` EXITS 2 on a manual UPGRADE* |
| M2 | `lf()` → identity | ISS-045 | **CAUGHT** 30/31 — *tolerates CRLF in the committed doc* |
| M3 | `untrustedAmong(root, scraped)` → `[]` | ISS-047 | **CAUGHT** 29/31 — scraped-source + gitignored |
| M4 | recorder stops recording (`files.add(…)` removed) | ISS-047 | **CAUGHT** 28/31 — incl. the new I14 test |
| M5 | trust-refusal `process.exit(2)` → `exit(0)` | ISS-038 | **CAUGHT** 27/31 — all four trust refusals |
| M6 | `ls-files` membership check neutered | gitignore | **CAUGHT** 30/31 — *GITIGNORED scraped file* |
| **M7** | `reachablePackages(root, reader.read)` → `(root)` | **ISS-048** | **CAUGHT 30/31 — was GREEN last cycle** |

### 6. Cycle-1 wins re-verified live

**ISS-047 attack**, rebuilt from scratch (untracked `apps/api/src/routes/smuggled.ts` with
`GET /topics` + `GET /citations/:claimId`, plus 2 added `<Route path=…>` lines in `App.tsx`):

```
$ node scripts/catalogue-score.mjs --check
  REFUSED: apps/api/src/routes/smuggled.ts is not what the repository holds (untracked).
  REFUSED: apps/web/src/App.tsx is not what the repository holds (modified).          rc=2
$ node scripts/catalogue-score.mjs
  wrote docs/PROGRESS.md — 24.6% adjusted / 33.3% machine-derived     # the lever, still refused
  banners in the doc: 2
```
Restored: `md5sum -c` OK on both `docs/PROGRESS.md` and `apps/web/src/App.tsx`.

**Gitignore blind spot:** `.gitignore` + gitignored `apps/api/src/routes/ghost.ts` (`GET /search`,
`GET /topics`) → `git status --porcelain --untracked-files=all` prints **0 lines** for it, and
`--check` → `REFUSED: apps/api/src/routes/ghost.ts … (untracked)` rc=2. Fix holds.

**ISS-046** — induced a throw *mid-tamper* (the scraped-source test's `assert.equal(status, 2, …)`
→ `assert.equal(status, 999, "CHECKER-INDUCED THROW mid-tamper")`, marker count 1). Suite went
11 pass / 1 fail with the AssertionError raised inside `whileTampered`; afterwards `md5sum -c`
reported **App.tsx: OK** and **PROGRESS.md: OK**, `--check` exit 0. The `finally` restores both.

**ISS-045** — rewrote `docs/PROGRESS.md` with 103 CRLF pairs (counted 0 → 103), byte-for-byte what
`core.autocrlf=true` produces: `--check` → **exit 0**. Restored, md5 unchanged.

**ISS-044** — live: `B6 manual.verdict="REAL"` → `REFUSED: … tries to UPGRADE a derived verdict:
B6: manual "REAL" > auto "MISSING"` rc=2 **with the doc byte-unchanged** (no write).

### 7. No regression on I1–I13

| inv | how I re-verified (live, not from the suite) | result |
|---|---|---|
| I1 | regenerate ×2, then delete + regenerate | md5 `84f0c37124e4a4fd18457f71660e3cc4` all three times |
| I2 | live `B6 manual.verdict=REAL` | rc=2, **no file write** (doc md5 unchanged) |
| I3 | live `B6 manual.verdict=EXCELLENT` | `… is not one of MISSING/STUB/PARTIAL/REAL` rc=2 |
| I4 | live `features.pop()` | `denominator drifted … dropped feature(s): F2` rc=2 |
| I5 | fingerprint printed in the doc | `Probe fingerprint \`9acec0d56307\`` present |
| I6 | source: `/search` at `apps/api/src/routes/stubs.ts:22`; `@lkb/meeting-bot` imported by **0** files outside its own package | C8 STUB, A10 STUB — correct |
| I7 | `catalogue-score.mjs --check` present in `package.json:15` `lint:structure` | wired; `lint:structure` rc=0 |
| I8/I9 | doc renders the scale from `POINTS` | `Scoring: REAL=1, PARTIAL=0.5, STUB=0, MISSING=0.` |
| I10 | live: dropped `qa/evidence/live-2099-01-01-00-00-00/preflight.json` with 4242 counts | `REFUSED: evidence run … is dated in the future` rc=2 |
| I11 | live: rewrote every zero count to 4242 **inside the already-committed** preflight.json | `REFUSED: … (modified)` rc=2 |
| I12 | M1/M2/M5 above — behaviour, not source text | all RED |
| I13 | live: repointed all probe-less rows + nulled every `manual` (the +42.1 lever) | write mode shows **62.3%**; `--check` → `REFUSED: .goal/catalogue.json is not what the repository holds (modified)` rc=2 |

**Feature verdicts re-verified against reality (6, ≥3 required)** — read from `preflight.json` and
from source, never from the generated table:

| id | doc says | reality I read |
|---|---|---|
| A2 | REAL | `sessions = 26`, `turns = 2118` |
| A3 | MISSING | `grep -c transcript-review apps/web/src/App.tsx` = **0** |
| A10 | STUB *(auto PARTIAL, lowered)* | `@lkb/meeting-bot` imported by 0 files outside `packages/meeting-bot` |
| B5 | REAL | `apps/api/src/routes/graph.ts:25 router.get("/graph"…)`; `tree_index = 1` |
| B6 | MISSING | `chunks = 0` |
| C8 | STUB | `apps/api/src/routes/stubs.ts:22` `{ path: "/search", … }` (501 list) |

All six match. **Score 20.2% adjusted / 28.9% machine-derived — unchanged. No verdict row moved.**

### 8. Suite, lint, LOC, cleanliness  ⚠️ two LOC figures in the manifest are stale

```
$ pnpm test:lint        -> tests 45 · pass 45 · fail 0
$ pnpm lint:structure   -> exit 0
$ git status --porcelain --untracked-files=all  -> byte-identical to session start, after everything
$ md5sum docs/PROGRESS.md -> 84f0c37124e4a4fd18457f71660e3cc4  (unchanged)
```

LOC measured with the **project's own** `countLoc` (`scripts/lib/walk.mjs:68-70`), not my own count:

| file | manifest claims | measured | budget |
|---|---|---|---|
| scripts/catalogue-score.mjs | 172 | **173** | 300 ✓ |
| scripts/lib/catalogue.mjs | 213 | 213 ✓ | 300 ✓ |
| scripts/lib/evidence.mjs | 160 | 160 ✓ | 300 ✓ |
| scripts/catalogue.test.mjs | 209 | 209 ✓ | 300 ✓ |
| scripts/catalogue-cli.test.mjs | 168 | **194** | 300 ✓ |

Both discrepancies are in the direction of "the block was pasted from a run made **before** the
ISS-048 fix was added" — the new test is ~26 lines (168 + 26 = 194) and `s.scrapedFiles` is the +1
in the scorer. The manifest's `How to verify` §7 likewise still says "44" where its own evidence
block correctly says 45. **Nothing material is wrong** — all five files are far under the 300 budget
and the acceptance criterion holds — but this is the **fifth** hand-carried number mis-stated on
this instrument, after the `jobs` constant, the earlier LOC figures, "13 probe-less features" and
"472". Filed as ISS-052 (low). Not a FAIL: I produced every number in this verdict myself, so no
criterion rests on the manifest's paste.

### 9. ISS-050 — asked directly: can it fire today?  ✅ NO, and structurally not just incidentally

I checked **all 228 scraped paths**, comparing what `git status --porcelain --untracked-files=all`
says against what `git diff --quiet HEAD --` says, path by path:

```
scraped files: 228
DISAGREEMENTS:  0
evidence file (qa/evidence/live-2026-09-07-01-58-41/preflight.json):
  status entry " M"  |  diff HEAD: clean          <- the ISS-050 condition, still present
```

The stronger answer the maker's reservation deserves: the two instruments **cover disjoint path
sets by construction**. `trustOf()` (diff-vs-HEAD) judges the evidence file and
`.goal/catalogue.json`; `untrustedAmong()` (status porcelain) judges the 228 scraped paths; the
scraped set contains nothing outside `apps/` and `packages/` (unclassified = 0). So the two can
never answer differently *about the same file* today, and the one path where the disagreement is
live is judged by only one of them. The maker's reservation — that if it ever fires on a scraped
file it becomes an ISS-043-class false refusal on a fresh clone — is correct as a future condition
and wrong as a present one. **ISS-050 stays open, low, FILE-don't-FIX, unchanged.**

---

## Proportionality — restated plainly, as asked

**Stop. My cycle-1 recommendation stands unchanged, and this cycle strengthens it.**

The measured decay of the largest lever per cycle:

| cycle | largest lever found | cost to the attacker |
|---|---|---|
| 2 | +19.3 pts (evidence folder name) | none |
| 3 | +19.3 pts (edit the committed evidence in place) | none |
| 4 | +42.1 pts (catalogue.json untrusted) | none |
| 5 | +10.5 pts (three code scrapers untrusted) | none |
| 6 | +0.9 pts, secondary number only | none |
| **7 (this one)** | **0.0 pts** — nothing without editing the scorer's own source | **a commit** |

I attacked routes, pages, packages, gitignored files, the catalogue, future-dated evidence and
in-place evidence edits, plus three fresh mutations of my own, and **found no payload that moves
either published number without a commit**. That is the first cycle where the answer is zero. The
boundary the maker proposed is now the instrument's real boundary, not an aspiration.

**Recommendation, for the maker to act on:**

1. **ISS-048 is closed. Do not open a new hardening thread on this instrument.** ISS-051 is
   deliberately filed-not-fixed: it is only reachable by editing the scorer's own source, which no
   self-check can defend against and which requires a commit to a reviewed history. Fixing it would
   be layer nine on a measurement tool for a product that is 20.2% built.
2. **Next: plan §10 U0.6 — tracker honesty.** Then `/health` + `/search`, the five db accessors,
   and the honest LLM eval baseline.
3. **FILE don't FIX holds.** Any further inflation path gets a ledger issue with its measured point
   value and stays open — *unless* it is exploitable without a commit. ISS-036, ISS-040, ISS-050,
   ISS-051 and ISS-052 all sit correctly under that rule.
4. **No contract amendment this cycle.** I14 as written is now met; ISS-051 is a known, bounded,
   recorded residual, not a new invariant. Adding I15 for it would be goalpost-moving and would
   restart exactly the chain this verdict is closing.

One process note for the maker, offered not charged: the LOC block in §8 shows the evidence section
was assembled before the final edit landed. Regenerating the numbers as the last action before
flipping Status is a cheap habit that would have caught four of the five mis-statements this
instrument has now accumulated.

## Ledger

- **ISS-048 → verified** — the M7 mutation is RED with a territory-naming message; the mechanism is
  pinned. Independently confirmed, not accepted from the manifest.
- **ISS-044 / ISS-045 / ISS-046 / ISS-047 / ISS-049** — re-verified this cycle, no regression.
- **ISS-050 → stays open (low)** — cannot fire today; proven across all 228 scraped paths and
  structurally by the disjoint coverage of the two trust instruments.
- **ISS-051 (new, low, open)** — the shipped I14 test is a territory+floor proxy for the literal
  subset clause; M8 and M11 survive it while creating untrusted-but-unreported regions. Payload 0
  on the adjusted headline; both require editing the scorer's own source. FILE-don't-FIX.
- **ISS-052 (new, low, open)** — the manifest's LOC evidence block is stale (claims 172 / 168;
  measured 173 / 194 by the project's own `countLoc`), and §7 still says 44 tests where the run is
  45. No gate affected; recorded because it is the fifth mis-stated hand-carried number here.

## Environment

Mongo was never contacted — the scorer is offline by construction and reads only files, so no
INCONCLUSIVE applies. Every command in this verdict ran to completion in this session; nothing
rests on a pasted or remembered result. Working tree returned to exactly its session-start state,
verified by `git status --porcelain --untracked-files=all` and by md5 on every file I touched
(`docs/PROGRESS.md`, `apps/web/src/App.tsx`, `.goal/catalogue.json`, `.gitignore`,
`scripts/catalogue-score.mjs`, `scripts/lib/catalogue.mjs`, `scripts/lib/evidence.mjs`,
`scripts/catalogue-cli.test.mjs`, the evidence `preflight.json`).
