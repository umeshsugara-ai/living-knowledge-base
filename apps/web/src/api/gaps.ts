import { apiFetch } from "./client.js";
import type { Gap } from "./types.js";

export function listGaps(apiKey: string | null): Promise<{ gaps: Gap[] }> {
  return apiFetch("/gaps", apiKey);
}
