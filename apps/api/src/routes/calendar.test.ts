/**
 * apps/api/src/routes/calendar.test.ts — same DI/HTTP pattern as graph.test.ts/brain.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeCalendarReadDeps } from "../fixtures.js";

test("GET /calendar/upcoming with the calendar scope returns real meetings", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "cal-key": { tenantId: "tenant-1", scopes: ["calendar"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/calendar/upcoming`, { headers: { authorization: "Bearer cal-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { meetings: { id: string; meetingUrl?: string }[] };
    assert.equal(body.meetings.length, 1);
    assert.equal(body.meetings[0]!.id, "evt-1");
  } finally {
    await server.close();
  }
});

test("GET /calendar/upcoming without the calendar scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/calendar/upcoming`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("GET /calendar/upcoming when the source returns nothing yields a real, honest empty list", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "cal-key": { tenantId: "tenant-1", scopes: ["calendar"] } }),
      calendar: fakeCalendarReadDeps({ listUpcoming: async () => [] }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/calendar/upcoming`, { headers: { authorization: "Bearer cal-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { meetings: unknown[] };
    assert.deepEqual(body.meetings, []);
  } finally {
    await server.close();
  }
});
