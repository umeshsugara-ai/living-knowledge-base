# Verdict — catalogue-input-integrity

**Contract:** qa/contracts/catalogue-progress-score.md (judged against **I9** and **I10**, effective
this cycle; I1–I8 checked for regression)
**Manifest:** qa/manifests/catalogue-input-integrity.md
**Cycle checked: 1**
**Date:** 2026-09-07
**Checker:** fresh subagent, Mode A, bound to `D:/KnowledgeBase`
**Mode:** independent re-execution — every number below was produced by this checker, not read from
the manifest.

```
VERDICT: PASS
SCOREBOARD: 2/2 invariants in scope met (I9, I10); 8/8 prior invariants hold (I1–I8, no regression)
FAILURES: none blocking
ISSUES-WRITTEN: ISS-037 (high), ISS-038 (medium), ISS-039 (medium), ISS-040 (low)
ISSUES-CLOSED: ISS-034 → fixed, ISS-035 → fixed (both independently re-executed)
EXPLANATION: ISS-034 and ISS-035 are genuinely closed at the mechanism level, not papered over —
I re-ran the original attacks and both are now refused, and mutation-testing shows two of the
three new guards are test-backed. The manifest's disclosures were accurate and unusually honest
about what it did NOT fix. But its stated ceiling is wrong: tampering with the already-committed
evidence file in place restores the full +19.3-point lever with every gate green (ISS-037), because
the new "committed" check is a path query, not a content query. That is the fifth layer, and it is
a new lever I10 does not reach rather than a failure of I10 as written — so it is filed, and I11
is added, rather than blocking this unit.
```

## What I re-ran (all commands executed by me, in this root)

| # | Check | Result |
|---|---|---|
| 0 | `pnpm test:lint` | **29 pass, 0 fail** — matches the claim |
| 0 | `node --test scripts/catalogue.test.mjs` | **15 pass, 0 fail** — matches the claim |
| 0 | `pnpm lint:structure` | **exit 0**, all stages OK |
| 0 | `countLoc` via `scripts/lib/walk.mjs` | catalogue-score **129** · lib/catalogue **248** · catalogue.test **146** — all ≤300; the claimed 248 confirmed |
| 0 | Score | **20.2% adjusted / 28.9% machine-derived**, 57 features — unchanged |

### 1. ISS-035, the original attack — REFUSED ✅
Planted `qa/evidence/live-2026-12-31-23-59-59/preflight.json`, every count `4242`, stamp
`2026-12-31T23:59:59.000Z`:

```
write mode : REFUSED: evidence run "qa/evidence/live-2026-12-31-23-59-59" is dated in the
             future (2026-12-31T23:59:59.000Z) — refusing to score from it      exit=2
--check    : (same refusal)                                                     exit=2
```
`docs/PROGRESS.md` sha256 unchanged (`1C028F7E…`) — **no write on refusal**. Restored
byte-identically.

*Method note:* my first attempt appeared to be ignored (exit 0, score unmoved). Cause was my own
fixture — PowerShell 5.1 `Out-File -Encoding utf8` emits a BOM, and the scorer silently swallows an
unparseable candidate. Re-run BOM-free, the guard fired correctly. The silent swallow is filed
separately as ISS-040 (low — it fails safe).

### 2. The plausibly-dated variant — honest disclosure CONFIRMED ✅
Uncommitted folder, stamp 6 minutes in the past, counts `4242`:

```
write mode : wrote docs/PROGRESS.md — 39.5% adjusted / 50% machine-derived     exit=0
             …with, in the doc:
             Collection counts from `qa/evidence/live-2026-09-07-03-15-00/preflight.json`
             (run 2026-09-07T03:15:00.000Z, sha `c6d787c2a59b`,
              **UNCOMMITTED — this evidence is not in git, so nobody else can reproduce this score**)
--check    : REFUSED: scored from UNCOMMITTED evidence …                       exit=2
```
Exactly as the manifest describes. **The maker is not overclaiming** — it states plainly that this
is not prevented, and that is the behaviour I measured.

**Judging the honesty of that disclosure (asked explicitly):** the disclosure is honest in kind but
wrong in degree. Its claim is *"what it now costs is a visible commit with a changed sha, which is
the honest ceiling."* That is false, and there **was** a defense it should have implemented — see §5.

### 3. Selection by content, not name — CONFIRMED ✅
Two folders, lexically-last holding the **older** stamp:

| folder | internal stamp | counts |
|---|---|---|
| `live-2026-09-07-05-00-00` | 02:30 (**newer**) | 1111 |
| `live-2026-09-07-06-00-00` (lexically last) | 02:00 (older) | 4242 |

The doc named `live-2026-09-07-05-00-00` — the newer-stamped run won. ISS-035's root cause is fixed
at the mechanism, not patched at the symptom.

