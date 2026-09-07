/**
 * apps/api/src/health-probe.ts — ISS-070. `store.ts`'s `createMongoHealthDeps()` used to guard
 * the ping and the counting with separate try/catch blocks (only the ping was covered), so a
 * transient `countDocuments` failure AFTER a successful ping became an unhandled rejection on
 * the one route ops depends on being reliably answerable. Extracted here (rather than left
 * inline in `store.ts`, which "tests never import" per its own header comment) so the
 * failure-handling logic itself is directly unit-testable with fakes, not just exercised
 * end-to-end against a real database.
 */
import type { HealthReport } from "./routes/health.js";

/** Runs `ping` then `countAll` under ONE try/catch — any failure from either step degrades to
 * `{db: "error", collections: {}}` rather than throwing. */
export async function probeMongoHealth(
  ping: () => Promise<unknown>,
  countAll: () => Promise<Record<string, number>>,
): Promise<HealthReport> {
  try {
    await ping();
    const collections = await countAll();
    return { db: "ok", collections };
  } catch {
    return { db: "error", collections: {} };
  }
}
