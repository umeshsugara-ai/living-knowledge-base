# Contract — catalogue-progress-score

> Ground truth for the honest progress score (plan §10 U0.5). **Drafted by the maker; /checker
> adopts or amends on first check** — the same convention as the other contracts in this
> directory. Written because the cycle-1 checker correctly observed that this unit was being
> checked against `snapshot-features-ledger.md`, a contract about a different artifact, so **no
> document stated this unit's own acceptance criteria** and each checker had to re-derive the
> honesty rules from the code.
>
> **/checker, cycle 2 (2026-09-07): ADOPTED as drafted.** I1–I8 accurately state this unit's
> acceptance criteria, every one is machine-checkable, and none of them softens anything the
> cycle-1 verdict found. **AMENDED** in the same pass (tightening → auto per the criticality gate)
> with **I9 and I10**, covering two inflation levers the cycle-2 check found that I1–I8 do not
> reach. **I9/I10 take effect from the NEXT cycle** — they were added after this cycle's work was
> submitted and it would be goalpost-moving to judge cycle 2 against them.

## Why this exists

`.goal/goal.json` reported **79% complete**. That figure counted 29 *foundation tasks*, not the
57-feature product catalogue, and omitted 5 rows present in `TASKS.md`. It was read as "the product
is 79% built" when the real figure was ~20%. A progress number that flatters is worse than no
number, because it is acted on. This unit replaces it with one that **cannot be inflated without
tripping a gate or leaving a diff**.

## Scope

`.goal/catalogue.json` (the feature list + probes) · `scripts/lib/catalogue.mjs` (signals +
scoring) · `scripts/catalogue-score.mjs` (CLI + generated doc) · `docs/PROGRESS.md` (generated) ·
`scripts/catalogue.test.mjs` (regression cover for the guards).

## Invariants (the reason the unit exists — each machine-checkable)

- **[I1] Verdicts are derived, never asserted.** Deleting `docs/PROGRESS.md` and regenerating must
  reproduce it byte-for-byte. No verdict may exist that is not computed from a probe.
- **[I2] A human may lower a verdict, never raise it.** A `manual.verdict` above the derived
  verdict must cause exit ≠ 0 **and no file write**.
- **[I3] The verdict vocabulary is closed.** A `manual.verdict` outside
  `{MISSING, STUB, PARTIAL, REAL}` must be refused, not silently treated as a downgrade.
  *(Regression: an unknown value made the ordering comparison `undefined > n` — false — so a bogus
  verdict was written out labelled "lowered" with exit 0. ISS-031.)*
- **[I4] The denominator is pinned.** The feature id set must match plan §4c exactly (57 ids,
  A×13 B×13 C×14 D×8 E×7 F×2). A dropped, added, renamed or duplicated id must be refused.
  *(Regression: deleting the 19 probe-less rows moved the score 20.2% → 30.3% with every gate
  green. Guarding the numerator alone was not enough. ISS-029.)*
- **[I5] Probe edits are reviewable.** `docs/PROGRESS.md` carries a fingerprint of every feature's
  probes + manual verdict, so weakening or repointing a probe appears as a diff in a committed
  file. This is *reviewability, not prevention* — a determined editor can still change a probe, but
  cannot do it invisibly. ISS-032.
- **[I6] A deliberate 501 is STUB, and dead code is STUB.** Neither may score REAL. A package
  imported by nothing outside itself is not a shipped feature.
- **[I7] Staleness is caught.** `--check` must exit non-zero when the committed doc differs from a
  fresh regeneration, and must be wired into `pnpm lint:structure`.
- **[I8] The guards carry regression tests.** Each of I2–I6 must have a test that fails if the
  guard is removed. *(Cycle-1 FAIL: all guards were proven by hand and none were tested, so a
  refactor could silently delete them. ISS-030.)*

### Added by /checker cycle 2 — effective from cycle 3 / the next unit that touches this scorer

