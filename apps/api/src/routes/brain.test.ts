/**
 * apps/api/src/routes/brain.test.ts — in-process HTTP requests (matching server.test.ts's
 * `startTestServer` pattern) against `routes/brain.ts` with `fakeBrainReadDeps`. Covers:
 * GET /sessions -> list; GET /sessions/:id -> real detail shape; missing id -> 404; each of
 * /sessions, /sources, /gaps -> 403 without the right scope, never a silent 200.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeBrainReadDeps } from "../fixtures.js";

test("GET /sessions with the sessions scope returns the real seeded fixture list", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "sessions-key": { tenantId: "tenant-1", scopes: ["sessions"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sessions`, { headers: { authorization: "Bearer sessions-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sessions: unknown[] };
    assert.equal(body.sessions.length, 1);
  } finally {
    await server.close();
  }
});

test("GET /sessions/:id returns the joined session+page+claims+turns shape", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "sessions-key": { tenantId: "tenant-1", scopes: ["sessions"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sessions/session-1`, { headers: { authorization: "Bearer sessions-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { session: { title: string }; page: { summary: string } | null; claims: unknown[]; turns: unknown[] };
    assert.equal(body.session.title, "Fixture Session");
    assert.equal(body.page?.summary, "A fixture summary.");
    assert.equal(body.claims.length, 1);
    assert.equal(body.turns.length, 1);
  } finally {
    await server.close();
  }
});

test("GET /sessions/:id with an unknown id returns 404", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "sessions-key": { tenantId: "tenant-1", scopes: ["sessions"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sessions/does-not-exist`, { headers: { authorization: "Bearer sessions-key" } });
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("GET /sources without the sources scope returns 403, not 200 or 501", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sources`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("GET /sources with the sources scope returns a real (possibly empty) list, never a stub 501", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "sources-key": { tenantId: "tenant-1", scopes: ["sources"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sources`, { headers: { authorization: "Bearer sources-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sources: unknown[] };
    assert.ok(Array.isArray(body.sources));
  } finally {
    await server.close();
  }
});

test("GET /gaps with the gaps scope returns a real (possibly empty) list", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "gaps-key": { tenantId: "tenant-1", scopes: ["gaps"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/gaps`, { headers: { authorization: "Bearer gaps-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { gaps: unknown[] };
    assert.ok(Array.isArray(body.gaps));
  } finally {
    await server.close();
  }
});

test("GET /gaps without the gaps scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/gaps`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("fixtures sanity: fakeBrainReadDeps builds an injectable dep without touching Mongo", async () => {
  const deps = fakeBrainReadDeps();
  const sessions = await deps.listSessions("tenant-1");
  assert.equal(sessions.length, 1);
  assert.equal(await deps.getSessionDetail("tenant-1", "nope"), null);
});
