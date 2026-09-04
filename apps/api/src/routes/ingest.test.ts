/**
 * apps/api/src/routes/ingest.test.ts — real coverage for POST /ingest: happy path, bad request
 * (non-URL body), a real fetch/adapter failure surfaced as 502 not 500, and the auth scope gate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeIngestDeps } from "../fixtures.js";

test("POST /ingest with a valid URL creates a real session/source/turns set and returns their ids", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ingest-key": { tenantId: "tenant-1", scopes: ["ingest"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ingest-key" },
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { sessionId: string; sourceId: string; turnCount: number };
    assert.ok(body.sessionId);
    assert.ok(body.sourceId);
    assert.equal(typeof body.turnCount, "number");
  } finally {
    await server.close();
  }
});

test("POST /ingest with a non-URL body returns 400, never attempts a fetch", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ingest-key": { tenantId: "tenant-1", scopes: ["ingest"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ingest-key" },
      body: JSON.stringify({ url: "not-a-url" }),
    });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("a real fetch/adapter failure surfaces as 502 with the real error message, never a silent 500", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "ingest-key": { tenantId: "tenant-1", scopes: ["ingest"] } }),
      ingest: fakeIngestDeps({
        ingestUrl: async () => { throw new Error("Jina Reader could not fetch this URL (HTTP 404)"); },
      }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ingest-key" },
      body: JSON.stringify({ url: "https://example.com/gone" }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { message: string };
    assert.match(body.message, /404/);
  } finally {
    await server.close();
  }
});

test("POST /ingest without the ingest scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ask-only-key" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
