# Verdict — golden-set-pin-criterion

**Date:** 2026-09-08
**Contract:** qa/contracts/golden-set-recall.md
**Gate:** qa/gates/golden-set-redesign.md (ANSWERED, Option C)
**Manifest:** qa/manifests/golden-set-pin-criterion.md
**Cycle checked: 1**
**Mode:** A (unit check), bound to `D:\KnowledgeBase`
**Commit under check:** `6055634`

```
VERDICT: FAIL
SCOREBOARD: 6/8 checked claims met, 1/2 invariants hold
FAILURES:
- [prov] sev: high · data/eval/golden-set-provenance.json — the two fields whose entire purpose is
  honesty still describe the DELETED criterion: `postFilter` says "unique to its own session within
  the SCORED corpus (session_page summary+keyInsights)" and `postFilterBiasWarning` asserts the
  recall is "a DOWNWARD-BIASED FLOOR, not an unbiased estimate". The code now computes uniqueness
  over the TURNS corpus and this run rejected 0 of 92, so both statements are false, and they are
  copied verbatim into data/eval/recall-report.json → goldenSetProvenance, the artifact the gate
  reads. This is ISS-091 recurring inside the file that fixed it. · fix: update the two strings in
  scripts/lib/golden-set-build.mjs writeProvenance() (:56-61) to state the turns-corpus criterion
  plus the page-presence condition, replace the floor warning with what filterBias now measures,
  re-run `--provenance-only` and `eval-recall.mjs`. · issue: ISS-094
- [split] sev: high · the file split broke the GENERATION path. scripts/gen-golden-set.mjs:43 now
  imports only `tokenize` from the diagnostics module — the previous `verbatimOverlap` import was
  dropped — while line 192 still calls `verbatimOverlap(q, turnsText.get(id))` inside main()'s
  non-dry-run loop. No other binding of that name exists in the file (grep: one hit, line 192), so
  a real `node scripts/gen-golden-set.mjs` run throws ReferenceError after the first paid API call.
  The manifest's "all three CLI paths re-run" is true and is exactly why this was missed: the
  fourth path — plain generation, the only one that costs money — was not among them. · fix: add
  `verbatimOverlap` back to the import at :43 (or move the loop's filter into golden-set-build.mjs
  beside refilter()'s identical predicate). · issue: ISS-095
ISSUES-WRITTEN: ISS-094, ISS-095
EXPLANATION: The unit's central claim is TRUE and I reproduced it independently — the page corpus
is ~3.4k tokens vs ~225k for turns, all seven named ordinary words are page-unique and none are
turns-unique, `flywire` is unique in both, and the pin vocabulary is 159 tokens. The refilter,
recall, control, verdict and filterBias numbers all reproduce exactly, gate condition 2 still
holds, and no question text changed. But the shipped provenance record still asserts the old
criterion and the old bias warning, so the artifact a reader consults contradicts the fix; and the
split silently broke the generation path. Both are defects in this unit's own deliverables, so the
manifest cannot flip to checked-PASS. ISS-093 stays open until the report describes the criterion
it actually applies.
```

## What I re-ran (evidence I produced myself, not read)

**1. Root cause — reproduced, holds.**

```
turns words 224779 | page words 3420 | sessions 23/23
should  pageUnique true  turnsUnique false
will    pageUnique true  turnsUnique false
you     pageUnique true  turnsUnique false
people  pageUnique true  turnsUnique false
paths   pageUnique true  turnsUnique false
skills  pageUnique true  turnsUnique false
living  pageUnique true  turnsUnique false
flywire pageUnique true  turnsUnique true
pin tokens 159 | turns-unique total 3910 | page-unique total 921
```

My token counts (224,779 / 3,420) differ slightly from the manifest's word counts (217,980 /
3,099) — different counting, same ~66× ratio and same conclusion. Not a finding. The single fact
this unit rests on is correct: at 3.4k tokens across 23 documents, ordinary words are "unique" by
sampling accident. The `921 → 159` reduction reproduces exactly.

**2. Attacked the 0-rejection result.** I built seven plausible questions that SHOULD be pinned and
ran the live predicate. Five were rejected on the right token:

```
REJECT(flywire)     How do I pay my tuition through Flywire?
REJECT(80e)         Can I claim the 80E deduction on an education loan?
REJECT(cura)        What does cura personalis mean at this university?
REJECT(cincinnati)  Is the campus in Cincinnati safe for international students?
REJECT(fema)        What is the FEMA limit set by the RBI on remittances?
```

The two that passed (`apostille`/`hrd`, `shagun`) passed because I had mis-assigned the target
session — those tokens ARE in the pin map, just pinned to a different session. That is the filter
behaving correctly, not missing: a rare token is only a shortcut for the session it is unique to.
The filter is alive and fires on rare brands, acronyms, place names, statute numbers and Latin
phrases. **I could not build a plausible pinned question this filter misses.** The maker's
synthetic-`shagun` check was the easy case; this is the hard one and it survives.

**3. The inverse (second condition letting pinning questions through) — checked, and the condition
is right.** 3,751 of the 3,910 turns-unique tokens are dropped for not appearing in the target's
page text. That is not a leak: `createHeuristicRetriever` (packages/index/src/eval/
heuristic-retriever.ts:36-45) scores only against `node.summary`, so a token absent from the page
surface cannot influence ranking at all and is not a shortcut. If anything the condition is
slightly LOOSER than the retriever's real surface — pageText is `summary + keyInsights` while the
retriever reads `summary` alone — which over-rejects in the conservative direction. Correct as
built.

