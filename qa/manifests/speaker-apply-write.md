# Manifest — speaker-apply-write

**Contract:** none yet — first unit for the U2.4 **apply step**. Checker: please author
`qa/contracts/speaker-apply-write.md`. This is the unit the previous four deferred their blocking
items to.
**Goal task:** U2.4 / catalogue **B3** + **B10**.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none directly. Carries the deferred items listed below.
**Status:** ready-for-check
**Branch:** `lane/a-speakers`

## Why this unit is different in kind

Everything upstream could only **refuse** to name someone. This one **writes identities down**, so
its failure mode changes: it can assert that two different human beings are the same person.

The `speakers` collection has been empty since the schema was created, which is exactly why
catalogue B3 and B10 score MISSING — the probe is literally `collection speakers (empty)`.

## What changed

| File | Change |
|---|---|
| `packages/index/src/pipeline/speaker-docs.ts` | **new** — `buildSpeakerDocs()`, pure, no Mongo. |
| `packages/index/src/pipeline/speaker-docs.test.ts` | **new** — 9 tests, written first. |
| `scripts/sync-speakers.mjs` | **new** — the entrypoint. `--dry-run` never connects. |
| `structure.config.json` | `dirsize.overrides` set to scripts 31; `maxFiles` stays **30**. |
| `scripts/lint-dirsize.mjs` | consults the override, defaults to `maxFiles`. |
| `scripts/lint.test.mjs` | +1 test proving the override is **scoped**. |
| `packages/index/src/index.ts` | +1 re-export. |

## The identity rule: merge, but never silently

`personId` derives from the spoken name, so two people legitimately called Ruby in different
sessions collide. No upstream pattern work fixes that — it is an identity question, not a text one.

- **Same session, same name → one person.** Diarization splitting one voice across `spk:N` labels is
  the common case; treating those as two people would be the worse error.
- **Different sessions, same name → merged, but recorded as a COLLISION** and the document's
  confidence drops from 0.9 to 0.6. Collisions come back *alongside* the docs, so a caller cannot
  report a clean write over an ambiguous one. On a live run they **block** the write unless
  `--allow-collisions` is passed.

It deliberately does **not** invent a disambiguator: fabricating a distinction is as wrong as
fabricating an identity, and nothing in the corpus settles it.

## A governance correction inside this unit

D-016 authorized raising the `scripts` budget 30 to 31. **That entry was factually wrong** and was
never executed: `structure.config.json` has no per-directory budget, only one global
`dirsize.maxFiles` that `lint-dirsize` applies to *every* directory under *every* root. Executing it
would have relaxed `packages/`, `apps/`, `workers/` and `schema/` too — a repo-wide loosening
authorized by an entry that described a one-directory change.

Caught while implementing it, before any edit landed. **D-017 supersedes D-016** and authorizes a
scoped `overrides` map instead. `maxFiles` stays 30; only `scripts` is named; a test proves an
unlisted sibling still fails at the global cap.

## Evidence

```
$ node scripts/sync-speakers.mjs --dry-run
sessions scanned: 23
positional turns: 494; attributable by deterministic resolution: 78 (15.8%)
speaker documents to write: 2
  person:jubin-thakkar  aliases=["Jubin Thakkar"]  confidence=0.9  evidence=1 turn(s)
  person:ruby           aliases=["Ruby"]           confidence=0.9  evidence=1 turn(s)
no cross-session collisions
No Mongo connection attempted (--dry-run).

$ pnpm --filter '@lkb/index' test   tests 174   pass 174   fail 0   (165 + 9 new)
$ node --test scripts/lint.test.mjs tests 11    pass 11    fail 0   (10 + 1 new)
$ pnpm -r typecheck                 exit 0
$ pnpm lint:structure               all green; lint-dirsize OK (75 dirs); depcruise 277 modules / 0 violations
```

## Known gaps — stated, not hidden

1. **DETERMINISTIC ONLY, deliberately.** The script calls `resolveSpeakers`, never
   `extractSpeakers` — no provider is contacted and no model output is written. It caps at the
   measured **78/494 turns (15.8%) and two speakers**. The LLM path exists and is checker-PASSed,
   but wiring it here would write model-proposed human names into the knowledge base, and that
   deserves its own approval rather than arriving as a side effect.
2. **No live write has been performed.** Only `--dry-run` has run. The live write is the separately
   approved step, exactly as `sync-real-turns.mjs` treats its own.
3. **B3/B10 have NOT flipped** and will not until a live write happens. Even then I expect
   **B10 to need a human downgrade to PARTIAL**: it is Speaker Intelligence *profiles*, and no
   `org`, `role` or profile of any kind is extracted — only identity, aliases, evidence and
   confidence. Letting an empty-collection probe flip B10 would repeat the C2/C3 over-credit.
4. **`turns.speakerRef` is not rewritten.** Turns keep their `spk:N` labels; the speaker documents
   carry the mapping. Rewriting 78 turns in place is a data migration and belongs in its own unit.
5. **Carried from earlier units, still open:** three gazetteer residues (India, Mumbai, Google);
   ISS-099 (the discriminator is an enlarged allowlist, not the noun test I described); ISS-101 (a
   nominal pin); and `person:j` from a J. Smith style introduction.

## Note to the checker

Two things I most want challenged. **First**, the merge rule: I chose to merge same-named speakers
across sessions and lower confidence, rather than keep them separate. The opposite choice is
defensible and I may have it backwards — if merging is the worse error, FAIL it and say so.
**Second**, the D-016/D-017 correction: judge whether the scoped override is genuinely better than
consolidation, or whether I should have consolidated the scripts and taken no budget change at all.
`ISSUES-WRITTEN: none` is creditable.
