/**
 * packages/ingest/src/gap-tracking.test.ts — T-006 C6. `recordGap` writes a correctly-shaped
 * `gaps` doc via a fake store (no real Mongo, matches every other unit's injectable-store test
 * pattern).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { recordGap, type GapStore } from "./gap-tracking.js";
import type { Gaps } from "@lkb/core";
import { TENANT, FIXED_NOW } from "./testUtils.js";

function fakeStore(): GapStore & { docs: Gaps[] } {
  const docs: Gaps[] = [];
  return {
    docs,
    async create(tenantId, doc) {
      docs.push({ ...doc, tenantId } as Gaps);
    },
  };
}

test("recordGap writes an open gap with a computed SLA dueAt", async () => {
  const store = fakeStore();
  const doc = await recordGap(
    "provided-first-warning",
    {
      tenantId: TENANT,
      kind: "recording-pending",
      description: "27-Aug In-Focus session recording not yet provided",
      requestedFrom: "org:toc-bhakti",
      now: () => FIXED_NOW,
    },
    store,
  );

  assert.equal(store.docs.length, 1);
  assert.deepEqual(store.docs[0], doc);
  assert.equal(doc.tenantId, TENANT);
  assert.equal(doc.kind, "recording-pending");
  assert.equal(doc.status, "open");
  assert.equal(doc.requestedAt, FIXED_NOW);
  assert.equal(doc.requestedFrom, "org:toc-bhakti");
  assert.match(doc.description ?? "", /provided-first-warning/);
  // Default SLA is 3 days (ADR-0002 decision 2).
  assert.equal(doc.sla?.dueAt, "2026-09-06T00:00:00.000Z");
});

test("recordGap defaults the id and omits sourceRef/requestedFrom when not supplied", async () => {
  const store = fakeStore();
  const doc = await recordGap(
    "fetch-not-found",
    { tenantId: TENANT, kind: "source-pending", description: "doc URL 404'd", now: () => FIXED_NOW },
    store,
  );

  assert.equal(doc._id, `gap-${TENANT}-${FIXED_NOW}`);
  assert.equal(doc.requestedFrom, undefined);
  assert.equal(doc.sourceRef, undefined);
});

test("recordGap honors a custom slaDays and id generator", async () => {
  const store = fakeStore();
  const doc = await recordGap(
    "join-failure",
    {
      tenantId: TENANT,
      kind: "recording-pending",
      description: "meeting-bot failed to join",
      slaDays: 1,
      now: () => FIXED_NOW,
      id: () => "custom-gap-id",
    },
    store,
  );

  assert.equal(doc._id, "custom-gap-id");
  assert.equal(doc.sla?.dueAt, "2026-09-04T00:00:00.000Z");
});
