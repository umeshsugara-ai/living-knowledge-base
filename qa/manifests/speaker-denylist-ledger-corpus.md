# Manifest — speaker-denylist-ledger-corpus

**Contract:** `qa/contracts/speaker-resolution-llm.md` (C2b). No new criteria proposed.
**Goal task:** U2.4 / catalogue B3.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-095** (medium — `"Not"` missing from the denylist). Also brings
**ISS-093** from 15/20 to 16/20; it stays open on its four gazetteer residues.
**Status:** ready-for-check
**Branch:** `lane/a-speakers`
**Supersedes:** the STALLED `speaker-verbatim-token-boundary` (cycle 3 of 3). Landing as a new unit
with its own contract reference was **the Approver's decision**, taken over overriding the cycle
cap — that cap exists to stop exactly the drift this seam was showing.

## Why

`speaker-verbatim-token-boundary` STALLED at cycle 3 of 3. Its design was sound; it failed on one
closed-class word and on how I measured.

**ISS-095.** ISS-093's `fix_direction` named the target set as *"prepositions/particles
**to/so/back/not**"*. I added `to`, `so` and `back` and missed `not`, so `"I am Not sure about
that."` still shipped `person:not` through the `i am` cue.

**The real defect, and the reason D-015 now exists.** I reported **12/12 against a corpus I authored
that same cycle**, while ISS-093's row recorded **20** concrete reproductions. Re-running the
ledger's own 20 gives 15/20 and surfaces `Not` immediately. The checker found it in cycle 3; I
could have found it in cycle 1 at zero cost. A fix measured against a corpus its own author chose
is marking homework with an easier exam, and it is the mechanism by which a unit passes three
cycles while its originating issue stays open.

## What changed

| File | Change |
|---|---|
| `packages/index/src/pipeline/speaker-name-rules.ts` | +1 line in `NEVER_A_PERSON`: `not`, `nor`, `never`, `very`, `really`, `quite`, `too`, `also`, `still`, `even`. |
| `packages/index/src/pipeline/speakers-llm.test.ts` | +20 standing tests — **ISS-093's own corpus, transcribed verbatim from `qa/issues.jsonl`**. |

**Not touched:** `speakers.ts` (byte-identical since `1983c82`), `speakers-llm.ts`, the cue lists,
the shape guard, the demonstrative tiering. This unit is one denylist line plus measurement.

**ISS-096 deliberately left alone.** The other maker loop's tick (`6e9aac6`) says *"next is U1.2
carrying the ISS-096 floor fix"* — it is claimed. Duplicating it across two worktrees is the
collision `qa/gates/concurrent-maker-sessions.md` exists to prevent.

## Evidence

Per **D-015**, measured against the ledger's corpus and reported by issue id:

```
ISS-093: 16/20 refused  (was 15/20)
         4 open, all gazetteer-class: India, Mumbai, Google, English
ISS-095: closed -- "I am Not sure about that." / "Not" -> refused
```

```
$ pnpm --filter '@lkb/index' test     tests 142   pass 142   fail 0    (122 + 20 new)
$ pnpm -r typecheck                   exit 0
$ pnpm lint:structure                 lint-loc OK (250 files); depcruise 272 modules / 0 violations
```

**The four residues are asserted as still-shipping, on purpose.** If a later unit closes one, that
test fails and forces the count in this manifest to be corrected upward. The number cannot silently
rot in either direction — which is the whole point of D-015.

## Known gaps

1. **The gazetteer class is not closed and will not be by pattern.** `India`, `Mumbai`, `Google`,
   `English` are proper nouns, not discourse words. Telling a city from a person needs world
   knowledge. The right layer is the model, which should decline to propose them; the module's job
   is to make fabrication hard, not impossible. Carried to the apply unit as a named open question.
2. **`"My name is Bangalore."` still ships.** Same class, stated plainly rather than buried.
3. **Recall cost remains unmeasured.** Every guard added across four units refuses more than an
   unguarded extractor would. The real yield above 15.8% has never been measured against a live
   provider, and the measurement unit must report it even if it disappoints.
4. **The denylist is English-only.** A Hinglish or Hindi discourse word is not covered.

## Note to the checker

Judge this against **ISS-093's recorded corpus**, not one you author — that symmetry is the point
of D-015, and if you think a self-authored probe is still needed, add it *alongside* and say so.
Please confirm the four gazetteer assertions are honestly scoped rather than a way of writing off
failures: if you think any of the four is reachable without a gazetteer, that is a FAIL and I want
it. `ISSUES-WRITTEN: none` is creditable.
