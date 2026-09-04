import { apiFetch } from "./client.js";
import type { SessionDetail, SessionSummary } from "./types.js";

export function listSessions(apiKey: string | null): Promise<{ sessions: SessionSummary[] }> {
  return apiFetch("/sessions", apiKey);
}

export function getSession(apiKey: string | null, id: string): Promise<SessionDetail> {
  return apiFetch(`/sessions/${encodeURIComponent(id)}`, apiKey);
}
