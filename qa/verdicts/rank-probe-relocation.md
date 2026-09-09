# Verdict — rank-probe-relocation

**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** Mode A, bound to `D:\KnowledgeBase`
**Contract:** none — judged against ISS-212 and ISS-213's recorded `fix_direction` (D-015).
**Commit under check:** `633161c` (see "Traceability" below — the code actually landed in `6ec03cb`).

```
VERDICT: FAIL
SCOREBOARD: 2/3 verify commands reproduce, 2/2 issue fix-directions satisfied
FAILURES:
- [V3] sev: medium · `pnpm lint:structure` is RED, not green as the manifest claims, and this unit
  caused it: creating `qa/probes/` made `docs/SNAPSHOT.md` stale (71 lines differ; the diff is
  exactly the insertion of the `qa/probes/` tree entry at line 47, shifting everything below).
  · Run `node scripts/snapshot.mjs` and commit the regenerated `docs/SNAPSHOT.md`. · issue: ISS-222
LIVE-BROWSER: not-applicable (changed paths `qa/probes/rank-probe.mjs`,
  `qa/evidence/live-rank-probe-2026-09-08.mjs`, `qa/manifests/*` — all under `qa/**`, listed in
  `qa/ui-surfaces.json:12` under `genuinely_not_user_facing`; verified against the pattern myself,
  not taken from the manifest)
ISSUES-WRITTEN: ISS-222, ISS-223
EXPLANATION: Both target issues are genuinely closed and I have marked them `fixed` — the
byte-identical restoration checks out exactly, and the live re-run reproduces the manifest's three
lines verbatim. The FAIL is collateral and costs one command: the manifest asserts a verify result
it evidently did not re-run after creating the new directory, and the repo's structural gate is red
on master right now. Cycle 2 owes only the snapshot regeneration.
```

## What I re-ran

### 1. The byte-identical claim — VERIFIED

The maker's phrasing is exact and it holds, once line-ending noise is removed:

```
$ git show 2873df4^:qa/evidence/live-rank-probe-2026-09-08.mjs > /tmp/pre.mjs
$ git show HEAD:qa/evidence/live-rank-probe-2026-09-08.mjs | tail -n 29 > /tmp/headtail.mjs
$ cmp /tmp/pre.mjs /tmp/headtail.mjs
BYTE-IDENTICAL (index form)
```

A naive worktree `diff -u` shows every line replaced, which looks damning; it is an artefact of
`core.autocrlf=true` (`git ls-files --eol` reports `i/lf w/crlf` for this path and `i/lf w/lf` for
`qa/probes/rank-probe.mjs`). In git's canonical form the pre-rewrite blob and the tail of the file
at HEAD are byte-for-byte equal — 29 lines, identical, under a 17-line header. The claim is true.

### 2. The probe — RE-RUN, output reproduces the manifest exactly

```
$ npx tsx --env-file=.env qa/probes/rank-probe.mjs
q="visa student university funding" hits=10 distinctSessions=6 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=2 scores=[1.0000,...]
q="2026 intake" hits=10 distinctSessions=1 -> INCONCLUSIVE for pairing: all hits share one session, so a mis-pairing is unobservable
q="counselling" hits=2 distinctSessions=2 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=1 scores=[1.0000,1.0000]
```

`distinctSessions` prints on every line; the single-session query returns INCONCLUSIVE rather than a
bare `0`; `anyChecked` is not set by an inconclusive query. That is ISS-212's recorded direction (a)
and (b), implemented as written.

**Read-only — verified, not assumed.** The probe reaches Mongo through exactly two paths:
`store.search(...)` and `db.collection("turns").findOne(...)`. `grep -n
"insert\|update\|delete\|replace\|bulkWrite\|findOneAnd" apps/api/src/search-store.ts` returns one
hit, and it is the word "replaces" inside a doc comment. No write API is reachable from this probe.

### 3. `pnpm lint:structure` — RED (the failure above)

`lint-dirsize: OK (78 dirs within budget)` — the maker's *narrow* claim is true. Its broader claim
("`pnpm lint:structure` → green") is false: `scripts/snapshot.mjs --check` fails four steps later.

## Ruling — the VOID header versus a rename

**The maker did not deviate from the recorded direction.** The dispatch framed this as a deviation
requiring justification; re-reading ISS-213's own `fix_direction` shows otherwise — it is a
two-branch direction, and branch 2 is, verbatim:

> *"If the dated convention is kept deliberately, then instead: restore the 09-08 file to its
> committed 09-08 content with a one-line `// VOID …` header, and put the rewrite at the 09-09
> path."*

The maker took branch 2. The header is 17 lines rather than one, which is immaterial — the extra
lines carry the D-019 rationale and name the replacement, as branch 2 requires.

**Is a VOID header itself a modification of a dated record?** Literally, yes. But the harm ISS-213
names is not "the bytes changed", it is *reference repointing*: a citation resolving to code its
author never read. Apply that test to each option:

| option | what a reader following a citation finds |
|---|---|
| in-place rewrite (what was filed) | different code, no warning — **the harm** |
| rename | **nothing**; the citation dangles, and the maker may not edit checker-owned verdicts to follow it |
| restore + VOID header | the exact 29 lines the citing checkers read, plus a notice saying so |

Only the third preserves the record *and* leaves the reader a path. This is the ordinary form of a
retraction: a retracted paper is not deleted or renamed, it is stamped and its text kept intact.
Annotating a record is a different act from altering what it recorded, and the header says so in its
own words. **Satisfies ISS-213; not a dodge.**

**The path deviation is an improvement on both recorded branches.** Branch 2 said put the instrument
at `live-rank-probe-2026-09-09.mjs`. That reconstructs the defect: a date-named instrument gets
improved next week and the 09-09 citations repoint in turn. The maker's reasoning — `qa/evidence/`
means *results*, an instrument is not a result — is branch 1's root-cause analysis applied correctly
to branch 2's mechanics. Better than what I recorded.

**The new directory is not scope creep.** The cap claim checks out: `structure.config.json:11` reads
`"dirsize": { "maxFiles": 30, "overrides": { "scripts": 32 } }` and `scripts/` holds exactly 32
files — at cap, with D-018 forbidding a third widening. `qa/probes/` mirrors the existing
`qa/{manifests,verdicts,gates,debug}` shape. One honest qualifier the manifest should have made:
`qa/` is not in `structure.config.json`'s `roots`, so "lint-dirsize stays green" is true but vacuous
— `qa/` was never linted. That does not change the ruling; it changes how much the maker's lint
evidence proved.

## `distinctSessions >= 2` — necessary, not sufficient, and that is the metric I specified

Necessary: at `distinctSessions == 1` a pairing defect has power exactly zero — every mis-pairing
maps a session id onto itself. Not sufficient, and the two rotation cases the dispatch names show
why:

- **5+5 split, rotate by one.** Eight of ten rows land on a different session; the probe reports
  `mismatchedPairs=8`. Loud.
- **9+1 split, rotate by one.** Only the two rows adjacent to the singleton change session; the
  probe reports `mismatchedPairs=2` out of 10. Detected, but with roughly a fifth of the
  sensitivity — and the printed `distinctSessions=2` is identical in both cases, so the reader
  cannot tell them apart.
- **Any within-session mis-pairing, at any distribution.** Invisible at every `distinctSessions`.

So the guard is a floor against the degenerate case, not a power measurement. If real power
reporting is ever wanted, the metric is `min(count per session)` or the count of cross-session hit
pairs, not a distinct count. **This is not a finding against the maker** — `distinctSessions` is what
ISS-212's `fix_direction` specified, word for word, and the maker implemented it exactly. It is a
limitation of the metric its author (this role) chose, and under this repo's class-based round cap
(D-014) the probe seam is non-security and already carries two PASSes — so it is recorded here and
**filed, not promoted into another round**.

## The `{6, 0, 2}` mutation the maker declined to re-run

**The restraint is right; the way the old number was carried forward is not.**

Right on scope: nothing in this unit touches `search-store.ts`, the mutation was measured and
recorded in `vacuous-evidence-probes` cycle 1 (I re-read that verdict and the `checker_note` on
ISS-202 — the mutant was `sessionId` taken from `scored[(i+1)%len]`), and re-reporting another
unit's measurement as this unit's evidence is exactly what D-015 exists to stop.

But the dispatch's observation is correct and it lands somewhere the maker did not look. The guard
changed the mutation's *observable shape*, and `qa/probes/rank-probe.mjs:44-45` states the old shape
in the present tense, about this probe:

> `// Measured: under an ISS-084-shaped mutation this probe reports 6 / 0 / 2 across the three`
> `// queries, and the 0 is exactly the single-session query.`

That sentence is false of this probe, and no mutation run is needed to prove it. The guard
`continue`s before `badPair` is ever computed, and query 2 is live-confirmed `distinctSessions=1`.
**This probe cannot emit a `0` for the middle query under any mutation of `search-store.ts`** — it
can only emit `6 / INCONCLUSIVE / 2`. The comment describes the instrument this one replaced.

It is a small thing, one clause, and it is filed as ISS-223 at medium — but it is worth naming
precisely, because it is the same defect class the whole seven-unit chain has been closing: **a
durable self-description asserting an output its code can no longer produce.** The maker was right
not to re-run the mutation, and wrong to inherit its number without re-deriving whether the sentence
still parsed. Under the round cap this is filed, not a unit.

## Traceability note (not charged)

The manifest names commit `633161c`. That commit contains **only** the manifest (`1 file changed, 77
insertions`). `qa/probes/rank-probe.mjs` and the restored evidence file landed in `6ec03cb`, whose
message reads *"qa/debug: correct the stall diagnosis"*. Nothing is lost and the working tree is
clean, but a reader auditing this unit by its stated commit finds no code in it. Worth one line of
care next time; not a finding.

## Ledger note (not charged)

ISS-202's evidence cites `qa/evidence/live-rank-probe-2026-09-08.mjs:16-22`. The 17-line header
prepends, so that range now lands inside the header rather than on the `bySession` construction (now
lines 33-39). I am not filing it: the reader lands on a notice that explains the situation and names
the replacement, which is the opposite of being misled, and a line range read into a file bearing a
retraction notice is conventionally understood. Recorded so the next reader is not surprised.

## Issue status changes

- **ISS-212 → `fixed`** — direction implemented verbatim; independently re-run live.
- **ISS-213 → `fixed`** — branch 2 of its own recorded direction; byte-identical restoration
  verified by `cmp` in git's canonical form; instrument relocated to a better path than either
  branch named.
- **ISS-222** (new, medium) — `pnpm lint:structure` red; `docs/SNAPSHOT.md` stale.
- **ISS-223** (new, medium, `file-don't-fix` under the D-014 round cap) — the stale `6 / 0 / 2`
  comment.

## Recommendation to the maker — leave this chain

This is the seventh consecutive unit in a chain of self-found defects on one probe. The chain has
been honest and it has been productive, but its remaining yield is doc accuracy on a QA instrument
that no product surface consumes. Under D-014 the seam is non-security and past its two-PASS cap;
under the repo's backlog priority, tiers 1-2 are what should be cleared and then **tier 3 — the next
unblocked roadmap task**, which is T-021 (golden set). Regenerate the snapshot to clear ISS-222,
answer the open enforcement HUMAN_GATE, and go build a feature. ISS-223 stays filed.
