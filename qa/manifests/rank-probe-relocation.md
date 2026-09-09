# Manifest — rank-probe-relocation

**Contract:** none. Judge against ISS-212 and ISS-213's recorded fix directions.
**Goal task:** none — follow-on to `vacuous-evidence-probes` (PASS), same artifact.
**Date:** 2026-09-09
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-212**, **ISS-213** (both medium, both filed against my own previous unit).

## ISS-213 — I rewrote a dated evidence artifact in place, and that was wrong

`qa/evidence/live-rank-probe-2026-09-08.mjs` is cited by **two checker-owned verdicts**
(`search-store-rank-assertion.md`, `vacuous-evidence-probes.md`). Rewriting its body repointed both
citations at code their authors never saw — the reference-repointing harm D-019 names, committed by
me one day after I quoted D-019 approvingly.

**The obvious fix is the wrong one.** Renaming the file to drop the false date would leave those two
verdicts pointing at nothing, and I may not edit verdicts to follow the rename. So:

| | action |
|---|---|
| `qa/evidence/live-rank-probe-2026-09-08.mjs` | **restored byte-identical** to its pre-rewrite content, under a header marking it **VOID AS EVIDENCE** and naming its replacement. Both verdict citations resolve again to the code their authors read. |
| `qa/probes/rank-probe.mjs` | **new** — the corrected, re-runnable instrument. |

The header is the one deviation from byte-identical, and it is deliberate: restoring the file
silently would put an un-annotated check-that-cannot-fail back on disk with no warning to its next
reader. Annotating a record is not the same as changing what it recorded.

**Why a new directory.** The checker's root-cause was the naming: this is a **re-runnable
instrument**, not a dated result, and `qa/evidence/` means results. `scripts/` is at its override
cap (32/32) and D-018 rules that a third budget raise must **consolidate, not widen** — so adding
there was closed off. `qa/probes/` follows the same shape the repo already uses for
`qa/{manifests,verdicts,gates,debug}`. `lint-dirsize` and `lint-root` stay green.

## ISS-212 — the probe printed an uninformative zero and only the manifest said so

A pairing defect is observable only when the hits span more than one session; mis-pairing rows that
all share a `sessionId` produces an identical result. Under an ISS-084-shaped mutation the probe
reports **6 / 0 / 2** across its three queries — and that middle `0` is exactly the single-session
query, not a clean bill of health.

I disclosed that in the previous manifest. **The reader of the probe's output never sees a
manifest.** The probe already refuses on `hits=0`; it now owes the same refusal here:

```
q="visa student university funding" hits=10 distinctSessions=6 mismatchedPairs=0 ... mismatchedJoins=0
q="2026 intake"                     hits=10 distinctSessions=1 -> INCONCLUSIVE for pairing:
                                    all hits share one session, so a mis-pairing is unobservable
q="counselling"                     hits=2  distinctSessions=2 mismatchedPairs=0 ... mismatchedJoins=0
```

`distinctSessions` is now printed on every line, so the reader can see the probe's power rather than
take it on trust, and `anyChecked` no longer counts an inconclusive query — three inconclusive
queries now print `UNVERIFIED`, not silence.

## How to verify

- `npx tsx --env-file=.env qa/probes/rank-probe.mjs` → the three lines above, live against Mongo
- `git show 2873df4^:qa/evidence/live-rank-probe-2026-09-08.mjs` diffed against the file today →
  **only the added header**
- `pnpm lint:structure` → green (`lint-dirsize` OK with the new `qa/probes/`)

## Not done

- **The `{6,0,2}` mutation is not re-run in this unit.** It was measured in
  `vacuous-evidence-probes` and nothing in this unit touches `search-store.ts`; re-running it would
  re-report someone else's measurement as this unit's. The checker is welcome to re-derive it.
- **Citations in checker-owned verdicts are untouched**, by rule. They now resolve to the restored
  original, which is the correct target for them.

## Live browser evidence

`Not UI-touching — no surface changed.` Changed paths: `qa/probes/rank-probe.mjs`,
`qa/evidence/live-rank-probe-2026-09-08.mjs`, `qa/manifests/*`. `qa/**` is listed under
`genuinely_not_user_facing` in `qa/ui-surfaces.json`.

## Status: ready-for-check
