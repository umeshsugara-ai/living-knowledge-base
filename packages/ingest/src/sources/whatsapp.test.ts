/**
 * packages/ingest/src/sources/whatsapp.test.ts — T-007 first slice. `detect` matches the
 * whatsapp hint only; `fetch` sets `kind: "whatsapp-batch"` and stashes `ownerUserId` for
 * `toTurns()`; `toTurns()` maps real messages to turns with correct `speakerRef` and
 * seconds-elapsed `tStart`/`tEnd`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createWhatsAppSource, type WhatsAppMessage } from "./whatsapp.js";
import { baseConsent, fakeHasher, TENANT, FIXED_NOW } from "../testUtils.js";

function fakeFetcher(byGroup: Record<string, WhatsAppMessage[]>) {
  return async (groupJid: string, _ownerUserId: string): Promise<WhatsAppMessage[]> => {
    const messages = byGroup[groupJid];
    if (!messages) throw new Error(`fakeFetcher: no fixture for ${groupJid}`);
    return messages;
  };
}

test("detect matches only the whatsapp hint, never a bare string", () => {
  const adapter = createWhatsAppSource({ hasher: fakeHasher, fetcher: fakeFetcher({}) });
  assert.equal(adapter.detect({ kind: "whatsapp", groupJid: "g1@g.us", ownerUserId: "u1" }), true);
  assert.equal(adapter.detect("g1@g.us"), false);
  assert.equal(adapter.detect({ kind: "document", path: "notes.md" }), false);
});

test("fetch pulls real messages via the injected fetcher, sets kind/captureMode/ownerUserId", async () => {
  const messages: WhatsAppMessage[] = [
    { personId: "p1", displayName: "Harshita", text: "hello", ts: "2026-08-25T09:43:21.000Z" },
    { personId: "p2", displayName: "Karunn", text: "hi there", ts: "2026-08-25T09:43:45.000Z" },
  ];
  const adapter = createWhatsAppSource({
    hasher: fakeHasher,
    fetcher: fakeFetcher({ "g1@g.us": messages }),
    now: () => FIXED_NOW,
  });

  const { source, media } = await adapter.fetch(
    { kind: "whatsapp", groupJid: "g1@g.us", ownerUserId: "u1", tenantId: TENANT },
    baseConsent({ captureMode: "provided" }),
  );

  assert.equal(source.kind, "whatsapp-batch");
  assert.equal(source.captureMode, "provided");
  assert.equal(source.path, "g1@g.us");
  assert.equal((source as { ownerUserId?: string }).ownerUserId, "u1");
  assert.equal(source.createdAt, FIXED_NOW);
  assert.deepEqual(media, []);
});

test("fetch throws on an unrecognized input, never silently no-ops", async () => {
  const adapter = createWhatsAppSource({ hasher: fakeHasher, fetcher: fakeFetcher({}) });
  await assert.rejects(() => adapter.fetch("not a whatsapp hint", baseConsent()), /unrecognized input/);
});

test("toTurns maps real messages to turns: speakerRef = real personId, tStart/tEnd = seconds elapsed since the first message", async () => {
  const messages: WhatsAppMessage[] = [
    { personId: "p1", displayName: "Harshita", text: "first", ts: "2026-08-25T09:43:00.000Z" },
    { personId: "p2", displayName: "Karunn", text: "second", ts: "2026-08-25T09:43:10.000Z" },
    { personId: "p1", displayName: "Harshita", text: "third", ts: "2026-08-25T09:44:00.000Z" },
  ];
  const adapter = createWhatsAppSource({ hasher: fakeHasher, fetcher: fakeFetcher({ "g1@g.us": messages }) });
  const { source } = await adapter.fetch(
    { kind: "whatsapp", groupJid: "g1@g.us", ownerUserId: "u1", tenantId: TENANT },
    baseConsent(),
  );

  const turns = await adapter.toTurns(source);
  assert.equal(turns.length, 3);
  assert.equal(turns[0]!.speakerRef, "p1");
  assert.equal(turns[0]!.text, "first");
  assert.equal(turns[0]!.tStart, 0);
  assert.equal(turns[0]!.tEnd, 0);
  assert.equal(turns[1]!.speakerRef, "p2");
  assert.equal(turns[1]!.tStart, 10);
  assert.equal(turns[2]!.speakerRef, "p1");
  assert.equal(turns[2]!.tStart, 60);
});

test("toTurns on an empty batch returns an empty array, not an error", async () => {
  const adapter = createWhatsAppSource({ hasher: fakeHasher, fetcher: fakeFetcher({ "g1@g.us": [] }) });
  const { source } = await adapter.fetch(
    { kind: "whatsapp", groupJid: "g1@g.us", ownerUserId: "u1", tenantId: TENANT },
    baseConsent(),
  );
  const turns = await adapter.toTurns(source);
  assert.deepEqual(turns, []);
});

test("toTurns throws when source is missing ownerUserId, never silently fetches with an empty id", async () => {
  const adapter = createWhatsAppSource({ hasher: fakeHasher, fetcher: fakeFetcher({}) });
  await assert.rejects(
    () => adapter.toTurns({
      _id: "h1", tenantId: TENANT, kind: "whatsapp-batch", captureMode: "provided",
      path: "g1@g.us", hash: "h1", consent: { given: true, recordedBy: "org:toc" }, createdAt: FIXED_NOW,
    }),
    /requires source.path.*ownerUserId/,
  );
});
