/**
 * packages/ingest/src/sources/recording.test.ts — T-020 C6 (recording half). `detect` matches
 * audio/video extensions and the `{kind: "recording"}` hint; `fetch` computes a hash via the
 * injected hasher and sets `captureMode` from the `ConsentContext`; `toTurns` delegates to the
 * injected `transcribe` (T-019 STT seam), never a concrete provider.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { TranscribeOpts, Turn } from "@lkb/ai";
import { createRecordingSource } from "./recording.js";
import { baseConsent, fakeBytesReader, fakeHasher, TENANT, FIXED_NOW } from "../testUtils.js";

const AUDIO_BYTES = new Uint8Array([1, 2, 3, 4]);

test("detect matches audio/video extensions and the recording hint", () => {
  const adapter = createRecordingSource({
    hasher: fakeHasher,
    reader: fakeBytesReader({}),
    transcribe: async () => [],
  });
  assert.equal(adapter.detect("call.mp3"), true);
  assert.equal(adapter.detect("call.webm"), true);
  assert.equal(adapter.detect({ kind: "recording", path: "call.raw" }), true);
  assert.equal(adapter.detect("notes.txt"), false);
  assert.equal(adapter.detect(42), false);
});

test("fetch computes a hash via the injected hasher and sets captureMode from context", async () => {
  const adapter = createRecordingSource({
    hasher: fakeHasher,
    reader: fakeBytesReader({ "call.mp3": AUDIO_BYTES }),
    transcribe: async () => [],
    now: () => FIXED_NOW,
  });

  const { source, media } = await adapter.fetch(
    { kind: "recording", path: "call.mp3", tenantId: TENANT },
    baseConsent({ captureMode: "public", recordedBy: "org:toc" }),
  );

  assert.equal(source.kind, "recording");
  assert.equal(source.captureMode, "public");
  assert.equal(source.hash, fakeHasher(AUDIO_BYTES));
  assert.equal(source.path, "call.mp3");
  assert.equal(source.tenantId, TENANT);
  assert.equal(source.createdAt, FIXED_NOW);
  assert.equal(media.length, 1);
  assert.equal(media[0]!.sourceRef, source._id);
});

test("fetch throws when tenantId is missing (never silently defaults tenancy)", async () => {
  const adapter = createRecordingSource({
    hasher: fakeHasher,
    reader: fakeBytesReader({ "call.mp3": AUDIO_BYTES }),
    transcribe: async () => [],
  });
  await assert.rejects(() => adapter.fetch("call.mp3", baseConsent()));
});

test("toTurns delegates to the injected transcribe function", async () => {
  const TURNS = [{ speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "hi" }];
  let calledWith: unknown;
  const adapter = createRecordingSource({
    hasher: fakeHasher,
    reader: fakeBytesReader({ "call.mp3": AUDIO_BYTES }),
    transcribe: async (audio: Uint8Array, opts: TranscribeOpts): Promise<Turn[]> => {
      calledWith = { audio, opts };
      return TURNS;
    },
  });

  const { source } = await adapter.fetch(
    { kind: "recording", path: "call.mp3", tenantId: TENANT },
    baseConsent(),
  );
  const turns = await adapter.toTurns(source);

  assert.deepEqual(turns, TURNS);
  assert.deepEqual((calledWith as { audio: Uint8Array }).audio, AUDIO_BYTES);
});
