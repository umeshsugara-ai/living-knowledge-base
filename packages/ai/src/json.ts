/**
 * packages/ai/src/json.ts — shared LLM-JSON-reply parsing. Real bug found live (2026-09-04)
 * running `/ask` against the real server for the first time: Gemini routinely wraps a
 * requested-JSON-only reply in a markdown code fence (` ```json\n{...}\n``` `) even when told
 * "reply with JSON only" — a bare `JSON.parse(text)` throws on that and every caller that fell
 * back to it (packages/ask's selectNodes and refine, apps/api's LLM judge) silently treated a
 * valid answer as "couldn't parse", either dropping it to an empty result or degrading to a
 * cruder heuristic. One shared parser fixes all three call sites instead of patching each's own
 * copy of the same broken try/catch.
 */
const FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;

/** Best-effort JSON.parse that also handles a reply wrapped in a markdown code fence. Returns
 * `null` (never throws) if neither the raw text nor its unfenced form is valid JSON. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = FENCE_RE.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]!.trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}
