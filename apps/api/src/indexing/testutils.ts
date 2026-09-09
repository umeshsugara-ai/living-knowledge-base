/**
 * apps/api/src/indexing-testutils.ts — shared fixtures for the indexing tests.
 *
 * Extracted when the ISS-118 gap tests moved into their own file alongside `vector-gap.ts`: both
 * suites need the same injected fake db and the same tenant-confinement assertions, and copying
 * them would have created two fixtures free to drift — with the tenant-scoping checks, the most
 * safety-relevant assertions in this package, being the ones duplicated. Same reasoning and same
 * shape as `packages/ai/src/testUtils.ts`. Not itself a test; imported by them.
 */
import assert from "node:assert/strict";
import type { Db } from "mongodb";

export interface Call {
  coll: string;
  op: string;
  filter?: Record<string, unknown>;
  docs?: Record<string, unknown>[];
  update?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * Records every collection operation. `turns` MUST return a real row: with zero turns
 * `extractClaims` short-circuits to a non-degraded empty result (correctly — there is nothing to
 * extract), so an empty fixture silently tests the wrong branch. The first version of this fake
 * returned nothing anywhere and the degraded-run test failed for that reason, not a code fault.
 *
 * `existingSessionPage`, when set, is what `session_pages.findOne` returns — used to test the
 * ISS-059 guard (a degraded summarize run must not overwrite a real prior page).
 */
export function fakeDb(
  opts: {
    existingSessionPage?: Record<string, unknown> | null;
    /**
     * Rows `claims.find()` returns. Default `[]`, which is what every test had until ISS-126
     * cycle 2 — and that default made the ENTIRE `tagClaims: true` path unreachable in all 137
     * tests, so mutating `topicRefs: refs` to `topicRefs: []` stayed green. An empty fixture does
     * not test the empty case; it tests nothing at all. Opt-in so existing tests are unchanged.
     */
    claims?: Record<string, unknown>[];
  } = {},
): { db: Pick<Db, "collection">; calls: Call[] } {
  const calls: Call[] = [];
  const TURN = { _id: "t1", tenantId: "t", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "A real sentence." };
  // A real session, so buildTree(allSessions, allPages) actually produces a root for "t" and the
  // tree_index replaceOne path is genuinely exercised — without this, buildTree([], []) returns
  // {} (no root for any tenant) and replaceOne NEVER fires, so nothing about the tree_index write
  // (including the ISS-062 tenantId-stamping fix) was ever really under test. Found by testing
  // the fix's own mutation and getting a false green.
  // `org` and a topic-bearing page are LOAD-BEARING, not decoration (ISS-154). Without them
  // `buildTree` produces no topic or org nodes, so `promoteAndPersistEntities` writes nothing, so
  // the blanket tenant-confinement test had NOTHING TO CONFINE for entities — and the contract's
  // mandatory `scopedCollection` -> bare-handle mutation survived on both `topics` and `orgs` at
  // 159/0 green. A fixture that cannot reach a code path silently exempts it from every test that
  // walks the recorded calls. This is the fifth such gap in this layer.
  const SESSION = { _id: "s1", tenantId: "t", sourceId: "src1", title: "Test Session", date: "2026-09-07", org: "Acme University", status: { transcribe: "done", index: "pending" } };
  // A capitalised phrase so the default `extractTopicRefs` heuristic yields a real topic node.
  const PAGE = { _id: "p1", tenantId: "t", sessionId: "s1", summary: "Notes about New Zealand visas.", keyInsights: ["New Zealand visa rules changed."], decisions: [], actionItems: [], evidence: [{ turnId: "t1", sessionId: "s1" }] };
  const db = {
    collection(name: string) {
      const rec = (op: string, extra?: { filter?: Record<string, unknown>; docs?: Record<string, unknown>[]; update?: Record<string, unknown>; options?: Record<string, unknown> }) => {
        calls.push({ coll: name, op, filter: extra?.filter, docs: extra?.docs, update: extra?.update, options: extra?.options });
      };
      return {
        deleteMany: async (filter?: Record<string, unknown>) => { rec("deleteMany", { filter }); return { deletedCount: 0 }; },
        insertOne: async (doc?: Record<string, unknown>) => { rec("insertOne", { docs: doc ? [doc] : [] }); return {}; },
        insertMany: async (docs?: Record<string, unknown>[]) => { rec("insertMany", { docs: docs ?? [] }); return {}; },
        replaceOne: async (filter?: Record<string, unknown>, doc?: Record<string, unknown>) => { rec("replaceOne", { filter, docs: doc ? [doc] : [] }); return {}; },
        findOne: async (filter?: Record<string, unknown>) => {
          rec("findOne", { filter });
          return name === "session_pages" ? (opts.existingSessionPage ?? null) : null;
        },
        find: (filter?: Record<string, unknown>) => ({
          toArray: async () => {
            rec("find", { filter });
            if (name === "turns") return [TURN];
            if (name === "sessions") return [SESSION];
            if (name === "session_pages") return [PAGE];
            if (name === "claims") {
              // HONOURS THE FILTER (ISS-C-CLAIMS-TARGETING-001). It previously ignored it and
              // returned every seeded row, which made a scoping regression STRUCTURALLY
              // INVISIBLE: widening `.find({"evidence.sessionId": id})` to `.find({})` returned
              // the same rows, so the mutation survived a full green suite. A fake that answers
              // the same regardless of what it was asked cannot test what it was asked.
              const want = (filter ?? {})["evidence.sessionId"];
              const rows = opts.claims ?? [];
              if (want === undefined) return rows;
              return rows.filter((c) => {
                const ev = (c.evidence ?? []) as { sessionId?: string }[];
                return Array.isArray(ev) && ev.some((e) => e.sessionId === want);
              });
            }
            return [];
          },
        }),
        updateOne: async (filter?: Record<string, unknown>, update?: Record<string, unknown>, options?: Record<string, unknown>) => { rec("updateOne", { filter, update, options }); return {}; },
      };
    },
  } as unknown as Pick<Db, "collection">;
  return { db, calls };
}

const CLAIMS_JSON = JSON.stringify([{ text: "A real claim.", turnIds: ["t1"] }]);

/** `complete` is called for both summarize and claims; route by the job kind. Each path degrades
 * independently, matching the real degradation shapes (ISS-056/ISS-059) — a claims outage must
 * not take the summary down with it, and vice versa. */
export function completeWith({ claimsFails = false, summarizeFails = false } = {}) {
  return async (job: { kind: string }) => {
    if (job.kind === "claims") {
      if (claimsFails) throw new Error("provider down");
      return { text: CLAIMS_JSON, json: undefined, usage: {}, provider: "fake", model: "fake" };
    }
    if (summarizeFails) throw new Error("provider down");
    return {
      text: JSON.stringify({ summary: "s", keyInsights: [], decisions: [], actionItems: [] }),
      json: undefined, usage: {}, provider: "fake", model: "fake",
    };
  };
}

/** A successful embedder: one 3-dim vector per input text, paired by index. */
export const embedOk = async (job: { texts: string[] }) => ({
  vectors: job.texts.map(() => [0.1, 0.2, 0.3]),
  dims: 3,
  provider: "fake",
  model: "fake-embed",
});

/**
 * Checks an `updateOne` call's UPDATE BODY, not just its filter — `updateOne`'s filter can carry
 * the right tenantId while the update itself moves the document to a different one. First found
 * (2026-09-07) as a single `$set`-only check; that missed `$unset` stripping `tenantId` entirely
 * (ISS-066) — the second instance of this project's own untested-guard pattern landing inside a
 * unit built specifically to close the first instance. Fixed generically this time: every
 * MongoDB update operator's sub-object (`$set`, `$unset`, `$rename`, `$currentDate`, …) and a raw
 * replacement document are all scanned the same way, so a THIRD operator doesn't need a THIRD
 * special case.
 */
export function assertUpdateBodyConfined(call: Call, tenantId: string) {
  const update = call.update!;
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith("$")) {
      // A raw replacement document (no operators at all) — `key` is a field name directly.
      if (key === "tenantId") assert.equal(value, tenantId, `${call.coll}.${call.op}'s update body reassigns tenantId — it can move a document into another tenant`);
      continue;
    }
    const operand = value as Record<string, unknown>;
    if (operand === null || typeof operand !== "object" || !("tenantId" in operand)) continue;
    if (key === "$unset") {
      assert.fail(`${call.coll}.${call.op}'s ${key} strips tenantId — the document would carry no tenant at all (ISS-066)`);
    } else {
      assert.equal(operand.tenantId, tenantId, `${call.coll}.${call.op}'s ${key} reassigns tenantId — it can move a document into another tenant`);
    }
  }
}
