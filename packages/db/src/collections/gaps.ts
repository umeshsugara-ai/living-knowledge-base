// packages/db/src/collections/gaps.ts — T-006 C2. `coll(tenantId)` accessor matching T-018's
// sources/sessions/turns/claims pattern (scopedCollection: a tenant-less call is a TS compile
// error — see tenantScope.typecheck-test.ts), plus the four gap-lifecycle operations
// `packages/ingest/src/gap-tracking.ts`'s `recordGap` (C3) and the standing-ask process
// (docs/adr/0002-standing-ask-process.md) need on top of it (contract
// qa/contracts/recording-gap-tracking.md C2).
import type { Gaps } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function gaps(tenantId: string) {
  return scopedCollection<Gaps>(getDb(), "gaps")(tenantId);
}

/** Inserts a new gap doc (caller supplies `status`, normally `"open"`). */
export async function create(tenantId: string, doc: Omit<Gaps, "tenantId">): Promise<void> {
  await gaps(tenantId).insertOne(doc);
}

/** Standing ask was fulfilled — moves one gap to `"received"`, optionally linking the source. */
export async function markReceived(tenantId: string, gapId: string, sourceRef?: string): Promise<void> {
  await gaps(tenantId).raw.updateOne(
    { _id: gapId, tenantId },
    { $set: { status: "received", ...(sourceRef ? { sourceRef } : {}) } },
  );
}

/** SLA blew past `dueAt` with no response — moves one gap to `"expired"`. */
export async function markExpired(tenantId: string, gapId: string): Promise<void> {
  await gaps(tenantId).raw.updateOne({ _id: gapId, tenantId }, { $set: { status: "expired" } });
}

/** Every still-open gap for a tenant (what a standing-ask escalation sweep reads). */
export async function listOpen(tenantId: string): Promise<Gaps[]> {
  return gaps(tenantId)
    .find({ status: "open" })
    .toArray();
}
