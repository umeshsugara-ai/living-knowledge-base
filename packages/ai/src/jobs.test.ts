/**
 * packages/ai/src/jobs.test.ts — T-019 C5. `recordJob` writes via the injected `write`, no
 * live Mongo needed (mirrors `packages/db`'s accessor pattern).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { recordJob, type JobEntry } from "./jobs.js";

test("recordJob calls the injected write with the entry, filling in createdAt if absent", async () => {
  const writes: (JobEntry & { createdAt: string })[] = [];
  await recordJob(
    { tenantId: "t1", kind: "transcribe", status: "done", provider: "gemini" },
    async (entry) => {
      writes.push(entry);
    },
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0]!.tenantId, "t1");
  assert.equal(writes[0]!.kind, "transcribe");
  assert.equal(writes[0]!.status, "done");
  assert.ok(typeof writes[0]!.createdAt === "string" && writes[0]!.createdAt.length > 0);
});

test("recordJob preserves a caller-supplied createdAt", async () => {
  const writes: (JobEntry & { createdAt: string })[] = [];
  await recordJob(
    { tenantId: "t1", kind: "k", status: "failed", error: "boom", createdAt: "2026-01-01T00:00:00.000Z" },
    async (entry) => {
      writes.push(entry);
    },
  );
  assert.equal(writes[0]!.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(writes[0]!.error, "boom");
});
