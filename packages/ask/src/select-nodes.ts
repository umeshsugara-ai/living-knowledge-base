/**
 * packages/ask/src/select-nodes.ts — T-005b C1. The missing query -> node_ids reasoning step
 * flagged by the AI-engineer lens: `packages/index`'s `treeSearch(tree, node_ids)` expects
 * candidate ids to already be picked; this module is what picks them.
 *
 * Builds a prompt listing every node's `{node_id, title, summary}`, calls the injected
 * `complete` (T-019's `Provider['complete']` shape), parses a `{node_ids: string[]}` JSON
 * response out of the reply, and resolves those ids back to full nodes via an injected
 * `treeSearchFn` matching `packages/index`'s `treeSearch(tree, nodeIds)` shape.
 *
 * `treeSearchFn` is DI, not a direct `@lkb/index` import: ARCHITECTURE §5 / the enforced
 * `.dependency-cruiser.cjs` rule `ask-index-ingest-only-ai-db-core` forbids `packages/ask` from
 * importing `packages/index` (siblings under that rule may only depend on `ai|db|core`). The
 * composition root that wires `askV2` together (an `apps/*` caller, which the rules DO allow to
 * depend on both `ask` and `index`) passes `@lkb/index`'s real `treeSearch` in here — the exact
 * same reuse the contract asks for, at the layer the dependency rules actually permit it.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";

export type CompleteFn = (job: Job) => Promise<CompleteResult>;

/** Matches `packages/index`'s `treeSearch(tree, nodeIds)` signature exactly (injected, see above). */
export type NodeSearchFn = (tree: TreeIndexNode, nodeIds: string[]) => TreeIndexNode[];

/**
 * Depth-first flatten. `packages/index/src/tree/search.ts` has an equivalent private `walk`
 * generator but does not export it (only `treeSearch` is exported), and `packages/ask` cannot
 * import `packages/index` regardless (see module doc) — so this small, single-purpose DFS is
 * the minimal non-duplicative option, not a re-implementation of anything reachable here.
 */
function flatten(node: TreeIndexNode): TreeIndexNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function buildPrompt(query: string, nodes: TreeIndexNode[]): string {
  const listing = nodes
    .map((n) => `- ${n.node_id} | ${n.title} | ${n.summary}`)
    .join("\n");
  return [
    `Query: ${query}`,
    "Below is a flattened index tree as `node_id | title | summary` lines.",
    "Pick the node_ids most likely to contain the answer.",
    `Reply with JSON only: {"node_ids": ["..."]}`,
    "Tree:",
    listing,
  ].join("\n");
}

/** Parses `{node_ids: string[]}` out of a completion's `json` field, falling back to its `text`. */
export function parseNodeIds(completion: CompleteResult): string[] {
  const candidate = completion.json ?? tryParseJson(completion.text);
  if (
    candidate !== null &&
    typeof candidate === "object" &&
    Array.isArray((candidate as { node_ids?: unknown }).node_ids)
  ) {
    return (candidate as { node_ids: unknown[] }).node_ids.filter(
      (id): id is string => typeof id === "string",
    );
  }
  return [];
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * `tree` is a single root node (e.g. one tenant's root from `buildTree`'s output).
 * Returns the full nodes (with summaries) that the LLM selected, resolved via `treeSearchFn` —
 * never the raw node_ids, and never nodes the model didn't ask for.
 */
export async function selectNodes(
  query: string,
  tree: TreeIndexNode,
  complete: CompleteFn,
  treeSearchFn: NodeSearchFn,
): Promise<TreeIndexNode[]> {
  const flattened = flatten(tree);
  const prompt = buildPrompt(query, flattened);
  const completion = await complete({ kind: "ask.select_nodes", messages: [{ role: "user", content: prompt }] });
  const nodeIds = parseNodeIds(completion);
  return treeSearchFn(tree, nodeIds);
}
