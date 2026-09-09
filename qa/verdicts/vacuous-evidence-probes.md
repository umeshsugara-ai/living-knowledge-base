# Verdict — vacuous-evidence-probes

**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** fresh subagent, Mode A + Mode D, bound to `D:\KnowledgeBase`
**Manifest:** `qa/manifests/vacuous-evidence-probes.md` (Fix cycle 1, `ready-for-check`)
**Contract:** none — ISS-203 owns the missing vacuity criterion and the `handshake-liveness` START is a
pending HUMAN_GATE. Two prior checkers declined to open another contract home; this one does not
either. Judged against ISS-202 items 1 and 2's **recorded fix directions** (D-015).

```
VERDICT: PASS
SCOREBOARD: 2/2 recorded fix directions met, 3/3 mutation-derived claims reproduced
FAILURES: none
LIVE-BROWSER: SKIP (Playwright MCP profile mcp-chrome-dde8b72 still locked — "Browser is already
  in use"; I re-attempted it myself and got the same error the maker did). Recorded as a SKIP, not
  a pass. See "Mode D" below: I additionally rule the unit not-applicable on the merits.
ISSUES-WRITTEN: ISS-212 (medium), ISS-213 (medium)
EXPLANATION: Both recorded fix directions are met, and every claim in the manifest was
re-derived independently rather than trusted. The item-2 three-state result reproduces exactly:
the original test AND the maker's own {Enter} first fix both SURVIVE the guard mutation, and
only fireEvent.submit(form) kills it — the maker's self-caught second vacuity is real. The
item-1 probe reproduces 6/0/2 under my own ISS-084-shaped mutant. Two medium findings are filed
(an undisclosed-in-output sensitivity hole in the probe, and the in-place rewrite of a dated
evidence artifact); per this repo's severity gate mediums are ledger entries, not PASS blockers.
```

---

## What I re-ran (nothing was taken from the manifest)

### Item 2 — `apps/web/src/pages/AskPage.test.tsx`, three states, my own derivation

I did **not** reuse the maker's numbers. I wrote a temporary
`apps/web/src/pages/AskPageCheckerVariants.test.tsx` holding three tests — STATE-A (the original
shape: type `"   "`, assert `toBeDisabled`, assert `not.toHaveBeenCalled`, never submit), STATE-B
(the maker's discarded first fix: `userEvent.type(field, "   {Enter}")`), STATE-C (the shipped fix:
`fireEvent.submit(field.closest("form"))` plus the non-vacuity leg) — ran them as a control, then
under the mutation, then deleted the file. `git status` is clean of it.

