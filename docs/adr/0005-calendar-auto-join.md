# ADR-0005 — Calendar auto-join: lead time + credential status (T-025)

## Status
Accepted (maker draft per contract `qa/contracts/calendar-auto-join.md` C4; checker to
adopt/amend on first check).

## Context
Plan §4c A10/Phase A lists "Google Calendar connect + per-meeting opt-in" as a Should-have for
the meeting-bot capture flow (T-024, done). This ADR fixes the auto-join lead time and records the
credential status honestly so a future reader doesn't assume Google Calendar is actually wired.

## Decision
1. **Default `leadMinutes`: 2.** The bot should join just before a meeting starts — early enough
   to catch the opening remarks, late enough not to sit in an empty room for a long window
   (matching the "announced bot" posture from the consent design, §6c.2 option A/C — arriving
   right at start time is the least awkward). Callers may override per call; no per-tenant config
   yet (YAGNI, same reasoning as ADR-0002's SLA default and ADR-0004's check interval).
2. **The join window extends through the event's own end**, not just the start — a late auto-join
   trigger (e.g. a scheduler tick that ran a few minutes behind) should still join an in-progress
   meeting rather than skip it entirely.
3. **No Google Calendar credentials exist today.** `.env` has no Calendar OAuth client
   id/secret — setting one up is a human/ops task (Google Cloud console, OAuth consent screen,
   scoping to Calendar read-only) that has not happened yet. `CalendarClient` is an interface
   only; there is no real implementation to test against, honestly, until that setup happens.
4. **Composition is documented, not wired.** `selectEventsToAutoJoin`'s output feeds T-024's
   `capture()` one event at a time — that call already runs the D-008 `assertProvidedFirst` gate,
   so auto-join never bypasses consent, it only decides timing. The actual scheduler that ties
   `CalendarClient.listUpcomingEvents` → `selectEventsToAutoJoin` → `capture()` together on a
   real cadence is future work.

## Consequences
No meeting is ever actually auto-joined by this unit — it is the decision layer only, with no real
calendar data source behind it yet. Once Google Calendar credentials exist, a real
`CalendarClient` implementation is a small, isolated follow-up (same shape as T-019's provider
adapters); this ADR's `leadMinutes` default carries over unchanged.
