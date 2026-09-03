/**
 * packages/ai/src/router.ts — T-019 C4. `route(jobKind, config)` resolves the ordered provider
 * chain for a jobKind (from `config/ai-routing.yaml`, D-005 Gemini-first) to adapter instances;
 * `complete(jobKind, job, config)` tries each in order, first success wins, and records a `jobs`
 * ledger entry (C5) for every attempt via the injected `write`.
 */
import type { CompleteResult, Job, Provider } from "./provider.js";
import { recordJob, type WriteJobFn } from "./jobs.js";

export interface RoutingConfig {
  /** jobKind -> ordered provider names, e.g. { transcribe: ["gemini", "ollama"] }. */
  chains: Record<string, string[]>;
  /** provider name -> instantiated Provider (transport already injected by the caller). */
  providers: Record<string, Provider>;
  write: WriteJobFn;
  tenantId: string;
}

export class AllProvidersFailedError extends Error {
  constructor(
    public readonly jobKind: string,
    public readonly attempts: { provider: string; error: string }[],
  ) {
    super(
      `all providers failed for jobKind "${jobKind}": ` +
        attempts.map((a) => `${a.provider} (${a.error})`).join("; "),
    );
    this.name = "AllProvidersFailedError";
  }
}

/** Resolves the ordered chain for `jobKind` to `Provider` instances, in order. */
export function route(jobKind: string, config: Pick<RoutingConfig, "chains" | "providers">): Provider[] {
  const names = config.chains[jobKind];
  if (!names || names.length === 0) {
    throw new Error(`router.route: no chain configured for jobKind "${jobKind}"`);
  }
  return names.map((name) => {
    const provider = config.providers[name];
    if (!provider) throw new Error(`router.route: unknown provider "${name}" in chain "${jobKind}"`);
    return provider;
  });
}

/**
 * Tries each provider in the resolved chain in order; returns the first success. Every attempt
 * (success or failure) writes exactly one `jobs` ledger entry via `config.write` (C5, C7).
 * Throws `AllProvidersFailedError` if every provider in the chain fails — never a silent empty
 * result.
 */
export async function complete(jobKind: string, job: Job, config: RoutingConfig): Promise<CompleteResult> {
  const providers = route(jobKind, config);
  const attempts: { provider: string; error: string }[] = [];

  for (const provider of providers) {
    try {
      const result = await provider.complete(job);
      await recordJob(
        {
          tenantId: config.tenantId,
          kind: jobKind,
          status: "done",
          provider: result.provider,
          model: result.model,
          costUsd: result.costUsd,
        },
        config.write,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ provider: provider.name, error: message });
      await recordJob(
        {
          tenantId: config.tenantId,
          kind: jobKind,
          status: "failed",
          provider: provider.name,
          error: message,
        },
        config.write,
      );
    }
  }

  throw new AllProvidersFailedError(jobKind, attempts);
}
