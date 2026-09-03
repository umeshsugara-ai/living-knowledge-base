/**
 * packages/ask/src/refine.ts — T-005b C2. CRAG's decompose -> filter -> recompose, applied to
 * BOTH internal (`good_docs`) and web-fallback docs on an `ambiguous`/`incorrect` verdict — the
 * gap the AI-engineer lens flagged as "refine web docs too — currently missing in router.py".
 *
 * decompose: split each doc's text into sentence-level strips.
 * filter: per-strip keep/drop, one injected `complete` call per strip (auditable per-strip).
 * recompose: join the kept strips (doc order, strip order preserved) into one context string.
 */
import type { CompleteResult } from "@lkb/ai";
import type { CompleteFn } from "./select-nodes.js";

/** The minimal shape `refine` needs from a doc — callers adapt tree nodes / web results to this. */
export interface RefinableDoc {
  text: string;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** decompose: sentence-level strips, empty/whitespace-only strips dropped before filtering. */
export function decompose(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildFilterPrompt(query: string, strip: string): string {
  return [
    `Query: ${query}`,
    `Candidate passage: ${strip}`,
    "Is this passage relevant to answering the query?",
    `Reply with JSON only: {"keep": true} or {"keep": false}`,
  ].join("\n");
}

/** Parses `{keep: boolean}` out of a completion's `json` field, falling back to its `text`. */
export function parseKeep(completion: CompleteResult): boolean {
  const candidate = completion.json ?? tryParseJson(completion.text);
  if (candidate !== null && typeof candidate === "object" && "keep" in candidate) {
    return Boolean((candidate as { keep: unknown }).keep);
  }
  return /true/i.test(completion.text) && !/false/i.test(completion.text);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * `docs` are refined independently, in order; kept strips across all docs are joined with a
 * single space into one recomposed context string (doc order, strip order preserved).
 */
export async function refine(
  docs: RefinableDoc[],
  query: string,
  complete: CompleteFn,
): Promise<string> {
  const kept: string[] = [];
  for (const doc of docs) {
    for (const strip of decompose(doc.text)) {
      const completion = await complete({
        kind: "ask.refine_strip",
        messages: [{ role: "user", content: buildFilterPrompt(query, strip) }],
      });
      if (parseKeep(completion)) kept.push(strip);
    }
  }
  return kept.join(" ");
}
