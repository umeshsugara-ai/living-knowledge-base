/**
 * apps/api/src/score.ts — T-009 production wiring gap, disclosed rather than hidden.
 * `@lkb/ask`'s `ScoreFn` is synchronous (`packages/ask/src/evaluator.ts`), so an LLM-based judge
 * (necessarily async) cannot be plugged in without changing that interface — out of scope for
 * this contract (C1-C8 only ask for a real `treeSearchFn` and a real `complete`; a real evaluator
 * scorer is T-005/T-005b territory). `heuristicScore` is a deterministic keyword-overlap stand-in
 * so production `/ask` is not silently unscored while that seam stays sync; swap for a real
 * scorer once evaluator.ts's `ScoreFn` grows an async variant.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { ScoreFn } from "@lkb/ask";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

export const heuristicScore: ScoreFn = (query, node: TreeIndexNode) => {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [0, "empty query"];
  const nodeTokens = tokenize(`${node.title} ${node.summary}`);
  let overlap = 0;
  for (const t of queryTokens) if (nodeTokens.has(t)) overlap += 1;
  const score = overlap / queryTokens.size;
  return [score, `${overlap}/${queryTokens.size} query terms matched title+summary (heuristic, not LLM)`];
};
