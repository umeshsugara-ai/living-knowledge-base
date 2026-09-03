// @lkb/meeting-bot — T-024. Platform detection, join-strategy selection, the Joiner seam + three
// stubbed joiners (TODO(T-024b) for real implementations), and capture() which composes them with
// packages/ingest's recording adapter. cli.ts is the `lkb capture` entry point (not re-exported —
// it is a script, run via `pnpm --filter @lkb/meeting-bot run cli -- capture <url>`).
export * from "./platform.js";
export * from "./strategy.js";
export * from "./joiner.js";
export * from "./capture.js";

export * from "./joiners/vexa-joiner.js";
export * from "./joiners/browser-joiner.js";
export * from "./joiners/system-audio-joiner.js";

// T-025 — calendar auto-join decision layer (interface only; no real Google Calendar
// implementation yet, see docs/adr/0005-calendar-auto-join.md).
export * from "./calendar/calendar-client.js";
export * from "./calendar/auto-join.js";