**Mutation `M-empty-guard-removed`** — `apps/web/src/pages/AskPage.tsx:52`,
`if (trimmed === "" || loading) return;` becomes `if (loading) return;`. Armed through
`scripts/lib/mutate.mjs apply` (which refuses unless the file is byte-identical to HEAD),
`tsc --noEmit` exit 0 under the mutant, restored via `mutate.mjs restore` ("verified identical to
HEAD") and `assert-clean`.

| state | control (unmutated) | under `M-empty-guard-removed` |
|---|---|---|
| STATE-A original (no submit) | pass | **SURVIVES** |
| STATE-B the maker's `{Enter}` first fix | pass | **SURVIVES** |
| STATE-C shipped `fireEvent.submit(form)` | pass | **KILLED** |

Full suite: **46/46 clean**, **45/46 under the mutant** with exactly
`AskPage > does not call the route for a whitespace-only query — even when the form is SUBMITTED`
red. With my variants file present that reads 49 tests: 47 clean, 2 red (STATE-C + the real test).

**The interesting middle claim is CONFIRMED.** `{Enter}` genuinely does not submit this form when
the query is whitespace: `userEvent`'s implicit-submission emulation follows the HTML spec, which
requires a *non-disabled* submit button, and `AskPage`'s button is
`disabled={loading || query.trim() === ""}`. The maker's first fix was vacuous and green, and it
found that out by mutating rather than by being told. That is the behaviour this whole class of
issue exists to produce.

**Attacking the new test.** Three probes, all of which it survives:

- *Does `field.closest("form")` bind to the right element?* Yes — and not by inspection. Under
  `M-empty-guard-removed` the `fireEvent.submit` leg **reddens**, which is only possible if the
  dispatched event reached `handleSubmit`. A wrong binding would have thrown on the `if (!form)`
  guard; a right-shaped but wrong element would have stayed green.
- *Would the test still fail if `ask` were unwired from the form entirely?* **Yes.** Second
  mutation, `M-form-unwired`: `<form className="card" onSubmit={handleSubmit}>` becomes
  `<form className="card">`; `tsc --noEmit` exit 0. Result: **7 tests red including the ISS-202
  test**, killed by its own non-vacuity leg
  (`waitFor(() => expect(spy).toHaveBeenCalledTimes(1))`). The non-vacuity leg is real, not
  decorative. Restored, `assert-clean`.
- *Does the non-vacuity leg pass for an unrelated reason?* It types `"real question{Enter}"` — with
  a non-empty query the button is enabled, so implicit submission is available, which is the same
  mechanism STATE-B showed is unavailable when it is disabled. The two legs are consistent with
  each other and with the spec, and the leg asserts both the call count and the trimmed argument.

**A note that belongs in the record.** ISS-202's own `fix_direction` for item 2 reads *"Click the
Ask button before the not.toHaveBeenCalled."* **That direction was itself insufficient** — the
button is disabled for a whitespace query, so a click dispatches nothing and the assertion would
have stayed exactly as vacuous as before. The maker exceeded its recorded direction and was right
to. Written back into the ISS-202 row so the next reader of that `fix_direction` is not misled by
it.

### Item 1 — `qa/evidence/live-rank-probe-2026-09-08.mjs`

**Read-only: confirmed.** Reviewed line by line. The probe's only database operations are
`store.search(...)` and `db.collection("turns").findOne(...)`; `createMongoSearchDeps.search`
(`apps/api/src/search-store.ts:53-84`) issues only `find().toArray()` and `findOne()` through
`scopedCollection`. No insert/update/delete, no aggregate, no index creation anywhere on the path.
It closes the client in a `finally`.

**Live re-run**, `npx tsx --env-file=.env qa/evidence/live-rank-probe-2026-09-08.mjs`:

```
q="visa student university funding" hits=10 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=2
q="2026 intake"                     hits=10 mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=2
q="counselling"                     hits=2  mismatchedPairs=0 unresolvableTurns=0 mismatchedJoins=0 distinctScores=1
```

22 hits across 3 queries, all zeros — the manifest's live figures reproduce.

**My own mutant, not the maker's.** `M-iss084-rotate` on `apps/api/src/search-store.ts:75-77`:
`scored.map((hit) => ({ ... sessionId: hit.sessionId` becomes
`scored.map((hit, i) => ({ ... sessionId: scored[(i + 1) % scored.length].sessionId`.
Armed and restored through `mutate.mjs`; `restore` reported identical-to-HEAD and `assert-clean`
passed. Probe output under it:

```
mismatchedPairs=6  mismatchedJoins=6   (visa student university funding)
mismatchedPairs=0  mismatchedJoins=0   (2026 intake)
mismatchedPairs=2  mismatchedJoins=2   (counselling)
```

**Exactly the manifest's 6 / 0 / 2.** The probe is capable of failing, and the independence of the
oracle is why: it re-reads each hit's turn by `_id` from the collection rather than from the array
the hits were derived from. Disclosure: my mutant drew one `tsc` strict-index complaint
(`TS2532: Object is possibly 'undefined'` on my own `scored[(i+1)%len]` expression) — a property of
the mutation I wrote, not of the file under test; it executed correctly under `tsx`, which is the
instrument the probe actually runs on.

**The disclosed limit — adequate, or does it need a precondition?** I measured the diversity myself:
`distinctSessions` = **6 / 1 / 2** for the three queries. The maker's account is exactly right, and
it volunteered the limit unprompted, which is the honest behaviour and is credited. **But the
disclosure is in the wrong place.** It lives in the manifest and the commit message; the probe's
own q2 output line is byte-identical in shape to the two informative lines, so anyone re-running
this probe next month reads three zeros and one of them is arithmetic. That is the ISS-202 shape
surviving in miniature. The probe already refuses on `hits === 0` ("NOTHING CHECKED (not a pass)");
it owes the same refusal to `distinctSessions < 2`. Filed as **ISS-212 (medium)** with a one-line
fix direction — not a PASS blocker under this repo's severity gate, and not a re-litigation of the
fix that was asked for.

**Editing a dated artifact in place — I rule that it was wrong.** Filed as **ISS-213 (medium)**.
`live-rank-probe-2026-09-08.mjs` now contains a program that did not exist on 09-08, so every
earlier manifest and verdict citing that path as its evidence silently resolves to different code
with a different oracle. D-019 named this exact harm for issue ids: *"an audit trail whose
references silently repoint is worse than an incomplete one, because it still looks correct."*
Two things hold it at medium rather than high: the new header states plainly that it was corrected
on 09-09 and exactly what changed, and git history preserves the original — so nothing is lost,
only mis-signposted. The root defect is the naming convention: this file is a re-runnable
**instrument**, not a dated **result**, and should not carry a date at all. Fix direction in the
ledger row.

### The manifest's claimed `Issues addressed`

`ISS-202` items 1 and 2 are genuinely fixed by this unit and I have re-derived both.
**ISS-202 stays `open`** — item 3 (`apps/api/src/indexing/promote-entities.test.ts:86-95`, the
tenancy one, which this repo's class-based round cap leaves uncapped) is untouched by this unit. A
`checker_note` recording the split is written to its row.

---

## Mode D

**Attempted, not assumed.** I called `browser_navigate` myself and received
`Browser is already in use for ...\ms-playwright-mcp\mcp-chrome-dde8b72, use --isolated`. The lock
the maker hit has **not** cleared. Recorded as `SKIP (<instrument failure>)`, never as a pass, and
I did not kill 44 Chrome processes on the user's machine either.

**On the maker's second point, which it correctly refused to decide for itself — I rule the D-024
trigger over-broad here, and this unit not-applicable on the merits.** The unit's complete changed
set is:

```
apps/web/src/pages/AskPage.test.tsx
qa/evidence/live-rank-probe-2026-09-08.mjs
qa/manifests/vacuous-evidence-probes.md
qa/.last-tick
```

Three of those are under `qa/**`, already listed in `genuinely_not_user_facing`. The fourth is a
**Vitest test file**: it is not in the shipped bundle, no runtime module imports it, and no
rendered surface, route, or console message can differ because of it. A browser driven against this
unit could not observe anything the unit changed — that is a genuine not-applicable, different in
kind from the instrument SKIP above. The maker was right not to self-exempt (D-024 says narrow the
config, never reason around it ad hoc); making that call is the checker's job, and I am making it
explicitly rather than letting a SKIP quietly decide it by default.

**Should `qa/ui-surfaces.json` narrow to exclude `*.test.*`? I recommend yes — but I am not doing
it, and neither should the maker.** Reasons, in order:

1. It is correct on the merits. A `*.test.tsx` change cannot alter a user-facing surface; the
   current pattern matches the `.tsx` extension alone, which is why a pure test edit tripped a
   live-browser gate.
2. It is a **weakening of a gate**, which is a CRITICAL amendment under the checker's own
   criticality table — *"removing/weakening a safety invariant … stop and ask the human"* — and
   `qa/ui-surfaces.json` is read by `delivery-gate-stop.ps1`, i.e. it is enforcement-path-adjacent.
   D-024's own text says a malformed file must fall back to the generic default *"because an
   exemption that arrives by accident is the failure this whole rule exists to stop."* An exemption
   that arrives because a maker or a checker found it inconvenient is the same failure with better
   manners.
3. There is a real, if narrow, counter-argument the Approver should weigh, and it should be written
   into the file rather than left implicit: a test-file change is sometimes the visible half of a
   behaviour change made elsewhere in the same unit. The exclusion is safe **because** the gate is
   evaluated over the unit's whole changed set — any non-test UI file in the same unit still trips
   it. If that ceases to be true, the exclusion becomes unsafe.

Queued as `qa/gates/ui-surfaces-test-file-exclusion.md` with a gate line above the QUEUE's TODO
rows. **No PASS in this repo depends on that gate being answered** — this verdict stands on the
not-applicable ruling above, not on the narrowing.

---

## Commands run

```
pnpm --filter @lkb/web test                                   -> 46 passed (clean baseline)
npx vitest run src/pages/AskPageCheckerVariants.test.tsx      -> 3 passed (control)
node scripts/lib/mutate.mjs apply apps/web/src/pages/AskPage.tsx
  [M-empty-guard-removed]  tsc --noEmit exit 0
  variants -> 1 failed (STATE-C) / 2 passed (STATE-A and STATE-B both survive)
  full     -> 47 passed / 2 failed  (my STATE-C + the real ISS-202 test)
node scripts/lib/mutate.mjs restore <same file> && assert-clean  -> identical to HEAD, none outstanding
node scripts/lib/mutate.mjs apply apps/web/src/pages/AskPage.tsx
  [M-form-unwired]         tsc --noEmit exit 0
  full     -> 42 passed / 7 failed, the ISS-202 test among them (non-vacuity leg is real)
node scripts/lib/mutate.mjs restore <same file> && assert-clean  -> identical to HEAD, none outstanding
npx tsx --env-file=.env qa/evidence/live-rank-probe-2026-09-08.mjs  -> 22 hits, all zeros
node scripts/lib/mutate.mjs apply apps/api/src/search-store.ts
  [M-iss084-rotate]        probe -> mismatchedPairs 6 / 0 / 2
node scripts/lib/mutate.mjs restore <same file> && assert-clean  -> identical to HEAD, none outstanding
(scratchpad script) distinctSessions per query                -> 6 / 1 / 2
browser_navigate                                              -> "Browser is already in use" (SKIP)
```

Mutation hygiene per D-020: every mutation armed through `scripts/lib/mutate.mjs` (which refuses a
file that is not byte-identical to HEAD), every run under `timeout`, restore in a trap on
EXIT/INT/TERM/ERR, **only the file I mutated ever restored**, `assert-clean` after each. One trap
fired from the wrong working directory on the first batch and its restore failed loudly (a relative
path to `mutate.mjs` from `apps/web`); I restored explicitly and re-verified identical-to-HEAD
before continuing. Recording it because the silent version of that failure is precisely the D-020
hazard, and the visible one is only visible because the ledger existed.
