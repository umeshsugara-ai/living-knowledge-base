/**
 * packages/ingest/src/watched/run.ts — A13's missing composition.
 *
 * T-027 built every piece of Watched Sources and wired none of them together: `listActive` →
 * `isDueForCheck` → `checkWatchedSource` → `recordFetch` has never existed as a single call, so no
 * watched source has ever actually been re-fetched. Its own module comment still says "a future
 * scheduler runs `listActive`". This is that scheduler.
 *
 * It is the difference between A13 being a stored intention and a working feature: rows in
 * `watched_sources` prove someone asked for a URL to be watched; only a run like this proves
 * anything was ever watched.
 *
 * One source failing must never abandon the rest. These are unattended periodic fetches over URLs
 * a user supplied, so a single blocked or dead target is the NORMAL case, not an exception — the
 * guarded fetcher is expected to refuse some of them by design. Failures are collected and
 * returned; the run continues.
 */
import type { WatchedSources } from "@lkb/core";
import { isDueForCheck } from "./schedule.js";
import { checkWatchedSource } from "./check.js";
import type { UrlFetcher, UrlHasher } from "../sources/url.js";

export interface WatchedRunDeps {
  listActive(tenantId: string): Promise<WatchedSources[]>;
  /** Inject the GUARDED fetcher here — this is the SSRF boundary for the whole feature. */
  fetcher: UrlFetcher;
  hasher: UrlHasher;
  recordFetch(
    tenantId: string,
    id: string,
    lastFetch: NonNullable<WatchedSources["lastFetch"]>,
  ): Promise<boolean>;
  now(): string;
}

export interface WatchedRunResult {
  /** Sources actually fetched and recorded. */
  checked: number;
  /** Of those, how many had content differing from their previous hash. */
  changed: number;
  /** Not due, or inactive. */
  skipped: number;
  /** Per-source failures — reported, never thrown. */
  failed: { id: string; url: string; reason: string }[];
}

export async function runWatchedSources(tenantId: string, deps: WatchedRunDeps): Promise<WatchedRunResult> {
  const result: WatchedRunResult = { checked: 0, changed: 0, skipped: 0, failed: [] };
  const sources = await deps.listActive(tenantId);
  const now = deps.now();

  for (const source of sources) {
    if (!isDueForCheck(source, now)) {
      result.skipped++;
      continue;
    }
    try {
      const check = await checkWatchedSource(source, deps.fetcher, deps.hasher, deps.now);
      await deps.recordFetch(tenantId, source._id, {
        fetchedAt: check.fetchedAt,
        hash: check.hash,
        diffFrom: check.diffFrom,
      });
      result.checked++;
      if (check.changed) result.changed++;
    } catch (err) {
      // A blocked or dead target is the expected case here, not an exception. Record it against
      // the source and keep going -- one bad URL must not stop every other source being checked.
      result.failed.push({
        id: source._id,
        url: source.url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}