- **[I9] The scoring scale is pinned and self-describing.** `POINTS` (REAL=1, PARTIAL=0.5,
  STUB/MISSING=0) must be covered by a test that fails when it changes, and the scale line printed
  in `docs/PROGRESS.md` must be RENDERED FROM `POINTS`, not a hardcoded string. *(Measured
  cycle 2: rewriting `POINTS` to `{STUB:0.5, PARTIAL:0.75}` moved the headline 20.2% → 28.5% with
  all 10 tests passing, `--check` exit 0, `lint:structure` exit 0 and the probe fingerprint
  unchanged — and the regenerated doc still asserted "STUB/MISSING=0" while scoring STUB at 0.5.
  A generated document that misstates its own scale is worse than no document. ISS-034.)*
- **[I10] Collection evidence is bounded and attributable.** The chosen
  `qa/evidence/live-*/preflight.json` must be tied to something the scorer can check — at minimum
  its content hash printed into `docs/PROGRESS.md` alongside its path, and a refusal (or a loud
  banner) when the selected run is dated in the future or is newer than the newest committed
  evidence. *(Measured cycle 2: adding one folder `qa/evidence/live-2026-12-31-23-59-59/` whose
  `preflight.json` replaces every zero count with 4242 moved the headline 20.2% → 39.5% — the
  largest lever found in either cycle, +19.3 points — with `--check` exit 0, `lint:structure`
  exit 0, all tests passing and the probe fingerprint unchanged. `loadCollectionCounts` takes the
  lexically-last `live-*` folder, so the folder NAME is attacker-controlled. ISS-035.)*

### Added by /checker cycle 3 — effective from cycle 4 / the next unit that touches this scorer

- **[I11] "Committed" must mean the CONTENT, not the path.** Any gate that admits evidence on the
  grounds that it is committed must compare the evidence's **content** to the committed blob (e.g.
  `git diff --quiet HEAD -- <path>`, or hashing `git show HEAD:<path>`), never merely assert that
  the path is tracked. The sha printed in `docs/PROGRESS.md` must be **line-ending-normalised** (or
  read from the blob) so it is identical on an LF and a CRLF checkout. Each such gate carries its
  own regression test. *(Measured cycle 3: `isTracked()` used `git ls-files --error-unmatch`, which
  is a path query. Rewriting every count in the ALREADY-COMMITTED `preflight.json` in place — no new
  folder, no commit, same internal stamp — moved the headline 20.2% → 39.5% with `--check` exit 0,
  `pnpm lint:structure` exit 0 and NO uncommitted banner, defeating the very gate built to close
  ISS-035 and at the same magnitude, +19.3 points. ISS-037. Separately, the same checkout run as
  CRLF changes the printed sha `5f7ed1c0d434` → `3a73c60dcc6d` and turns `--check` STALE on an
  untouched clone — ISS-039. And the `--check` refusal itself had no test: neutering it left all 29
  green — ISS-038.)*

### Added by /checker cycle 4 — effective from cycle 5 / the next unit that touches this scorer

- **[I12] A gate is pinned by its BEHAVIOUR, not by its source text.** Every refusal this scorer
  relies on must have a test that **runs the thing** — for the CLI, spawn
  `node scripts/catalogue-score.mjs --check` after a real tamper and assert the **exit status**;
  for `trustOf`, assert the exact trust state against HEAD, including the **staged-but-uncommitted**
  case. An `assert.match` over the source file does not count. *(Measured cycle 4: the ISS-038 test
  is a source-text assertion, so changing only `process.exit(2)` → `process.exit(0)` in the refusal
  branch left 19/19 + 33/33 green while restoring the full +19.3-point lever with `--check` exit 0
  and `lint:structure` exit 0 — the regex `/process\.exit\(2\)/` still matched the two other exits
  in the same file. Separately, rewriting `git diff --quiet HEAD --` to `git diff --quiet --` (index,
  not HEAD) survived the whole suite, and with it a bare `git add` restores the lever with no banner.
  ISS-038, ISS-042.)* No fixture repo is required for either: this repo is the fixture, and the
  throwaway-git-repo helper already exists.
