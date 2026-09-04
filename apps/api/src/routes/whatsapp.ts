/**
 * apps/api/src/routes/whatsapp.ts — T-007 first slice. `GET /whatsapp/groups` (real, live-
 * queried list of what `sources/whatsapp_msg` is actually tracking, so a caller sees real
 * capturable groups before ingesting anything) and `POST /whatsapp/ingest` (real write — pulls
 * one group's real captured messages via `@lkb/ingest`'s `whatsapp` adapter and persists a real
 * `sources` + `sessions` + `turns` doc set, same shape `POST /ingest` already produces for URLs
 * — reused via the already-real `GET /sessions/:id` view, no second viewer built).
 *
 * Scope disclosure: this is the ingestion step of T-007 only ("WhatsApp → claims ingestion
 * review" per the plan's A9). The review layer — topic/decision/sensitive-content detection,
 * duplicate flagging, an approve-before-publish queue — is explicitly OUT of this slice, a
 * separate, larger follow-up (same disclosed-scope pattern as the Gmail meeting-candidate unit's
 * split from its own approval workflow).
 */
import { Router, type Request, type Response } from "express";
import { requireScope } from "../auth.js";

export interface WhatsAppGroup {
  groupJid: string;
  ownerUserId: string;
  subject: string;
  trackedPersonCount: number;
}

export interface WhatsAppIngestResult {
  sessionId: string;
  sourceId: string;
  turnCount: number;
}

export interface WhatsAppRouteDeps {
  listGroups(): Promise<WhatsAppGroup[]>;
  ingestGroup(tenantId: string, groupJid: string, ownerUserId: string): Promise<WhatsAppIngestResult>;
}

export function createWhatsAppRouter(deps: WhatsAppRouteDeps): Router {
  const router = Router();

  router.get("/whatsapp/groups", requireScope("whatsapp"), async (_req: Request, res: Response) => {
    const groups = await deps.listGroups();
    res.status(200).json({ groups });
  });

  router.post("/whatsapp/ingest", requireScope("whatsapp"), async (req: Request, res: Response) => {
    const body = req.body as { groupJid?: unknown; ownerUserId?: unknown } | undefined;
    if (!body || typeof body.groupJid !== "string" || typeof body.ownerUserId !== "string") {
      res.status(400).json({ error: "bad_request", message: "body must be { groupJid: string, ownerUserId: string }" });
      return;
    }
    try {
      const result = await deps.ingestGroup(req.auth!.tenantId, body.groupJid, body.ownerUserId);
      res.status(201).json(result);
    } catch (err) {
      // A real fetch failure (whatsapp_msg's Mongo unreachable, unknown group) is an environment/
      // input problem, not a server bug -- 502, not 500, with the real error message.
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: "whatsapp_ingest_failed", message });
    }
  });

  return router;
}
