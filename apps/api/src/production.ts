/**
 * apps/api/src/production.ts — T-009 C3. Assembles the REAL `ServerDeps` `server.ts` needs:
 * `@lkb/index`'s real `treeSearch`, T-019's real provider `complete` routed via
 * `config/ai-routing.yaml`'s `ask` chain (this task adds that line — no `ask` jobKind existed
 * before it), Mongo-backed key/tree/job stores (`store.ts`), and the real `Transport`
 * (`ai-transport.ts`). Kept out of `server.ts` so that file stays <=80 LOC and injectable-only.
 * Never imported by tests.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { complete as routeComplete, embed as routeEmbed, parseRoutingYaml, GeminiProvider, ClaudeCodeProvider, OllamaProvider, type Provider } from "@lkb/ai";
import { treeSearch } from "@lkb/index";
import type { ServerDeps } from "./server.js";
import { createMongoApiKeyStore, createMongoEvalRunStore, createMongoJobWriter, createMongoTreeStore, createMongoBrainReadDeps, createMongoCitationsDeps, createMongoHealthDeps, createMongoGraphReadDeps, createGwsCalendarReadDeps, createMeetingCandidatesDeps, createMongoKeysDeps } from "./store.js";
import { createMongoIngestDeps } from "./ingest-store.js";
import { createMongoSearchDeps } from "./search-store.js";
import { createMongoWhatsAppDeps } from "./whatsapp-store.js";
import { realTransport } from "./ai-transport.js";
import { createLlmScorer } from "./score.js";
import { createTavilySearchFn } from "./ask-web-fallback.js";
import { indexSession, type BoundIndexer } from "./indexing/session.js";

const ROUTING_CONFIG_PATH = fileURLToPath(new URL("../../../config/ai-routing.yaml", import.meta.url));
/** `write` for the router's own per-attempt ledger entries — a tenant isn't known until a
 * request resolves one, so router-level attempts (as opposed to askV2's own writes, which do
 * carry the real per-request tenantId) are logged under this fixed system id. */
const ROUTER_TENANT_ID = "system";

/**
 * The real routing wiring — parsed chains, registered providers, and the Mongo job ledger.
 *
 * Exported (U1.0 backfill) so an offline job gets the SAME chain config and the SAME provider set
 * as the running server. A script that re-registered its own providers would be a second
 * definition free to drift from this one, and the comment below is a standing reminder that the
 * membership of `providers` is load-bearing, not incidental.
 */
export function buildRouting(): {
  chains: ReturnType<typeof parseRoutingYaml>;
  providers: Record<string, Provider>;
  jobWrite: ReturnType<typeof createMongoJobWriter>;
} {
  const chains = parseRoutingYaml(readFileSync(ROUTING_CONFIG_PATH, "utf8"));
  const jobWrite = createMongoJobWriter();

  // Real bug found in this session's own senior-engineer review (2026-09-06): `router.route()`
  // eagerly resolves EVERY name in a jobKind's chain to a registered Provider before trying any
  // of them (packages/ai/src/router.ts:38-42) -- an unregistered chain member throws before the
  // first (working) provider is ever attempted. `summarize`'s chain (config/ai-routing.yaml)
  // lists `ollama` third; leaving it unregistered here meant every real `summarizeSession` call
  // threw immediately and silently degraded to its own fallback, even though gemini alone would
  // have succeeded. Registering the already-built (D-008, "Ollama is a required adapter from the
  // outset") `OllamaProvider` fixes this for every chain that lists it (`summarize`, `answer`),
  // not just a targeted patch for the one job kind that happened to be caught.
  const providers: Record<string, Provider> = {
    gemini: new GeminiProvider(realTransport, { apiKey: process.env.GEMINI_API_KEY ?? "" }),
    "claude-code": new ClaudeCodeProvider(realTransport),
    ollama: new OllamaProvider(realTransport, { baseUrl: process.env.OLLAMA_BASE_URL }),
  };
  return { chains, providers, jobWrite };
}

export function buildProductionDeps(): ServerDeps {
  const { chains, providers, jobWrite } = buildRouting();

  const tavilySearchFn = createTavilySearchFn();

  // Real "make ingested content searchable" step (ISS: summarize/claims/tree_index were declared
  // job kinds with no implementation until now — see indexing.ts). Bound once here so every
  // ingest composition root only ever calls `(tenantId, sessionId) => Promise<void>`.
  const boundIndexer: BoundIndexer = (tenantId, sessionId) =>
    indexSession(tenantId, sessionId, {
      complete: (job) => routeComplete(job.kind, job, { chains, providers, write: jobWrite, tenantId }),
      // Wired only when a chain is configured for it (U1.3). Passing an embedder unconditionally
      // would make every index run fail on an install with no embedding provider, where today it
      // simply indexes without a vector layer — `indexSession` treats the absent dep as "skip
      // chunks" rather than as an error.
      embed: chains.embedding
        ? (job) => routeEmbed("embedding", job, { chains, providers, write: jobWrite, tenantId })
        : undefined,
    });

  return {
    keyStore: createMongoApiKeyStore(),
    evalRuns: createMongoEvalRunStore(),
    brain: createMongoBrainReadDeps(),
    citations: createMongoCitationsDeps(),
    health: createMongoHealthDeps(),
    search: createMongoSearchDeps(),
    graph: createMongoGraphReadDeps(),
    calendar: createGwsCalendarReadDeps(),
    meetingCandidates: createMeetingCandidatesDeps(),
    whatsapp: createMongoWhatsAppDeps(boundIndexer),
    keys: createMongoKeysDeps(),
    ingest: createMongoIngestDeps(boundIndexer),
    // CORS_ORIGINS is a comma-separated allowlist (e.g. "http://localhost:5173" in dev, the real
    // apps/web deployment origin in prod) — no default beyond "" -> empty list, matching
    // server.ts's safe-by-default stance.
    corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    ask: {
      tree: createMongoTreeStore(),
      askDeps: {
        complete: (job) => routeComplete("ask", job, { chains, providers, write: jobWrite, tenantId: ROUTER_TENANT_ID }),
        // T-009b: real LLM judge by default; createLlmScorer falls back to the keyword heuristic
        // internally on a parse failure or AllProvidersFailedError — /ask never crashes on this.
        scoreFn: createLlmScorer(
          (job) => routeComplete("evaluator", job, { chains, providers, write: jobWrite, tenantId: ROUTER_TENANT_ID }),
        ),
        treeSearchFn: treeSearch,
        // ISS-010: real Tavily web-supplement, only when TAVILY_API_KEY is actually set (it's
        // empty in .env today) -- createTavilySearchFn() returns undefined in that case, so
        // /ask's insufficient_coverage:true behavior is unchanged until a real key exists.
        ...(tavilySearchFn ? { tavilySearchFn } : {}),
        write: jobWrite,
      },
    },
  };
}
