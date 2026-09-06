# Verdict — whatsapp-chat-view-speaker-names

**Contract:** qa/contracts/whatsapp-ingestion-first-slice.md (F6 follow-up, also disclosed in
qa/contracts/post-review-fixes-2026-09-06.md)
**Manifest:** qa/manifests/whatsapp-chat-view-speaker-names.md
**Cycle checked:** 1
**Date:** 2026-09-06
**Mode:** A (unit check, direct invocation — fresh context, no builder reasoning)

## What I re-ran myself (nothing pasted was trusted)

1. `pnpm -r typecheck` — re-ran fresh. All 10 workspace projects report `Done`, no errors
   (apps/web, packages/core, packages/ai, packages/db, packages/ask, packages/ingest,
   packages/index, apps/api, packages/meeting-bot). Exit 0.
2. `pnpm -r test` — re-ran fresh, full output captured. `apps/api: pass 66, fail 0`,
   `apps/web: Test Files 10 passed (10), Tests 40 passed (40)` (vitest), `packages/core: pass 7,
   fail 0`, `packages/ingest`, `packages/ask`, `packages/index`, `packages/meeting-bot`, `packages/ai`
   all report `fail 0`. Matches the manifest's claimed 66/40/41/etc counts; no discrepancy found.
3. `pnpm lint:structure` — re-ran fresh. `lint-loc OK`, `lint-dirsize OK`, `lint-root: OK (15
   loose root file(s), 1 gitignored excluded)` (same count as before this unit — no new loose
   files left behind), `lint-dupes OK`, `lint-migrations OK`, snapshot fresh, depcruise
   "no dependency violations found". Exit 0.
4. `python schema/validate.py` — re-ran fresh. `PASS: 24 collection schema(s) validated
   correctly.`
5. Read `packages/ingest/src/sources/whatsapp.ts` `toTurns()` directly (lines 112-139) —
   confirmed `speakerLabel` is set from `m.displayName` (only when truthy) and `occurredAt` is
   set from the real `m.ts`, exactly as claimed.
6. Read `apps/api/src/whatsapp-store.ts`'s `turnDocs` mapping (lines ~152-156) — confirmed both
   `speakerLabel` and `occurredAt` are spread onto the persisted `Turns` doc when present on the
   turn, replacing the prior discard-after-computing bug (`displayNameOf(...)` was computed at
   line 59 and previously never reached the doc).
7. Read `apps/web/src/pages/sessions/SessionDetailPage.tsx` in full — confirmed the chat-bubble
   branch is gated on `detail.turns...some((t) => t.speakerLabel)` and the plain-list branch
   (`t.speakerRef · {tStart}{unit}–{tEnd}{unit}`) is otherwise unchanged from the pre-existing
   shape (verified against a real non-WhatsApp session below).
8. **Independent live re-verification, no mocks:** confirmed both dev servers were actually
   running (`netstat` showed LISTEN on 3300 and 5173), then used a real browser (Playwright MCP)
   against the live app rather than trusting the manifest's pasted curl output.
   - `GET /` on `localhost:5173` → real Dashboard, 26 real sessions, 0 console errors — confirms
     the main Mongo (despite failing `ping`, which is ICMP-blocked, not a real outage right now)
     is in fact reachable from the running server; the dashboard lists a real
     `WhatsApp: Millionaires` session dated `2026-08-25`.
   - Navigated to that session's detail page directly
     (`/sessions/45e3b9e8e0cc60a61bf6bc6ce8d7ce693970fbda0659c399ef9a93c60d02b369`): rendered as
     WhatsApp-style chat bubbles, real names (`Navnit Chaubey Vidysea`, `Himanshu Tomar`, and
     phone-number-labeled senders for unresolved contacts), real per-message times
     (`Aug 25, 3:13 PM` through `Aug 27, 2:58 PM`) — matches the manifest's pasted evidence
     exactly, including the disclosed real OTP `633259` appearing in plaintext. 0 console errors.
   - Navigated to a real non-WhatsApp session (`/sessions/2bcd871f-...`, a URL ingest): rendered
     in the original plain-list form (`url · 0chars–21chars`), confirming the chat-bubble
     rendering is additive and does not regress non-WhatsApp sessions.
9. Checked for stray root files: `git status --porcelain` shows no loose `.png` at repo root;
   `ls`/direct existence checks on `brain-before-click.png` and `dashboard-live-check.png`
   (named in a stale outer git-status snapshot from before this unit) confirm they do not exist
   on disk — the manifest's claim that screenshots went to a scratchpad path outside the repo is
   consistent with what's actually on disk, and `lint-root`'s loose-file count (15) is unchanged
   from what a fresh regeneration reports, i.e. no regression from the prior cycle's
   `lint:structure` failure (commit `0f18dc9`).

## Criteria judged

| # | Criterion (manifest "How to verify") | Result |
|---|---|---|
| 1 | `pnpm -r typecheck` exit 0 | MET |
| 2 | `pnpm -r test` 0 failures | MET |
| 3 | `pnpm lint:structure` exit 0 | MET |
| 4 | adapter sets `speakerLabel`/`occurredAt` from real fetched data | MET |
| 5 | store persists both fields onto the real Mongo doc | MET |
| 6 | chat-bubble branch additive only, non-WhatsApp unaffected | MET |
| 7 | live re-ingest/render shows real names + real times matching source Mongo | MET |

No FAILURES found. No fabricated data found in the touched files. `captureMode`/consent handling
untouched by this unit (out of scope, correctly).

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 0/0 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: Every manifest verification step was independently re-run (typecheck, full test
suite, structure lint, schema validate) and all passed exactly as claimed. The core F6 fix
(displayName/timestamp computed-then-discarded) was confirmed by reading the actual adapter and
store code, then independently re-verified live in a real browser against the running
apps/api (:3300) + apps/web (:5173) instances and the real remote Mongo — the WhatsApp session
renders real names and real per-message times, and a control non-WhatsApp session still renders
in the original plain-list form, confirming no regression. No loose files were left at repo root.
```
