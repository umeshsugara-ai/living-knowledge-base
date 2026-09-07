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
import { createBrainRouter, type BrainReadDeps } from "./routes/brain.js";
import { createCitationsRouter, type CitationsDeps } from "./routes/citations.js";
import { createGraphRouter, type GraphReadDeps } from "./routes/graph.js";
import { createCalendarRouter, type CalendarReadDeps } from "./routes/calendar.js";
import { createMeetingCandidatesRouter, type MeetingCandidatesDeps } from "./routes/meeting-candidates.js";
import { createWhatsAppRouter, type WhatsAppRouteDeps } from "./routes/whatsapp.js";
import { createKeysRouter, type KeysDeps } from "./routes/keys.js";
import { createIngestRouter, type IngestDeps } from "./routes/ingest.js";
import { createPagesRouter } from "./routes/pages.js";
import { createStubsRouter } from "./routes/stubs.js";
import { createRateLimiter, type RateLimitOptions } from "./rate-limit.js";
import { createCors } from "./cors.js";

export interface ServerDeps {
  keyStore: ApiKeyStore;
  ask: AskRouteDeps;
  evalRuns: EvalRunStore;
  brain: BrainReadDeps;
  citations: CitationsDeps;
  graph: GraphReadDeps;
  calendar: CalendarReadDeps;
  meetingCandidates: MeetingCandidatesDeps;
  whatsapp: WhatsAppRouteDeps;
  keys: KeysDeps;
  ingest: IngestDeps;
  rateLimit?: RateLimitOptions;
  /** apps/web's real origin(s) in dev/prod (e.g. "http://localhost:5173") — no default, an
   * empty list means no cross-origin browser call succeeds, which is the safe default until a
   * caller explicitly opts a frontend origin in. */
  corsOrigins?: string[];
}

export function createServer(deps: ServerDeps): Express {
  const app = express();
  app.use(express.json());
  app.use(createCors(deps.corsOrigins ?? []));
  // Every *-page.ts route is static markup carrying no data of its own (its own JS/server-side
  // render is what attaches the API key to each fetch) -- mounted BEFORE requireAuth, or a plain
  // browser navigation (which never sends a custom Authorization header) 401s before the HTML
  // that would even prompt for a key ever loads. Real bug found live (2026-09-04) on /compete;
  // the same reasoning now covers every UI page. Every JSON/data route stays behind auth.
  app.use(createCompetePageRouter());
  app.use(createPagesRouter());
  app.use(requireAuth(deps.keyStore));
  app.use(createRateLimiter(deps.rateLimit));
  app.use(createAskRouter(deps.ask));
  app.use(createCompeteRouter({ ...deps.ask, evalRuns: deps.evalRuns }));
  app.use(createBrainRouter(deps.brain));
  app.use(createCitationsRouter(deps.citations));
  app.use(createGraphRouter(deps.graph));
  app.use(createCalendarRouter(deps.calendar));
  app.use(createMeetingCandidatesRouter(deps.meetingCandidates));
  app.use(createWhatsAppRouter(deps.whatsapp));
  app.use(createKeysRouter(deps.keys));
  app.use(createIngestRouter(deps.ingest));
  app.use(createStubsRouter());
  return app;
}

export function startServer(deps: ServerDeps, port: number = Number(process.env.PORT ?? 3000)): Server {
  return createServer(deps).listen(port);
}
