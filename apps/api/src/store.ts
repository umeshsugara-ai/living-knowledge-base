/**
 * apps/api/src/store.ts — T-009 C3. Real Mongo-backed `ApiKeyStore` and `TreeStore` (the
 * production side of the injected interfaces `auth.ts`/`routes/ask.ts` declare; tests never
 * import this file, they build fakes matching the same interfaces). No dedicated
 * `packages/db/collections/*` accessor exists for `api_keys` or `tree_index` yet (T-018 only
 * shipped `sources`/`sessions`/`turns`/`claims`, and an api-key lookup is deliberately NOT
 * tenant-scoped — the tenant is unknown until the key resolves it), so this reads via `@lkb/db`'s
 * `getDb()` directly, the same low-level accessor `packages/db/src/collections/*.ts` itself
 * wraps — no new cross-package pattern invented.
 */
import { randomUUID } from "node:crypto";
import { getDb, createEvalRun, recordScore as recordEvalRunScore } from "@lkb/db";
import type { ApiKeys, Jobs, TreeIndexNode } from "@lkb/core";
import type { WriteJobFn } from "@lkb/ai";
import type { ApiKeyStore, VerifiedKey } from "./auth.js";
import type { TreeStore } from "./routes/ask.js";
import type { EvalRunStore } from "./routes/compete.js";
import { sha256Hex } from "./hash.js";

export function createMongoApiKeyStore(): ApiKeyStore {
  return {
    async verify(key: string): Promise<VerifiedKey | null> {
      const doc = await getDb().collection<ApiKeys>("api_keys").findOne({ keyHash: sha256Hex(key) });
      if (!doc || doc.revokedAt) return null;
      return { tenantId: doc.tenantId, scopes: doc.scopes ?? [] };
    },
  };
}

/** One root node per tenant, `level: "tenant"`, `node_id` == tenantId (buildTree's output shape). */
export function createMongoTreeStore(): TreeStore {
  return {
    async load(tenantId: string): Promise<TreeIndexNode | null> {
      return getDb().collection<TreeIndexNode>("tree_index").findOne({ node_id: tenantId, level: "tenant" });
    },
  };
}

/** Mongo-backed `EvalRunStore` (T-012 C3) — thin wrapper over `@lkb/db`'s `eval-runs.ts`
 * accessor, same composition-root pattern as the two stores above. */
export function createMongoEvalRunStore(): EvalRunStore {
  return {
    create: (tenantId, doc) => createEvalRun(tenantId, doc),
    recordScore: (tenantId, id, update) => recordEvalRunScore(tenantId, id, update),
  };
}

/** `askV2`'s own audit-trail writer (T-019 C5 `jobs` ledger) — separate from the router's
 * per-attempt writes in `production.ts`; both land in the same collection. */
export function createMongoJobWriter(): WriteJobFn {
  return async (entry) => {
    await getDb().collection<Jobs>("jobs").insertOne({ _id: randomUUID(), ...entry });
  };
}
