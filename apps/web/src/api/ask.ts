/**
 * apps/web/src/api/ask.ts — client for `POST /ask` (apps/api/src/routes/ask.ts). Uses the shared
 * `apiFetch` wrapper so the Bearer key, base URL and typed `ApiError` behaviour are identical to
 * every other page's calls; no bespoke fetch logic lives here.
 */
import { apiFetch } from "./client.js";
import type { AskResponse } from "./types.js";

export function ask(apiKey: string | null, query: string): Promise<AskResponse> {
  return apiFetch("/ask", apiKey, { method: "POST", body: { query } });
}