- **[I13] EVERY input that can raise the score carries the I11 trust check — not just the evidence
  file.** In particular `.goal/catalogue.json`, which defines all 57 probes and every human
  downgrade, must have its trust state and content fingerprint printed in `docs/PROGRESS.md` and
  must make `--check` refuse when it is not `committed`. A fingerprint printed into the document the
  same run regenerates is visibility with no reviewer; only a refusal is a gate. *(Measured cycle 4,
  the sixth layer and the largest lever in this chain: repointing the 19 probe-less rows at a
  populated collection and nulling the 11 `manual` downgrades — no commit — moved the headline
  20.2% → 62.3%, **+42.1 points**, with `--check` exit 0, `lint:structure` exit 0 and 19/19 tests
  green. Halves: probes alone 53.5%, downgrade removal alone 28.9%. Note I2 cannot see the second
  half — REMOVING a downgrade is not an upgrade relative to the derived verdict, so the
  one-directional upgrade guard has nothing to object to. ISS-041.)*

### Added by /checker cycle 5 — effective from cycle 6 / the next unit that touches this scorer

- **[I14] The trusted-input set is DERIVED, never hand-maintained.** I13 says *every* input that can
  raise the score carries the trust check; a hand-written constant listing one path is not a way to
  satisfy an invariant quantified over "every". The scorer must collect the repo-relative paths it
  actually reads during a real `generate()` — by instrumenting the reads, or by having each scraper
  return what it consumed — trust every one of them with `trustOf()`, and refuse in `--check` on any
  that is not `committed`. This carries its own test in the I12 sense: assert that the set of
  repo-relative paths read during a real `generate()` is a **subset** of the trusted set, so an input
  added without trust fails a test rather than quietly inflating a number.
  *(Measured cycle 5, the seventh layer: three of the four scoring signals never pass through
  `SCORE_INPUTS`. `scrapeRoutes` reads every `apps/api/src/routes/*.ts`, `scrapePages` reads
  `apps/web/src/App.tsx`, `reachablePackages` walks the package tree. One untracked route file
  declaring 15 routes plus 13 `<Route path=…>` lines added to `App.tsx` — **nothing committed** —
  moved the headline 20.2% → 30.7% (machine-derived 28.9% → 39.5%, **+10.5 points**) with `--check`
  exit 0, `pnpm lint:structure` exit 0, 23/23 tests green and **no banner of any kind**. This is
  strictly cheaper than the ceiling the unit disclosed, which assumed a fabrication had to be
  committed. ISS-047.)*

## Honest limits of this instrument (disclosed, not defects)

- **Probes are hand-authored**, so the catalogue can be wrong by omission: an under-specified probe
  under-scores, a too-easy probe over-scores. Mitigation is visibility — every row's probe is
  printed in the generated table's "derived from" column, so a reviewer argues with the *probe*
  rather than the number.
- **Features with no probe score MISSING by default.** Correct today (none of them exist), but if
  one is built its probe must be added or it will keep reading MISSING. No gate catches that; the
  count and the full id list are printed in `docs/PROGRESS.md` so it stays in view.
- **Collection counts are as fresh as the last `pnpm verify:live`**, not live at scoring time — a
  deliberate trade so the scorer stays offline and the score is tied to reproducible evidence. The
  generated doc names the exact evidence file used.
- **Route scraping is static**, so a route that exists but crashes at runtime still scores live.
  `pnpm verify:live` is the complement that catches that.