**4. Is 159 the right size?** Sampled the first 60. Roughly two-thirds are genuinely rare
identifying entities — `shagun handa italia hrd sdm apostille flywire fema rbi 80e xavier
cincinnati jesuit cura personalis nih babson makrand rajadhyaksha msme ugdx bkc isdi isme frr`.
The remaining third are ordinary words that happen to occur in one of only 23 transcripts:
`capped permit stamp dev penalty repayment currency spouse ii markup deduction chaos emotion
nostalgia decode examine unearth grant accolades flagship copyright 48 700`. So the criterion is
much better but not clean — 23 sessions is still a small corpus for a pure uniqueness test, and an
IDF or stopword-aware test would tighten it. This costs nothing on this run (0 rejections) and
errs toward keeping questions, so it is not a failure. The maker correctly did not claim 159 is
optimal. Not filed. **Open question for the condition-4 unit:** unigram pinning cannot catch a
rare multi-word entity whose parts are individually common — pre-existing, not introduced here.

**5. Numbers — all reproduce.**

```
node scripts/gen-golden-set.mjs --refilter
  refiltered 92 candidate(s): 92 kept, 0 rejected, 23/23 sessions covered
node scripts/eval-recall.mjs
  recallAtK 0.391304347826087 (36/92) | control 0.217 (20) | lift +0.174 | verdict "informative"
  saturated false | 56 misses
  filterBias.note "0 candidates rejected, so the kept set IS the candidate set and the filter
                   introduces no selection bias on this run — kept === combined by construction"
  filterBias kept 0.3913 (n=92) / rejected null (n=0) / combined 0.3913 (n=92)
```

`filterBias` is an object with a real note, not `null` — as claimed. Gate condition 2 holds:
0.391 is strictly inside (0.217, 1.000) with 56 non-zero misses, so no Option B escalation.

**6. No question text changed — confirmed.** `git diff 6055634~1 6055634 -- data/eval/golden-set.json`
has **zero** removed content lines (`grep -c '^-  '` → 0) and +85 added lines = 17 new questions ×
5 lines. Pure addition, 75 → 92, no ids renumbered, no wording edited. The previous checker's human
read of the sampled questions still applies.

**7. The file split.** It is a move: `writeProvenance`, `loadCorpora` and the corpus loader
transplant verbatim (diff of `6055634 -- scripts/gen-golden-set.mjs` shows them deleted unchanged
and reappearing in the new lib), with exactly one behavioural change — `globallyUniqueTokens(pageText)`
→ `buildPinTokens(turnsText, pageText)` — which is the fix itself. `node scripts/lint-loc.mjs` →
`OK (249 file(s) within budget)`, so the 300-LOC budget claim holds (224 / 173 / 118). Three CLI
paths re-run by me: `--dry-run` exit 0 with neighbour output, `--provenance-only` exit 0,
`--refilter` exit 0. **The fourth path — plain generation — is broken (ISS-095).**

Keeping `golden-set-build.mjs` separate from `golden-set-diagnostics.mjs` is right, and I checked
the argument rather than accepting it: `diagnose()` builds `globallyUniqueTokens(textBySession)`
over whichever corpus it is handed, while the filter requires turns-unique AND page-present.
Merging them would let one function define both what ships and what the measurement reports — the
ISS-092 tautology. The 10.9% / 0-rejection gap the maker discloses is the visible signature of
that intended difference, not an inconsistency.

**8. Condition 4 is NOT claimed unblocked — confirmed.** The manifest's "What this unit does NOT
do" states plainly that sibling-session ambiguity (~4 of 12 sampled questions answerable by several
`uniaccess-*` sessions) is untouched and still blocks, and that T-021 is not closed. The gate file
was not modified by this commit (`git diff --stat` for `6055634` lists no `qa/gates/` path), so
nothing on disk claims condition 4 is satisfied. Correct.

## Why this is a FAIL and not a PASS with notes

The unit's thesis is right and well-evidenced, and I want to be explicit that I could not break the
central measurement. But the deliverable a future reader consults — `recall-report.json` — now says,
in the same document, that recall is 0.391 with `rejected: 0` AND that the pin check "runs over the
same corpus the retriever scores" producing "a DOWNWARD-BIASED FLOOR". One of those is a lie about
the code as shipped. That is the precise failure ISS-091 was filed for, in the function that was
written to make it impossible, and it propagates into the artifact the gate's condition 4 will be
judged against. A one-line string fix closes it; a fix cycle here is cheap and the alternative is
publishing a false provenance record into a gate decision.

## Ledger

- **ISS-093** — the code half is **verifiably fixed** (criterion now turns-corpus based, 921 → 159,
  re-derived above). Status stays **open** because the shipped provenance still asserts the criterion
  this issue names; it closes when ISS-094 does. It remains BINDING on gate condition 4, alongside
  the untouched sibling-session ambiguity.
- **ISS-094** (high, new) — provenance record describes the deleted criterion.
- **ISS-095** (high, new) — `verbatimOverlap` unbound in the generation path.
