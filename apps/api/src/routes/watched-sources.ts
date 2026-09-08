/**
 * apps/api/src/routes/watched-sources.ts — A13's missing entrypoint.
 *
 * T-027 built this feature's schema, its tenant-scoped accessors and its pure due-check, all
 * checker-PASSed — and then nothing called them. The module comment in
 * `packages/ingest/src/watched/schedule.ts` still reads "a future scheduler runs `listActive`".
 * The `watched_sources` collection has been empty ever since, which is precisely why catalogue A13
 * scores MISSING: the probe is `collection watched_sources (empty)`.
 *
 * The missing piece was never the logic. It was that no user action could reach it. This is that
 * action: register a URL to watch, and list what is being watched.
 *
 * Validation is deliberately strict, because a watched source is a URL the system will later fetch
 * on a timer. An unvalidated `url` here is a stored server-side request target — so the scheme is
 * checked against http(s) rather than trusted, the same reasoning that made the Ask page refuse a
 * `javascript:` citation.
 */
import { Router, type Request, type Response } from "express";
import type { WatchedSources } from "@lkb/core";
import { requireScope } from "../auth.js";

export interface WatchedSourceDeps {
  create(tenantId: string, doc: Omit<WatchedSources, "tenantId">): Promise<void>;
  listActive(tenantId: string): Promise<WatchedSources[]>;
}

const TIERS = new Set(["official", "community", "blog"]);

/** http(s) only. A stored URL is a future outbound fetch target, not just a string. */
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function createWatchedSourcesRouter(deps: WatchedSourceDeps): Router {
  const router = Router();

  router.post("/watched-sources", requireScope("sources"), async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!isHttpUrl(body.url)) {
      res.status(400).json({ error: "bad_request", message: "url must be an absolute http(s) URL" });
      return;
    }
    if (typeof body.reputationTier !== "string" || !TIERS.has(body.reputationTier)) {
      res.status(400).json({ error: "bad_request", message: "reputationTier must be one of: official, community, blog" });
      return;
    }
    // A non-positive interval would make the source permanently due — `isDueForCheck` compares
    // elapsed >= interval, so 0 is "always", and a negative one is meaningless.
    const hours = body.checkIntervalHours;
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
      res.status(400).json({ error: "bad_request", message: "checkIntervalHours must be a positive number" });
      return;
    }

    const doc: Omit<WatchedSources, "tenantId"> = {
      _id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: body.url,
      reputationTier: body.reputationTier as WatchedSources["reputationTier"],
      checkIntervalHours: hours,
      active: true,
      ...(typeof body.label === "string" && body.label.trim() !== "" ? { label: body.label } : {}),
    };

    await deps.create(req.auth!.tenantId, doc);
    res.status(201).json({ source: { ...doc, tenantId: req.auth!.tenantId } });
  });

  router.get("/watched-sources", requireScope("sources"), async (req: Request, res: Response) => {
    const sources = await deps.listActive(req.auth!.tenantId);
    res.status(200).json({ sources });
  });

  return router;
}