### 4. ISS-034 — CONFIRMED ✅
Rewrote `POINTS` → `{MISSING:0, STUB:0.5, PARTIAL:0.75, REAL:1}`:
- `node --test` → **14 pass / 1 FAIL**: *"the scoring scale is pinned — changing POINTS must break a test"*
- regenerated doc → `Scoring: REAL=1, PARTIAL=0.75, STUB=0.5, MISSING=0` — the scale line **tracked
  the change**. The doc can no longer misstate its own arithmetic.

Restored; `POINTS` byte-identical, baseline sha reproduced.

### 5. Mutation-testing the three new guards — 2 of 3 covered ⚠️

| guard neutered | result |
|---|---|
| future-date refusal (`if (false && chosen.at > now…)`) | **RED** — *"future-dated evidence is refused outright"* ✅ |
| stamp-based selection (sort reverted to lexical) | **RED** — *"evidence is chosen by the timestamp INSIDE the file"* ✅ |
| `--check` uncommitted-evidence refusal | **all 29 GREEN** ❌ → **ISS-038** |

Behaviour change for the third confirmed separately: with it neutered, `--check` returns
`OK: docs/PROGRESS.md is current (39.5% …)` exit 0 on fabricated untracked evidence, where the live
guard gives exit 2. So it is a real guard — with no test. This is the ISS-030 failure mode exactly,
and it lands on the one guard the manifest calls the place *"where trust is placed."*

All three mutations reverted; verified no `MUTATION` / `if (false` markers remain.

### 6. No regression on I1–I8 ✅
Re-executed against the live CLI, not asserted:

| inv | check | result |
|---|---|---|
| I1 | deleted `docs/PROGRESS.md`, regenerated | byte-identical (sha256 `1C028F7E…`); also reproduced 5× across the session |
| I2 | `C5.manual.verdict = "REAL"` | `REFUSED: … tries to UPGRADE …  C5: manual "REAL" > auto "MISSING"` exit 2 |
| I3 | `C5.manual.verdict = "EXCELLENT"` | `REFUSED: … manual verdict "EXCELLENT" is not one of MISSING/STUB/PARTIAL/REAL` exit 2 |
| I4 | deleted feature `C5` | `REFUSED: catalogue denominator drifted from plan §4c … dropped feature(s): C5` exit 2 |
| I5 | fingerprint present + test | `9acec0d56307` printed; probe-edit test green |
| I6 | verdicts vs source | see below |
| I7 | staleness gate | `--check` exit 1 on a stale doc; confirmed wired into `lint:structure` (observed in its output) |
| I8 | guard tests | present and passing for I2–I6 (gap for the new gate → ISS-038) |

`.goal/catalogue.json` restored byte-exact after every attack (verified by buffer comparison).

**Four verdicts independently confirmed against reality** (not against the number):
- **C8 / C9 STUB** — `GET /search` really is in `STUB_ROUTES` (`apps/api/src/routes/stubs.ts:22`) and
  that file really answers `res.status(501)` (line 29). Correct.
- **A10 STUB** — `grep -r "@lkb/meeting-bot"` outside `packages/meeting-bot/` returns **nothing**.
  Genuinely dead code. Correct.
- **A8 REAL** — `whatsapp.ts:48` `router.get("/whatsapp/groups"…)`, `:53`
  `router.post("/whatsapp/ingest"…)`, and `App.tsx:32` `<Route path="/whatsapp">`. All three real,
  none in `stubs.ts`. Correct.
- **B4 REAL** — `claims: 81` in the real committed `preflight.json`. Correct.

### 7. Score unmoved ✅
**20.2% / 28.9%**, 57 features, probe fingerprint `9acec0d56307` — identical before and after the
unit. Hardening the inputs changed no verdict, which is the right outcome.

### 8. Workflow-regression check (`--check` now requires committed evidence)
Ran the ordinary loop for real:

```
$ pnpm verify:live      → exit 3, INCONCLUSIVE (DIRTY-TREE + no LKB_API_KEY);
                          Mongo WAS reachable — 11/24 collections counted;
                          wrote qa/evidence/live-2026-09-07-03-29-24/ (untracked)
$ pnpm lint:structure   → exit 2
  REFUSED: scored from UNCOMMITTED evidence qa/evidence/live-2026-09-07-03-29-24/preflight.json
           — commit it, or re-run `pnpm verify:live` and commit that, so the score is
           reproducible by someone else.
```

**Verdict on this: disclosed, actionable, not a trap.** The manifest lists it explicitly under
Disclosed limitations, and the refusal names the file and the remedy. One nit, not an issue: the
message's second option ("re-run `pnpm verify:live` and commit that") is circular on its own, since
re-running produces another untracked folder — only the "commit it" half terminates. Worth a word
tweak, not a fix cycle. I removed the evidence folder I created so the builder's tree is green.

## The fifth layer — ISS-037 (high), the finding that matters

