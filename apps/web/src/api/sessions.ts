import { apiFetch } from "./client.js";
import type { SessionDetail, SessionSummary } from "./types.js";

function normalizeSessionPathParam(value: string): string {
  // Accept route params whether they arrive encoded or decoded, and avoid double-encoding.
  // decodeURIComponent throws on malformed payloads; in that case we fall back to raw encoding.
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export function listSessions(apiKey: string | null): Promise<{ sessions: SessionSummary[] }> {
  return apiFetch("/sessions", apiKey);
}

export function getSession(apiKey: string | null, id: string): Promise<SessionDetail> {
  return apiFetch(`/sessions/${normalizeSessionPathParam(id)}`, apiKey);
}
