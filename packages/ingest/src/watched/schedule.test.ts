/**
 * packages/ingest/src/watched/schedule.test.ts — T-027 C6 (schedule half). Never-fetched is
 * always due; inactive is never due regardless of elapsed time; due/not-due boundary at exactly
 * checkIntervalHours.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { WatchedSources } from "@lkb/core";
import { isDueForCheck } from "./schedule.js";

const TENANT = "toc";

function source(overrides: Partial<WatchedSources> = {}): WatchedSources {
  return {
    _id: "ws1", tenantId: TENANT, url: "https://example.com", reputationTier: "official",
    checkIntervalHours: 24, active: true,
    ...overrides,
  };
}

test("never-fetched source is always due", () => {
  const s = source();
  assert.equal(isDueForCheck(s, "2026-09-03T12:00:00Z"), true);
});

test("inactive source is never due, even if never fetched", () => {
  const s = source({ active: false });
  assert.equal(isDueForCheck(s, "2026-09-03T12:00:00Z"), false);
});

test("inactive source is never due, even long past its interval", () => {
  const s = source({ active: false, lastFetch: { fetchedAt: "2026-01-01T00:00:00Z", hash: "h", diffFrom: null } });
  assert.equal(isDueForCheck(s, "2026-09-03T12:00:00Z"), false);
});

test("boundary: exactly checkIntervalHours elapsed is due", () => {
  const s = source({ checkIntervalHours: 24, lastFetch: { fetchedAt: "2026-09-02T12:00:00Z", hash: "h", diffFrom: null } });
  assert.equal(isDueForCheck(s, "2026-09-03T12:00:00.000Z"), true);
});

test("boundary: one second short of checkIntervalHours is not due", () => {
  const s = source({ checkIntervalHours: 24, lastFetch: { fetchedAt: "2026-09-02T12:00:00Z", hash: "h", diffFrom: null } });
  assert.equal(isDueForCheck(s, "2026-09-03T11:59:59Z"), false);
});
