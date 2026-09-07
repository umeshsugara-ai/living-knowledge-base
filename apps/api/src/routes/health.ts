/**
 * apps/api/src/routes/health.ts — plan §10 U0.7 (first half). `GET /health`: db ping + real
 * per-collection document counts, for ops monitoring. Deliberately UNAUTHENTICATED (mounted
 * before `requireAuth`, same as the `*-page.ts` routes) — an uptime probe should not need a
 * scoped API key, and the response carries only aggregate counts, never tenant-scoped content.
 */
import { Router, type Request, type Response } from "express";

export interface HealthReport {
  db: "ok" | "error";
  /** Real `countDocuments` per collection, keyed by name — empty when `db` is "error". */
  collections: Record<string, number>;
}

export interface HealthDeps {
  checkHealth(): Promise<HealthReport>;
}

export function createHealthRouter(deps: HealthDeps): Router {
  const router = Router();

  router.get("/health", async (_req: Request, res: Response) => {
    const report = await deps.checkHealth();
    // 503 (not 200) when the db ping failed — a health probe's whole job is to make an
    // unhealthy backend visible to whatever is watching the HTTP status code, not just the body.
    res.status(report.db === "ok" ? 200 : 503).json(report);
  });

  return router;
}
