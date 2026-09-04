import { apiFetch } from "./client.js";
import type { Graph } from "./types.js";

export function loadGraph(apiKey: string | null): Promise<Graph> {
  return apiFetch("/graph", apiKey);
}
