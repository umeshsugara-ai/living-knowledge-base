/**
 * packages/index/src/tree/extract-topics.ts — topic-name extraction for tree-index v2 (T-004b).
 *
 * `extractTopicRefs` is a pure, network-free heuristic: it reads the existing `summary` and
 * `keyInsights` fields T-002 already populated on a `session_pages` document and pulls out
 * proper-noun-ish phrases (capitalized word runs) as candidate topic names, most-frequent-first.
 * No LLM call is required to satisfy the contract; `build.ts` accepts this as its default
 * `extractFn` but can be handed an LLM-backed replacement with the same signature (tested with a
 * fake, same "injectable, real-by-default-but-fakeable" pattern as `summarize` in build.ts).
 */
import type { SessionPages } from "@lkb/core";

export type ExtractTopicRefs = (sessionPage: SessionPages | null) => string[];

/** Words too generic to stand alone as a topic, even though they're capitalized at a sentence start. */
const STOPWORDS = new Set([
  "The", "A", "An", "This", "That", "These", "Those", "It", "He", "She", "They", "We", "You", "I",
  "His", "Her", "Their", "Its", "Our", "Your", "In", "On", "At", "For", "With", "As", "By", "From",
  "And", "Or", "But", "If", "So", "Because", "When", "While", "After", "Before", "About", "Into",
  "Both", "Only", "Same", "Not",
]);

/** Runs of 1-4 capitalized words, e.g. "New Zealand", "HDFC Credila", "Section". */
const PHRASE_RE = /\b[A-Z][A-Za-z0-9&'.]*(?:\s+[A-Z][A-Za-z0-9&'.]*){0,3}\b/g;

const MAX_TOPICS = 6;

/**
 * Extracts candidate topic-name strings from a session_page's summary + keyInsights text.
 * Returns [] for a null page (no page indexed yet) or when no candidate phrase survives
 * filtering. Order: most frequent phrase first (ties keep first-seen order), capped at
 * `MAX_TOPICS` per session so a session doesn't flood its topic children.
 */
export function extractTopicRefs(sessionPage: SessionPages | null): string[] {
  if (sessionPage === null) return [];

  const text = [sessionPage.summary ?? "", ...(sessionPage.keyInsights ?? [])].join(" ");
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const match of text.matchAll(PHRASE_RE)) {
    const phrase = match[0].trim();
    if (phrase.length < 2) continue;

    const words = phrase.split(/\s+/);
    if (words.every((w) => STOPWORDS.has(w))) continue;

    if (!counts.has(phrase)) order.push(phrase);
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  return order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, MAX_TOPICS);
}
