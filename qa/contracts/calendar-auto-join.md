# Contract — calendar-auto-join (T-025)

> Ground truth for Google Calendar connect + auto-join, per TASKS.md ("Google Calendar connect +
> auto-join", depends T-024, done) and plan §4c A10/Phase A "Should — Google Calendar connect +
> per-meeting opt-in". Drafted by the maker; /checker adopts or amends on first check.

## Scope, and an honest scope-down disclosed up front (same posture as T-021/T-022/T-003)
No Google Cloud project / OAuth client exists (`.env` has no Google Calendar credentials) — that
is a human/ops setup step (Google Cloud console, OAuth consent screen, client ID/secret), not a
code blocker this unit can resolve. This unit builds the injectable `CalendarClient` seam (same
"real-by-default-but-fakeable" pattern as every provider/adapter in this codebase) plus the pure
`selectEventsToAutoJoin` decision function that composes with T-024's `capture()`. **A real
Google Calendar implementation is a later, separate concern once credentials exist** — not
required to satisfy this contract, matching T-019/T-020's own precedent of shipping an interface
+ tests before a real vendor integration lands.

## Criteria (each machine-checkable)

1. **`packages/meeting-bot/src/calendar/calendar-client.ts`**: `CalendarEvent = {id, title,
   startTime, endTime, meetingUrl?, organizer?}` (ISO datetime strings); `CalendarClient` interface
   — `listUpcomingEvents(windowMinutes: number): Promise<CalendarEvent[]>`. No implementation
   shipped in this unit — the interface + type are the contract; a `packages/meeting-bot →
   ingest, core` dependency-rule-compliant file (no new external deps).
2. **`packages/meeting-bot/src/calendar/auto-join.ts`**: `selectEventsToAutoJoin(events:
   CalendarEvent[], now: string, leadMinutes: number): CalendarEvent[]` — pure, no I/O. Includes
   an event iff: (a) it has a `meetingUrl` (nothing to auto-join without one); (b) `now` is within
   `[startTime - leadMinutes, endTime]` (join-just-before-start through the meeting's own end —
   never join an event that already ended, never join more than `leadMinutes` early). Returns
   events sorted by `startTime` ascending (soonest first — the caller's queue order).
3. **Composition note, documented not built**: a doc comment on `auto-join.ts` (or a short
   section in the ADR below) states how a future scheduler would compose this with T-024:
   `selectEventsToAutoJoin` → for each returned event, call `capture(event.meetingUrl, {tenantId,
   consent}, deps)` — same `assertProvidedFirst` D-008 gate T-024 already enforces internally, so
   auto-join does not bypass consent, it only decides *when* to trigger a capture that was always
   going to run the same consent check.
4. **`docs/adr/0005-calendar-auto-join.md`** (≤60 lines, matching 0001-0004's budget) — states the
   default `leadMinutes` (pick and justify one value) and explicitly documents the missing Google
   OAuth credentials as the blocker for a real implementation, so a future reader doesn't assume
   it's wired.
5. **Tests exist and pass**: `packages/meeting-bot/src/calendar/auto-join.test.ts` covering: an
   event with no `meetingUrl` is excluded; an event starting more than `leadMinutes` in the future
   is excluded; an event that already ended is excluded; an event within the join window is
   included; multiple qualifying events come back sorted by `startTime` ascending; the boundary at
   exactly `leadMinutes` before start is included (`>=`, matching T-027's `isDueForCheck` boundary
   convention for consistency).
6. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-025
- No real Google Calendar API call, no OAuth flow, no token storage (blocked on missing
  credentials, a human/ops setup step). No live wiring into T-024's `capture()` or a scheduled
  job that actually calls `listUpcomingEvents` on a cadence. No UI for per-meeting opt-in.
