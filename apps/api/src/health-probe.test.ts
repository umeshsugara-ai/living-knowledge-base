/**
 * apps/api/src/health-probe.test.ts — ISS-070 regression. Proves `probeMongoHealth` degrades to
 * `{db: "error", collections: {}}` on a failure from EITHER step, not just `ping`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { probeMongoHealth } from "./health-probe.js";

test("both ping and count succeeding returns db: ok with the real counts", async () => {
  const report = await probeMongoHealth(
    async () => ({}),
    async () => ({ sessions: 3, claims: 7 }),
  );
  assert.deepEqual(report, { db: "ok", collections: { sessions: 3, claims: 7 } });
});

test("a ping failure degrades to db: error, never throws", async () => {
  const report = await probeMongoHealth(
    async () => { throw new Error("connection refused"); },
    async () => ({ sessions: 3 }),
  );
  assert.deepEqual(report, { db: "error", collections: {} });
});

test("a count failure AFTER a successful ping ALSO degrades to db: error, never throws (ISS-070)", () => {
  // Before the fix, only the ping was try/catch-guarded — a countAll() throw here propagated as
  // an unhandled rejection instead of a reported "error" status.
  return assert.doesNotReject(async () => {
    const report = await probeMongoHealth(
      async () => ({}), // ping succeeds
      async () => { throw new Error("transient countDocuments failure"); },
    );
    assert.deepEqual(report, { db: "error", collections: {} });
  });
});
