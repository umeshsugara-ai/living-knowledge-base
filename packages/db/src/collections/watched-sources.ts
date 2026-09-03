// packages/db/src/collections/watched-sources.ts — T-027 C2. `coll(tenantId)` accessor matching
// the existing eval-runs.ts/claims.ts pattern (scopedCollection: a tenant-less call is a TS
// compile error), plus the operations a future watched-source scheduler needs: create,
// recordFetch (after checkWatchedSource resolves), listActive.
import type { WatchedSources } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function watchedSources(tenantId: string) {
  return scopedCollection<WatchedSources>(getDb(), "watched_sources")(tenantId);
}

export async function createWatchedSource(tenantId: string, doc: Omit<WatchedSources, "tenantId">): Promise<void> {
  await watchedSources(tenantId).insertOne(doc);
}

/** Persists the result of a `checkWatchedSource` call onto the source's `lastFetch` field. */
export async function recordFetch(
  tenantId: string,
  id: string,
  lastFetch: NonNullable<WatchedSources["lastFetch"]>,
): Promise<boolean> {
  const result = await watchedSources(tenantId).raw.updateOne(
    { _id: id, tenantId },
    { $set: { lastFetch } },
  );
  return result.matchedCount > 0;
}

/** Every active watched source for a tenant (what a future scheduler reads before applying
 * `isDueForCheck`). */
export async function listActive(tenantId: string): Promise<WatchedSources[]> {
  return watchedSources(tenantId)
    .find({ active: true })
    .toArray();
}