The dispatch asked whether there is a fifth layer. There is, and it is in the code this unit added.

`isTracked()` (`scripts/lib/catalogue.mjs:148-155`) runs
`git ls-files --error-unmatch <path>`. That answers *"is this path tracked?"* — it says **nothing**
about whether the working-tree content matches the committed blob. So: don't add a folder, **edit
the already-committed one**.

```
# rewrote every count in qa/evidence/live-2026-09-07-01-58-41/preflight.json to 4242
# no new folder, no commit, same internal stamp
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 39.5% adjusted / 50% machine-derived, 57 features      exit=0
   → doc line: (run 2026-09-07T01:58:41.367Z, sha `9645b8e0217b`)   ← NO uncommitted banner
$ node scripts/catalogue-score.mjs --check
OK: docs/PROGRESS.md is current (39.5% of 57 features)                          exit=0
$ pnpm lint:structure
… OK: docs/PROGRESS.md is current (39.5% of 57 features)                        exit=0
```

**+19.3 points — the identical magnitude as ISS-035 — through the very gate built to close ISS-035**,
with `lint:structure` green, no banner, and the probe fingerprint unchanged.

This is the defense that should have been implemented and wasn't. It is cheap and uses machinery
already imported: `git diff --quiet HEAD -- <path>`, or hash `git show HEAD:<path>` and compare. The
manifest's ceiling claim — *"what it now costs is a visible commit with a changed sha"* — is
therefore inaccurate. The real cost is a dirty working tree, i.e. **the same cost as the original
ISS-035 attack**. The only residual trace is the printed sha changing, which nobody can evaluate
without recomputing it against the blob by hand.

**Why this is not a FAIL.** I10 as written asks for the content hash printed (done), a refusal on
future-dating (done), and a refusal/banner when the run is newer than the newest committed evidence
(done, via the tracked check). A tampered file is neither future-dated nor newer — same stamp,
different bytes — so it falls outside I10's literal reach. It is the next layer, in the same
pattern this project has hit three times (verdicts → numerator → denominator → inputs → **content
attribution**). Note also that the `tracked` gate was *beyond* what I10 demanded; failing the unit
for a hole in a defense the contract never required would be perverse. Filed as ISS-037 and pinned
by new invariant **I11** instead.

## Also filed

- **ISS-039 (medium)** — the printed evidence sha is line-ending dependent. The blob is LF (804
  bytes); `core.autocrlf=true` in this repo, so a checkout materialises CRLF (840 bytes) and the sha
  moves `5f7ed1c0d434` → `3a73c60dcc6d`, making `docs/PROGRESS.md` byte-different and `--check`
  report **STALE exit 1 on an untouched clone**. Measured directly. Regenerating flips the diff back
  on an LF machine — a cross-platform ping-pong. Compounds a pre-existing instance of the same class
  (git reports `docs/PROGRESS.md` itself as LF-in-worktree / CRLF-on-checkout, and `generate()` joins
  with `\n`), so I1 was already platform-dependent before this unit; this unit adds a second
  CRLF-sensitive input. Not scored as a regression for that reason.
- **ISS-040 (low)** — a BOM'd/malformed `preflight.json` is silently skipped by
  `catch { continue }` (`lib/catalogue.mjs:122`), so the scorer can quietly fall back to stale
  evidence. Fails safe (lowers, never inflates) and the doc names whichever file it used.

## Contract amended (routine tightening — auto per the criticality gate)

Added **I11** — *"committed" must mean the CONTENT, not the path*; the printed sha must be
line-ending-normalised; each such gate carries a regression test. **Effective from cycle 4**, the
same convention cycle 2 used for I9/I10 — it would be goalpost-moving to judge this cycle against an
invariant written after its work was submitted. Verification steps 13–14 added. Nothing weakened.

## Housekeeping

- Repaired one **pre-existing** corrupt ledger row (`ISS-017` carried an unescaped `\s`, so
  `JSON.parse` failed on it). Escaping only, no semantic change. Ledger now **40 rows, 0 invalid**.
- Working tree restored to exactly the state I found it: `docs/PROGRESS.md` at baseline sha256
  `1C028F7E…`, `.goal/catalogue.json` byte-exact, evidence file byte-exact
  (`git diff --exit-code` = 0, blob 804 = worktree 804), all mutations reverted, all attack folders
  removed. `pnpm lint:structure` exit 0 and `pnpm test:lint` 29/29 on exit.
- Mongo was reachable this run, so nothing was INCONCLUSIVE.

## Recommended next unit

**ISS-037 first** — it is high severity, it reopens a 19.3-point hole, and it is a ~5-line change
(`isTracked` → content comparison). Fold **ISS-038** into it (the same change should arrive with the
regression test the current gate lacks), and **ISS-039** alongside, since both touch the same few
lines of `loadCollectionCounts`.
