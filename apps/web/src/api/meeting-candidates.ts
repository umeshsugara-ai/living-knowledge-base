import { apiFetch } from "./client.js";
import type { MeetingCandidate } from "./types.js";

export function scanGmail(apiKey: string | null): Promise<{ created: number; autoApproved: number }> {
  return apiFetch("/gmail/scan", apiKey, { method: "POST" });
}

export function listMeetingCandidates(apiKey: string | null): Promise<{ candidates: MeetingCandidate[] }> {
  return apiFetch("/meeting-candidates", apiKey);
}

export function approveMeetingCandidate(apiKey: string | null, id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/meeting-candidates/${encodeURIComponent(id)}/approve`, apiKey, { method: "POST" });
}

export function rejectMeetingCandidate(apiKey: string | null, id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/meeting-candidates/${encodeURIComponent(id)}/reject`, apiKey, { method: "POST" });
}
