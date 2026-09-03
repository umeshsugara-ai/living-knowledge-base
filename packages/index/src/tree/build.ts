/**
 * packages/index/src/tree/build.ts — vectorless tree-index generator (port of
 * tree_index/build_tree.py, T-004 → T-016; behaviour-identical).
 *
 * Builds a hierarchical tree (tenant -> year -> month -> session) from `sessions` and
 * `session_pages` documents (schema/sessions.schema.json, schema/session_pages.schema.json).
 * No dense-vector math, no similarity search, no network calls: structure IS the index; an LLM
 * (or, for tests, a plain fallback) supplies each node's summary.
 *
 * `summarize` is an injectable seam — pass a function to have an LLM write node summaries;
 * omit it and the session_page's own `summary` field is used verbatim (network-free, testable).
 */
import type { SessionPages, Sessions, TreeIndexNode } from "@lkb/core";

export type Summarize = (session: Sessions, page: SessionPages | null) => string;

function node(nodeId: string, title: string, level: TreeIndexNode["level"], summary = "",
  evidence?: TreeIndexNode["evidence"]): TreeIndexNode {
  const n: TreeIndexNode = { node_id: nodeId, title, level, summary, children: [] };
  if (evidence !== undefined) n.evidence = evidence;
  return n;
}

function sessionPageFor(sessionId: string, sessionPages: SessionPages[]): SessionPages | null {
  return sessionPages.find((p) => p.sessionId === sessionId) ?? null;
}

function childById(parent: TreeIndexNode, nodeId: string): TreeIndexNode | undefined {
  return parent.children.find((c) => c.node_id === nodeId);
}

/**
 * Returns `{ [tenantId]: <root tree node> }` — one root per distinct tenant found in `sessions`.
 * Each root nests year -> month -> session nodes underneath it.
 *
 * `summarize(session, page)`, if provided, produces the summary text for a session node.
 * If omitted, falls back to `page.summary` (or "" if no page exists for that session yet).
 */
export function buildTree(sessions: Sessions[], sessionPages: SessionPages[],
  summarize?: Summarize): Record<string, TreeIndexNode> {
  const roots: Record<string, TreeIndexNode> = {};

  for (const session of sessions) {
    const tenantId = session.tenantId;
    const year = session.date.slice(0, 4);
    const month = session.date.slice(5, 7);

    const root = (roots[tenantId] ??= node(`tenant:${tenantId}`, tenantId, "tenant"));

    const yearId = `${tenantId}/year:${year}`;
    let yearNode = childById(root, yearId);
    if (yearNode === undefined) {
      yearNode = node(yearId, year, "year");
      root.children.push(yearNode);
    }

    const monthId = `${yearId}/month:${month}`;
    let monthNode = childById(yearNode, monthId);
    if (monthNode === undefined) {
      monthNode = node(monthId, month, "month");
      yearNode.children.push(monthNode);
    }

    const page = sessionPageFor(session._id, sessionPages);
    const summary = summarize !== undefined ? summarize(session, page) : page?.summary ?? "";

    monthNode.children.push(node(`${monthId}/session:${session._id}`, session.title, "session",
      summary, { sessionRef: session._id }));
  }

  return roots;
}
