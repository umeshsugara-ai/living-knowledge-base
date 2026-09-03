/**
 * packages/ask/src/eval/heuristic-scorer.ts — T-022. A small, self-contained, non-LLM `ScoreFn`
 * built for the calibration harness — `packages/ask` cannot depend on `apps/api` (score.ts's real
 * `heuristicScore`) or `packages/index` (eval/heuristic-retriever.ts) per `.dependency-cruiser.
 * cjs`'s downward-only rules, so this is a small purpose-built scorer, not an illegal cross-import
 * of either. Same bag-of-words keyword-overlap technique as its siblings in those packages.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { ScoreFn } from "../evaluator.js";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

/** Scores `query` against `node.title + " " + node.summary` by fraction of query tokens found. */
export const heuristicScorer: ScoreFn = (query: string, node: TreeIndexNode) => {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [0, "empty query"];
  const nodeTokens = tokenize(`${node.title} ${node.summary}`);
  let overlap = 0;
  for (const t of queryTokens) if (nodeTokens.has(t)) overlap += 1;
  const score = overlap / queryTokens.size;
  return [score, `${overlap}/${queryTokens.size} query terms matched title+summary (heuristic, not LLM)`];
};
