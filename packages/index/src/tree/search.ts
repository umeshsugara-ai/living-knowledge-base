/**
 * packages/index/src/tree/search.ts — retrieval half of the vectorless tree pattern (port of
 * tree_index/tree_search.py, T-004 → T-016; behaviour-identical).
 *
 * `treeSearch` is a plain tree-walk lookup by node_id. It performs NO reasoning and NO LLM
 * call itself — in the full CRAG/PageIndex flow an LLM reads the tree, reasons over it, and
 * returns the node_ids it thinks are relevant; this function resolves those ids back to full
 * node objects (with their summaries) for the next stage (evaluator / answer generation).
 */
import type { TreeIndexNode } from "@lkb/core";

function* walk(node: TreeIndexNode): Generator<TreeIndexNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

/**
 * `tree` is a single root node (e.g. one tenant's root from buildTree's output).
 * Returns the nodes whose node_id is in `nodeIds`, in depth-first order.
 * Unknown ids are simply absent from the result (never an error).
 */
export function treeSearch(tree: TreeIndexNode, nodeIds: string[]): TreeIndexNode[] {
  const wanted = new Set(nodeIds);
  const found: TreeIndexNode[] = [];
  for (const node of walk(tree)) if (wanted.has(node.node_id)) found.push(node);
  return found;
}
