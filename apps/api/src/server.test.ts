/**
 * apps/api/src/server.test.ts — T-009 C7. In-process HTTP requests (via `testUtils.ts`'s
 * ephemeral-port helper) against `createServer(deps)` with fakes for every injected dependency.
 * Covers: valid key + `ask` scope -> 200 `AskResult`; missing/invalid key -> 401; valid key
 * missing `ask` scope on `/ask` -> 403; valid key on a stub route -> 501 (never 403, never 200);
 * rate limit trips after N requests -> 429 with `Retry-After`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "./testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeTreeStore, fakeAskDeps } from "./fixtures.js";

test("POST /ask with a valid key + ask scope returns 200 with an AskResult shape", async () => {
  const server = await startTestServer(buildTestDeps());
  try {
    const res = await fetch(`${server.baseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good-ask-key" },
      body: JSON.stringify({ query: "topic one" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.verdict, "correct");
    assert.equal(body.answer, "This is the fake answer.");
    assert.ok(Array.isArray(body.auditLog));
    assert.ok(typeof body.sources === "object" && body.sources !== null);
  } finally {
    await server.close();
  }
});

test("POST /ask with no Authorization header returns 401", async () => {
  const server = await startTestServer(buildTestDeps());
  try {
    const res = await fetch(`${server.baseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "topic one" }),
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  } finally {
    await server.close();
  }
});

test("POST /ask with an invalid/unknown key returns 401", async () => {
  const server = await startTestServer(buildTestDeps());
  try {
    const res = await fetch(`${server.baseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer not-a-real-key" },
      body: JSON.stringify({ query: "topic one" }),
    });
    assert.equal(res.status, 401);
  } finally {
    await server.close();
  }
});

test("POST /ask with a valid key that lacks the ask scope returns 403, not 401", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "no-ask-scope-key": { tenantId: "tenant-1", scopes: ["sources"] } }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer no-ask-scope-key" },
      body: JSON.stringify({ query: "topic one" }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "forbidden");
  } finally {
    await server.close();
  }
});

test("a valid key hitting a stub route gets 501 (authorized but not built), never 403 or 200", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "sources-key": { tenantId: "tenant-1", scopes: ["sources", "webhooks"] } }),
    }),
  );
  try {
    const getRes = await fetch(`${server.baseUrl}/sources`, {
      headers: { authorization: "Bearer sources-key" },
    });
    assert.equal(getRes.status, 501);
    const getBody = (await getRes.json()) as { error: string; message: string };
    assert.equal(getBody.error, "not_implemented");
    assert.match(getBody.message, /GET \/sources is planned, not yet built/);

    const postRes = await fetch(`${server.baseUrl}/webhooks/register`, {
      method: "POST",
      headers: { authorization: "Bearer sources-key" },
    });
    assert.equal(postRes.status, 501);
  } finally {
    await server.close();
  }
});

test("a valid key lacking a stub route's scope still gets 403 there (scope check runs before the 501)", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/sources`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("rate limit trips after N requests with 429 and a Retry-After header", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "rl-key": { tenantId: "tenant-rl", scopes: ["sources"] } }),
      rateLimit: { windowMs: 60_000, max: 2 },
    }),
  );
  try {
    const headers = { authorization: "Bearer rl-key" };
    const first = await fetch(`${server.baseUrl}/sources`, { headers });
    const second = await fetch(`${server.baseUrl}/sources`, { headers });
    const third = await fetch(`${server.baseUrl}/sources`, { headers });

    assert.equal(first.status, 501);
    assert.equal(second.status, 501);
    assert.equal(third.status, 429);
    assert.ok(third.headers.get("retry-after"), "429 response must carry a Retry-After header");
    const body = (await third.json()) as { error: string };
    assert.equal(body.error, "rate_limited");
  } finally {
    await server.close();
  }
});

test("fixtures sanity: fakeTreeStore/fakeAskDeps build injectable deps without touching Mongo/network", async () => {
  const deps = fakeAskDeps();
  assert.equal(typeof deps.complete, "function");
  assert.equal(typeof deps.treeSearchFn, "function");
  assert.ok(await fakeTreeStore().load("tenant-1"));
});
