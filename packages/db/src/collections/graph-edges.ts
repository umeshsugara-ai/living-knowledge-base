// packages/db/src/collections/graph-edges.ts — plan §10 U0.9. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { GraphEdges } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function graphEdges(tenantId: string) {
  return scopedCollection<GraphEdges>(getDb(), "graph_edges")(tenantId);
}
