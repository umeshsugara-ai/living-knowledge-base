import { useEffect, useMemo, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useAuth } from "../auth/AuthContext.js";
import { loadGraph } from "../api/graph.js";
import { getSession } from "../api/sessions.js";
import { ApiError } from "../api/client.js";
import type { Graph, GraphNode, SessionDetail } from "../api/types.js";

const NODE_COLOR: Record<GraphNode["kind"], string> = {
  session: "#2554ff",
  topic: "#0b8a5c",
  org: "#b7791f",
};

interface SidePanelState {
  kind: "session" | "topic" | "org";
  label: string;
  detail?: SessionDetail;
  linkedSessionLabels?: string[];
  loading?: boolean;
  error?: string;
}

export function BrainPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<SidePanelState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGraph(apiKey)
      .then((data) => { if (!cancelled) setGraph(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load graph"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of graph?.nodes ?? []) map.set(n.id, n);
    return map;
  }, [graph]);

  function handleNodeClick(node: { id?: string | number }): void {
    const id = String(node.id ?? "");
    const graphNode = nodeById.get(id);
    if (!graphNode || !graph) return;

    if (graphNode.kind === "session") {
      setPanel({ kind: "session", label: graphNode.label, loading: true });
      getSession(apiKey, id)
        .then((detail) => setPanel({ kind: "session", label: graphNode.label, detail }))
        .catch((err: unknown) => setPanel({ kind: "session", label: graphNode.label, error: err instanceof ApiError ? err.message : "failed to load session" }));
      return;
    }

    // topic/org: no dedicated detail route -- derive linked sessions from the edges already in
    // the graph payload we already have, no extra fetch (plan §8b phase 2 drill-down design).
    const linkedIds = graph.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));
    const linkedSessionLabels = linkedIds
      .map((linkedId) => nodeById.get(linkedId))
      .filter((n): n is GraphNode => n?.kind === "session")
      .map((n) => n.label);
    setPanel({ kind: graphNode.kind, label: graphNode.label, linkedSessionLabels });
  }

  return (
    <>
      <div className="page-header">
        <h1>Brain</h1>
        <p>
          Sessions, topics, and orgs from the real knowledge tree. Solid lines are real membership;
          dashed lines are a derived "these topics showed up together" signal, not literal data.
        </p>
      </div>
      {error && <div className="card error-note">{error}</div>}
      {!error && graph === null && <div className="card empty-note">Loading&hellip;</div>}
      {graph && graph.nodes.length === 0 && (
        <div className="card empty-note">No tree index built for this tenant yet.</div>
      )}
      {graph && graph.nodes.length > 0 && (
        <div className="card" style={{ display: "flex", gap: "1rem", padding: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 520 }}>
            <ForceGraph2D
              graphData={{
                nodes: graph.nodes.map((n) => ({ ...n })),
                links: graph.edges.map((e) => ({ ...e })),
              }}
              nodeId="id"
              nodeLabel="label"
              nodeColor={(n: unknown) => NODE_COLOR[(n as GraphNode).kind]}
              linkColor={(l: unknown) => ((l as { inferred?: boolean }).inferred ? "rgba(20,24,31,0.15)" : "rgba(20,24,31,0.35)")}
              linkLineDash={(l: unknown) => ((l as { inferred?: boolean }).inferred ? [2, 2] : null)}
              onNodeClick={handleNodeClick}
              height={520}
            />
          </div>
          {panel && (
            <div style={{ width: 300, borderLeft: "1px solid var(--line)", padding: "1rem", overflowY: "auto", maxHeight: 520 }}>
              <div className="section-title">{panel.kind}</div>
              <div className="row-title">{panel.label}</div>
              {panel.loading && <div className="empty-note">Loading&hellip;</div>}
              {panel.error && <div className="error-note">{panel.error}</div>}
              {panel.detail && (
                <>
                  <p style={{ fontSize: "0.85rem" }}>{panel.detail.page?.summary ?? "(no summary yet)"}</p>
                  <div className="row-meta">{panel.detail.claims.length} claim(s) &middot; {panel.detail.turns.length} turn(s)</div>
                </>
              )}
              {panel.linkedSessionLabels && (
                <>
                  <div className="section-title">Linked sessions ({panel.linkedSessionLabels.length})</div>
                  {panel.linkedSessionLabels.length === 0 && <div className="empty-note">None.</div>}
                  {panel.linkedSessionLabels.map((label, i) => (
                    <div key={i} className="row-meta">{label}</div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
