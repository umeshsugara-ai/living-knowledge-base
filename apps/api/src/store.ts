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
  listAll as listAllMeetingCandidates, createIfNew as createMeetingCandidateIfNew,
  decide as decideMeetingCandidate, get as getTrustedSender, recordApproval as recordSenderApproval,
} from "@lkb/db";
import type { ApiKeys, Jobs, TreeIndexNode, TreeIndexRootDocument } from "@lkb/core";
import type { WriteJobFn } from "@lkb/ai";
import { flattenTreeToGraph, treeIndexRootFilter, type Graph } from "@lkb/index";
import type { ApiKeyStore, VerifiedKey } from "./auth.js";
import type { TreeStore } from "./routes/ask.js";
import type { EvalRunStore } from "./routes/compete.js";
import type { BrainReadDeps, SessionDetail } from "./routes/brain.js";
import type { Citation, CitationEvidence, CitationsDeps } from "./routes/citations.js";
import type { GraphReadDeps } from "./routes/graph.js";
import type { ApiKeySummary, KeysDeps } from "./routes/keys.js";
import type { CalendarReadDeps } from "./routes/calendar.js";
import { listUpcomingGwsMeetings } from "./gws-calendar.js";
import type { MeetingCandidatesDeps } from "./routes/meeting-candidates.js";
import { scanGmailForMeetingCandidates } from "./gws-gmail.js";
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
      // treeIndexRootFilter (ISS-063) is the single source of the `tenant:<id>` convention this
      // query used to hand-write -- that hand-written copy was the exact query that got the
      // node_id shape wrong once, live, on 2026-09-04, before this file matched what buildTree
      // actually produces. It now also matches on the real `tenantId` field (ISS-062) --
      // TreeIndexRootDocument satisfies TreeStore's TreeIndexNode return type (it's a superset).
      return getDb().collection<TreeIndexRootDocument>("tree_index").findOne(treeIndexRootFilter(tenantId));
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

/** Real `CitationsDeps` (routes/citations.ts) — same composition-root pattern as the brain deps
 * above. A claim's `evidence[]` is a small, bounded array (JSON Schema `@minItems 1`, never
 * thousands of rows), so resolving each turn/session in parallel is the right shape — no batching
 * layer needed at this scale. */
export function createMongoCitationsDeps(): CitationsDeps {
  return {
    async getCitation(tenantId, claimId): Promise<Citation | null> {
      const claim = await claimsColl(tenantId).findOne({ _id: claimId });
      if (!claim) return null;
      const evidence = await Promise.all(
        claim.evidence.map(async (e): Promise<CitationEvidence> => {
          const [turn, session] = await Promise.all([
            turnsColl(tenantId).findOne({ _id: e.turnId }),
            sessionsColl(tenantId).findOne({ _id: e.sessionId }),
          ]);
          return { turnId: e.turnId, sessionId: e.sessionId, turn: turn ?? null, session: session ?? null };
        }),
      );
      return { claim, evidence };
    },
  };
}

/** Real `GraphReadDeps` (routes/graph.ts) — reuses the exact same `treeIndexRootFilter` query
 * `createMongoTreeStore` already uses, then flattens it with `@lkb/index`'s pure
 * `flattenTreeToGraph`. No new Mongo access pattern. */
export function createMongoGraphReadDeps(): GraphReadDeps {
  return {
    async loadGraph(tenantId): Promise<Graph | null> {
      const root = await getDb().collection<TreeIndexRootDocument>("tree_index").findOne(treeIndexRootFilter(tenantId));
      return root ? flattenTreeToGraph(root) : null;
    },
  };
}

/** Real `CalendarReadDeps` (routes/calendar.ts) — thin wrapper over the `gws`-backed adapter.
 * `tenantId` is accepted for interface parity with every other read-dep but unused today: `gws`
 * reads one calendar ("primary", Umesh's own), not a per-tenant mapping — a real, disclosed
 * limitation of this being a single-operator tool today, not a hosted multi-tenant one. */
export function createGwsCalendarReadDeps(): CalendarReadDeps {
  return {
    async listUpcoming(_tenantId) {
      return listUpcomingGwsMeetings();
    },
  };
}

/** Real `MeetingCandidatesDeps` (routes/meeting-candidates.ts) — wraps the already-real
 * `@lkb/db` `meeting-candidates`/`trusted-senders` accessors plus the `gws`-backed Gmail scan.
 * `scanGmail`'s per-message trust check is why this composes the two collections here rather
 * than in the route: a candidate whose sender already crossed `AUTO_APPROVE_THRESHOLD` is filed
 * straight in as `auto_approved`, never sitting in the pending review queue Umesh has to clear
 * by hand for a sender he's already trusted three times over. */
export function createMeetingCandidatesDeps(): MeetingCandidatesDeps {
  return {
    async scanGmail(tenantId) {
      const found = await scanGmailForMeetingCandidates();
      let created = 0;
      let autoApproved = 0;
      for (const candidate of found) {
        const trusted = await getTrustedSender(tenantId, candidate.senderDomain);
        const status = trusted?.autoApprove ? "auto_approved" : "pending";
        const wrote = await createMeetingCandidateIfNew(tenantId, {
          _id: randomUUID(),
          messageId: candidate.messageId,
          subject: candidate.subject,
          senderEmail: candidate.senderEmail,
          senderDomain: candidate.senderDomain,
          ...(candidate.meetingUrl ? { meetingUrl: candidate.meetingUrl } : {}),
          status,
          detectedAt: new Date().toISOString(),
        });
        if (wrote) {
          created += 1;
          if (status === "auto_approved") autoApproved += 1;
        }
      }
      return { created, autoApproved };
    },
    listCandidates: (tenantId) => listAllMeetingCandidates(tenantId),
    async approve(tenantId, id) {
      const candidate = await listAllMeetingCandidates(tenantId).then((rows) => rows.find((r) => r._id === id));
      const ok = await decideMeetingCandidate(tenantId, id, "approved");
      if (ok && candidate) await recordSenderApproval(tenantId, candidate.senderDomain);
      return ok;
    },
    reject: (tenantId, id) => decideMeetingCandidate(tenantId, id, "rejected"),
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
