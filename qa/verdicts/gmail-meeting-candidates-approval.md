# Verdict — gmail-meeting-candidates-approval

Cycle checked: 1
Verdict: **PASS**

## Evidence (fresh re-run, this session, D:\KnowledgeBase)

1. **Schema validation** — `python schema/validate.py`
   ```
   OK: meeting_candidates — valid fixture passes, invalid fixture correctly rejected (5 error(s))
   OK: trusted_senders — valid fixture passes, invalid fixture correctly rejected (2 error(s))
   PASS: 24 collection schema(s) validated correctly.
   ```
   Matches contract/manifest exactly (24, up from 22).

2. **Migration status** — `npx migrate-mongo status -f migrate-mongo-config.cjs`
   Both `20260903100000-baseline.cjs` and `20260904120000-meeting-candidates.cjs` show
   `Applied At` timestamps (2026-09-04T12:34:43.4xxZ) — neither PENDING. Confirms the contract's
   claim that `npx migrate-mongo up` was run for real.

3. **Typecheck** — all three exit 0, no output:
   - `packages/db && npx tsc --noEmit -p tsconfig.json` → exit 0
   - `apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0
   - `apps/web && npx tsc --noEmit -p tsconfig.json` → exit 0

4. **Full test suite** — `pnpm -r test`, fresh, exit 0. Summed every package's own reported
   count myself:
   ```
   packages/core        7
   packages/index       25
   packages/ai          56
   packages/ingest      34
   packages/ask         30
   packages/meeting-bot 40
   apps/api             56   (up from 51 — +5 meeting-candidates route tests, confirmed real)
   apps/web             34   (up from 32 — +2 CalendarPage Gmail-review tests)
   ------------------------------
   Total                282, all pass, 0 fail
   ```
   Matches manifest's claimed 282/282 exactly.

5. **`pnpm lint:structure`** — exit 0. `lint-migrations: OK (964 file(s) scanned)` — manifest
   said 962; this is a natural drift from file-count growth between the manifest's snapshot and
   now, not a numeric criterion the contract pins, and every other lint line (loc/dirsize/root/
   dupes/SNAPSHOT/depcruise) matches. Not an issue.

6. **Schema files** — `schema/meeting_candidates.schema.json` (status enum
   `pending|approved|rejected|auto_approved`, required incl. `messageId`) and
   `schema/trusted_senders.schema.json` (`senderDomain`, `approvalCount`, `autoApprove`) read and
   confirmed to match the contract. Both fixture dirs (`valid.json`/`invalid.json`) exist.
   `schema/index.json` lines 22-23 confirmed: `meeting_candidates` has a unique
   `{tenantId:1, messageId:1}` index; `trusted_senders` has a unique `{tenantId:1,
   senderDomain:1}` index. Both tenant-led.

7. **Migration file** — `migrations/20260904120000-meeting-candidates.cjs` read in full:
   `up()` only calls `createCollection`/`createIndex` (guarded by an `existing` Set check —
   safe to re-run); `down()` only drops the two collections it creates. Idempotent, no
   destructive operation. Confirmed no `.js` migration files remain
   (`migrations/*.js` → "No such file or directory"), both are `.cjs`, and
   `migrate-mongo-config.cjs` line 20: `migrationFileExtension: ".cjs"`.

8. **`packages/db/src/collections/trusted-senders.ts`** — `recordApproval` logic:
   `approvalCount = (existing?.approvalCount ?? 0) + 1`, then
   `autoApprove = existing?.autoApprove || approvalCount >= AUTO_APPROVE_THRESHOLD` with
   `AUTO_APPROVE_THRESHOLD = 3`. On the 3rd approval, `approvalCount` becomes 3, `3 >= 3` is
   true → flips on the 3rd approval exactly as claimed (not the 4th). Once
   `existing.autoApprove` is true it stays true via the `||` — never decremented or reset by
   this function. Matches contract exactly.

9. **`packages/db/src/collections/meeting-candidates.ts`** — `createIfNew` does a
   `findOne({messageId...})` check before `insertOne`, returns `false` without inserting if a
   row already exists. Real dedup by `messageId`.

10. **`apps/api/src/gws-gmail.ts`** — traced every path. `scanGmailForMeetingCandidates` wraps
    its entire body in `try {...} catch { return []; }`; `fetchOne` calls are individually
    wrapped with `.catch(() => null)` before the outer `Promise.all`. No path throws out of the
    exported function. `meetingUrl` is extracted via `MEETING_URL_RE.exec(msg.snippet ?? "")?.[0]`
    — a literal regex match against real snippet text, spread into the return object only via
    `...(meetingUrl ? {meetingUrl} : {})` — never fabricated when absent.

11. **`apps/api/src/routes/meeting-candidates.ts` + `.test.ts`** — 4 real routes, all
    `requireScope("gmail")`. 5 tests read in full: scan-returns-summary,
    no-scope-403, approve-flips-status-and-records-trust, approve-already-decided-404-no-
    double-count-trust, reject-flips-status. All meaningfully exercise approve/reject/scan/
    scope-enforcement with real assertions (status codes + state changes), not stubs.

12. **`apps/api/src/store.ts`'s `createMeetingCandidatesDeps`** (lines 131-166) — `scanGmail`
    calls `getTrustedSender(tenantId, candidate.senderDomain)` and computes
    `status = trusted?.autoApprove ? "auto_approved" : "pending"` **before** calling
    `createMeetingCandidateIfNew`. Confirmed the trust check happens before insert — an
    already-trusted sender's candidate never sits pending.

13. **Wiring** — confirmed real, not just claimed: `apps/api/src/server.ts` imports the router
    and mounts it (`app.use(createMeetingCandidatesRouter(...))`); `production.ts` wires
    `createMeetingCandidatesDeps()`; `fixtures.ts` wires `fakeMeetingCandidatesDeps()`;
    `routes/pages.ts` `REAL_ROUTES` has the 4 new gmail-scoped entries;
    `scripts/seed-demo-server.mjs` includes `"gmail"` in its scopes array.

14. **`apps/web/src/pages/CalendarPage.tsx`** — imports `scanGmail`,
    `listMeetingCandidates`, `approveMeetingCandidate`, `rejectMeetingCandidate` from the real
    api client (`apps/web/src/api/meeting-candidates.ts`, itself confirmed to make real
    `apiFetch` calls to `/gmail/scan`, `/meeting-candidates`, `/meeting-candidates/:id/approve`
    `/reject`). "Needs review (from Gmail)" section, "Scan Gmail" button (`handleScan` → real
    `scanGmail(apiKey)` call), real pending-candidate list with Approve/Reject buttons. Real,
    not decorative.

15. **Screenshots** — both read as images.
    - `calendar-gmail-review.png`: real Calendar page, "Needs review (from Gmail)" section with
      10 pending candidates, real Vidysea senders (harshita@, karunn@, umeshsugara@,
      himanshu@vidysea.com), real subjects ("Fwd: Meeting assets for Assam Velley X Vidysea
      Education's Zoom Meeting are ready!", etc.), Approve/Reject buttons on each.
    - `calendar-gmail-review-after-approve.png`: the first list's top item ("Re: Testing
      feedback of new student portal recording", harshita@vidysea.com) is genuinely gone from
      the second screenshot — the list now starts with what was previously the 2nd item ("Fwd:
      Meeting assets for Assam Velley..."). This is a real before/after state change from an
      actual approve click, not just a claim.

16. **`git status`** — `migrations/20260903100000-baseline.js` → `.cjs` rename is staged; all
    other T-028 files (routes, collections, gws-gmail.ts, schemas, fixtures, migration, contract,
    manifest, screenshots) are untracked/unstaged as expected for a ready-for-check unit. Nothing
    committed by the maker (correct — commit is a separate, later step). No stray files outside
    the described change set.

17. **Infra bug fix judgment** — the `.js`/`"type":"module"` vs `require()` collision is real
    and independently visible in the `git status`/file listing (both migration files are indeed
    `.cjs` now, and `migrate-mongo-config.cjs` already declared `moduleSystem: "commonjs"` before
    this fix, so aligning the extension is consistent with the config's existing intent, not a
    new design decision). This unit's own migration could not have run without the fix — it is
    minimal (one rename + one extension config field), necessary, and disclosed rather than
    buried. Judged reasonable, not scope creep.

## Conclusion

All 9 contract criteria verified against fresh command output and direct code/schema/screenshot
inspection. No fabricated numbers, no discrepancies material enough to fail. PASS.
