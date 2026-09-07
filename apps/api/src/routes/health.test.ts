/**
 * apps/api/src/routes/health.test.ts — in-process HTTP requests against `routes/health.ts` with
 * `fakeHealthDeps`. Covers: healthy -> 200 with real shape; NO Authorization header still works
 * (the deliberate unauthenticated exception); an unhealthy db report -> 503, not 200.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeHealthDeps } from "../fixtures.js";

test("GET /health with no Authorization header returns 200 with a real report shape", async () => {
  const server = await startTestServer(buildTestDeps());
  try {
    const res = await fetch(`${server.baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { db: string; collections: Record<string, number> };
    assert.equal(body.db, "ok");
    assert.equal(body.collections.sessions, 1);
    assert.equal(body.collections.claims, 1);
  } finally {
    await server.close();
  }
});

test("GET /health reports 503, not 200, when the db is unhealthy", async () => {
  const server = await startTestServer(
    buildTestDeps({ health: fakeHealthDeps({ checkHealth: async () => ({ db: "error", collections: {} }) }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/health`);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { db: string; collections: Record<string, number> };
    assert.equal(body.db, "error");
    assert.deepEqual(body.collections, {});
  } finally {
    await server.close();
  }
});
