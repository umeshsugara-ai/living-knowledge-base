import { apiFetch } from "./client.js";

export interface WhatsAppGroup {
  groupJid: string;
  ownerUserId: string;
  subject: string;
  trackedPersonCount: number;
}

export interface WhatsAppIngestResult {
  sessionId: string;
  sourceId: string;
  turnCount: number;
}

export function listWhatsAppGroups(apiKey: string | null): Promise<{ groups: WhatsAppGroup[] }> {
  return apiFetch("/whatsapp/groups", apiKey);
}

// ownerUserId is intentionally NOT sent -- the real backend resolves it itself from the live
// trackable-groups list (2026-09-06 data-engineer review: a client-supplied owner id would let
// any whatsapp-scoped key ingest a different archiver owner's private groups).
export function ingestWhatsAppGroup(apiKey: string | null, groupJid: string): Promise<WhatsAppIngestResult> {
  return apiFetch("/whatsapp/ingest", apiKey, { method: "POST", body: { groupJid } });
}
