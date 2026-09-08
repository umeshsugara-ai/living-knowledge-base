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

---

# Verdict — golden-set-pin-criterion (cycle 2)

**Date:** 2026-09-08
**Cycle checked: 2**
**Mode:** A (unit check), bound to `D:\KnowledgeBase`
**Commit under check:** `67527fa`

```
VERDICT: PASS
SCOREBOARD: 8/8 checked claims met, 2/2 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: Both cycle-1 failures are fixed, and I proved each one myself rather than reading
the proof. ISS-095: I armed gen-golden-set.mjs via mutate.mjs, reintroduced an unbound reference
inside the generation loop, and got a ReferenceError at gen-golden-set.mjs:199 from `--self-test`
while `--dry-run` stayed green and blind — the contrast the unit claims — then restored to an empty
diff. The structural claim also holds: `judgeCandidate` is the only filter decision in the repo
(one `pinned by rare token` string, one `MAX_OVERLAP`, one `verbatimOverlap` call site outside the
diagnostics module) and both the generation loop (:199) and `refilter` (golden-set-build.mjs:172)
call it. ISS-094: provenance is genuinely DERIVED — I changed `PIN_CORPUS`, re-ran
`--provenance-only`, and `postFilter` followed the constant verbatim; `postFilterBiasWarning` is a
real branch on `rejectedCount` (I exercised both arms). The `restore` guard is real: on a tracked
file with uncommitted edits that was never armed, `restore` refused with exit 1 and left the file
SHA256-identical. Numbers reproduce exactly and no question text changed. ISS-093 closes; gate
condition 4 remains blocked by the untouched sibling-session ambiguity, and the manifest says so.
```

## What I re-ran (my own evidence)

**1. ISS-095 — mutation proof replayed, not accepted.**

```
node scripts/lib/mutate.mjs apply scripts/gen-golden-set.mjs   -> MUTATION ARMED
(inserted `const __x = checkerUnboundProbe(q);` above the judgeCandidate call, inside the loop)

node scripts/gen-golden-set.mjs --self-test
  ReferenceError: checkerUnboundProbe is not defined
      at main (file:///D:/KnowledgeBase/scripts/gen-golden-set.mjs:199:19)

node scripts/gen-golden-set.mjs --dry-run
  ...neighbours printed for all 23 sessions, exit 0 — GREEN AND BLIND

node scripts/lib/mutate.mjs restore scripts/gen-golden-set.mjs -> RESTORED (verified identical to HEAD)
git diff --name-only -- scripts/gen-golden-set.mjs             -> (empty)
```

The claim is demonstrated, not asserted. The self-test genuinely executes the loop body that
cycle 1's defect lived in.

**2. One predicate, not two — confirmed by search, not by reading the diff.**
`grep -rn "verbatimOverlap|globallyUniqueTokens|MAX_OVERLAP|pinned by rare"` over `scripts/` and
`packages/` returns the predicate exactly once (`golden-set-build.mjs:36-42`); the only other
`verbatimOverlap` call sites are inside `golden-set-diagnostics.mjs`'s own `diagnose()`, which is
the measurement and is meant to differ. `gen-golden-set.mjs:199` and `refilter()` at
`golden-set-build.mjs:172` both call `judgeCandidate`. There is no second copy to diverge.

