# Verdict — speaker-resolution-deterministic

**Date:** 2026-09-08
**Mode:** A (event-driven unit check)
**Bound root:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`, commit `1983c82`)
**Contract:** `qa/contracts/speaker-resolution-deterministic.md` — **authored by this checker in
this cycle**, from the manifest's proposed criteria, plus three checker-added criteria (C9, C10, I4).
**Cycle checked:** 1

```
VERDICT: PASS
SCOREBOARD: 10/10 criteria met, 4/4 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
```

## What I re-ran myself (nothing below is the maker's pasted output)

| Command | My result |
|---|---|
| `pnpm --filter '@lkb/index' test` | `tests 67 · pass 67 · fail 0` — matches the claim (59 pre-existing + 8 new) |
| `pnpm -r typecheck` | exit 0, 10 projects, `apps/api typecheck: Done` |
| `pnpm lint:structure` | lint-loc/dirsize/root/dupes/migrations OK · `snapshot --check` OK (113 lines) · tracker-audit OK (gate G1) · depcruise **0 violations** (269 modules, 811 dependencies) |

Working tree was clean before and after; `git show --stat 1983c82` touches only
`packages/index/src/{index.ts,pipeline/speakers.ts,pipeline/speakers.test.ts}` plus this unit's
manifest → **I2 holds**.

## Independent verification of the two load-bearing factual claims

**Claim 1 — the Juben/Jubin discrepancy is real.** Re-derived from the data, not the manifest,
for `data/toc-migrated/2026-08-24-uniaccess-leeds-arts-university`:

```
session_page.json contains "Juben Thakur": true
turn text (51,411 chars — the manifest's figure, exact):
   contains "Juben":   false
   contains "Thakur":  false
   contains "Jubin":   true
   contains "Thakkar": true
   contains "Jubin Thakkar": true
speakerRefs present: spk:0, spk:1, spk:2, spk:3   ("Jubin" appears in NO non-text field)
```

Confirmed in full. The summarizer did normalise a real person's name, and the decision to refuse
`session_page.json` as an identity source is justified by evidence, not by caution. This is the
strongest thing in the unit: the verbatim rule was derived from a defect it actually caught.

**Claim 2 — the 15.8% yield.** I wrote my own harness against the real `resolveSpeakers` export
and ran it over all of `data/toc-migrated/*/turns.json`:

```
2026-04-21-visa-blueprint-part2-italy-france-nz    41/196 turns  unresolved-labels=2
2026-08-24-uniaccess-leeds-arts-university         37/102 turns  unresolved-labels=3

sessions with positional labels: 11
resolved 78/494 positional turns (15.8%)
speakers identified: 2
   Ruby           spk:2  1 evidence turn  person:ruby
   Jubin Thakkar  spk:0  1 evidence turn  person:jubin-thakkar
```

Reproduces the manifest **exactly** — 78/494, 15.8%, 2 speakers, 11 sessions, and the spoken
spelling "Jubin Thakkar" rather than the summary's "Juben Thakur". The same harness asserted, over
every resolved speaker in the real corpus, that each cited `turnId` exists in the input, that each
`sessionId` matches its turn's own, and that `displayName` is a verbatim substring of every cited
turn's text. No violation. → **C2, C3, C10 evidenced on real data, not only fixtures.**

## Mutation testing (as requested)

**(a) Remove the `byName.size !== 1` guard (line 97).** Result: `pass 66 · fail 1`, and the
failure is precisely

```
✖ a label that contradicts itself is left unresolved, not arbitrarily picked
```

C7 is genuinely load-bearing and genuinely covered. Without the guard the module silently takes
`[...byName.entries()][0]` — a coin-flip identity decided by insertion order. → **C7 met.**

**(b) Remove the `(t.text ?? "").includes(name)` verbatim check (line 85).** Result: `pass 67 ·
fail 0` — **nothing reddens.** But the maker's hypothesis that the line is therefore redundant is
**wrong**, and I can demonstrate it. The regex separator between the two name capture groups is
`\s+` (any whitespace run), while the name is reassembled with `join(" ")` — a single space. Any
self-introduction whose two name tokens are separated by a newline, a tab, or two spaces produces
a `displayName` that does **not** occur verbatim in the turn being cited. Probed directly against
both variants:

```
                 GUARD REMOVED                             GUARD PRESENT
double space  -> resolved=1 "Jubin Thakkar" verbatim=FALSE    resolved=0
newline sep   -> resolved=1 "Jubin Thakkar" verbatim=FALSE    resolved=0
tab sep       -> resolved=1 "Jubin Thakkar" verbatim=FALSE    resolved=0
```

So that line is the **only** thing standing between this module and a C2 violation on
whitespace-normalised transcript text — exactly the class of defect the rule exists to stop, and
plausible in real diarization output where a turn can wrap across lines. It is not belt-and-braces;
it is the belt. Keep it. **The artifact is correct as committed** — this is a strength, not a
finding, so no issue is filed. The only gap is that no *test* pins it (see note 1).

`packages/index/src/pipeline/speakers.ts` was restored from a pre-mutation copy; `git status
--porcelain` and `git diff --stat` were both empty before the final verification run, which was
re-run green on the restored tree.

## Criterion-by-criterion

| # | Verdict | Evidence |
|---|---|---|
| C1 | met | test 1; and on the real corpus spk:0 → "Jubin Thakkar", spk:2 → "Ruby" |
| C2 | met | test 2; my corpus-wide verbatim audit (0 violations); mutation (b) proves the guard is load-bearing |
| C3 | met | corpus audit — every `turnId` exists, every `sessionId` matches its own turn; dedup pinned by the `!cites.some(...)` guard + the "collects every turn … deduped and ordered" test |
| C4 | met | `personIdFor` → `person:jubin-thakkar`, `person:ruby`; asserted in test 1 |
| C5 | met | test 3 — `I'm going to…`, `I am really excited…`, `This is our Blenheim Walk Campus` all resolve nothing |
| C6 | met | test 4 — "Prasanti, what comes to your mind…" resolves nothing, both labels reported unresolved |
| C7 | met | test 5 **+ mutation (a) reddens exactly that test** |
| C8 | met | test 6; the `POSITIONAL` filter is applied before anything else |
| C9 | met | `unresolved` is a required field of `SpeakerResolution`, populated from labels minus resolved, sorted; asserted in tests 4/5/6/8 |
| C10 | met | reproduced exactly — 78/494 (15.8%), 2 speakers (see Claim 2) |
| I1 | holds | the file's only import is `import type { Turns }` — type-only. Grep for `require(`/`fetch`/`fs.`/`http`/`process.`/`Date.now`/`Math.random` returns nothing |
| I2 | holds | `git show --stat 1983c82` — 4 files, all in `packages/index/src/` + this unit's manifest |
| I3 | holds | 67/67 pass; the 59 pre-existing tests are unchanged and green |
| I4 | holds | no write path exists in the module at all (I1's grep is also I4's proof) |

## Notes (observations, not ledger findings)

1. **The verbatim guard is untested.** Mutation (b) survives the suite. The behaviour is correct;
   the *coverage* is not. A one-line test — `"My name is Jubin  Thakkar."` (two spaces) asserting
   `resolved` is empty — would pin the module's single most important rule. Recommended for the
   next unit; not filed as an issue because no contract criterion is currently unmet.
2. **`SELF_NAMING` is a module-level `/g` regex** with `lastIndex` reset before each use. Correct
   under I1's synchronous purity, and safe today; it would stop being safe if this module ever
   became re-entrant. Worth a comment, nothing more.
3. **The five disclosed gaps are disclosed and in scope of nothing here.** 84% unresolved, no
   persistence, "Ruby" as a weak single-first-name identity, no `org`/`role`, English-only
   patterns — all are properties of a deliberately deterministic floor, all are named in the
   manifest before being asked about, and the contract's "Out of scope" section now records them
   as such. None is a defect of this unit. Gap 2 in particular (nothing persisted) is exactly
   right: it keeps the data-mutating step in its own separately-checked unit.
4. **Catalogue B3/B10 do not flip on this unit** and the manifest correctly refuses to claim they
   do. Whoever reads the goal tracker should expect `speakers` to remain empty until the apply
   unit lands.

## Assessment

This unit does the rare thing: it measured the ceiling *before* writing the code, published the
unflattering number (15.8%), and refused the shortcut that would have inflated it. The one claim
that could have been rhetorical — the Juben/Jubin defect — is real and I reproduced it character
for character. The maker asked to be told if the 15.8% or the verbatim guarantee did not hold;
both hold, and the guard it offered to delete turns out to be the thing holding the second one up.
