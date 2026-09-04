/**
 * apps/api/src/fixtures.ts — shared test fakes (C7: "tests use fakes for these" — treeSearch,
 * provider `complete`, `scoreFn`, key/tree stores). Not a `*.test.ts` file itself; imported by
 * them so every test file builds `ServerDeps` the same honest way.
 */
import type { CompleteResult } from "@lkb/ai";
import type { EvalRuns, TreeIndexNode } from "@lkb/core";
import type { AskV2Deps } from "@lkb/ask";
import type { ApiKeyStore, VerifiedKey } from "./auth.js";
import type { TreeStore } from "./routes/ask.js";
import type { EvalRunStore } from "./routes/compete.js";
import { randomUUID } from "node:crypto";
import type { BrainReadDeps, SessionDetail } from "./routes/brain.js";
import type { GraphReadDeps } from "./routes/graph.js";
import type { CalendarReadDeps, UpcomingMeeting } from "./routes/calendar.js";
import type { ApiKeySummary, KeysDeps } from "./routes/keys.js";
import type { IngestDeps } from "./routes/ingest.js";
import type { ServerDeps } from "./server.js";

export const FIXTURE_TREE: TreeIndexNode = {
  node_id: "tenant-1",
  title: "Tenant Root",
  level: "tenant",
  summary: "root",
  children: [
    { node_id: "n1", title: "Topic One", level: "topic", summary: "everything about topic one", children: [] },
  ],
};

export function fakeKeyStore(keys: Record<string, VerifiedKey | undefined>): ApiKeyStore {
  return { verify: async (key) => keys[key] ?? null };
}

export function fakeTreeStore(tree: TreeIndexNode | null = FIXTURE_TREE): TreeStore {
  return { load: async () => tree };
}

function flatten(node: TreeIndexNode): TreeIndexNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

/** A fake `NodeSearchFn` — deliberately reimplemented, not `@lkb/index`'s `treeSearch`, so the
 * route's injection seam is what's under test, independent of the real implementation. */
export const fakeTreeSearchFn = (tree: TreeIndexNode, nodeIds: string[]): TreeIndexNode[] =>
  flatten(tree).filter((n) => nodeIds.includes(n.node_id));

function completion(text: string, json?: unknown): CompleteResult {
  return { text, json, usage: { inputTokens: 1, outputTokens: 1 }, provider: "fake", model: "fake-1", costUsd: 0 };
}

/** Always resolves node `n1` and answers with a fixed string — enough to exercise a full
 * `askV2` "correct verdict, no refine, no web" happy path end to end. */
export const fakeComplete: AskV2Deps["complete"] = async (job) => {
  if (job.kind === "ask.select_nodes") return completion("", { node_ids: ["n1"] });
  return completion("This is the fake answer.");
};

export const fakeScoreFn: AskV2Deps["scoreFn"] = () => [0.9, "fixture: always scores above upper threshold"];

export function fakeAskDeps(): Omit<AskV2Deps, "tenantId"> {
  return {
    complete: fakeComplete,
    scoreFn: fakeScoreFn,
    treeSearchFn: fakeTreeSearchFn,
    write: async () => {},
  };
}

/** An in-memory `EvalRunStore` — tests never touch Mongo. `_rows` is exposed for assertions. */
export function fakeEvalRunStore(): EvalRunStore & { _rows: Map<string, EvalRuns> } {
  const rows = new Map<string, EvalRuns>();
  return {
    _rows: rows,
    async create(tenantId, doc) {
      const row = { ...doc, tenantId } as EvalRuns;
      rows.set(row._id, row);
    },
    async recordScore(tenantId, id, update) {
      const row = rows.get(id);
      if (!row || row.tenantId !== tenantId) return false;
      rows.set(id, { ...row, counsellorAnswer: update.counsellorAnswer, score: update.score });
      return true;
    },
  };
}

/** An in-memory `BrainReadDeps` — tests never touch Mongo. Seeded with one fixture session so
 * both the list and detail routes have something real to return by default. */
