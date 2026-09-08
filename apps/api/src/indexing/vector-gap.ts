/**
 * apps/api/src/vector-gap.ts — the durable record that a session has no vectors (ISS-118).
 *
 * Split out of `indexing.ts` rather than left inline: that file crossed its 300-LOC budget when
 * this landed, and raising the budget to fit a genuinely separate concern would have been the
 * accretion the budget exists to prevent. Gap bookkeeping is not indexing.
 */
import type { Db } from "mongodb";
import { scopedCollection } from "@lkb/db";
import type { Gaps } from "@lkb/core";
import type { ChunkWriteResult } from "./types.js";

/**
 * The DURABLE record that a session has no vectors (ISS-118).
 *
 * The return value added by U1.0b made the skip observable to a caller, and both ingest paths log
 * it — but the checker proved that surface is not a guarantee: it disabled the `console.warn` on
 * BOTH paths simultaneously and the entire 124-test suite stayed green. A log line nothing asserts
 * is one careless edit from silence, and silence here is exactly the ISS-116 failure (three whole
 * sessions absent from the index while every status field read "done").
 *
 * A `gaps` row is the honest surface: it survives the process, it is queryable by an operator, and
 * `GET /gaps` + the Dashboard already render this collection. `kind: "vector-pending"` is additive
 * — the two existing kinds describe content we never received; this describes content we HAVE and
 * cannot retrieve.
 *
 * IDEMPOTENT BY `_id`, deliberately: a re-index must not accumulate a second row for the same
 * session, and a success must CLEAR a previous failure's row rather than leaving a stale "open" gap
 * that outlives the problem it described. Both directions are one `updateOne` upsert on a derived
 * id, so there is no read-then-write race.
 */
export async function recordVectorGap(
  tenantId: string,
  sessionId: string,
  chunks: ChunkWriteResult,
  db: Pick<Db, "collection">,
): Promise<void> {
  const gapsColl = scopedCollection<Gaps>(db as never, "gaps");
  const _id = `vector-pending:${sessionId}`;
  if (chunks.skipped) {
    await gapsColl(tenantId).updateOne(
      { _id } as never,
      {
        $set: {
          tenantId,
          kind: "vector-pending",
          status: "open",
          sourceRef: sessionId,
          requestedAt: new Date().toISOString(),
          description: `Session ${sessionId} indexed but has no embedding vectors (${chunks.skipped}); it is absent from vector search.`,
        },
      } as never,
      { upsert: true },
    );
    return;
  }
  // Resolved. `updateOne` without upsert: a session that never failed must not gain a
  // "received" gap row describing a problem it never had.
  await gapsColl(tenantId).updateOne(
    { _id, status: "open" } as never,
    { $set: { status: "received" } } as never,
  );
}
