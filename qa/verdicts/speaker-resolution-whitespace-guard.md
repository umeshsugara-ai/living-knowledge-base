# Verdict — speaker-resolution-whitespace-guard

**Date:** 2026-09-08
**Cycle checked:** 1
**Contract:** `qa/contracts/speaker-resolution-deterministic.md`
**Manifest:** `qa/manifests/speaker-resolution-whitespace-guard.md` (Status: ready-for-check, Fix cycle 1)
**Commit judged:** `6a3f715`
**Bound root:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`) — the main tree
`D:\KnowledgeBase` was not read or written; a live maker loop owns it.
**Mode:** A. Default (coding) adapter — no `qa/adapter.json` in this root.

```
VERDICT: PASS
SCOREBOARD: 10/10 criteria met, 4/4 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: Every claim in the manifest was re-derived, not accepted. The suite is 71/71;
speakers.ts is byte-identical to the cycle-1 PASSed version (`git diff 1983c82 6a3f715 --
packages/index/src/pipeline/speakers.ts` is empty and the commit touches only the test file and
the manifest); and my own mutation — deleting `speakers.ts:85` — reddens exactly the four new
tests and nothing else, restored byte-identically with a clean `git status` before the final run.
The C2 guard the cycle-1 check found unprotected is now genuinely pinned.
```

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/index' test` | `tests 71 · pass 71 · fail 0` |
| mutation: `sed -i '85d' packages/index/src/pipeline/speakers.ts` + suite | `tests 71 · pass 67 · fail 4` |
| restore from byte backup → `git diff --stat` / `git status --porcelain` | both empty |
| post-restore `pnpm --filter '@lkb/index' test` | `71/71` |
| `git diff 1983c82 6a3f715 -- packages/index/src/pipeline/speakers.ts` | empty |
| `git show --stat 6a3f715` | `speakers.test.ts (+44)`, manifest (+82). Nothing else. |
| `pnpm -r typecheck` | all 5 packages Done, exit 0 |
| `pnpm lint:structure` | lint-root OK · lint-dupes OK · lint-migrations OK · SNAPSHOT fresh · tracker-audit OK (G1) · depcruise 0 violations |

**The four that reddened, verbatim from my mutated run — exactly the four this unit adds:**

```
✖ refuses to resolve when the name is split by a double space
✖ refuses to resolve when the name is split by a newline
✖ refuses to resolve when the name is split by a tab
✖ every emitted name is verbatim in EVERY turn it cites, across whitespace variants
```

No test outside those four reddened. The maker's mutation block reproduces exactly.

## Criteria

C1–C8 and I1 were evidenced in the cycle-1 check of `speaker-resolution-deterministic` and are
re-evidenced here by the stronger fact that **the judged production code is byte-identical to the
version that carried that PASS** — verified by diff, not asserted. C9, C10 and I4 likewise cannot
have moved: no production line changed.

- **[C2]** — the criterion this unit exists to protect. Now **structurally** pinned, not pinned by
  inspection: removing the guard fails the suite. The fourth test is the load-bearing one, and it
  is not tautological — it recomputes verbatim-ness against the *input* turns rather than against
  the module's own output, and its closing
  `assert.deepEqual(resolved.map(r => r.speakerRef).sort(), ["spk:0","spk:2"])` keeps the test from
  passing vacuously on an empty `resolved`. A test that only looped would have been a real finding;
  this one isn't.
- **[I2]** — nothing outside `packages/index/src/` plus this unit's own qa/ paperwork was touched.
  Confirmed from `git show --stat`, not from the manifest's table.
- **[I3]** — the 67 pre-existing tests all pass, and all 67 stayed green under the mutation, which
  is the sharper statement: the new tests discriminate on something no previous test could see.

## On known-gap #2 — deferring the regex/join asymmetry

**Deferring is right, and I would have rejected doing it here.** Stated plainly, since asked:

1. It is a **behaviour change**. Capturing the raw matched span would make `My name is
   Jubin\nThakkar.` resolve where it currently refuses. That flips outputs on real corpus input
   and belongs behind its own verdict — exactly what the maker says.
2. The current behaviour is not a bug the contract wants fixed. The Out-of-scope section says
   "C2 outranks recall, always", and §10 prefers unresolved over guessed. Refusing a name it
   cannot cite verbatim is the contract's preferred outcome, not a degradation being tolerated.
3. Folding it in would have **destroyed this unit's best property** — that `speakers.ts` is
   byte-identical to a PASSed version, which is what let me certify C1–C10 by diff rather than by
   re-litigating the whole module. Mixing a test-only unit with a semantics change would have cost
   a cycle for no safety gain.

One thing for whoever writes that future unit (an observation, not a finding, and deliberately not
in the ledger): the proposed fix would emit a `displayName` containing a literal newline or tab.
That satisfies C2 as written — it is verbatim in the cited turn — but it would put raw whitespace
into a `person:` slug and into anything that renders a speaker name. The right shape is probably to
match the raw span *and* keep the refusal unless the normalised form is also present, or to
normalise the turn text and the name together. Worth naming in that unit's contract criteria up
front rather than discovering downstream.

## Ledger

`ISSUES-WRITTEN: none.` No issue was filed and none should be: the coverage gap this unit closes
was recorded in the cycle-1 EXPLANATION rather than the ledger, and it is now closed. Per D-013 as
amended by D-014, `none` is a complete and creditable result — I found nothing at >80% confidence
that would survive being defended, and I did not manufacture a finding to look thorough.

## Contract amendment

**None.** This unit was judged against `speaker-resolution-deterministic` as it stands and revealed
nothing wrong with it — C2 was correct as written; what was missing was a test, not a rule. The
contract governs behaviour, not coverage, so the fix belonged in the suite, which is where it went.
No criteria were added, and none were softened.