## How to verify
1. `pnpm progress` twice → byte-identical `docs/PROGRESS.md` (I1).
2. Delete `docs/PROGRESS.md`, regenerate → identical (I1).
3. Set any MISSING feature's `manual.verdict` to `"REAL"` → exit ≠ 0, no write (I2).
4. Set one to `"EXCELLENT"` → refused as an invalid verdict, not accepted (I3).
5. Delete any feature row → refused, naming the dropped id (I4).
6. Edit any probe → the fingerprint line in `docs/PROGRESS.md` changes (I5).
7. Confirm `GET /search` scores STUB and `@lkb/meeting-bot` scores STUB (I6).
8. Tamper with `docs/PROGRESS.md`, run `--check` → exit 1; confirm it is in `lint:structure` (I7).
9. `node --test scripts/catalogue.test.mjs` → all pass; delete a guard and confirm a test fails (I8).
10. Independently confirm ≥5 verdicts against source/Mongo — attack the probes, not the number.
11. *(I9, from cycle 3)* Rewrite `POINTS` in `scripts/lib/catalogue.mjs` → a test must fail, and the
    scale line in `docs/PROGRESS.md` must change with it.
12. *(I10, from cycle 3)* Drop a future-dated `qa/evidence/live-*/preflight.json` with inflated
    counts → the scorer must refuse, or the doc must make the substitution unmissable.
13. *(I11, from cycle 4)* Rewrite the counts **inside the already-committed** `preflight.json`
    without committing → `--check` and `pnpm lint:structure` must refuse, not pass.
14. *(I11, from cycle 4)* `git checkout --` the evidence file on a CRLF-configured clone
    (`core.autocrlf=true`) → the sha printed in `docs/PROGRESS.md` must not change and `--check`
    must stay exit 0.
15. *(I12, from cycle 5)* Change ONLY `process.exit(2)` to `process.exit(0)` inside the `--check`
    trust-refusal branch → a test must fail. Likewise rewrite `git diff --quiet HEAD --` to
    `git diff --quiet --` → a test must fail.
16. *(I13, from cycle 5)* Repoint the probe-less rows in `.goal/catalogue.json` at a populated
    collection without committing → `--check` and `pnpm lint:structure` must refuse, not pass.
17. *(I14, from cycle 6)* Add an **untracked** file under `apps/api/src/routes/` declaring routes a
    probe looks for, and/or add `<Route path="…">` lines to `apps/web/src/App.tsx` without
    committing → the score must not move silently: `--check` must refuse, or at minimum the doc must
    carry the untrusted banner naming those files.
18. *(I14, from cycle 6)* Neuter the `--check` line-ending normalisation and the CLI upgrade
    refusal, one at a time → a test must fail for each (ISS-045, ISS-044).

## Amendment log

