/**
 * apps/api/src/routes/search.test.ts — in-process HTTP requests against `routes/search.ts` with
 * `fakeSearchDeps`. Covers: real hit shape on a match; empty result on no match; missing `q` ->
 * 400 not a stub 501; missing scope -> 403.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore } from "../fixtures.js";

test("GET /search?q=... with the search scope returns real hits", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "search-key": { tenantId: "tenant-1", scopes: ["search"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/search?q=hello`, { headers: { authorization: "Bearer search-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { query: string; hits: { turnId: string; turn: { text: string } | null; session: { title: string } | null }[] };
    assert.equal(body.query, "hello");
    assert.equal(body.hits.length, 1);
    assert.equal(body.hits[0]?.turnId, "t1");
    assert.equal(body.hits[0]?.turn?.text, "Hello.");
    assert.equal(body.hits[0]?.session?.title, "Fixture Session");
  } finally {
    await server.close();
  }
});

test("GET /search?q=... with no match returns an empty hits array, not an error", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "search-key": { tenantId: "tenant-1", scopes: ["search"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/search?q=nonexistentterm`, { headers: { authorization: "Bearer search-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { hits: unknown[] };
    assert.deepEqual(body.hits, []);
  } finally {
    await server.close();
  }
});

test("GET /search with no q param returns 400, not a stub 501", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "search-key": { tenantId: "tenant-1", scopes: ["search"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/search`, { headers: { authorization: "Bearer search-key" } });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("GET /search without the search scope returns 403, never a silent 200", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/search?q=hello`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
