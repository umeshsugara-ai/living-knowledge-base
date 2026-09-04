import { apiFetch } from "./client.js";

export interface IngestResult {
  sessionId: string;
  sourceId: string;
  turnCount: number;
}

export function ingestUrl(apiKey: string | null, url: string): Promise<IngestResult> {
  return apiFetch("/ingest", apiKey, { method: "POST", body: { url } });
}
