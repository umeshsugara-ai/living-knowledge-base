/**
 * packages/index/src/tree/promote-entities.ts — plan §10 U2.1.
 *
 * Promotes the `topic` and `org` nodes the tree ALREADY holds into standalone entity rows.
 *
 * NO LLM, and that is the point. `topics`, `orgs`, `speakers`, `decisions` and `graph_edges` are
 * five of the eleven collections that have schemas, generated types and accessors but have never
 * held a row — which is why eight of catalogue group B's thirteen features score MISSING. Three of
 * those need an extraction pass that does not exist yet. Topics and orgs do not: `buildTree`
 * already derives them, already dedupes them by slug, and already unions `evidence.sessionRefs`
 * across every session that surfaced a topic. This function just reads what is there.
 *
 * So this is the cheapest honest win in Phase 2: deterministic, re-runnable, and impossible to
 * hallucinate, because every row is derived from a node that already survived the tree build.
 *
 * PURE, no I/O — the caller persists. Same shape as every other function in this package.
 */
import type { TreeIndexNode } from "@lkb/core";

export interface PromotedTopic {
  _id: string;
  name: string;
  sessionRefs: string[];
}

export interface PromotedOrg {
  _id: string;
  name: string;
}

export interface PromotedEntities {
  topics: PromotedTopic[];
  orgs: PromotedOrg[];
}

/** The slug is the last path segment of `node_id` (`…/topic:<slug>`, `…/org:<slug>`). Taken from
 * the id rather than re-slugifying the title, so this cannot drift from `buildTree`'s own slug
 * rule — one definition, not two that agree until someone edits one. */
function slugOf(nodeId: string, prefix: "topic" | "org"): string {
  const marker = `/${prefix}:`;
  const i = nodeId.lastIndexOf(marker);
  return i === -1 ? "" : nodeId.slice(i + marker.length);
}

function walk(node: TreeIndexNode, visit: (n: TreeIndexNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * @returns topics and orgs, each deduped by slug, in stable id order.
 *
 * A topic surfaced by several sessions yields ONE row whose `sessionRefs` is the union — which is
 * exactly the cross-session signal that makes a topic worth having as an entity at all (a topic
 * appearing in one session is barely more than a tag). `buildTree` already computes that union per
 * node; this unions again across nodes rather than trusting any single one, because a node's
 * `sessionRefs` is only as complete as the build that produced it.
 */
export function promoteTreeEntities(root: TreeIndexNode): PromotedEntities {
  const topics = new Map<string, PromotedTopic>();
  const orgs = new Map<string, PromotedOrg>();

  walk(root, (n) => {
    if (n.level === "topic") {
      const slug = slugOf(n.node_id, "topic");
      if (slug === "") return;
      const existing = topics.get(slug);
      const refs = new Set(existing?.sessionRefs ?? []);
      for (const r of (n.evidence?.sessionRefs ?? []) as string[]) refs.add(r);
      // `sessionRef` (the node's own parent session) is a real occurrence even when the build
      // omitted it from `sessionRefs`; including it can only make coverage more complete.
      if (n.evidence?.sessionRef) refs.add(n.evidence.sessionRef);
      topics.set(slug, { _id: slug, name: existing?.name ?? n.title, sessionRefs: [...refs].sort() });
    } else if (n.level === "org") {
      const slug = slugOf(n.node_id, "org");
      if (slug === "") return;
      if (!orgs.has(slug)) orgs.set(slug, { _id: slug, name: n.title });
    }
  });

  const byId = <T extends { _id: string }>(a: T, b: T) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);
  return { topics: [...topics.values()].sort(byId), orgs: [...orgs.values()].sort(byId) };
}

/**
 * Which topic slugs a claim's evidence turns place it in.
 *
 * `claims.topicRefs` exists in the schema and has been `[]` on all 81 real claims since T-002 —
 * nothing has ever written it. A claim belongs to a topic when the SESSION it is evidenced in is
 * one of that topic's `sessionRefs`. That is a deliberately weak, deterministic rule: it can
 * over-include (a session covering three topics tags its claims with all three) but it cannot
 * invent a link, because both sides come from ids that already exist. Narrowing it correctly needs
 * turn-level topic attribution, which is U2.3's LLM pass, not this one.
 */
export function topicRefsForSession(sessionId: string, topics: PromotedTopic[]): string[] {
  return topics.filter((t) => t.sessionRefs.includes(sessionId)).map((t) => t._id).sort();
}
