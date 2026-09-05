# Verdict — post-review-fixes-2026-09-06

Cycle checked: 1

**PASS**

Independently re-ran every verification step from scratch, fresh context, no reliance on the
manifest's claims.

## Evidence

1. **Typecheck (all 3):**
   - `packages/ingest && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.
   - `apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.
   - `apps/web && npx tsc --noEmit -p tsconfig.json` → exit 0, no output.

2. **`pnpm -r test` (fresh run):** exit 0. Per-package counts, independently summed from the raw
   test-runner output (not copied from the manifest):
   `core 7, ai 56, ingest 41, index 38, ask 32, meeting-bot 40, api 66, web 40` → **320/320 pass,
   0 fail.** Matches contract exactly, including the claimed deltas (ingest 40→41, api 65→66,
   web 39→40).

3. **`pnpm lint:structure`:** exit 0 — lint-loc/dirsize/root/dupes/migrations OK, SNAPSHOT.md
   fresh-regen match, 0 dependency-cruiser violations.

4. **Finding 1 (summarize routing, Block):** `apps/api/src/production.ts:11,41-45` — `OllamaProvider`
   imported from `@lkb/ai` and instantiated in the `providers` record alongside `gemini` and
   `claude-code`. **Live reproduction:** wrote a standalone script in `apps/api/` loading real
   `.env` (`GEMINI_API_KEY` present), built the same `providers`/`chains` production.ts builds,
   called `routeComplete("summarize", ...)` → **succeeded via provider: gemini** (did not throw
   "unknown provider \"ollama\""). Scratch script deleted; `git status` confirms no trace.

5. **Finding 2 (WhatsApp idempotency, Critical):** `packages/ingest/src/sources/whatsapp.ts:91` —
   hash is `deps.hasher(\`${groupJid}:${ownerUserId}\`)`, no message count involved.
   `apps/api/src/whatsapp-store.ts` — `sources` (line 122-123) and `sessions` (line 141-142) both
   use `replaceOne(..., { upsert: true })`; `turns` (line 153-159) uses `bulkWrite` with
   `replaceOne`/`upsert: true` per turn; each turn `_id` is `sha256Hex(`${sessionId}:${messages[i].messageId}`)`
   — the real upstream `messageId`, not a positional index. **Live reproduction:** `whatsapp-msg-mongo`
   container confirmed running (`docker ps`, port 27018). Wrote a standalone script in `apps/api/`
   calling `createWhatsAppSource(...).fetch()` twice against the real tracked group
   ("Millionaires", `120363405936621456@g.us`) → both calls returned identical `source._id`
   (`45e3b9e8e0cc60a61bf6bc6ce8d7ce693970fbda0659c399ef9a93c60d02b369`), 50 messages / 50 unique
   ids, turn counts equal across both runs. Matches the manifest's claimed evidence exactly.
   Scratch script deleted; `git status` confirms no trace.

6. **Finding 3 (cross-owner exposure, High):** `apps/api/src/routes/whatsapp.ts:54` — body schema
   is `{ groupJid?: unknown }` only, no `ownerUserId` field read anywhere in the route.
   `apps/api/src/whatsapp-store.ts:107-115` — `ingestGroup(tenantId, groupJid)` takes no
   `ownerUserId` param; resolves it via `listTrackableGroups().find(g => g.groupJid === groupJid)`,
   throws `no tracked WhatsApp group with jid "..."` on no match. Regression test in
   `apps/api/src/routes/whatsapp.test.ts:72-98` posts a body with an attacker-supplied
   `ownerUserId`, captures the actual args `ingestGroup` receives, and asserts
   `receivedArgs === ["tenant-1", "g1@g.us"]` — genuinely proves the field never reaches the
   implementation, not just a shape check.

7. **Finding 4 (sort tiebreak, Medium):** `apps/api/src/whatsapp-store.ts:49` —
   `.sort({ ts: 1, _id: 1 })`, confirmed.

8. **Finding 5 (CalendarPage missing catch, Medium):** `apps/web/src/pages/CalendarPage.tsx:88-93`
   — `handleDecision` now has `.catch((err) => setCandidatesError(...))`, mirroring the file's
   other async calls. Test `CalendarPage.test.tsx:93-105` ("a failed approve/reject shows the real
   error...") mocks `approveMeetingCandidate` to reject with a real `ApiError(404, ...)`, clicks
   Approve, and asserts the exact error message text renders on screen — a genuine failure-path
   assertion, not a rendered-happy-path check.

9. **`git status`:** exactly the expected file set — the 13 fix-batch source files plus
   `.goal/goal.json` and `data/eval/calibration-report.json` (pre-existing modifications from
   earlier this session, unrelated to this unit) plus the two new untracked `qa/` files for this
   unit. No scratch/verification script left behind (confirmed after deleting both temporary
   scripts I wrote for findings 1 and 2).

10. **Honesty of the review-agent representation:** Reading the diffs against the findings as
    described, all five fixes are substantive, not cosmetic:
    - Finding 1's fix is the minimal correct one (register the missing provider) and is
      independently, live-reproduced — not just claimed.
    - Finding 2's fix addresses all three symptoms named in the finding (hash stability, upsert
      writes, real-messageId turn keys) — not a partial patch of just the hash. Live-verified.
    - Finding 3's fix is a real architectural change (server resolves the owner, never trusts the
      client) with a regression test that asserts the mechanism, not just the outcome.
    - Finding 4 is a one-line, easily-verified sort-key fix; confirmed present.
    - Finding 5 mirrors the file's established `.catch` pattern exactly, with a real
      failure-driving test.
    - The "explicitly not fixed" list (F4, F6, F7, F8-F12) is consistent with the contract's own
      severity framing (Warning-and-above only) and is disclosed, not buried.
    - The disclosed limitation (main Mongo unreachable, live HTTP round-trip deferred) was
      independently confirmed via `ping` (100% packet loss) — accurate, not a convenient excuse to
      skip verification that was actually possible.

No issues found. All 5 findings are genuinely and fully fixed, with live, non-mocked
reproduction for the two most severe (Block, Critical) findings, reproduced independently by this
checker (not just re-reading the maker's transcript).
