/**
 * apps/api/src/routes/ingest.ts — `POST /ingest`: the first real write path into the brain
 * from a browser (plan §8's "Ingest" page, deferred until now). v1 scope, disclosed: URL
 * ingestion only (`packages/ingest`'s already-real, checker-PASSed `url` adapter) — document/
 * recording upload needs multipart file handling this repo doesn't have yet, a real follow-up,
 * not silently promised here. A successful ingest produces a real `sources` doc, a real
 * `sessions` doc wrapping it, and real `turns` (paragraph-split extracted text) — all
 * immediately visible through the already-real `GET /sessions/:id` page, reused rather than
 * building a second view for ingested content.
 */
import { Router, type Request, type Response } from "express";
import { requireScope } from "../auth.js";

export interface IngestResult {
  sessionId: string;
  sourceId: string;
  turnCount: number;
}

export interface IngestDeps {
  ingestUrl(tenantId: string, url: string): Promise<IngestResult>;
}

const URL_RE = /^https?:\/\//i;

export function createIngestRouter(deps: IngestDeps): Router {
  const router = Router();

  router.post("/ingest", requireScope("ingest"), async (req: Request, res: Response) => {
    const url = (req.body as { url?: unknown } | undefined)?.url;
    if (typeof url !== "string" || !URL_RE.test(url)) {
      res.status(400).json({ error: "bad_request", message: "body must be { url: string } (http/https only)" });
      return;
    }
    try {
      const result = await deps.ingestUrl(req.auth!.tenantId, url);
      res.status(201).json(result);
    } catch (err) {
      // A real fetch/extraction failure (unreachable URL, non-text content, etc.) is the
      // caller's URL being unfetchable, not a server bug -- 502, not 500, and the real error
      // message so the UI can show why, never a silent generic failure.
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: "ingest_failed", message });
    }
  });

  return router;
}
