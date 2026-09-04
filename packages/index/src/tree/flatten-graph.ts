/**
 * packages/index/src/tree/flatten-graph.ts — flattens a real `tree_index` root into a generic
 * `{nodes, edges}` graph payload a force-directed viz can render directly (plan §8b phase 2,
 * "Obsidian-style" brain view). Pure function, no I/O — same seam pattern as `build.ts`/
 * `search.ts` living together in this package.
 *
 * Node inclusion: only `session`/`topic`/`org` levels. `tenant`/`year`/`month` are deliberately
 * excluded — they're temporal/organizational scaffolding (a single root, thin year/month
 * pass-throughs at today's data volume), not an associative relationship, and add visual noise
 * to a "brain view" meant to feel like Obsidian's notes graph. Time-faceted browsing belongs to
 * the Calendar view instead.
 *
 * Edges: `session-topic`/`session-org` are REAL, read straight off tree structure
 * (`inferred: false`). `topic-cooccurrence` is DERIVED (`inferred: true`): two topics get an
 * edge when they share a session, computed only from `sessionRefs` `buildTree` already
 * populates — no new data, no LLM call, but not literal tree structure either, so it's flagged
 * on the wire rather than presented as equally real. This is the one thing that gives the graph
 * an actual "these ideas cluster" feel instead of a disconnected forest of session-centered
 * stars; deliberately NOT extended to session-session edges (a second layer of inference on top
 * of an already-inferred signal) or to claim/decision/speaker edges (those collections hold zero
 * real rows today — see module doc in `routes/graph.ts` for the full disclosure).
 */
import type { TreeIndexNode } from "@lkb/core";

export interface GraphNode {
  id: string;
  label: string;
  kind: "session" | "topic" | "org";
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "session-topic" | "session-org" | "topic-cooccurrence";
  inferred: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** `topic:<slug>` / `org:<slug>` -> `<slug>` — the last `:`-delimited segment of a tree node_id. */
function lastSegment(nodeId: string): string {
  const idx = nodeId.lastIndexOf(":");
  return idx === -1 ? nodeId : nodeId.slice(idx + 1);
}

export function flattenTreeToGraph(root: TreeIndexNode): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const sessionTopics = new Map<string, Set<string>>();

  function addEdge(source: string, target: string, kind: GraphEdge["kind"], inferred: boolean): void {
    const key = `${source}|${target}|${kind}`;
    if (!edges.has(key)) edges.set(key, { source, target, kind, inferred });
  }

  function visitSession(session: TreeIndexNode): void {
    const evidence = session.evidence as { sessionRef?: string } | undefined;
    const sessionId = evidence?.sessionRef ?? session.node_id;
    nodes.set(sessionId, { id: sessionId, label: session.title, kind: "session" });
    const topicSlugs = new Set<string>();

    for (const child of session.children) {
      if (child.level === "topic") {
        const slug = lastSegment(child.node_id);
        nodes.set(slug, { id: slug, label: child.title, kind: "topic" });
        addEdge(sessionId, slug, "session-topic", false);
        topicSlugs.add(slug);
      } else if (child.level === "org") {
        const slug = lastSegment(child.node_id);
        nodes.set(slug, { id: slug, label: child.title, kind: "org" });
        addEdge(sessionId, slug, "session-org", false);
      }
    }
    sessionTopics.set(sessionId, topicSlugs);
  }

  function walk(node: TreeIndexNode): void {
    if (node.level === "session") {
      visitSession(node);
      return;
    }
    for (const child of node.children) walk(child);
  }
  walk(root);

  for (const topicSlugs of sessionTopics.values()) {
    const slugs = [...topicSlugs].sort();
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        addEdge(slugs[i]!, slugs[j]!, "topic-cooccurrence", true);
      }
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
