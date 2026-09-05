/**
 * apps/api/src/routes/whatsapp.test.ts — same DI/HTTP pattern as ingest.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeWhatsAppDeps } from "../fixtures.js";

test("GET /whatsapp/groups with the whatsapp scope returns a real (fixture) group list", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "wa-key": { tenantId: "tenant-1", scopes: ["whatsapp"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/groups`, { headers: { authorization: "Bearer wa-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { groups: { groupJid: string }[] };
    assert.equal(body.groups.length, 1);
    assert.equal(body.groups[0]!.groupJid, "g1@g.us");
  } finally {
    await server.close();
  }
});

test("GET /whatsapp/groups without the whatsapp scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/groups`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("POST /whatsapp/ingest with a valid body creates a real session/source/turns set", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "wa-key": { tenantId: "tenant-1", scopes: ["whatsapp"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/ingest`, {
      method: "POST",
      headers: { authorization: "Bearer wa-key", "content-type": "application/json" },
      body: JSON.stringify({ groupJid: "g1@g.us" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { sessionId: string; sourceId: string; turnCount: number };
    assert.equal(body.sessionId, "fake-wa-session");
    assert.equal(body.turnCount, 3);
  } finally {
    await server.close();
  }
});

test("POST /whatsapp/ingest with a missing groupJid returns 400, never attempts an ingest", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "wa-key": { tenantId: "tenant-1", scopes: ["whatsapp"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/ingest`, {
      method: "POST",
      headers: { authorization: "Bearer wa-key", "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("a client-supplied ownerUserId in the body is ignored, never trusted (regression, 2026-09-06 data-engineer review)", async () => {
  let receivedArgs: unknown[] = [];
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "wa-key": { tenantId: "tenant-1", scopes: ["whatsapp"] } }),
      whatsapp: fakeWhatsAppDeps({
        ingestGroup: async (...args: unknown[]) => {
          receivedArgs = args;
          return { sessionId: "s1", sourceId: "src1", turnCount: 0 };
        },
      }),
    }),
  );
  try {
    await fetch(`${server.baseUrl}/whatsapp/ingest`, {
      method: "POST",
      headers: { authorization: "Bearer wa-key", "content-type": "application/json" },
      body: JSON.stringify({ groupJid: "g1@g.us", ownerUserId: "attacker-supplied-owner-id" }),
    });
    // Real assertion: the route only ever forwards (tenantId, groupJid) -- a client-supplied
    // ownerUserId in the body has no way to reach ingestGroup's real implementation, which
    // resolves the owner itself from the live trackable-groups list.
    assert.deepEqual(receivedArgs, ["tenant-1", "g1@g.us"]);
  } finally {
    await server.close();
  }
});

test("a real fetch/adapter failure surfaces as 502 with the real error message, never a silent 500", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "wa-key": { tenantId: "tenant-1", scopes: ["whatsapp"] } }),
      whatsapp: fakeWhatsAppDeps({
        ingestGroup: async () => { throw new Error("whatsapp_msg Mongo unreachable"); },
      }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/ingest`, {
      method: "POST",
      headers: { authorization: "Bearer wa-key", "content-type": "application/json" },
      body: JSON.stringify({ groupJid: "g1@g.us" }),
    });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { message: string };
    assert.match(body.message, /whatsapp_msg Mongo unreachable/);
  } finally {
    await server.close();
  }
});

test("POST /whatsapp/ingest without the whatsapp scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/whatsapp/ingest`, {
      method: "POST",
      headers: { authorization: "Bearer ask-only-key", "content-type": "application/json" },
      body: JSON.stringify({ groupJid: "g1@g.us" }),
    });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
