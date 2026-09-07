# Verdict — summarize-degradation-honesty

**Contract:** qa/contracts/ingest-indexing-pipeline.md, criterion 1a
**Manifest:** qa/manifests/summarize-degradation-honesty.md
**Cycle checked:** 1
**Date:** 2026-09-07
**Mode:** A (fresh subagent, no builder context)

## What I re-ran myself (not trusted from the manifest)

1. **Mutation reproduction** — disabled the `existingPage` lookup in
   `apps/api/src/indexing.ts:90` (`const existingPage = summaryDegraded ? await
   sessionPagesColl(tenantId).findOne({ sessionId }) : null;` → `const existingPage = null;`),
   confirmed present via `grep` first, then ran `pnpm --filter @lkb/api test`. Result: **73/75,
   exactly the 2 claimed tests red** (`a DEGRADED summarize run with NO existing page still
   writes the labelled fallback (ISS-059)`, `a DEGRADED summarize run with a REAL existing page
   must NOT touch it (ISS-059, criterion 1a)`), all others unaffected. Reverted from my own saved
   backup; `pnpm --filter @lkb/api test` back to 75/75.

2. **Both directions, read from the actual code + tests, not asserted:**
   - No existing page + degraded → `pageOps === [findOne, deleteMany, insertOne, find]` — fallback
     written (criterion 1 preserved).
   - Real existing page + degraded → `pageOps === [findOne, find]` — **no write of any kind** to
     `session_pages`.
   - Successful run, page pre-existing → `pageOps === [deleteMany, insertOne, find]` — always
     replaces, fallback or not.
   All three passed on the unmutated code as part of the full suite run above.

3. **Live proof against the real database** — wrote my own script (independent of the maker's
   saved `live-summary-proof.ts`, different tenant/session ids, seeds via `sessions`+`turns`
   +`session_pages` directly, forces only the `summarize` job to fail while leaving `claims`
   answering cleanly): `checker-live-iss059.ts`. Ran it **twice**, both attempts:
   `Server selection timed out after 15000 ms` against `mongodb://13.202.206.101:27017`. This
   independently reproduces the manifest's disclosed limitation — not a "probe was broken" claim
   (the manifest itself distinguishes this from ISS-056's earlier false-unreachable mistake), a
   real, repeatable TCP/driver-level timeout. I take this as it is: the write path remains proven
   only by the mutation-tested unit evidence, which is real evidence, not a live end-to-end proof.

4. **`summarize.test.ts`'s 5 tests** — read in full. All five now assert the `{page, degraded}`
   shape and still assert the same summary/keyInsights/decisions/actionItems content as before
   (e.g. `page.summary` equality, `page.keyInsights` deepEqual) — genuinely rewritten for the new
   shape, not narrowed. The zero-turns case is explicitly asserted `degraded === null` ("an empty
   session is an honest empty result, not a failure"), matching the contract's stated distinction
   from `claims.ts`.

5. **Claims path independence (ISS-056) still intact, both directions, real tests:**
   - `session_pages are still written on a degraded CLAIMS run — the two paths are independent` —
     present, passing, `pageOps` includes `deleteMany` under a claims-only failure.
   - `a DEGRADED SUMMARIZE run does not take the claims write down with it — the two paths are
     independent` — present, passing, `claimOps === [deleteMany, insertMany]` under a
     summarize-only failure.
   - `packages/index/src/pipeline/claims.ts` is untouched by this unit (read in full); the
     `ClaimsResult { claims, degraded }` shape and the evidence cross-check are exactly as ISS-056
     left them.

6. **Full suite + typecheck**, run fresh:
   - `pnpm -r test`: core 7, db 8, ai 56, index 40, ingest 41, ask 32, meeting-bot 40, api 75,
     web 40 = **339/339, 0 fail** — matches the manifest's claimed total exactly.
   - `pnpm -r typecheck`: all 10 workspace projects report `Done`, no errors.

## Judgment against criterion 1a

Criterion 1a: a degraded `summarizeSession` may not overwrite an existing `session_pages` doc;
the labelled fallback is written only when no page exists. `apps/api/src/indexing.ts:90-108`
implements exactly this (`findOne` gated on `summaryDegraded`, write branch gated on
`summaryDegraded && existingPage`), and every clause of it is independently pinned by a test I
re-ran and by a mutation I reproduced myself. The one piece not provable today — the real Mongo
write path end-to-end — is disclosed honestly by the manifest and independently confirmed
unreachable by me on two separate attempts, which is the correct and stronger form of that
disclosure (an unreachable-per-checker-too claim beats an unreachable-per-maker-only claim).

## Issues ledger

`ISS-059` flipped `open → fixed` in `qa/issues.jsonl` (evidence: mutation + both-direction tests +
independent live-timeout reproduction, appended to `checker_verdict`). Not `verified` — that status
is reserved for a future re-check once the live Mongo write path can actually be exercised
end-to-end; today's evidence is unit-level, not live-write-level.

```
VERDICT: PASS
SCOREBOARD: 1/1 criteria met (1a), 0/0 invariants (none named beyond 1a for this unit)
FAILURES (if any): none
ISSUES-WRITTEN: none (ISS-059 status updated, not newly raised)
EXPLANATION: The ISS-059 guard is real, correctly bidirectional (fallback still written when no
page exists; no write at all when a real page exists; unconditional replace on success), and
independently pinned by a mutation I reproduced myself plus tests I re-ran myself. The disclosed
Mongo-unreachable limitation is genuine — I reproduced the same server-selection timeout twice on
my own independently-authored script, so this is not a repeat of the earlier false-unreachable
mistake this project has already made once. Full suite 339/339 and typecheck clean across all 10
projects, both re-run fresh by me.
```
