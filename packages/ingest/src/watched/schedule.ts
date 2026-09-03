/**
 * packages/ingest/src/watched/schedule.ts — T-027 C3. Pure due-check for Watched Sources (A13) —
 * no I/O, no scheduling itself. A future scheduler runs `listActive` (packages/db) then filters
 * to `isDueForCheck(source, now)` before calling `checkWatchedSource` (check.ts) on each.
 */
import type { WatchedSources } from "@lkb/core";

/** `now` is an ISO datetime string (injected, not `Date.now()` directly, for testability). */
export function isDueForCheck(source: WatchedSources, now: string): boolean {
  if (!source.active) return false;
  if (!source.lastFetch) return true;

  const elapsedMs = new Date(now).getTime() - new Date(source.lastFetch.fetchedAt).getTime();
  const intervalMs = source.checkIntervalHours * 60 * 60 * 1000;
  return elapsedMs >= intervalMs;
}
