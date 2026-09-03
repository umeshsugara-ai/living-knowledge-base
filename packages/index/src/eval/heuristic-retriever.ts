/**
 * packages/index/src/eval/heuristic-retriever.ts — T-021 C3. A NON-LLM stand-in for
 * `packages/ask`'s real `selectNodes` (which reasons over the tree via an LLM call). Ranks a
 * tenant's session nodes by keyword-overlap between the question and each session node's
 * `summary`, same bag-of-words technique as `apps/api/src/score.ts`'s `heuristicScore` and
 * `extract-topics.ts`'s heuristic extractor. Explicitly a proxy for retrieval-harness testing
 * while the real LLM path is blocked (ISS-015, invalid GEMINI_API_KEY) — NOT a claim that this
 * measures the real pipeline's recall.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { RetrieveFn } from "./recall.js";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

function overlapScore(questionTokens: Set<string>, summary: string): number {
  if (questionTokens.size === 0) return 0;
  const summaryTokens = tokenize(summary);
  let overlap = 0;
  for (const t of questionTokens) if (summaryTokens.has(t)) overlap += 1;
  return overlap / questionTokens.size;
}

function* sessionNodes(tree: TreeIndexNode): Generator<TreeIndexNode> {
  if (tree.level === "session") yield tree;
  for (const child of tree.children) yield* sessionNodes(child);
}

/** `tree` — one tenant's root node (buildTree's output for a single tenantId). */
export function createHeuristicRetriever(tree: TreeIndexNode): RetrieveFn {
  const sessions = [...sessionNodes(tree)];

  return (question: string, k: number): string[] => {
    const questionTokens = tokenize(question);
    const scored = sessions
      .map((node) => ({
        sessionId: node.evidence?.sessionRef as string | undefined,
        score: overlapScore(questionTokens, node.summary),
      }))
      .filter((s): s is { sessionId: string; score: number } => s.sessionId !== undefined && s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, k).map((s) => s.sessionId);
  };
}
