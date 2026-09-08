/**
 * apps/api/src/routes/watched-sources.test.ts — A13, the entrypoint T-027 never built.
 *
 * T-027 shipped the schema, the tenant-scoped accessors (`createWatchedSource`, `recordFetch`,
 * `listActive`) and the pure due-check, all checker-PASSed — and then nothing called them. Its own
 * module comment says "a future scheduler runs `listActive`". The collection has been empty ever
 * since, which is exactly why catalogue A13 scores MISSING: the probe is `collection
 * watched_sources (empty)`.
 *
 * So the gap was never the logic. It was that no user action could reach it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeWatchedSourceDeps } from "../fixtures.js";

const key = (scopes: string[]) => fakeKeyStore({ "ws-key": { tenantId: "tenant-1", scopes } });

test("POST /watched-sources registers a source and returns it", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    const res = await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.ac.uk/fees", reputationTier: "official", checkIntervalHours: 24 }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { source: { url: string; active: boolean; _id: string } };
    assert.equal(body.source.url, "https://example.ac.uk/fees");
    assert.equal(body.source.active, true, "a newly registered source is active by default");
    assert.ok(body.source._id.length > 0);
  } finally {
    await server.close();
  }
});

test("GET /watched-sources lists what was registered", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.ac.uk/fees", reputationTier: "official", checkIntervalHours: 24 }),
    });
    const res = await fetch(`${server.baseUrl}/watched-sources`, { headers: { authorization: "Bearer ws-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sources: { url: string }[] };
    assert.equal(body.sources.length, 1);
    assert.equal(body.sources[0]?.url, "https://example.ac.uk/fees");
  } finally {
    await server.close();
  }
});

test("a url that is not http(s) is rejected, never stored", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "not-a-url", ""]) {
      const res = await fetch(`${server.baseUrl}/watched-sources`, {
        method: "POST",
        headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
        body: JSON.stringify({ url, reputationTier: "official", checkIntervalHours: 24 }),
      });
      assert.equal(res.status, 400, `${JSON.stringify(url)} must be refused`);
    }
    const list = await fetch(`${server.baseUrl}/watched-sources`, { headers: { authorization: "Bearer ws-key" } });
    const body = (await list.json()) as { sources: unknown[] };
    assert.equal(body.sources.length, 0, "nothing was stored");
  } finally {
    await server.close();
  }
});

test("an unknown reputationTier is rejected -- the schema enumerates exactly three", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    const res = await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", reputationTier: "gold", checkIntervalHours: 24 }),
    });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("a non-positive checkIntervalHours is rejected -- it would make the source due forever", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    for (const checkIntervalHours of [0, -1, "soon"]) {
      const res = await fetch(`${server.baseUrl}/watched-sources`, {
        method: "POST",
        headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", reputationTier: "blog", checkIntervalHours }),
      });
      assert.equal(res.status, 400, `${JSON.stringify(checkIntervalHours)} must be refused`);
    }
  } finally {
    await server.close();
  }
});

test("both routes 403 without the sources scope, never a silent 200", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["ask"]) }));
  try {
    const post = await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", reputationTier: "blog", checkIntervalHours: 24 }),
    });
    assert.equal(post.status, 403);
    const get = await fetch(`${server.baseUrl}/watched-sources`, { headers: { authorization: "Bearer ws-key" } });
    assert.equal(get.status, 403);
  } finally {
    await server.close();
  }
});

test("one tenant never sees another tenant's watched sources", async () => {
  const deps = fakeWatchedSourceDeps();
  const server = await startTestServer(buildTestDeps({
    watchedSources: deps,
    keyStore: fakeKeyStore({
      "a-key": { tenantId: "tenant-a", scopes: ["sources"] },
      "b-key": { tenantId: "tenant-b", scopes: ["sources"] },
    }),
  }));
  try {
    await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer a-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://a.example/only", reputationTier: "official", checkIntervalHours: 12 }),
    });
    const res = await fetch(`${server.baseUrl}/watched-sources`, { headers: { authorization: "Bearer b-key" } });
    const body = (await res.json()) as { sources: unknown[] };
    assert.deepEqual(body.sources, [], "tenant-b must not see tenant-a's source");
  } finally {
    await server.close();
  }
});

/**
 * ISS-C-UNRUN-WRITERS-001. The route validated a PARSED url and stored the RAW string, so the
 * value approved and the value stored could differ under a different parser. That gap matters
 * precisely because this row is a future outbound fetch target: whatever the fetcher re-parses
 * must be the thing this check actually approved, not a string that merely normalises to it here.
 */
test("the STORED url is the normalised one, not the raw input", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: key(["sources"]) }));
  try {
    const res = await fetch(`${server.baseUrl}/watched-sources`, {
      method: "POST",
      headers: { authorization: "Bearer ws-key", "content-type": "application/json" },
      body: JSON.stringify({ url: "HTTPS://Example.AC.uk/fees?b=2&a=1", reputationTier: "official", checkIntervalHours: 6 }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { source: { url: string } };
    assert.equal(body.source.url, new URL("HTTPS://Example.AC.uk/fees?b=2&a=1").href,
      "what is stored must be exactly what was parsed and approved");

    const list = await fetch(`${server.baseUrl}/watched-sources`, { headers: { authorization: "Bearer ws-key" } });
    const listed = (await list.json()) as { sources: { url: string }[] };
    assert.equal(listed.sources[0]?.url, body.source.url, "and the same value must come back out");
  } finally {
    await server.close();
  }
});
