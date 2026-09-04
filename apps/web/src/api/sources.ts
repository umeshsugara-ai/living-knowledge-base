import { apiFetch } from "./client.js";
import type { Source } from "./types.js";

export function listSources(apiKey: string | null): Promise<{ sources: Source[] }> {
  return apiFetch("/sources", apiKey);
}
