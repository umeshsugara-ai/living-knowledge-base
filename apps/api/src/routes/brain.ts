/**
 * apps/api/src/routes/brain.ts — real read routes over the already-real `sessions`/`sources`/
 * `gaps`/`session_pages`/`claims`/`turns` data: `GET /sessions`, `GET /sessions/:id` (joins
 * session_pages + claims + turns for one session), `GET /sources`, `GET /gaps`. Un-stubs
 * `/sessions` and `/sources` from `stubs.ts` (their `501` entries are removed there in the same
 * unit) — `/gaps` is entirely new (no stub existed for it). Injected `BrainReadDeps`, same
 * pattern as `AskRouteDeps`/`EvalRunStore` — tests never touch Mongo, production wires the real
 * accessors in `store.ts`.
 */
import { Router, type Request, type Response } from "express";
import type { Claims, Gaps, Sessions, SessionPages, Sources, Turns } from "@lkb/core";
import { requireScope } from "../auth.js";

export interface SessionDetail {
  session: Sessions;
  page: SessionPages | null;
  claims: Claims[];
  turns: Turns[];
}

export interface BrainReadDeps {
  listSessions(tenantId: string): Promise<Sessions[]>;
  getSessionDetail(tenantId: string, sessionId: string): Promise<SessionDetail | null>;
  listSources(tenantId: string): Promise<Sources[]>;
  listGaps(tenantId: string): Promise<Gaps[]>;
}

export function createBrainRouter(deps: BrainReadDeps): Router {
  const router = Router();

  router.get("/sessions", requireScope("sessions"), async (req: Request, res: Response) => {
    const sessions = await deps.listSessions(req.auth!.tenantId);
    res.status(200).json({ sessions });
  });

  router.get("/sessions/:id", requireScope("sessions"), async (req: Request, res: Response) => {
    const detail = await deps.getSessionDetail(req.auth!.tenantId, req.params.id as string);
    if (!detail) {
      res.status(404).json({ error: "not_found", message: "no session with that id for this tenant" });
      return;
    }
    res.status(200).json(detail);
  });

  router.get("/sources", requireScope("sources"), async (req: Request, res: Response) => {
    const sources = await deps.listSources(req.auth!.tenantId);
    res.status(200).json({ sources });
  });

  router.get("/gaps", requireScope("gaps"), async (req: Request, res: Response) => {
    const gaps = await deps.listGaps(req.auth!.tenantId);
    res.status(200).json({ gaps });
  });

  return router;
}
