/**
 * apps/api/src/server.ts — T-009 C1. `createServer(deps)`: Express app, JSON body parsing,
 * auth -> per-key rate limit -> routes. Everything DB/LLM-backed is injected (`deps`) so tests
 * never touch Mongo or a real network/CLI call; `startServer` is the thin `listen()` wrapper
 * `production.ts` (the real Mongo + real-provider entrypoint) calls. Budget: <=80 LOC (own note).
 */
import express, { type Express } from "express";
import type { Server } from "node:http";
import type { ApiKeyStore } from "./auth.js";
import { requireAuth } from "./auth.js";
import { createAskRouter, type AskRouteDeps } from "./routes/ask.js";
import { createCompeteRouter, type EvalRunStore } from "./routes/compete.js";
import { createCompetePageRouter } from "./routes/compete-page.js";
import { createStubsRouter } from "./routes/stubs.js";
import { createRateLimiter, type RateLimitOptions } from "./rate-limit.js";

export interface ServerDeps {
  keyStore: ApiKeyStore;
  ask: AskRouteDeps;
  evalRuns: EvalRunStore;
  rateLimit?: RateLimitOptions;
}

export function createServer(deps: ServerDeps): Express {
  const app = express();
  app.use(express.json());
  app.use(requireAuth(deps.keyStore));
  app.use(createRateLimiter(deps.rateLimit));
  app.use(createAskRouter(deps.ask));
  app.use(createCompeteRouter({ ...deps.ask, evalRuns: deps.evalRuns }));
  app.use(createCompetePageRouter());
  app.use(createStubsRouter());
  return app;
}

export function startServer(deps: ServerDeps, port: number = Number(process.env.PORT ?? 3000)): Server {
  return createServer(deps).listen(port);
}
