/**
 * apps/api/src/routes/citations.test.ts — in-process HTTP requests (matching brain.test.ts's
 * `startTestServer` pattern) against `routes/citations.ts` with `fakeCitationsDeps`. Covers:
 * GET /citations/:claimId -> real claim+evidence shape; unknown id -> 404; missing scope -> 403.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore } from "../fixtures.js";

test("GET /citations/:claimId with the citations scope returns claim + resolved evidence", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "citations-key": { tenantId: "tenant-1", scopes: ["citations"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/citations/claim-1`, { headers: { authorization: "Bearer citations-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { claim: { text: string }; evidence: { turnId: string; turn: { text: string } | null; session: { title: string } | null }[] };
    assert.equal(body.claim.text, "A fixture claim.");
    assert.equal(body.evidence.length, 1);
    assert.equal(body.evidence[0]?.turnId, "t1");
    assert.equal(body.evidence[0]?.turn?.text, "Hello.");
    assert.equal(body.evidence[0]?.session?.title, "Fixture Session");
  } finally {
    await server.close();
  }
});

test("GET /citations/:claimId with an unknown id returns 404, not a stub 501", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "citations-key": { tenantId: "tenant-1", scopes: ["citations"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/citations/does-not-exist`, { headers: { authorization: "Bearer citations-key" } });
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("GET /citations/:claimId without the citations scope returns 403, never a silent 200", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/citations/claim-1`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
