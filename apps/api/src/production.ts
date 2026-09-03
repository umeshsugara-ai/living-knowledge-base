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
import { complete as routeComplete, parseRoutingYaml, GeminiProvider, ClaudeCodeProvider, type Provider } from "@lkb/ai";
import { treeSearch } from "@lkb/index";
import type { ServerDeps } from "./server.js";
import { createMongoApiKeyStore, createMongoEvalRunStore, createMongoJobWriter, createMongoTreeStore } from "./store.js";
import { realTransport } from "./ai-transport.js";
import { createLlmScorer } from "./score.js";

const ROUTING_CONFIG_PATH = fileURLToPath(new URL("../../../config/ai-routing.yaml", import.meta.url));
/** `write` for the router's own per-attempt ledger entries — a tenant isn't known until a
 * request resolves one, so router-level attempts (as opposed to askV2's own writes, which do
 * carry the real per-request tenantId) are logged under this fixed system id. */
const ROUTER_TENANT_ID = "system";

export function buildProductionDeps(): ServerDeps {
  const chains = parseRoutingYaml(readFileSync(ROUTING_CONFIG_PATH, "utf8"));
  const jobWrite = createMongoJobWriter();

  const providers: Record<string, Provider> = {
    gemini: new GeminiProvider(realTransport, { apiKey: process.env.GEMINI_API_KEY ?? "" }),
    "claude-code": new ClaudeCodeProvider(realTransport),
  };

  return {
    keyStore: createMongoApiKeyStore(),
    evalRuns: createMongoEvalRunStore(),
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
        write: jobWrite,
      },
    },
  };
}
