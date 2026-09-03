/**
 * packages/ingest/src/watched/check.ts — T-027 C4. Fetches + hashes a watched source via T-023's
 * `UrlFetcher`/`UrlHasher` seam (imported, not redeclared) and diffs against its previously known
 * hash. No re-ingestion here — a future worker reacts to `changed: true` by composing this with
 * T-023's `createUrlSource` (out of scope, see contract non-goals).
 */
import type { WatchedSources } from "@lkb/core";
import type { UrlFetcher, UrlHasher } from "../sources/url.js";

export interface WatchCheckResult {
  changed: boolean;
  hash: string;
  fetchedAt: string;
  diffFrom: string | null;
}

export async function checkWatchedSource(
  source: WatchedSources,
  fetcher: UrlFetcher,
  hasher: UrlHasher,
  now: () => string,
): Promise<WatchCheckResult> {
  const text = await fetcher(source.url);
  const hash = await hasher(text);
  const previousHash = source.lastFetch?.hash ?? null;

  return {
    changed: previousHash === null || hash !== previousHash,
    hash,
    fetchedAt: now(),
    diffFrom: previousHash,
  };
}
