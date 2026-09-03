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

export function buildTestDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    keyStore: fakeKeyStore({ "good-ask-key": { tenantId: "tenant-1", scopes: ["ask"] } }),
    ask: { tree: fakeTreeStore(), askDeps: fakeAskDeps() },
    evalRuns: fakeEvalRunStore(),
    ...overrides,
  };
}
