/**
 * apps/api/src/routes/graph.ts — `GET /graph`: the real relationship data behind the "brain
 * view" (plan §8b phase 2). Same DI pattern as `brain.ts` — an injected `GraphReadDeps`, a real
 * Mongo-backed impl in `store.ts`.
 *
 * Scope disclosure (also on the wire via each edge's `inferred` flag, not just here): this
 * route reads ONLY `tree_index`, the one collection with real relational data today.
 * `graph_edges`/`topics`/`speakers`/`decisions`/`orgs` as standalone collections hold ZERO real
 * rows and no pipeline writes them — this route does not read them, on purpose, rather than
 * simulate a richer graph than actually exists. Claim→topic edges are blocked on
 * `claims.topicRefs` (present on every real claim, always empty). See
 * `packages/index/src/tree/flatten-graph.ts` for exactly which nodes/edges are real vs. derived.
 */
import { Router, type Request, type Response } from "express";
import type { Graph } from "@lkb/index";
import { requireScope } from "../auth.js";

export interface GraphReadDeps {
  loadGraph(tenantId: string): Promise<Graph | null>;
}

export function createGraphRouter(deps: GraphReadDeps): Router {
  const router = Router();

  router.get("/graph", requireScope("graph"), async (req: Request, res: Response) => {
    const graph = await deps.loadGraph(req.auth!.tenantId);
    if (!graph) {
      res.status(404).json({ error: "not_found", message: "no tree index built for this tenant yet" });
      return;
    }
    res.status(200).json(graph);
  });

  return router;
}
