// packages/db/src/collections/meeting-candidates.ts — T-028. `coll(tenantId)` accessor matching
// the sources/sessions/gaps pattern, plus the lifecycle operations the Gmail scan + approval
// routes need: dedup-by-messageId insert, list pending/decided, and a status transition.
import type { MeetingCandidates } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function meetingCandidates(tenantId: string) {
  return scopedCollection<MeetingCandidates>(getDb(), "meeting_candidates")(tenantId);
}

/** Inserts a new candidate iff no row with this `messageId` already exists for the tenant
 * (real Gmail messages never duplicate this way naturally, but a re-scan must not re-insert
 * one). Returns true if a new row was written. */
export async function createIfNew(tenantId: string, doc: Omit<MeetingCandidates, "tenantId">): Promise<boolean> {
  const existing = await meetingCandidates(tenantId).findOne({ messageId: doc.messageId as string });
  if (existing) return false;
  await meetingCandidates(tenantId).insertOne(doc);
  return true;
}

/** Every candidate still awaiting a human decision. */
export async function listPending(tenantId: string): Promise<MeetingCandidates[]> {
  return meetingCandidates(tenantId).find({ status: "pending" }).toArray();
}

/** Every candidate, most recently detected first — the full review list (pending + decided). */
export async function listAll(tenantId: string): Promise<MeetingCandidates[]> {
  return meetingCandidates(tenantId).find({}).sort({ detectedAt: -1 }).toArray();
}

/** Moves one candidate to a decided status, stamping `decidedAt`. Returns false if the id
 * doesn't belong to this tenant or was already decided. */
export async function decide(
  tenantId: string,
  id: string,
  status: "approved" | "rejected" | "auto_approved",
): Promise<boolean> {
  const result = await meetingCandidates(tenantId).updateOne(
    { _id: id, status: "pending" },
    { $set: { status, decidedAt: new Date().toISOString() } },
  );
  return result.matchedCount > 0;
}
