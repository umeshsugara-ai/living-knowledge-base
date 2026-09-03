/**
 * packages/ai/src/stt.test.ts — T-019 C6. whisper.ts and gemini.ts STT adapters, both behind
 * an injectable transport (no real worker/network call).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createWhisperAdapter } from "./stt/whisper.js";
import { createGeminiSttAdapter } from "./stt/gemini.js";
import { fakeTransport } from "./testUtils.js";

const AUDIO = new Uint8Array([1, 2, 3]);
const TURNS = [{ speakerRef: "spk:0", tStart: 0, tEnd: 1.5, text: "hello", confidence: 0.95 }];

test("whisper adapter transcribes via its injected transport", async () => {
  const transport = fakeTransport({ status: 200, body: { turns: TURNS } });
  const adapter = createWhisperAdapter(transport);
  const turns = await adapter.transcribe(AUDIO, {});
  assert.deepEqual(turns, TURNS);
  assert.equal(adapter.name, "whisper");
  assert.equal(transport.calls[0]!.kind, "http");
});

test("gemini STT adapter transcribes via its injected transport", async () => {
  const transport = fakeTransport({ status: 200, body: { turns: TURNS } });
  const adapter = createGeminiSttAdapter(transport, { apiKey: "k" });
  const turns = await adapter.transcribe(AUDIO, { language: "en" });
  assert.deepEqual(turns, TURNS);
  assert.equal(adapter.name, "gemini");
});

test("both STT adapters throw (never silently return []) on a transport error status", async () => {
  const whisperFail = createWhisperAdapter(fakeTransport({ status: 500, body: {} }));
  await assert.rejects(() => whisperFail.transcribe(AUDIO, {}));

  const geminiFail = createGeminiSttAdapter(fakeTransport({ status: 500, body: {} }), { apiKey: "k" });
  await assert.rejects(() => geminiFail.transcribe(AUDIO, {}));
});
