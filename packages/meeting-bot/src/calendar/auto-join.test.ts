/**
 * packages/meeting-bot/src/calendar/auto-join.test.ts — T-025 C5. `selectEventsToAutoJoin`
 * against fixture events — no I/O.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { CalendarEvent } from "./calendar-client.js";
import { selectEventsToAutoJoin } from "./auto-join.js";

const NOW = "2026-09-03T10:00:00Z";
const LEAD_MINUTES = 2;

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1", title: "Test meeting", startTime: "2026-09-03T10:01:00Z",
    endTime: "2026-09-03T11:00:00Z", meetingUrl: "https://meet.google.com/abc-defg-hij",
    ...overrides,
  };
}

test("an event with no meetingUrl is excluded", () => {
  const e = event({ meetingUrl: undefined });
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), []);
});

test("an event starting more than leadMinutes in the future is excluded", () => {
  const e = event({ startTime: "2026-09-03T10:05:00Z" }); // 5 min out, lead is 2
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), []);
});

test("an event that already ended is excluded", () => {
  const e = event({ startTime: "2026-09-03T08:00:00Z", endTime: "2026-09-03T09:00:00Z" });
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), []);
});

test("an event within the join window is included", () => {
  const e = event({ startTime: "2026-09-03T10:01:00Z" }); // 1 min out, within lead=2
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), [e]);
});

test("an in-progress event (already started, not yet ended) is included", () => {
  const e = event({ startTime: "2026-09-03T09:55:00Z", endTime: "2026-09-03T10:30:00Z" });
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), [e]);
});

test("boundary: exactly leadMinutes before start is included", () => {
  const e = event({ startTime: "2026-09-03T10:02:00Z" }); // exactly 2 min out
  assert.deepEqual(selectEventsToAutoJoin([e], NOW, LEAD_MINUTES), [e]);
});

test("multiple qualifying events come back sorted by startTime ascending", () => {
  const later = event({ id: "later", startTime: "2026-09-03T10:02:00Z" });
  const sooner = event({ id: "sooner", startTime: "2026-09-03T10:00:30Z" });
  const result = selectEventsToAutoJoin([later, sooner], NOW, LEAD_MINUTES);
  assert.deepEqual(result.map((e) => e.id), ["sooner", "later"]);
});
