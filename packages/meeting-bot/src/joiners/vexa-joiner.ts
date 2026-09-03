/**
 * packages/meeting-bot/src/joiners/vexa-joiner.ts — T-024 C3. Vexa bot joiner. Mirrors T-019's
 * transport-injection pattern (packages/ai/src/providers/*.ts): every network call goes through
 * an injected `VexaTransport`, so tests never touch a real network and no Vexa base URL is
 * hardcoded here (the self-hosted instance URL is the caller's config, per D-004).
 *
 * TODO(T-024b): this is a STUB. It shapes a plausible Vexa bot-create/stop call (POST
 * `{baseUrl}/bots` with `{meetingUrl, tenantId}`, POST `{baseUrl}/bots/{sessionHandle}/stop`)
 * based on the README's documented API shape, but no real Vexa instance has been exercised yet.
 * Wiring this against a live self-hosted Vexa deployment (auth, actual endpoint paths/response
 * shape, polling for "bot has joined") is explicitly follow-up work, not this unit's.
 */
import type { Joiner, JoinOpts, JoinResult } from "../joiner.js";

export interface VexaTransportRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface VexaTransportResponse {
  status: number;
  body: unknown;
}

/** Injected HTTP call — no real `fetch` in tests, matching packages/ai's `Transport` seam. */
export type VexaTransport = (req: VexaTransportRequest) => Promise<VexaTransportResponse>;

export interface VexaJoinerDeps {
  transport: VexaTransport;
  /** Self-hosted Vexa base URL — never hardcoded, always supplied by the caller (D-004). */
  baseUrl: string;
  apiKey?: string;
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

export function createVexaJoiner(deps: VexaJoinerDeps): Joiner {
  return {
    name: "vexa",

    async join(url: string, opts: JoinOpts): Promise<JoinResult> {
      const res = await deps.transport({
        url: `${deps.baseUrl}/bots`,
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(deps.apiKey) },
        body: { meetingUrl: url, tenantId: opts.tenantId },
      });

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`vexa-joiner: join failed with status ${res.status}`);
      }
      const body = res.body as { sessionHandle?: string } | undefined;
      if (!body?.sessionHandle) {
        throw new Error("vexa-joiner: response missing sessionHandle");
      }

      return { sessionHandle: body.sessionHandle, mediaStream: undefined };
    },

    async stop(sessionHandle: string): Promise<void> {
      const res = await deps.transport({
        url: `${deps.baseUrl}/bots/${sessionHandle}/stop`,
        method: "POST",
        headers: authHeaders(deps.apiKey),
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`vexa-joiner: stop failed with status ${res.status}`);
      }
    },
  };
}
