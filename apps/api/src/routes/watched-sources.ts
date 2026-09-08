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

export interface WatchedRunSummary {
  checked: number;
  changed: number;
  skipped: number;
  failed: { id: string; url: string; reason: string }[];
}

export interface WatchedSourceDeps {
  create(tenantId: string, doc: Omit<WatchedSources, "tenantId">): Promise<void>;
  listActive(tenantId: string): Promise<WatchedSources[]>;
  /**
   * Run the due sources: listActive -> isDueForCheck -> guarded fetch -> recordFetch. This is the
   * only thing that makes A13 a working feature rather than a stored intention -- rows prove
   * someone asked for a URL to be watched, a run proves anything was ever watched.
   */
  run(tenantId: string): Promise<WatchedRunSummary>;
}

const TIERS = new Set(["official", "community", "blog"]);

/**
 * http(s) only, returning the NORMALISED url rather than a boolean.
 *
 * ISS-C-UNRUN-WRITERS-001: the first version validated a parsed URL and stored the raw string, so
 * the value approved and the value stored could differ under a different parser. That matters
 * precisely because this row is a future outbound fetch target — whatever the fetcher re-parses
 * must be the thing this check actually approved. Returning the parsed `href` makes the two the
 * same object rather than two strings that happen to agree today.
 */
function normalisedHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function createWatchedSourcesRouter(deps: WatchedSourceDeps): Router {
  const router = Router();

  router.post("/watched-sources", requireScope("sources"), async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const url = normalisedHttpUrl(body.url);
    if (url === null) {
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
      url,
      reputationTier: body.reputationTier as WatchedSources["reputationTier"],
      checkIntervalHours: hours,
      active: true,
      ...(typeof body.label === "string" && body.label.trim() !== "" ? { label: body.label } : {}),
    };

    await deps.create(req.auth!.tenantId, doc);
    res.status(201).json({ source: { ...doc, tenantId: req.auth!.tenantId } });
  });

  router.post("/watched-sources/run", requireScope("sources"), async (req: Request, res: Response) => {
    // Per-source failures come back in the summary rather than as a 500: a blocked or dead target
    // is the expected case for unattended fetches of user-supplied URLs, not an error of the run.
    const summary = await deps.run(req.auth!.tenantId);
    res.status(200).json(summary);
  });

  router.get("/watched-sources", requireScope("sources"), async (req: Request, res: Response) => {
    const sources = await deps.listActive(req.auth!.tenantId);
    res.status(200).json({ sources });
  });

  return router;
}
