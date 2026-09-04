/**
 * apps/api/src/routes/keys.test.ts — real coverage for self-serve API key management, including
 * the security-sensitive invariants: the raw key is returned exactly once (POST), never again
 * (GET always masks), and a key can only ever see/revoke its own tenant's keys.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeKeysDeps } from "../fixtures.js";

test("POST /keys creates a real key and returns the raw value exactly once", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "admin-key": { tenantId: "tenant-1", scopes: ["keys"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin-key" },
      body: JSON.stringify({ label: "My integration", scopes: ["ask"] }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { id: string; key: string };
    assert.ok(body.id);
    assert.ok(body.key && body.key.length > 10);
  } finally {
    await server.close();
  }
});

test("GET /keys never returns a raw key or a hash, only masked metadata", async () => {
  const keys = fakeKeysDeps();
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "admin-key": { tenantId: "tenant-1", scopes: ["keys"] } }),
      keys,
    }),
  );
  try {
    await keys.createKey("tenant-1", "Existing key", ["ask"]);
    const res = await fetch(`${server.baseUrl}/keys`, { headers: { authorization: "Bearer admin-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { keys: Array<Record<string, unknown>> };
    assert.equal(body.keys.length, 1);
    assert.equal(body.keys[0]!.label, "Existing key");
    assert.equal("keyHash" in body.keys[0]!, false, "must never serialize keyHash");
    assert.equal("key" in body.keys[0]!, false, "must never serialize a raw key");
  } finally {
    await server.close();
  }
});

test("a key only ever sees its own tenant's keys, never another tenant's", async () => {
  const keys = fakeKeysDeps();
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({
        "tenant-a-key": { tenantId: "tenant-a", scopes: ["keys"] },
        "tenant-b-key": { tenantId: "tenant-b", scopes: ["keys"] },
      }),
      keys,
    }),
  );
  try {
    await keys.createKey("tenant-a", "A's key", ["ask"]);
    await keys.createKey("tenant-b", "B's key", ["ask"]);
    const res = await fetch(`${server.baseUrl}/keys`, { headers: { authorization: "Bearer tenant-a-key" } });
    const body = (await res.json()) as { keys: Array<{ label: string }> };
    assert.equal(body.keys.length, 1);
    assert.equal(body.keys[0]!.label, "A's key");
  } finally {
    await server.close();
  }
});

test("DELETE /keys/:id revokes a key, and it stops appearing as active", async () => {
  const keys = fakeKeysDeps();
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "admin-key": { tenantId: "tenant-1", scopes: ["keys"] } }), keys }),
  );
  try {
    const { id } = await keys.createKey("tenant-1", "To be revoked", ["ask"]);
    const res = await fetch(`${server.baseUrl}/keys/${id}`, { method: "DELETE", headers: { authorization: "Bearer admin-key" } });
    assert.equal(res.status, 200);
    const list = await keys.listKeys("tenant-1");
    assert.ok(list[0]!.revokedAt, "revokedAt must be set after DELETE");
  } finally {
    await server.close();
  }
});

test("DELETE /keys/:id on another tenant's key returns 404, never revokes it", async () => {
  const keys = fakeKeysDeps();
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({
        "tenant-a-key": { tenantId: "tenant-a", scopes: ["keys"] },
      }),
      keys,
    }),
  );
  try {
    const { id } = await keys.createKey("tenant-b", "B's key", ["ask"]);
    const res = await fetch(`${server.baseUrl}/keys/${id}`, { method: "DELETE", headers: { authorization: "Bearer tenant-a-key" } });
    assert.equal(res.status, 404);
    const list = await keys.listKeys("tenant-b");
    assert.equal(list[0]!.revokedAt, null, "cross-tenant DELETE must never revoke another tenant's key");
  } finally {
    await server.close();
  }
});

test("POST /keys with an empty scopes array is rejected, never silently creates an unusable key", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "admin-key": { tenantId: "tenant-1", scopes: ["keys"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin-key" },
      body: JSON.stringify({ label: "x", scopes: [] }),
    });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("GET /keys without the keys scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/keys`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
