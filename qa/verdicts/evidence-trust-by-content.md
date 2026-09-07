# Verdict — evidence-trust-by-content

**Date:** 2026-09-07
**Contract:** qa/contracts/catalogue-progress-score.md (judged against **I11**, effective this cycle; I1–I10 for regression)
**Manifest:** qa/manifests/evidence-trust-by-content.md
**Project root:** D:/KnowledgeBase (bound)
**Cycle checked: 1**

```
VERDICT: FAIL
SCOREBOARD: 3/3 claimed issues re-tested, 10/11 invariants hold
FAILURES:
- [I11] sev: medium · The clause "each such gate carries its own regression test" is not met: the
  --check refusal is pinned only by a SOURCE-TEXT assertion, and changing `process.exit(2)` to
  `process.exit(0)` inside that branch leaves 19/19 + 33/33 green while restoring the full
  +19.3-point inflation with `--check` exit 0 and `lint:structure` exit 0 · fix: spawn the CLI
  against THIS repo (no fixture needed) and assert exit code 2 · issue: ISS-038 (stays open)
ISSUES-WRITTEN: ISS-037 → fixed · ISS-039 → fixed · ISS-038 stays open (new evidence) · ISS-041 (high, new) · ISS-042 (medium, new) · ISS-043 (medium, new)
EXPLANATION: ISS-037 and ISS-039 are genuinely and independently closed — I re-ran the in-place
tamper attack and it now prints the EDITED SINCE COMMIT banner and exits 2, and the fingerprint is
provably invariant across CRLF/LF/key-order while moving on a real count change. But the maker's
own disclosed limitation is the defect: the wiring assertion does not pin the gate's behaviour, and
I demonstrated a one-token mutation that reopens the whole ISS-037 lever with every test green —
that is ISS-030 surviving in a thinner form, and it is closeable cheaply. Separately, the sixth
layer exists and is the largest lever found in this chain: `.goal/catalogue.json` is a scorer input
with NO trust check of any kind, and editing it without committing moves the headline
20.2% → 62.3% (+42.1 points) with --check, lint:structure and all tests green.
```

---

## What I re-ran (all commands executed by me in D:/KnowledgeBase; nothing taken from the manifest)

### 1. The ISS-037 attack, re-executed — **PASSES**

Rewrote every zero count to `4242` **inside the already-committed**
`qa/evidence/live-2026-09-07-01-58-41/preflight.json` (no new folder, no commit, same stamp):

```
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 39.5% adjusted / 50% machine-derived, 57 features
# docs/PROGRESS.md line 12 now reads:
Collection counts from `qa/evidence/live-2026-09-07-01-58-41/preflight.json`
(run 2026-09-07T01:58:41.367Z, content `6ee25972dbc8`) — **EDITED SINCE COMMIT —
`qa/evidence/live-2026-09-07-01-58-41/preflight.json` no longer matches the version in git,
so this score is not the one the repository supports**

$ node scripts/catalogue-score.mjs --check
REFUSED: evidence qa/evidence/…/preflight.json is not what the repository holds (modified).
exit=2
$ pnpm lint:structure
REFUSED: … (modified).   ELIFECYCLE  Command failed with exit code 2
```

The banner **names the file**, `--check` exits 2, and `lint:structure` goes red. Restored
byte-identically afterwards (804 bytes, raw sha256 `5f7ed1c0d434`, `git diff --quiet HEAD` exit 0),
`--check` back to `OK: docs/PROGRESS.md is current (20.2% of 57 features)`. **ISS-037 closed.**

### 2. `modified` vs `untracked` vs `unknown` — **PASSES**

| state | how I produced it | banner | `--check` |
|---|---|---|---|
| `modified` | edit the committed file in place | `**EDITED SINCE COMMIT — … no longer matches the version in git…**` | `REFUSED … (modified)` exit 2 |
| `untracked` | new `qa/evidence/live-checker-untracked/preflight.json`, newer internal stamp, counts 4242 | `**UNCOMMITTED — … is not in git, so nobody else can reproduce this score**` | `REFUSED … (untracked)` exit 2 |
| `unknown` | `trustOf()` against a non-git temp dir | `**NOT A GIT CHECKOUT — the provenance … cannot be established**` | `isTrustworthy("unknown") === false` → would refuse |

Three genuinely distinct messages; all three non-`committed` states refused. The `unknown` path
degrades safely (refuse, don't crash, don't trust).

### 3. ISS-039 — fingerprint from parsed content, not bytes — **PASSES**

