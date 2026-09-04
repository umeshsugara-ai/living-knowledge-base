/**
 * apps/api/src/routes/graph.test.ts — same DI/HTTP pattern as brain.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeGraphReadDeps } from "../fixtures.js";

test("GET /graph with the graph scope returns real nodes/edges", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "graph-key": { tenantId: "tenant-1", scopes: ["graph"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/graph`, { headers: { authorization: "Bearer graph-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { nodes: unknown[]; edges: unknown[] };
    assert.equal(body.nodes.length, 2);
    assert.equal(body.edges.length, 1);
  } finally {
    await server.close();
  }
});

test("GET /graph without the graph scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/graph`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("GET /graph for a tenant with no tree index returns 404", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "graph-key": { tenantId: "tenant-empty", scopes: ["graph"] } }),
      graph: fakeGraphReadDeps(),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/graph`, { headers: { authorization: "Bearer graph-key" } });
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});
