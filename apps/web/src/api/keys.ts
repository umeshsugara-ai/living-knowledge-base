import { apiFetch } from "./client.js";

export interface ApiKeySummary {
  _id: string;
  label: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
}

export function listKeys(apiKey: string | null): Promise<{ keys: ApiKeySummary[] }> {
  return apiFetch("/keys", apiKey);
}

export function createKey(apiKey: string | null, label: string, scopes: string[]): Promise<{ id: string; key: string }> {
  return apiFetch("/keys", apiKey, { method: "POST", body: { label, scopes } });
}

export function revokeKey(apiKey: string | null, id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/keys/${encodeURIComponent(id)}`, apiKey, { method: "DELETE" });
}
