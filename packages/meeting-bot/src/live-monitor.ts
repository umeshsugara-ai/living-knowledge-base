/**
 * packages/meeting-bot/src/live-monitor.ts — T-011 C2. The privacy-filter primitive behind
 * plan A11's "Live Meeting Bot Monitor... exclude private segment" — no UI, no real-time control
 * here; a future live-monitor worker/UI calls this with whatever windows were marked private
 * during capture. Pure, no I/O.
 */
import type { Turn } from "@lkb/ingest";

export interface TimeWindow {
  tStart: number;
  tEnd: number;
}

function overlaps(turn: Turn, window: TimeWindow): boolean {
  // Any overlap at all counts — a turn straddling a window's edge is still excluded, never
  // partially truncated (the contract's explicit "never partially truncated" requirement).
  return turn.tStart < window.tEnd && turn.tEnd > window.tStart;
}

/** Drops every turn that overlaps ANY `privateWindows` entry. Returns a new array; never
 * mutates `turns`. An empty `privateWindows` returns every turn unchanged. */
export function excludePrivateSegments(turns: Turn[], privateWindows: TimeWindow[]): Turn[] {
  if (privateWindows.length === 0) return [...turns];
  return turns.filter((turn) => !privateWindows.some((w) => overlaps(turn, w)));
}