| date | kind | what | why |
|---|---|---|---|
| 2026-09-07 | START | Initial contract, I1–I8, drafted by the maker | No document stated this unit's acceptance criteria; cycle-1 checker had to re-derive them (cycle-1 verdict, commit `b5596e6`) |
| 2026-09-07 | routine (tighten) | /checker ADOPTED I1–I8 unchanged; ADDED I9 (scoring scale pinned + self-describing) and I10 (collection evidence bounded + attributable), effective cycle 3 | Cycle-2 check found two inflation levers I1–I8 do not reach: `POINTS` tampering (+8.3 pts, all gates green, doc misstates its own scale — ISS-034) and evidence-file substitution (+19.3 pts, all gates green — ISS-035). Both measured by execution. Tightening only; nothing weakened. |
| 2026-09-07 | routine (tighten) | ADDED I11 (committed means CONTENT not path; sha must be line-ending-normalised; each such gate carries a test), effective cycle 4 | Cycle-3 check confirmed I9 and I10 are met, and found the next layer in the same place the last two were: the new `tracked` gate admits evidence on a path query, so tampering with the already-committed `preflight.json` in place restores the full +19.3-point lever with `--check` and `lint:structure` both green (ISS-037). Also ISS-039 (CRLF flips the printed sha, `--check` STALE on a clean clone) and ISS-038 (that gate had no regression test). Measured by execution. Tightening only; nothing weakened. |
| 2026-09-07 | routine (tighten) | ADDED I12 (gate pinned by BEHAVIOUR — spawn the CLI and assert the exit status; trust asserted against HEAD including the staged case) and I13 (every score-raising input carries the I11 trust check, `.goal/catalogue.json` above all), effective cycle 5 | Cycle-4 check confirmed I11's content-vs-HEAD trust and its line-ending-normalised sha, but its "each such gate carries its own regression test" clause is not met: `process.exit(2)` → `process.exit(0)` in the refusal branch survives 19/19 + 33/33 and restores the +19.3-point lever (ISS-038), and `git diff --quiet --` (index, not HEAD) survives the suite too (ISS-042). And the sixth layer of the same pattern was found one input over: `.goal/catalogue.json` has no trust check at all, worth **+42.1 points** with every gate green (ISS-041). Measured by execution. Tightening only; nothing weakened. |
| 2026-09-07 | routine (tighten) | ADDED I14 (the trusted-input set is DERIVED, never hand-maintained; the read-set must be a subset of the trusted set, with its own test), effective cycle 6 | Cycle-5 check confirmed I12's behaviour-pinning for the three `--check` refusals and I13's catalogue gate — the exact `exit(2)`→`exit(0)` mutation that survived cycle 4 now reddens two tests, and the +42.1-point catalogue lever is closed at the mechanism. But I13 is quantified over EVERY score-raising input and the unit satisfied it with a hand-written list of one, which the maker disclosed and asked to have judged. It is already incomplete: the three code scrapers are untrusted, and purely uncommitted source edits move the headline +10.5 points with every gate green and no banner (ISS-047). Also ISS-044 (the CLI upgrade refusal has no behavioural test) and ISS-045 (the line-ending gate shipped this cycle is itself unpinned) — both the I12 class. Measured by execution. Tightening only; nothing weakened. |
| 2026-09-07 | routine (record ruling; **nothing changed**) | **I13/I14 UPHELD unchanged**, and the packaging complaint against them SUSTAINED and separated out as ISS-058. The refusal on uncommitted scraped SOURCE stays exactly as strong. What moves is *where the refusal runs*: `catalogue-score --check` belongs in the commit/CI path, not bundled into the everyday `pnpm lint:structure` chain. | Ruling on the maker's `qa/feedback-inbox.md` entry of 2026-09-07 (ISS-056 unit), which asked to have this judged rather than changing a checker-owned invariant — the right escalation. **Its substantive premise is refuted by this contract's own cycle-5 measurement.** The maker argued that for scraped SOURCE "the protection is arguably already the EDITED-SINCE-COMMIT banner plus the staleness check". ISS-047 measured precisely that case: one untracked route file plus 13 `<Route>` lines in `App.tsx`, **nothing committed**, moved the headline 20.2% → 30.7% with `--check` exit 0, `lint:structure` exit 0, 23/23 green and **"no banner of any kind"**. Scraped source is not a lesser input; it is the input that was silently inflatable, and I14 exists because of it. **The cited ruling does not transfer.** "A gate that blocks every commit until someone else acts is a gate people delete" (ISS-053, on tracker-audit G2/G3) turns on *someone else acting*. This gate is cleared by the author, by committing their own work — the very next step — and is never clearable-only-by-a-third-party. That is the same distinction ISS-053 itself drew when it kept G1, which is "fully in the authors' control and always clearable in-commit", inside the chain. **But the workflow harm is real and is the maker's own evidence**: this unit's `lint:structure` refused on four in-flight files while every other structure check passed and the score was unchanged, so the one command a maker runs pre-commit is red exactly when it is most wanted, and a chain that is red for legitimate reasons trains people to stop reading it. That is a composition defect, not a strength defect — a score-reproducibility check is only meaningful *about committed state*, so running it before the commit asks a question that cannot yet have a good answer. Remedy in ISS-058: split it out (`lint:score`) and gate the commit/CI path with it, leaving `lint:structure` runnable at any time. No invariant weakened; no criterion softened. |