I forced the real materialisation rather than simulating it (`rm` the evidence file, then
`git checkout --` it, with `core.autocrlf=true` set in `C:/Program Files/Git/etc/gitconfig`):

| working-tree state | CR count | **raw** sha256/12 | **canonical fingerprint** | `git diff --quiet HEAD` | `--check` |
|---|---|---|---|---|---|
| real checkout (CRLF) | 36 | `3a73c60dcc6d` | `78a2fc2b0743` | exit 0 → `committed` | **exit 0** |
| LF | 0 | `5f7ed1c0d434` | `78a2fc2b0743` | exit 0 → `committed` | **exit 0** |
| CRLF + reversed key order + 4-space indent | 36 | (differs) | `78a2fc2b0743` | modified | exit 2 |
| one count changed (`turns` 2118→2119) | — | — | `ebc3ae1f17e5` | modified | exit 2 |

The two raw shas are exactly the `5f7ed1c0d434` / `3a73c60dcc6d` pair ISS-039 was filed on, and the
canonical fingerprint is identical across all of them while still moving on a one-count change.
Contract verify step 14 is satisfied. **ISS-039 closed** (see ISS-043 for the surviving
*pre-existing* half of that class, which ISS-039's own text scoped out).

### 4. Mutation testing — the five claimed, plus five I chose

Each mutation applied to the real source, `node --test scripts/catalogue.test.mjs` run, source restored.

| # | mutation | result |
|---|---|---|
| M1 | content-vs-HEAD check always returns `"committed"` | **RED** (1 fail) |
| M2 | `isTrustworthy` returns `true` for everything | **RED** (2 fail) |
| M3 | future-date refusal disabled (`if (false)`) | **RED** (1 fail) |
| M4 | selection back to lexical folder name | **RED** (1 fail) |
| M5 | fingerprint hashes the stamp only (drops counts) | **RED** (2 fail) |
| M6 | delete the `--check` trust refusal `if` entirely | **RED** (1 fail) |
| M7 | `modified` banner reuses the `UNCOMMITTED` wording | **RED** (1 fail) |
| M8 | `trusted: true` hardcoded in `loadCollectionCounts` | **RED** (1 fail) |
| **M9** | `git diff --quiet HEAD --` → `git diff --quiet --` (index, not HEAD) | **SURVIVES — 19/19 green** |
| **M10** | the refusal branch's `process.exit(2)` → `process.exit(0)` | **SURVIVES — 19/19 green** |

The manifest's 5/5 claim is **true and independently reproduced**. Two of my own five survive, and
both are exploitable, not theoretical:

**M10 (this is the ISS-038 answer).** With one token changed:
```
$ node --test scripts/catalogue.test.mjs      → 19 pass, 0 fail
$ node scripts/catalogue-score.mjs --check    → REFUSED: … (modified).   exit=0
$ pnpm lint:structure                         → exit 0
$ head docs/PROGRESS.md                       → **39.5% of the 57-feature product catalogue.**
```
The refusal *message* still prints to stderr and the gate still passes. The wiring test asserts
`assert.match(cli, /process\.exit\(2\)/)` — which matches the *other two* `process.exit(2)` calls
already in that file (the denominator refusal and the upgrade refusal), so it cannot fail here.

**M9.** Dropping `HEAD` makes trust mean "matches the index". I then staged (not committed) a
doctored `preflight.json`:
```
$ git add -- qa/evidence/live-2026-09-07-01-58-41/preflight.json
$ node scripts/catalogue-score.mjs --check
OK: docs/PROGRESS.md is current (39.5% of 57 features)     exit=0    # and no banner in the doc
$ node --test scripts/catalogue.test.mjs      → 19 pass, 0 fail
```
`git add` alone would restore the whole lever. The suite pins "content-vs-something"; it does not
pin "content-vs-HEAD", which is the entire substance of I11.

### 5. ISS-038 — the direct answer the maker asked for

**A wiring assertion is not adequate here, and this is the ISS-030 failure mode surviving in a
thinner form.** M10 is the proof: the gate can be turned into a no-op with every test green and the
+19.3-point inflation restored through `pnpm lint:structure`.

But I reject the framing that the alternative is expensive. The manifest says a real test "would
need a fixture repo containing `apps/api/src/routes`, `apps/web/src/App.tsx`, `schema/` and a
catalogue". That is the cost of a *synthetic* fixture — and it is not the only option, because
**this repo is already the fixture**. A behavioural test that (a) tampers with the real committed
`preflight.json`, (b) `spawnSync`s `node scripts/catalogue-score.mjs --check`, (c) asserts
`status === 2`, and (d) restores the file in a `finally`, is roughly fifteen lines, needs no
scaffolding, and reddens under both M10 and M6. I performed exactly that sequence by hand four
times during this check; encoding it is strictly cheaper than the fixture repo that was declined.
So the limitation is a **closeable gap**, not an honest ceiling — the same distinction that made
the previous unit's "visible commit with a changed sha" claim an overclaim.

Add the HEAD-vs-index assertion (M9) at the same time: one test with a staged-but-uncommitted file
asserting `trustOf(...) === "modified"`. Both are in ISS-038 and ISS-042.

### 6. Regression on I1–I10 — **all hold**

| inv | what I ran | result |
|---|---|---|
| I1 | `pnpm progress` ×2, then `rm docs/PROGRESS.md` + regenerate | byte-identical ×3 (`cmp` clean) |
| I2 | `.goal/catalogue.json` C5 `manual.verdict = "REAL"` | `REFUSED: … C5: manual "REAL" > auto "MISSING"` exit 2, **md5 of docs/PROGRESS.md unchanged → no write** |
| I3 | C5 `manual.verdict = "EXCELLENT"` | `REFUSED: … "EXCELLENT" is not one of MISSING/STUB/PARTIAL/REAL` exit 2 |
| I4 | deleted feature row `F2` | `REFUSED: catalogue denominator drifted … dropped feature(s): F2` exit 2 |
| I5 | repointed A2's probe to `claims` | fingerprint `9acec0d56307` → `55cb8b4215b3` in the doc |
| I6 | source-read, not doc-read | `GET /search` is a 501 in `apps/api/src/routes/stubs.ts:29`; `@lkb/meeting-bot` has zero importers outside itself; both score **STUB** |
| I7 | appended a line to `docs/PROGRESS.md` | `STALE: … differs from a fresh regeneration` exit 1; wired at `package.json:15` inside `lint:structure` |
| I8 | mutations M1–M8 above + `POINTS`/`assertDenominator` neuters | every one reddens ≥1 test |
| I9 | `POINTS.STUB` 0 → 0.5 | 18 pass / **1 fail**; scale line renders from `POINTS` (`STUB=0`, not a hardcoded string) |
| I10 | planted a `2027-01-01` stamp; and the stamp-vs-folder-name test | `REFUSED: … dated in the future … refusing to score from it` exit 2 in **both** write and `--check`; selection-by-stamp test present and reddens under M4 |

**Verdicts re-verified against reality (4, independently, from source not from the doc):**
- **A8 REAL** — `GET /whatsapp/groups` + `POST /whatsapp/ingest` registered (`apps/api/src/routes/pages.ts:29-30`, tests in `whatsapp.test.ts`), `apps/web/src/pages/WhatsAppPage.tsx` exists. Sound.
- **B5 REAL** — `apps/api/src/routes/graph.ts:25` really registers `GET /graph`; `tree_index` has 1 doc. Route confirmed; the count is thin but the probe is `>0` and that is the *probe's* weakness, which the contract already discloses.
- **C8/C9 STUB** — both derive from `GET /search`, a genuine 501 in `stubs.ts:29`. Correct, and correctly *not* REAL.
- **A10 STUB (auto PARTIAL, lowered)** — `MeetingBotPage.tsx` exists so the page probe passes; the human downgrade is the honest direction. Correct.

### 7. Suite, lint, LOC — **all as claimed**

```
$ node --test scripts/catalogue.test.mjs   → 19 pass, 0 fail
$ pnpm test:lint                           → 33 tests, 33 pass, 0 fail
$ pnpm lint:structure                      → exit 0
countLoc (scripts/lib/walk.mjs, absolute paths):
  scripts/catalogue-score.mjs 130 · scripts/lib/catalogue.mjs 194
  scripts/lib/evidence.mjs    115 · scripts/catalogue.test.mjs  206      (budget 300)
```
All four claimed figures reproduce exactly.

### 8. Score unmoved — **confirmed**

`20.2% adjusted / 28.9% machine-derived`, 57 features. `git diff HEAD -- docs/PROGRESS.md` is
**2 lines**: the scale line (`STUB/MISSING=0` → `STUB=0, MISSING=0`, an I9 rendering change) and the
evidence line (now carries stamp + content hash). **No verdict row changed.** Correct for a
hardening unit.

---

## 9. Is there a sixth layer? **Yes — and it is the biggest one yet.**

The chain so far: verdicts → numerator → denominator → the evidence input → the trust check on that
input. The sixth layer is the *other* input. The scorer now demands content-vs-HEAD proof for
`preflight.json` — **and demands nothing whatsoever for `.goal/catalogue.json`**, the file that
defines all 57 probes and every human downgrade.

Executed, from a clean tree (`git status` showed `.goal/catalogue.json` unmodified beforehand):

```
# repoint the 19 probe-less rows at a populated collection, and null out the manual downgrades
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 62.3% adjusted / 62.3% machine-derived, 57 features
$ node scripts/catalogue-score.mjs --check
OK: docs/PROGRESS.md is current (62.3% of 57 features)        exit=0
$ pnpm lint:structure                                          exit=0
$ node --test scripts/catalogue.test.mjs                        19 pass, 0 fail
```

**20.2% → 62.3%, +42.1 points, no commit, no banner, every gate green.** More than double the
+19.3-point lever this unit was built to close. Split into its two independent halves:

| lever | headline | `--check` |
|---|---|---|
| repoint the 19 probe-less rows at `turns` (2118 docs) | 20.2% → **53.5%** (+33.3) | exit 0 |
| null out the 11 `manual` downgrades | 20.2% → **28.9%** (+8.7) | exit 0 |
| both | 20.2% → **62.3%** (+42.1) | exit 0 |

Two things make this the same defect, not a new one:

1. **Identical shape to ISS-037.** Trust was applied to one input class and not the other. I11 says
   *"Any gate that admits evidence on the grounds that it is committed must compare the evidence's
   content to the committed blob."* `.goal/catalogue.json` has no such gate at all — there is not
   even a path check to upgrade.
2. **I5 is visibility-only by construction, and here visibility does nothing.** The probe fingerprint
   did change (`9acec0d56307` → `6b58726d4979`), but it is printed *into the document the same run
   regenerates*, and nothing compares it to anything. Contrast the evidence file, which now has a
   gate that refuses. The fingerprint is a diff you have to be looking at; the trust check is a
   refusal you cannot miss. Only one of the two inputs got the refusal.

Note the second half also slips past I2 cleanly: **deleting** a `manual` downgrade is not an
*upgrade* relative to the derived verdict, so the upgrade guard has nothing to object to — the row
simply reverts to the machine verdict. The upgrade guard has always been one-directional; nobody
had noticed that removal is the other direction.

Bound on the lever: the machine-derived ceiling with probes repointed is 62.3%, so this cannot
manufacture 100% — but it comfortably manufactures "the product is two-thirds built", which is
precisely the false statement this whole unit exists to make impossible.

**So: the chain has NOT terminated.** Filed as **ISS-041 (high)** and as contract **I13**.

Where I expect it to terminate: once every input that can raise the score is under content-vs-HEAD
trust (evidence *and* catalogue), the remaining move is to commit doctored inputs — which is the
ceiling the manifest correctly identifies, and a real one, because it costs a reviewable commit.
The gates themselves become the last surface, which is why ISS-038/ISS-042 (pinning gate *behaviour*
rather than gate *source text*) matter more than they look.

---

## Ledger

| issue | before | after | why |
|---|---|---|---|
| ISS-037 | open (high) | **fixed** | Attack re-executed; banner + exit 2 + red `lint:structure`; restored byte-identically |
| ISS-038 | open (medium) | **stays open** | Wiring assertion does not pin behaviour — M10 survives with 19/19 green and the lever restored |
| ISS-039 | open (medium) | **fixed** | Canonical fingerprint identical across a real CRLF checkout and LF; moves on a real change |
| ISS-041 | — | **new, high** | Sixth layer: `.goal/catalogue.json` has no trust check; +42.1 points, all gates green |
| ISS-042 | — | **new, medium** | Trust is not pinned to HEAD: `git diff --quiet --` (index) survives all tests; `git add` would restore the lever |
| ISS-043 | — | **new, medium** | `docs/PROGRESS.md`'s own CRLF materialisation still sends `--check` STALE (exit 1) on an untouched clone — the pre-existing half ISS-039 scoped out |

## Contract

Amended in the same pass (routine / tightening → auto per the criticality gate): **I12** (gate
behaviour must be pinned by a spawned run and to HEAD specifically) and **I13** (every score-raising
input carries the I11 trust check), effective from cycle 2 / the next unit touching this scorer.
Nothing weakened; I11 is unchanged.

## Environment

Mongo was not required — the scorer is offline by design and reads `qa/evidence/*/preflight.json`.
No INCONCLUSIVE items. Working tree left exactly as found (`preflight.json` restored to 804 bytes /
LF / raw sha `5f7ed1c0d434`; `docs/PROGRESS.md` `cmp`-identical to its pre-check state; the builder's
in-flight modifications untouched).
