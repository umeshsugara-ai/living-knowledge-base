/**
 * apps/api/src/routes/compete.test.ts — T-012 C5. In-process HTTP requests (matching
 * server.test.ts's `startTestServer` pattern) against the compete routes with fakes for every
 * injected dependency. Covers: `/compete/start` with a fake `askV2`/store produces an eval_runs
 * row with `credibility: 'internal'`; `/compete/:id/score` updates the existing row (not a new
 * one); missing `compete` scope -> 403 (T-009's auth middleware, no second auth system);
 * a nonexistent `:id` on `/score` -> 404; `GET /compete` serves the plain HTML form.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeEvalRunStore } from "../fixtures.js";

const COMPETE_KEY = { "compete-key": { tenantId: "tenant-1", scopes: ["ask", "compete"] } };

test("POST /compete/start produces an eval_runs row with credibility 'internal'", async () => {
  const evalRuns = fakeEvalRunStore();
  const server = await startTestServer(buildTestDeps({ keyStore: fakeKeyStore(COMPETE_KEY), evalRuns }));
  try {
    const res = await fetch(`${server.baseUrl}/compete/start`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer compete-key" },
      body: JSON.stringify({ question: "topic one", counsellor: { name: "Asha", org: "Acme" } }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { evalRunId: string; aiAnswer: { text: string } };
    assert.ok(body.evalRunId);
    assert.equal(body.aiAnswer.text, "This is the fake answer.");

    const row = evalRuns._rows.get(body.evalRunId);
    assert.ok(row, "eval_runs row must exist");
    assert.equal(row!.credibility, "internal");
    assert.equal(row!.tenantId, "tenant-1");
    assert.equal(row!.counsellor.name, "Asha");
    assert.equal(row!.counsellor.org, "Acme");
    assert.equal(row!.question, "topic one");
  } finally {
    await server.close();
  }
});

test("POST /compete/start with a missing question returns 400", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: fakeKeyStore(COMPETE_KEY) }));
  try {
    const res = await fetch(`${server.baseUrl}/compete/start`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer compete-key" },
      body: JSON.stringify({ counsellor: { name: "Asha" } }),
    });
    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});

test("POST /compete/:id/score updates the existing row, not a new one", async () => {
  const evalRuns = fakeEvalRunStore();
  const server = await startTestServer(buildTestDeps({ keyStore: fakeKeyStore(COMPETE_KEY), evalRuns }));
  try {
    const startRes = await fetch(`${server.baseUrl}/compete/start`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer compete-key" },
      body: JSON.stringify({ question: "topic one", counsellor: { name: "Asha" } }),
    });
    const { evalRunId } = (await startRes.json()) as { evalRunId: string };

    const sizeBefore = evalRuns._rows.size;
    const scoreRes = await fetch(`${server.baseUrl}/compete/${evalRunId}/score`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer compete-key" },
      body: JSON.stringify({
        counsellorAnswer: { text: "counsellor's own answer" },
        score: { ai: 4, counsellor: 3 },
        notes: "AI cited a source",
      }),
    });
    assert.equal(scoreRes.status, 200);
    assert.equal(evalRuns._rows.size, sizeBefore, "score must update the existing row, not insert a new one");

    const row = evalRuns._rows.get(evalRunId)!;
    assert.equal(row.counsellorAnswer!.text, "counsellor's own answer");
    assert.equal(row.score!.ai, 4);
    assert.equal(row.score!.counsellor, 3);
    assert.equal(row.score!.notes, "AI cited a source");
  } finally {
    await server.close();
  }
});

test("POST /compete/start without the compete scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/compete/start`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ask-only-key" },
      body: JSON.stringify({ question: "topic one", counsellor: { name: "Asha" } }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "forbidden");
  } finally {
    await server.close();
  }
});

test("POST /compete/:id/score with a nonexistent id returns 404", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: fakeKeyStore(COMPETE_KEY) }));
  try {
    const res = await fetch(`${server.baseUrl}/compete/does-not-exist/score`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer compete-key" },
      body: JSON.stringify({ counsellorAnswer: { text: "x" }, score: { ai: 1, counsellor: 1 } }),
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "not_found");
  } finally {
    await server.close();
  }
});

test("GET /compete serves the plain HTML form", async () => {
  const server = await startTestServer(buildTestDeps({ keyStore: fakeKeyStore(COMPETE_KEY) }));
  try {
    const res = await fetch(`${server.baseUrl}/compete`, { headers: { authorization: "Bearer compete-key" } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /html/);
    const text = await res.text();
    assert.match(text, /\/compete\/start/);
  } finally {
    await server.close();
  }
});
