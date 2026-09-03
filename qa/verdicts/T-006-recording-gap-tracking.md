# Verdict — T-006 recording-gap-tracking

**Date:** 2026-09-03
**Cycle checked:** 1
**Checker:** Mode A unit check, fresh subagent, read-only

## Contract adoption
Contract `qa/contracts/recording-gap-tracking.md` was maker-drafted. Adopted as-is — faithful to
`Living-Knowledge-Base-Architecture.html` §1 (see below). No amendment needed.

## Re-run verify commands (all re-executed myself, not trusted from the manifest)

- `pnpm -r typecheck` → 9/9 workspace projects with a typecheck script: Done, zero errors.
- `pnpm gen:types --check` → `OK: 20 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` → `PASS: 20 collection schema(s) validated correctly.` (includes
  `OK: gaps — valid fixture passes, invalid fixture correctly rejected (1 error(s))`).
- `pnpm -r test` → all packages fail 0: index 8/8, ai 23/23, ingest 18/18, ask 18/18,
  meeting-bot 20/20, apps/api 8/8. Matches manifest's claimed counts exactly.
- `pnpm lint:structure` → lint-loc/dirsize/root/dupes/migrations OK, SNAPSHOT.md matches fresh
  regeneration, depcruise 0 violations.

## Extra-care item 1 — ADR-0002 fidelity to the architecture HTML

Read `Living-Knowledge-Base-Architecture.html` §1 Layer 1 step 2b directly (both the SVG diagram
text at lines ~156-167 and the plain-text flow export at lines ~382-387). Actual source text:

> "2b. NO -> Process-first gap handling [NEW, process not code]: Standing ask: request the
> recording from Bhakti / TOC. DECISION: received within N days? YES -> joins the transcription
> pipeline above (2a). NO -> logged as a 'recording pending' gap entry in the Knowledge Bank (not
> silently dropped)."

`docs/adr/0002-standing-ask-process.md`'s Context section quotes this accurately (no fabricated
quote). The Decision section (who asks — `requestedFrom`; default SLA N=3 days; escalation via
`markReceived`/`markExpired`/`listOpen`) is a genuine generalization filling the gap the HTML
explicitly left open ("N... unspecified") — not invented content dressed as sourced fact; the ADR
is honest that N=3 is its own choice, not the HTML's. Vocabulary cross-reference to
`gaps.schema.json`'s `status`/`requestedFrom`/`sla.dueAt` fields checked directly against the
schema file — accurate. C5 holds.

## Extra-care item 2 — capture.ts wiring is genuinely additive

`git show HEAD --stat` + the full `capture.ts` hunk read in full. Confirmed:
- Only additions: a `gapStore?: GapStore` optional dep, a `recordGap` call gated behind
  `if (deps.gapStore)` after the existing `assertProvidedFirst` warning, and `Joiner.join` wrapped
  in try/catch that calls `recordGap` on failure then rethrows unchanged.
- No existing line of logic was altered in a way that changes behavior when `gapStore` is absent
  (the D-008 warning push and the join call/result path are unchanged for that case).
- `capture.test.ts` diff read in full: the diff shows only two added import lines and one new
  test function appended at the end of the file — the 4 pre-existing test bodies (lines 1-90 of
  the original file) are byte-for-byte untouched in the diff (no `-` lines against them). New test
  count matches manifest's claim of "one new test case." Full suite run confirms 20/20 pass
  (4 pre-existing behaviors + this new one + others already in the file's fuller history).

## Criteria (contract C1-C7)

- **C1** — met. `schema/gaps.schema.json` + `schema/fixtures/gaps/{valid,invalid}.json` read in
  full; required `[_id, tenantId, kind, status]`; passes `validate.py` unmodified, 20/20.
- **C2** — met. `packages/db/src/collections/gaps.ts` read in full; `gaps(tenantId)` via
  `scopedCollection` matches `sources.ts`'s exact shape (compared directly), plus
  `create`/`markReceived`/`markExpired`/`listOpen`.
- **C3** — met. `packages/ingest/src/gap-tracking.ts` read in full; `recordGap(reason, context,
  store): Promise<Gaps>`; no `@lkb/db` import; only I/O is the injected `store.create` call.
- **C4** — met, verified above (extra-care item 2).
- **C5** — met, verified above (extra-care item 1).
- **C6** — met. `gap-tracking.test.ts` (3 tests, read in full) covers computed SLA, defaults, and
  overrides via a fake store. `tenantScope.typecheck-test.ts` diff confirms the `gaps()` /
  `gaps("toc")` `@ts-expect-error` pair was added, mirroring the existing 4 exactly — correct call
  since no other collection has a per-file `*.test.ts` to mirror.
- **C7** — met, all 5 commands re-run above, all clean.

## SCOREBOARD
7/7 criteria met, 0/0 invariants (contract defines none beyond the criteria) — all criteria hold.

## Issues
None found. No open ledger issues named in "Issues addressed" (manifest names none) — nothing to
reconcile.

VERDICT: PASS
