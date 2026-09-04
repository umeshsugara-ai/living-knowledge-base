/**
 * apps/api/src/routes/meeting-candidates.test.ts — same DI/HTTP pattern as calendar.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { startTestServer } from "../testUtils.js";
import { buildTestDeps, fakeKeyStore, fakeMeetingCandidatesDeps } from "../fixtures.js";

test("POST /gmail/scan with the gmail scope returns a real scan summary", async () => {
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "gmail-key": { tenantId: "tenant-1", scopes: ["gmail"] } }),
      meetingCandidates: fakeMeetingCandidatesDeps({ scanGmail: async () => ({ created: 2, autoApproved: 1 }) }),
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/gmail/scan`, { method: "POST", headers: { authorization: "Bearer gmail-key" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { created: number; autoApproved: number };
    assert.equal(body.created, 2);
    assert.equal(body.autoApproved, 1);
  } finally {
    await server.close();
  }
});

test("GET /meeting-candidates without the gmail scope returns 403", async () => {
  const server = await startTestServer(
    buildTestDeps({ keyStore: fakeKeyStore({ "ask-only-key": { tenantId: "tenant-1", scopes: ["ask"] } }) }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/meeting-candidates`, { headers: { authorization: "Bearer ask-only-key" } });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("approving a pending candidate flips its status and records a sender approval", async () => {
  const meetingCandidates = fakeMeetingCandidatesDeps();
  meetingCandidates._rows.set("mc1", {
    _id: "mc1", messageId: "gm-1", subject: "Sync", senderEmail: "a@vidysea.com",
    senderDomain: "vidysea.com", status: "pending", detectedAt: "2026-09-04T00:00:00Z",
  });
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "gmail-key": { tenantId: "tenant-1", scopes: ["gmail"] } }),
      meetingCandidates,
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/meeting-candidates/mc1/approve`, { method: "POST", headers: { authorization: "Bearer gmail-key" } });
    assert.equal(res.status, 200);
    assert.equal(meetingCandidates._rows.get("mc1")!.status, "approved");
    assert.equal(meetingCandidates._trust.get("vidysea.com"), 1);
  } finally {
    await server.close();
  }
});

test("approving an already-decided candidate returns 404, never double-counts trust", async () => {
  const meetingCandidates = fakeMeetingCandidatesDeps();
  meetingCandidates._rows.set("mc1", {
    _id: "mc1", messageId: "gm-1", subject: "Sync", senderEmail: "a@vidysea.com",
    senderDomain: "vidysea.com", status: "approved", detectedAt: "2026-09-04T00:00:00Z",
  });
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "gmail-key": { tenantId: "tenant-1", scopes: ["gmail"] } }),
      meetingCandidates,
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/meeting-candidates/mc1/approve`, { method: "POST", headers: { authorization: "Bearer gmail-key" } });
    assert.equal(res.status, 404);
    assert.equal(meetingCandidates._trust.get("vidysea.com"), undefined);
  } finally {
    await server.close();
  }
});

test("rejecting a pending candidate flips its status", async () => {
  const meetingCandidates = fakeMeetingCandidatesDeps();
  meetingCandidates._rows.set("mc1", {
    _id: "mc1", messageId: "gm-1", subject: "Sync", senderEmail: "a@vidysea.com",
    senderDomain: "vidysea.com", status: "pending", detectedAt: "2026-09-04T00:00:00Z",
  });
  const server = await startTestServer(
    buildTestDeps({
      keyStore: fakeKeyStore({ "gmail-key": { tenantId: "tenant-1", scopes: ["gmail"] } }),
      meetingCandidates,
    }),
  );
  try {
    const res = await fetch(`${server.baseUrl}/meeting-candidates/mc1/reject`, { method: "POST", headers: { authorization: "Bearer gmail-key" } });
    assert.equal(res.status, 200);
    assert.equal(meetingCandidates._rows.get("mc1")!.status, "rejected");
  } finally {
    await server.close();
  }
});
