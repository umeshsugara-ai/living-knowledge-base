import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

interface LinkedSession { id: string; label: string; }

interface SidePanelState {
  kind: "session" | "topic" | "org";
  id: string;
  label: string;
  detail?: SessionDetail;
  linkedSessions?: LinkedSession[];
  loading?: boolean;
  error?: string;
}

export function BrainPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<SidePanelState | null>(null);
  // ForceGraph2D auto-sizes to its container via its own ResizeObserver, but that measurement
  // races the side panel's layout on first mount (real bug found live: the canvas locked in at
  // the full-card width taken *before* the panel's flex space was accounted for, then never
  // re-measured, permanently overlapping the panel). Measuring the container ourselves and
  // passing explicit width/height removes that race entirely.
  const graphWrapRef = useRef<HTMLDivElement | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 520 });

  useEffect(() => {
    const el = graphWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setGraphSize({ width: entry.contentRect.width, height: 520 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [graph]);

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

  function selectSession(id: string, label: string): void {
    setPanel({ kind: "session", id, label, loading: true });
    getSession(apiKey, id)
      .then((detail) => setPanel({ kind: "session", id, label, detail }))
      .catch((err: unknown) => setPanel({ kind: "session", id, label, error: err instanceof ApiError ? err.message : "failed to load session" }));
  }

  function selectNode(id: string): void {
    const graphNode = nodeById.get(id);
    if (!graphNode || !graph) return;

    if (graphNode.kind === "session") {
      selectSession(id, graphNode.label);
      return;
    }

    // topic/org: no dedicated detail route -- derive linked sessions from the edges already in
    // the graph payload we already have, no extra fetch (plan §8b phase 2 drill-down design).
    // Each linked session is itself clickable, so a topic/org node is a real entry point into
    // its actual content, not a dead end (the "Obsidian-style" ask: a node click opens content,
    // and every linked note is itself a link, not plain text).
    const linkedIds = graph.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));
    const linkedSessions: LinkedSession[] = linkedIds
      .map((linkedId) => nodeById.get(linkedId))
      .filter((n): n is GraphNode => n?.kind === "session")
      .map((n) => ({ id: n.id, label: n.label }));
    setPanel({ kind: graphNode.kind, id, label: graphNode.label, linkedSessions });
  }

  function handleNodeClick(node: { id?: string | number }): void {
    selectNode(String(node.id ?? ""));
  }

  return (
    <>
      <div className="page-header">
        <h1>Brain</h1>
        <p>
          Sessions, topics, and orgs from the real knowledge tree. Solid lines are real membership;
          dashed lines are a derived "these topics showed up together" signal, not literal data.
          Click any node to read its real content — every link in the panel is itself clickable.
        </p>
      </div>
      {error && <div className="card error-note">{error}</div>}
      {!error && graph === null && <div className="card empty-note">Loading&hellip;</div>}
      {graph && graph.nodes.length === 0 && (
        <div className="card empty-note">No tree index built for this tenant yet.</div>
      )}
      {graph && graph.nodes.length > 0 && (
        <div className="card" style={{ display: "flex", gap: "1rem", padding: 0, overflow: "hidden" }}>
          <div ref={graphWrapRef} style={{ flex: 1, minWidth: 0, minHeight: 520 }}>
            {graphSize.width > 0 && (
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
                width={graphSize.width}
                height={graphSize.height}
              />
            )}
          </div>
          {/* Always visible, Obsidian-style side pane -- a placeholder before any click rather
              than nothing, so the panel reads as part of the page, not a hidden feature. */}
          <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--line)", padding: "1rem", overflowY: "auto", maxHeight: 520 }}>
            {!panel && (
              <div className="empty-note">Click a session, topic, or org node to read its real content here.</div>
            )}
            {panel && (
              <>
                <div className="section-title">{panel.kind}</div>
                <div className="row-title">{panel.label}</div>
                {panel.loading && <div className="empty-note">Loading&hellip;</div>}
                {panel.error && <div className="error-note">{panel.error}</div>}
                {panel.detail && (
                  <>
                    <p style={{ fontSize: "0.85rem" }}>{panel.detail.page?.summary ?? "(no summary yet)"}</p>
                    {panel.detail.claims.length > 0 && (
                      <>
                        <div className="section-title">Claims ({panel.detail.claims.length})</div>
                        <ul style={{ paddingLeft: "1.1rem", margin: 0, fontSize: "0.8rem" }}>
                          {panel.detail.claims.slice(0, 8).map((c) => (
                            <li key={c._id} style={{ marginBottom: "0.4rem" }}>{c.text}</li>
                          ))}
                        </ul>
                        {panel.detail.claims.length > 8 && (
                          <div className="row-meta">+{panel.detail.claims.length - 8} more</div>
                        )}
                      </>
                    )}
                    <div className="row-meta" style={{ marginTop: "0.5rem" }}>{panel.detail.turns.length} turn(s) transcribed</div>
                    <Link to={`/sessions/${encodeURIComponent(panel.id)}`} className="row-meta" style={{ color: "var(--accent)", display: "inline-block", marginTop: "0.5rem" }}>
                      View full session &rarr;
                    </Link>
                  </>
                )}
                {panel.linkedSessions && (
                  <>
                    <div className="section-title">Linked sessions ({panel.linkedSessions.length})</div>
                    {panel.linkedSessions.length === 0 && <div className="empty-note">None.</div>}
                    {panel.linkedSessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSession(s.id, s.label)}
                        className="row-meta"
                        style={{ display: "block", background: "none", border: "none", padding: 0, marginBottom: "0.3rem", color: "var(--accent)", cursor: "pointer", textAlign: "left", font: "inherit" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
