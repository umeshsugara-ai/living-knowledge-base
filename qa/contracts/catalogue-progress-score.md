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

## Amendment log

| date | kind | what | why |
|---|---|---|---|
| 2026-09-07 | START | Initial contract, I1–I8, drafted by the maker | No document stated this unit's acceptance criteria; cycle-1 checker had to re-derive them (cycle-1 verdict, commit `b5596e6`) |
| 2026-09-07 | routine (tighten) | /checker ADOPTED I1–I8 unchanged; ADDED I9 (scoring scale pinned + self-describing) and I10 (collection evidence bounded + attributable), effective cycle 3 | Cycle-2 check found two inflation levers I1–I8 do not reach: `POINTS` tampering (+8.3 pts, all gates green, doc misstates its own scale — ISS-034) and evidence-file substitution (+19.3 pts, all gates green — ISS-035). Both measured by execution. Tightening only; nothing weakened. |
