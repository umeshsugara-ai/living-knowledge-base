/**
 * apps/api/src/routes/stubs.ts — T-009 C4/C5. `/search` `/citations/:claimId`
 * `/webhooks/register` — honestly labeled 501s (no data-access layer built for any of them yet,
 * each is its own later unit per the contract's non-goals). The route's scope check still runs
 * first, so a caller can tell "authorized but not built" (501) apart from "not authorized" (403)
 * — the two are different information per the contract and must never collapse into one status
 * code. `/sources` and `/sessions` were un-stubbed (real routes now live in `routes/brain.ts`) —
 * `STUB_ROUTES` is exported so `routes/pages.ts`'s API-docs page renders directly from this
 * table instead of a hand-maintained copy that could drift from what's actually still a stub.
 */
import { Router, type Request, type Response } from "express";
import { requireScope } from "../auth.js";

export interface StubRoute {
  method: "get" | "post";
  path: string;
  scope: string;
  label: string;
}

export const STUB_ROUTES: StubRoute[] = [
  { method: "get", path: "/search", scope: "search", label: "GET /search" },
  { method: "get", path: "/citations/:claimId", scope: "citations", label: "GET /citations/:claimId" },
  { method: "post", path: "/webhooks/register", scope: "webhooks", label: "POST /webhooks/register" },
];

function notImplemented(label: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({ error: "not_implemented", message: `${label} is planned, not yet built — see TASKS.md` });
  };
}

export function createStubsRouter(): Router {
  const router = Router();
  for (const route of STUB_ROUTES) {
    router[route.method](route.path, requireScope(route.scope), notImplemented(route.label));
  }
  return router;
}
