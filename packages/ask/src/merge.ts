/**
 * packages/ask/src/merge.ts — plan §10 U1.5. Reciprocal-rank fusion of retrieval arms.
 *
 * PURE, and it deliberately knows nothing about vectors, lexical search or the tree. It takes
 * ranked lists of nodes and returns one ranked list. That is what lets it live in `packages/ask`
 * without importing `packages/index` (contract C10, enforced by dependency-cruiser): the ARMS are
 * built at the composition root, which may import both, and only their results come in here.
 *
 * THE REAL DESIGN DECISION IS THE KEY, not the formula (contract C3).
 *
 * Plan §10 says "deduped by turnId". That is unimplementable as written, and the contract says so:
 * the three arms speak three different id vocabularies — tree search yields `node_id`, the vector
 * retriever yields `sessionId`, and lexical search yields `turnId`. There is no field all three
 * carry. Deduping on a field two of them lack would silently dedupe nothing, which is worse than
 * not deduping at all, because the merge would *look* correct while one long session's chunks
 * crowded the list.
 *
 * So the key is explicit, total, and injected: the caller supplies `keyOf`, and every arm's nodes
 * must be resolvable through it. The one used in production maps every arm back to `node_id`,
 * because contract C2 requires the thunk to yield nodes that exist in this tenant's loaded tree —
 * so `node_id` is the only vocabulary all three necessarily share by the time they get here.
 */

/** Reciprocal-rank fusion's smoothing constant. */
export const RRF_K = 60;

export interface RrfOptions<T> {
  /** Total function to a stable identity. Two items with the same key are the same result. */
  keyOf: (item: T) => string;
  /** Smoothing constant. Higher flattens the contribution of rank position. */
  k?: number;
}

/**
 * Fuses ranked arms into one ranked list, best first.
 *
 * Score is the standard `sum over arms of 1 / (k + rank)`, rank being 1-based within its arm. An
 * item found by two arms therefore outranks an item found once at the same position — which is the
 * entire point of fusing rather than concatenating.
 *
 * DETERMINISTIC BY CONSTRUCTION (contract C4). Ties break on the key, so the same inputs always
 * produce the same ORDER, not merely the same set. Without that, a recall number measured twice on
 * one corpus could differ, and the delta U1.5 exists to report would be untrustworthy — the same
 * reasoning `rankByCosine` already carries.
 *
 * @param arms ranked lists, best-first within each. Empty arms are allowed and contribute nothing,
 *        which is what lets a failed vector arm degrade to tree+lexical without a special case.
 */
export function rrfMerge<T>(arms: T[][], options: RrfOptions<T>): T[] {
  const { keyOf, k = RRF_K } = options;
  const scores = new Map<string, number>();
  // First occurrence wins as the representative object: arms are ordered by trust at the call
  // site, so the earlier arm's node is the one carrying the richer `summary` the refine step reads.
  const firstSeen = new Map<string, T>();

  for (const arm of arms) {
    for (let i = 0; i < arm.length; i++) {
      const item = arm[i]!;
      const key = keyOf(item);
      scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
      if (!firstSeen.has(key)) firstSeen.set(key, item);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key]) => firstSeen.get(key)!);
}
