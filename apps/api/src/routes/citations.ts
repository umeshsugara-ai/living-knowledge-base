/**
 * apps/api/src/routes/citations.ts — plan §10 U0.8. `GET /citations/:claimId`: claim -> its
 * evidence turnIds -> real turn text + the session each turn belongs to, so an `/ask` answer's
 * citation chip can be drilled into and read against the actual transcript, not just a claim id.
 * Un-stubs `/citations/:claimId` from `stubs.ts` (its `501` entry is removed there in the same
 * unit), same injected-deps pattern as `routes/brain.ts` — tests never touch Mongo, production
 * wires the real accessors in `store.ts`.
 */
import { Router, type Request, type Response } from "express";
import type { Claims, Sessions, Turns } from "@lkb/core";
import { requireScope } from "../auth.js";

export interface CitationEvidence {
  turnId: string;
  sessionId: string;
  /** null when the cited turn no longer exists (e.g. deleted/re-ingested) — never silently omitted. */
  turn: Turns | null;
  /** null when the cited session no longer exists — same reasoning as `turn`. */
  session: Sessions | null;
}

export interface Citation {
  claim: Claims;
  evidence: CitationEvidence[];
}

export interface CitationsDeps {
  getCitation(tenantId: string, claimId: string): Promise<Citation | null>;
}

export function createCitationsRouter(deps: CitationsDeps): Router {
  const router = Router();

  router.get("/citations/:claimId", requireScope("citations"), async (req: Request, res: Response) => {
    const citation = await deps.getCitation(req.auth!.tenantId, req.params.claimId as string);
    if (!citation) {
      res.status(404).json({ error: "not_found", message: "no claim with that id for this tenant" });
      return;
    }
    res.status(200).json(citation);
  });

  return router;
}
