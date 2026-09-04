/**
 * apps/web/src/api/types.ts — response shapes mirrored by hand from apps/api's real routes, NOT
 * imported from @lkb/core. apps/web imports zero packages/* (dependency-cruiser boundary +
 * project decision: a frontend only talks HTTP/JSON to apps/api, never the domain packages
 * directly) — a small amount of duplication here is the accepted cost of keeping that boundary
 * real instead of nominal.
 */
export interface SessionSummary {
  _id: string;
  title: string;
  date: string;
  org?: string;
  status: { transcribe: string; index: string; [k: string]: unknown };
}

export interface Claim {
  _id: string;
  text: string;
  status: "verified" | "needs-review" | "conflicting";
}

export interface Turn {
  _id: string;
  speakerRef: string;
  tStart: number;
  tEnd: number;
  text: string;
}

export interface SessionDetail {
  session: SessionSummary;
  page: { summary: string } | null;
  claims: Claim[];
  turns: Turn[];
}

export interface Source {
  _id: string;
  kind: string;
  captureMode: string;
  path?: string;
  url?: string;
  createdAt: string;
}

export interface Gap {
  _id: string;
  kind: string;
  description?: string;
  status: "open" | "received" | "expired";
}

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
