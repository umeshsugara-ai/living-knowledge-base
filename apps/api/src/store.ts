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
import { randomUUID, randomBytes } from "node:crypto";
import {
  getDb, createEvalRun, recordScore as recordEvalRunScore,
  sessions as sessionsColl, sources as sourcesColl, gaps as gapsColl,
  claims as claimsColl, turns as turnsColl, sessionPages as sessionPagesColl,
} from "@lkb/db";
import type { ApiKeys, Jobs, TreeIndexNode } from "@lkb/core";
import type { WriteJobFn } from "@lkb/ai";
import { flattenTreeToGraph, type Graph } from "@lkb/index";
import type { ApiKeyStore, VerifiedKey } from "./auth.js";
import type { TreeStore } from "./routes/ask.js";
import type { EvalRunStore } from "./routes/compete.js";
import type { BrainReadDeps, SessionDetail } from "./routes/brain.js";
import type { GraphReadDeps } from "./routes/graph.js";
import type { ApiKeySummary, KeysDeps } from "./routes/keys.js";
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
      // buildTree's own root node_id is `tenant:<id>` (packages/index/src/tree/build.ts), not
      // the bare tenantId -- real bug found live (2026-09-04) while first standing up the API
      // against real seeded data: this query never matched anything buildTree ever produced.
      return getDb().collection<TreeIndexNode>("tree_index").findOne({ node_id: `tenant:${tenantId}`, level: "tenant" });
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

/** Real `BrainReadDeps` (routes/brain.ts) — wraps the already-real `@lkb/db` accessors, same
 * composition-root pattern as every store above. Claims/turns don't carry a bare `sessionId`
 * field (claims relate via `evidence[].sessionId`; turns via their own `sessionId`), so the
 * session-detail join queries each accordingly rather than assuming a shared shape. */
export function createMongoBrainReadDeps(): BrainReadDeps {
  return {
    async listSessions(tenantId) {
      return sessionsColl(tenantId).find({}).toArray();
    },
    async getSessionDetail(tenantId, sessionId): Promise<SessionDetail | null> {
      const session = await sessionsColl(tenantId).findOne({ _id: sessionId });
      if (!session) return null;
      const [page, sessionClaims, sessionTurns] = await Promise.all([
        sessionPagesColl(tenantId).findOne({ sessionId }),
        claimsColl(tenantId).find({ "evidence.sessionId": sessionId }).toArray(),
        turnsColl(tenantId).find({ sessionId }).toArray(),
      ]);
      return { session, page: page ?? null, claims: sessionClaims, turns: sessionTurns };
    },
    async listSources(tenantId) {
      return sourcesColl(tenantId).find({}).toArray();
    },
    async listGaps(tenantId) {
      return gapsColl(tenantId).find({}).toArray();
    },
  };
}

/** Real `GraphReadDeps` (routes/graph.ts) — reuses the exact same `tree_index` query
 * `createMongoTreeStore` already uses (the `tenant:<id>` node_id fix), then flattens it with
 * `@lkb/index`'s pure `flattenTreeToGraph`. No new Mongo access pattern. */
export function createMongoGraphReadDeps(): GraphReadDeps {
  return {
    async loadGraph(tenantId): Promise<Graph | null> {
      const root = await getDb().collection<TreeIndexNode>("tree_index").findOne({ node_id: `tenant:${tenantId}`, level: "tenant" });
      return root ? flattenTreeToGraph(root) : null;
    },
  };
}

/** Real `KeysDeps` (routes/keys.ts) — the only place that generates or hashes a raw API key
 * outside `scripts/seed-demo-server.mjs`. `listKeys` projects out `keyHash` explicitly (never
 * relies on the caller to remember not to serialize it) so a masked list can never accidentally
 * leak the one thing that must never leave this function. */
export function createMongoKeysDeps(): KeysDeps {
  const coll = () => getDb().collection<ApiKeys>("api_keys");

  return {
    async listKeys(tenantId): Promise<ApiKeySummary[]> {
      const docs = await coll().find({ tenantId }).toArray();
      return docs.map((d) => ({
        _id: d._id,
        label: d.label ?? "(unlabeled)",
        scopes: d.scopes ?? [],
        createdAt: d.createdAt,
        revokedAt: d.revokedAt ?? null,
      }));
    },
    async createKey(tenantId, label, scopes) {
      const id = randomUUID();
      const rawKey = `lkb_${randomBytes(24).toString("hex")}`;
      await coll().insertOne({
        _id: id,
        tenantId,
        keyHash: sha256Hex(rawKey),
        label,
        scopes,
        createdAt: new Date().toISOString(),
        revokedAt: null,
      });
      return { id, rawKey };
    },
    async revokeKey(tenantId, id) {
      const result = await coll().updateOne(
        { _id: id, tenantId, revokedAt: null },
        { $set: { revokedAt: new Date().toISOString() } },
      );
      return result.matchedCount > 0;
    },
  };
}
