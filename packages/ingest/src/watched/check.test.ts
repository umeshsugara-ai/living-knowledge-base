/**
 * packages/ingest/src/watched/check.test.ts — T-027 C6 (check half). First-ever check is always
 * changed; identical content on a second check is not changed; different content is changed with
 * diffFrom set to the prior hash. No live network — fake fetcher/hasher throughout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { WatchedSources } from "@lkb/core";
import { checkWatchedSource } from "./check.js";
import { fakeUrlFetcher, fakeHasher, TENANT, FIXED_NOW } from "../testUtils.js";

const URL = "https://example.com/nz-visas";

function source(overrides: Partial<WatchedSources> = {}): WatchedSources {
  return {
    _id: "ws1", tenantId: TENANT, url: URL, reputationTier: "official",
    checkIntervalHours: 24, active: true,
    ...overrides,
  };
}

test("first-ever check (no lastFetch) is always changed", async () => {
  const fetcher = fakeUrlFetcher({ [URL]: "visa rules v1" });
  const result = await checkWatchedSource(source(), fetcher, fakeHasher, () => FIXED_NOW);
  assert.equal(result.changed, true);
  assert.equal(result.diffFrom, null);
  assert.equal(result.hash, fakeHasher("visa rules v1"));
  assert.equal(result.fetchedAt, FIXED_NOW);
});

test("identical content on a second check is not changed", async () => {
  const fetcher = fakeUrlFetcher({ [URL]: "visa rules v1" });
  const s = source({ lastFetch: { fetchedAt: "2026-09-01T00:00:00Z", hash: fakeHasher("visa rules v1"), diffFrom: null } });
  const result = await checkWatchedSource(s, fetcher, fakeHasher, () => FIXED_NOW);
  assert.equal(result.changed, false);
  assert.equal(result.diffFrom, fakeHasher("visa rules v1"));
});

test("different content is changed, diffFrom set to the prior hash", async () => {
  const fetcher = fakeUrlFetcher({ [URL]: "visa rules v2 — updated fee schedule" });
  const priorHash = fakeHasher("visa rules v1");
  const s = source({ lastFetch: { fetchedAt: "2026-09-01T00:00:00Z", hash: priorHash, diffFrom: null } });
  const result = await checkWatchedSource(s, fetcher, fakeHasher, () => FIXED_NOW);
  assert.equal(result.changed, true);
  assert.equal(result.diffFrom, priorHash);
  assert.notEqual(result.hash, priorHash);
});
