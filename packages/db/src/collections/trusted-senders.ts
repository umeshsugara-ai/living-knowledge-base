// packages/db/src/collections/trusted-senders.ts — T-028. Tracks how many times a sender
// domain's meeting candidates have been manually approved. Umesh's own rule (2026-09-04): after
// 3 manual approvals from the same sender, future candidates from it auto-confirm.
import { randomUUID } from "node:crypto";
import type { TrustedSenders } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export const AUTO_APPROVE_THRESHOLD = 3;

export function trustedSenders(tenantId: string) {
  return scopedCollection<TrustedSenders>(getDb(), "trusted_senders")(tenantId);
}

export async function get(tenantId: string, senderDomain: string): Promise<TrustedSenders | null> {
  return trustedSenders(tenantId).findOne({ senderDomain });
}

/** Records one manual approval for a sender domain, upserting the row. Flips `autoApprove` to
 * true once `approvalCount` reaches `AUTO_APPROVE_THRESHOLD` — never flips it back off here
 * (a rejection doesn't un-trust a sender that already earned it; that's a separate policy
 * decision if it's ever needed). Returns the row's state after the update. */
export async function recordApproval(tenantId: string, senderDomain: string): Promise<TrustedSenders> {
  const existing = await get(tenantId, senderDomain);
  const approvalCount = (existing?.approvalCount ?? 0) + 1;
  const autoApprove = existing?.autoApprove || approvalCount >= AUTO_APPROVE_THRESHOLD;
  const lastApprovedAt = new Date().toISOString();

  if (existing) {
    await trustedSenders(tenantId).updateOne(
      { _id: existing._id },
      { $set: { approvalCount, autoApprove, lastApprovedAt } },
    );
    return { ...existing, approvalCount, autoApprove, lastApprovedAt };
  }

  const doc: TrustedSenders = { _id: randomUUID(), tenantId, senderDomain, approvalCount, autoApprove, lastApprovedAt };
  await trustedSenders(tenantId).insertOne(doc);
  return doc;
}
