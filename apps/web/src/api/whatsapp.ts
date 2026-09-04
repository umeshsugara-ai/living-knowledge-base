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

export function ingestWhatsAppGroup(
  apiKey: string | null,
  groupJid: string,
  ownerUserId: string,
): Promise<WhatsAppIngestResult> {
  return apiFetch("/whatsapp/ingest", apiKey, { method: "POST", body: { groupJid, ownerUserId } });
}