export function fakeBrainReadDeps(overrides: Partial<BrainReadDeps> = {}): BrainReadDeps {
  const fixtureDetail: SessionDetail = {
    session: {
      _id: "session-1", tenantId: "tenant-1", sourceId: "source-1", title: "Fixture Session",
      date: "2026-01-15", status: { transcribe: "done", index: "done" },
    },
    page: { _id: "page-1", tenantId: "tenant-1", sessionId: "session-1", summary: "A fixture summary.", evidence: [{ turnId: "t1", sessionId: "session-1" }] },
    claims: [{ _id: "claim-1", tenantId: "tenant-1", text: "A fixture claim.", status: "verified", evidence: [{ turnId: "t1", sessionId: "session-1" }] }],
    turns: [{ _id: "t1", tenantId: "tenant-1", sessionId: "session-1", speakerRef: "spk:0", tStart: 0, tEnd: 5, text: "Hello." }],
  };
  return {
    listSessions: async () => [fixtureDetail.session],
    getSessionDetail: async (_tenantId, id) => (id === "session-1" ? fixtureDetail : null),
    listSources: async () => [],
    listGaps: async () => [],
    ...overrides,
  };
}

/** An in-memory `GraphReadDeps` — tests never touch Mongo. One session/topic node + edge so
 * both the empty-graph and non-empty-graph shapes are reachable from a default fixture. */
export function fakeGraphReadDeps(overrides: Partial<GraphReadDeps> = {}): GraphReadDeps {
  return {
    loadGraph: async (tenantId) =>
      tenantId === "tenant-1"
        ? {
            nodes: [
              { id: "session-1", label: "Fixture Session", kind: "session" },
              { id: "visas", label: "Visas", kind: "topic" },
            ],
            edges: [{ source: "session-1", target: "visas", kind: "session-topic", inferred: false }],
          }
        : null,
    ...overrides,
  };
}

/** An in-memory `CalendarReadDeps` — tests never shell out to `gws`. One fixture meeting by
 * default so both the populated and (via override) empty shapes are reachable. */
export function fakeCalendarReadDeps(overrides: Partial<CalendarReadDeps> = {}): CalendarReadDeps {
  const fixtureMeeting: UpcomingMeeting = {
    id: "evt-1", title: "Fixture Sync", startTime: "2026-09-05T10:00:00.000Z",
    endTime: "2026-09-05T10:30:00.000Z", meetingUrl: "https://meet.google.com/fixture", organizer: "umeshsugara@vidysea.com",
  };
  return {
    listUpcoming: async () => [fixtureMeeting],
    ...overrides,
  };
}

/** A REAL in-memory `KeysDeps` (not read-only like the fakes above — create/list/revoke must
 * stay consistent within one test, matching what the real Mongo-backed impl guarantees). Never
 * exposes a raw key or hash from `listKeys`, same as the production implementation. */
export function fakeKeysDeps(): KeysDeps & { _raw: Map<string, { tenantId: string; label: string; scopes: string[]; createdAt: string; revokedAt: string | null }> } {
  const rows = new Map<string, { tenantId: string; label: string; scopes: string[]; createdAt: string; revokedAt: string | null }>();
  return {
    _raw: rows,
    async listKeys(tenantId): Promise<ApiKeySummary[]> {
      return [...rows.entries()]
        .filter(([, r]) => r.tenantId === tenantId)
        .map(([_id, r]) => ({ _id, label: r.label, scopes: r.scopes, createdAt: r.createdAt, revokedAt: r.revokedAt }));
    },
    async createKey(tenantId, label, scopes) {
      const id = randomUUID();
      rows.set(id, { tenantId, label, scopes, createdAt: new Date().toISOString(), revokedAt: null });
      return { id, rawKey: `fake_${id}` };
    },
    async revokeKey(tenantId, id) {
      const row = rows.get(id);
      if (!row || row.tenantId !== tenantId || row.revokedAt) return false;
      row.revokedAt = new Date().toISOString();
      return true;
    },
  };
}

/** A REAL in-memory `IngestDeps` — tests never touch Mongo or a real network fetch. Overridable
 * per-test so a failure path (a real fetch/adapter error) can be exercised too. */
export function fakeIngestDeps(overrides: Partial<IngestDeps> = {}): IngestDeps {
  return {
    async ingestUrl(_tenantId, url) {
      return { sessionId: `fake-session-for-${url}`, sourceId: `fake-source-for-${url}`, turnCount: 3 };
    },
    ...overrides,
  };
}

export function buildTestDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    keyStore: fakeKeyStore({ "good-ask-key": { tenantId: "tenant-1", scopes: ["ask"] } }),
    ask: { tree: fakeTreeStore(), askDeps: fakeAskDeps() },
    evalRuns: fakeEvalRunStore(),
    brain: fakeBrainReadDeps(),
    graph: fakeGraphReadDeps(),
    calendar: fakeCalendarReadDeps(),
    keys: fakeKeysDeps(),
    ingest: fakeIngestDeps(),
    ...overrides,
  };
}