**3. Is `--self-test` real coverage, or theatre? Partly theatre, and the residue is small.**
It substitutes a stub `{ complete: async () => ... }`, so it does NOT cover: `new GeminiProvider(...)`
construction and its config, the parse of a real Gemini response (the stub returns a clean JSON
array, so `parseQuestions`'s fence/garbage handling is exercised only on the happy case), and the
two `writeFileSync` calls plus the non-`afterTheFact` `writeProvenance(..., false)` at :220-224 —
the only lines still unique to the paid path. Those writes are structurally covered elsewhere
(`--refilter` writes both files; `--provenance-only` writes the record), so the residual
paid-path-only surface is provider construction and real-response parsing. That is a genuinely
smaller class than "the entire loop was never run", which is what cycle 1 found. I would not call
the untested-path class closed — I would call it reduced to its irreducible remainder. Not a
failure; the manifest's own wording ("runs the REAL generation loop against a stub provider") is
accurate about what it does.

**4. ISS-094 — provenance is derived, verified by changing the source of truth.**

```
(armed golden-set-build.mjs, set PIN_CORPUS = "CHECKER-PROBE-CORPUS-XYZ")
node scripts/gen-golden-set.mjs --provenance-only
  postFilter: "...unique to its own session in the CHECKER-PROBE-CORPUS-XYZ corpus AND present
               in that session's page text, or overlapping the transcript past 0.5"
```

It follows the constant. Then both arms of the bias branch, exercised for real:

```
rejectedCount = 0 -> "no candidate was rejected, so the kept set IS the candidate set and the
                      filter introduces no selection bias on this run"
rejectedCount = 3 -> "3 candidate(s) rejected. ... the resulting recall is a DOWNWARD-BIASED
                      FLOOR. eval-recall.mjs measures the size of that bias."
```

Not a constant, a branch. Restored; `mutate.mjs assert-clean` -> `MUTATIONS CLEAN: none outstanding`.
The shipped `recall-report.json.goldenSetProvenance` carries the corrected strings.

**5. The `restore` guard — verified independently on a real dirty file.**

```
(appended a sentinel line to a tracked, never-armed file)
node scripts/lib/mutate.mjs restore <that file>
  MUTATE REFUSED: ... is not armed. 'restore' runs 'git checkout -- <path>' and would DISCARD
  any uncommitted changes. ...
  exit 1
sha256 before = b5dcbd50...efa96
sha256 after  = b5dcbd50...efa96   BYTE-IDENTICAL: yes   (sentinel line still present)
```

The fix holds: refuses AND leaves the file byte-identical. Test `(f)` exists at
`scripts/lib/mutate.test.mjs:117` and asserts the same property; `node --test scripts/lib/*.test.mjs`
-> 17/17 pass (my run).

**One residual sharp edge, reported as a question, not a failure.** `restore a b` where `a` is
armed and `b` is not: `a` is checked out, then `fail(b)` exits before `writeLedger`, so `a`'s
ledger row survives a successful restore. The consequence is fail-safe — `assert-clean` then
reports an outstanding mutation and blocks the commit until `restore a` is re-run — so no work can
be lost by it, and I am not filing it. Worth a one-line fix (write the ledger as rows are cleared)
if the file is touched again.

**6. Numbers — reproduced exactly.**

```
node scripts/gen-golden-set.mjs --refilter
  refiltered 92 candidate(s): 92 kept, 0 rejected, 23/23 sessions covered
node scripts/eval-recall.mjs
  recallAtK 0.391304347826087 (36/92) | control 0.21739130434782608 | lift +0.1739
  verdict "informative" | saturated false | 56 misses
  filterBias kept 0.3913 (n=92) / rejected null (n=0) / combined 0.3913 (n=92)
```

Gate condition 2 holds — 0.391 strictly inside (0.217, 1.000) with 56 non-zero misses, no Option B
escalation. No question text changed: after my own `--refilter`, `git diff` on
`data/eval/golden-set.json` is empty against HEAD, and `git diff 6055634 67527fa` touches that file
not at all — cycle 2 changed code and prose only. `pnpm --filter @lkb/api test` 109/109,
`pnpm lint:structure` clean (SNAPSHOT fresh, tracker-audit OK, depcruise 0 violations / 269 modules).

**7. Condition 4 is NOT claimed unblocked — confirmed on disk.** The manifest still states
plainly (lines 89-91, 227) that sibling-session ambiguity is untouched and still blocks, and that
T-021 is not closed. `git diff 731b51a 67527fa --name-only -- qa/gates/` is empty: the gate file was
not touched by this commit. Nothing anywhere claims the precondition is satisfied. Correct.

**8. Cosmetic residue, explicitly not a finding.** ISS-095's fix_direction also suggested pruning
now-dead symbols; `readdirSync` (imported, unused) and `DATA_DIR` (declared, unused) remain in
`gen-golden-set.mjs`. `MAX_OVERLAP` and the other dead `node:fs` names are gone. Lint passes and the
contract's out-of-scope rule says no churn on cosmetics. Noted for the next edit, not charged.

## Ledger

- **ISS-093** — fixed. The code half was already verified in cycle 1; the shipped provenance now
  describes the criterion the code actually applies, which was the only thing holding it open. It
  is no longer a precondition on gate condition 4. Condition 4 remains blocked by the other,
  untouched precondition: sibling-session ambiguity across the seven `uniaccess-*` sessions.
- **ISS-094** — fixed (provenance derived from `PIN_CORPUS`; bias warning branches on
  `rejectedCount`; both arms exercised by me).
- **ISS-095** — fixed (single `judgeCandidate` predicate shared by both paths; `--self-test`
  exercises the loop and reddens under an injected unbound reference).
