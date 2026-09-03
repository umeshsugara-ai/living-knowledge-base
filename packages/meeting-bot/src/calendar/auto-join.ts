/**
 * packages/meeting-bot/src/calendar/auto-join.ts — T-025 C2. Pure decision: which calendar
 * events should trigger an auto-join capture right now. No I/O, no scheduling itself.
 *
 * Composition (T-025 C3, documented not built): a future scheduler calls `CalendarClient.
 * listUpcomingEvents(...)`, passes the result through `selectEventsToAutoJoin`, then for each
 * returned event calls `capture(event.meetingUrl, {tenantId, consent}, deps)` (`../capture.js`,
 * T-024). That call already runs `assertProvidedFirst` (D-008) internally before joining — this
 * function only decides *when* to trigger a capture that was always going to run the same
 * consent check; it never bypasses it.
 */
import type { CalendarEvent } from "./calendar-client.js";

/**
 * Includes an event iff it has a `meetingUrl` AND `now` falls within
 * `[startTime - leadMinutes, endTime]` — never more than `leadMinutes` early, never after the
 * event's own end. Returns matches sorted by `startTime` ascending (soonest first).
 */
export function selectEventsToAutoJoin(events: CalendarEvent[], now: string,
  leadMinutes: number): CalendarEvent[] {
  const nowMs = new Date(now).getTime();
  const leadMs = leadMinutes * 60 * 1000;

  return events
    .filter((e) => {
      if (!e.meetingUrl) return false;
      const startMs = new Date(e.startTime).getTime();
      const endMs = new Date(e.endTime).getTime();
      return nowMs >= startMs - leadMs && nowMs <= endMs;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
