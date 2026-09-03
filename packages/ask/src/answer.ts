/**
 * packages/ask/src/answer.ts — T-005b C3. Final generation from refined context via the
 * injected `complete`. `sources` pass through unchanged — internal/web stay separated exactly
 * as T-005's `ask()` already produces them; this step never merges or re-labels them.
 */
import type { CompleteFn } from "./select-nodes.js";

export interface AnswerResult<Sources> {
  text: string;
  sources: Sources;
}

function buildPrompt(query: string, refinedContext: string): string {
  return [
    `Query: ${query}`,
    "Context (already refined — decomposed, filtered, recomposed):",
    refinedContext,
    "Answer the query using only the context above.",
  ].join("\n");
}

export async function answer<Sources>(
  query: string,
  refinedContext: string,
  sources: Sources,
  complete: CompleteFn,
): Promise<AnswerResult<Sources>> {
  const completion = await complete({
    kind: "ask.answer",
    messages: [{ role: "user", content: buildPrompt(query, refinedContext) }],
  });
  return { text: completion.text, sources };
}
