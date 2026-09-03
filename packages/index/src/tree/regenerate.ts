/**
 * packages/index/src/tree/regenerate.ts — incremental tree-index regeneration (T-004b, C3).
 *
 * `regenerate` rebuilds only the year subtrees touched by `changedSessionIds`, leaving every
 * other year (and everything under it — months, sessions, topic/org children) as the exact same
 * object reference from the input `tree`, so an untouched subtree is trivially `===`- and
 * deep-equal-comparable to what buildTree would have produced from scratch. This mirrors the
 * "regenerate before you can ship" discipline ARCHITECTURE §5 already established for
 * SNAPSHOT.md, applied here to the tree index itself.
 *
 * Scope note: `tree` is a single tenant root (buildTree's output is keyed by tenant; pass
 * `tree[tenantId]`), matching search.ts's "operate on one root" convention. A changed session
 * that *moved* year (its `date` changed) is handled — its new year is rebuilt from `sessions` —
 * but a now-orphaned node under its *old* year is only cleaned up if that old year also contains
 * another changed session; this is a heuristic incremental path, not a full diff, and full
 * correctness after a date-changing edit is a follow-up if it's ever needed. Cross-session topic
 * evidence (`evidence.sessionRefs`) is recomputed only from the sessions in the touched years —
 * a topic shared with an untouched year won't pick up the new session there until that year is
 * itself touched. Both are acceptable for the "same year edited repeatedly" hot path this
 * function targets.
 */
import type { SessionPages, Sessions, TreeIndexNode } from "@lkb/core";
import { buildTree } from "./build.js";
import { extractTopicRefs, type ExtractTopicRefs } from "./extract-topics.js";

/**
 * `tree` — one tenant's root node (as found at `buildTree(...)[tenantId]`).
 * `changedSessionIds` — session `_id`s that were added or updated since `tree` was built.
 * `sessions` / `sessionPages` — the FULL current collections (not just the changed ones); needed
 * because a touched year must be rebuilt with all its sessions, not only the changed subset.
 * `extractFn` — same injectable seam as `buildTree`; must match what built `tree` originally to
 * keep unrelated topic ids stable.
 */
export function regenerate(tree: TreeIndexNode, changedSessionIds: string[], sessions: Sessions[],
  sessionPages: SessionPages[], extractFn: ExtractTopicRefs = extractTopicRefs): TreeIndexNode {
  const tenantId = tree.node_id.replace(/^tenant:/, "");
  const changed = new Set(changedSessionIds);

  const changedSessions = sessions.filter((s) => s.tenantId === tenantId && changed.has(s._id));
  const touchedYears = new Set(changedSessions.map((s) => s.date.slice(0, 4)));

  if (touchedYears.size === 0) return tree; // nothing in changedSessionIds belongs here

  const tenantSessions = sessions.filter((s) => s.tenantId === tenantId
    && touchedYears.has(s.date.slice(0, 4)));

  const rebuilt = buildTree(tenantSessions, sessionPages, undefined, extractFn)[tenantId];

  const untouchedYearChildren = tree.children.filter((yearNode) => !touchedYears.has(yearNode.title));
  const rebuiltYearChildren = rebuilt?.children ?? [];

  return {
    ...tree,
    children: [...untouchedYearChildren, ...rebuiltYearChildren],
  };
}
