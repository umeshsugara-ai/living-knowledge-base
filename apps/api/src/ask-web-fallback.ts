/**
 * apps/api/src/ask-web-fallback.ts — ISS-010: the real `tavilySearchFn` (packages/ask's
 * `AskV2Deps.tavilySearchFn`) for `POST /ask`'s web-supplement path. Same composition-root
 * pattern as `ingest-store.ts`'s `jinaReaderFetch` — a plain `fetch` call, no vendor SDK, no
 * abstraction the rest of the codebase doesn't already use for a single external HTTP call.
 *
 * Tavily's Search API: `POST https://api.tavily.com/search`, `{ api_key, query, max_results }`
 * body, `{ results: [{ title, url, content }, ...] }` response. Each result is passed straight
 * through as a `WebSource` — its `content` key already matches what `ask-v2.ts`'s `webDocText()`
 * looks for, so no field-mapping layer is needed.
 *
 * Gated on `TAVILY_API_KEY`: `createTavilySearchFn()` returns `undefined` when the key is unset
 * (real today — `.env`'s `TAVILY_API_KEY` is empty pending Umesh adding a real one), so
 * `production.ts` simply omits `tavilySearchFn` from `askDeps` in that case and `/ask` keeps its
 * current, honest `insufficient_coverage: true` behavior — this file changes nothing until a
 * real key exists.
 */
import type { WebSource } from "@lkb/ask";

interface TavilyResponse {
  results?: { title?: string; url?: string; content?: string }[];
}

async function tavilySearch(apiKey: string, query: string): Promise<WebSource[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
  });
  if (!res.ok) throw new Error(`Tavily search failed (HTTP ${res.status})`);
  const body = (await res.json()) as TavilyResponse;
  return (body.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content }));
}

/** Returns `undefined` (never a function that would always fail) when no `TAVILY_API_KEY` is
 * configured, so a caller can `...( tavilySearchFn ? { tavilySearchFn } : {} )` it into place
 * without ever wiring a guaranteed-broken fallback. */
export function createTavilySearchFn(): ((query: string) => Promise<WebSource[]>) | undefined {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return undefined;
  return (query: string) => tavilySearch(apiKey, query);
}
