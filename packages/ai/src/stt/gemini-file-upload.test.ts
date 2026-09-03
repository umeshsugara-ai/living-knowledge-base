/**
 * packages/ai/src/stt/gemini-file-upload.test.ts — T-003 C4. `uploadFile`, `pollFileState`,
 * `transcribeUploadedAudio`, `parseDiarizedTranscript` against a fake `UploadTransport` — no
 * real network call anywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  uploadFile, pollFileState, transcribeUploadedAudio, parseDiarizedTranscript,
  type UploadTransport, type UploadTransportRequest,
} from "./gemini-file-upload.js";

function fakeTransport(handlers: Record<string, (req: UploadTransportRequest) => { status: number; headers?: Record<string, string>; body?: unknown }>): UploadTransport {
  return async (req) => {
    const key = `${req.method} ${req.url.split("?")[0]}`;
    const handler = handlers[key] ?? handlers[req.method];
    if (!handler) throw new Error(`fakeTransport: no handler for ${key}`);
    const result = handler(req);
    return { status: result.status, headers: result.headers ?? {}, body: result.body };
  };
}

const API_KEY = "fake-key";

test("uploadFile posts a resumable-upload start, then PUTs bytes to the returned upload URL", async () => {
  let capturedFinalizeUrl = "";
  let capturedBytes: unknown;
  const transport = fakeTransport({
    "POST https://generativelanguage.googleapis.com/upload/v1beta/files": () => ({
      status: 200, headers: { "x-goog-upload-url": "https://upload.example.com/session/abc" },
    }),
    "PUT https://upload.example.com/session/abc": (req) => {
      capturedFinalizeUrl = req.url;
      capturedBytes = req.body;
      return { status: 200, body: { file: { uri: "files/abc123", name: "files/abc123" } } };
    },
  });

  const bytes = new Uint8Array([1, 2, 3]);
  const result = await uploadFile(bytes, "audio/mp4", transport, API_KEY, "test-audio");

  assert.equal(result.fileUri, "files/abc123");
  assert.equal(result.name, "files/abc123");
  assert.equal(capturedFinalizeUrl, "https://upload.example.com/session/abc");
  assert.equal(capturedBytes, bytes);
});

test("uploadFile throws when the start response carries no upload URL header", async () => {
  const transport = fakeTransport({
    "POST https://generativelanguage.googleapis.com/upload/v1beta/files": () => ({ status: 200, headers: {} }),
  });
  await assert.rejects(
    () => uploadFile(new Uint8Array([1]), "audio/mp4", transport, API_KEY),
    /no x-goog-upload-url/,
  );
});

test("uploadFile throws on a non-2xx status at either step", async () => {
  const failingStart = fakeTransport({
    "POST https://generativelanguage.googleapis.com/upload/v1beta/files": () => ({ status: 403, body: { error: "denied" } }),
  });
  await assert.rejects(() => uploadFile(new Uint8Array([1]), "audio/mp4", failingStart, API_KEY), /upload-start failed with status 403/);
});

test("pollFileState maps the response state field to ACTIVE/PROCESSING/FAILED", async () => {
  const active = fakeTransport({ GET: () => ({ status: 200, body: { state: "ACTIVE" } }) });
  assert.equal(await pollFileState("files/abc", active, API_KEY), "ACTIVE");

  const processing = fakeTransport({ GET: () => ({ status: 200, body: { state: "PROCESSING" } }) });
  assert.equal(await pollFileState("files/abc", processing, API_KEY), "PROCESSING");

  const failed = fakeTransport({ GET: () => ({ status: 200, body: { state: "FAILED" } }) });
  assert.equal(await pollFileState("files/abc", failed, API_KEY), "FAILED");
});

test("pollFileState throws on an unexpected state value", async () => {
  const transport = fakeTransport({ GET: () => ({ status: 200, body: { state: "WEIRD" } }) });
  await assert.rejects(() => pollFileState("files/abc", transport, API_KEY), /unexpected file state/);
});

test("parseDiarizedTranscript parses [MM:SS] Speaker: text lines, computes tEnd from the next turn", () => {
  const text = [
    "[00:00] Devesh: Perfect perfect.",
    "[00:02] spk:1: Welcome everyone.",
    "[01:55] Priyamvada: Thank you.",
  ].join("\n");

  const turns = parseDiarizedTranscript(text);
  assert.equal(turns.length, 3);
  assert.deepEqual(turns[0], { speakerRef: "Devesh", tStart: 0, tEnd: 2, text: "Perfect perfect." });
  assert.deepEqual(turns[1], { speakerRef: "spk:1", tStart: 2, tEnd: 115, text: "Welcome everyone." });
  assert.equal(turns[2]!.tStart, 115);
  assert.equal(turns[2]!.tEnd, 115 + 30, "last turn's tEnd falls back to tStart + 30s");
});

test("parseDiarizedTranscript skips non-matching lines without throwing", () => {
  const text = "## Some header\n\n[00:10] Bob: hello\nrandom prose with no timestamp\n[00:20] Ann: hi";
  const turns = parseDiarizedTranscript(text);
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.speakerRef, "Bob");
  assert.equal(turns[1]!.speakerRef, "Ann");
});

test("parseDiarizedTranscript on empty text returns an empty array", () => {
  assert.deepEqual(parseDiarizedTranscript(""), []);
});

test("transcribeUploadedAudio calls generateContent with fileData and parses the response", async () => {
  const transport = fakeTransport({
    POST: () => ({
      status: 200,
      body: {
        candidates: [{ content: { parts: [{ text: "[00:00] Bob: hi\n[00:05] Ann: hey" }] } }],
        usageMetadata: { promptTokenCount: 1234, candidatesTokenCount: 56 },
      },
    }),
  });

  const result = await transcribeUploadedAudio("files/abc123", transport, API_KEY);
  assert.equal(result.turns.length, 2);
  assert.equal(result.turns[0]!.speakerRef, "Bob");
  assert.equal(result.usage.inputTokens, 1234);
  assert.equal(result.usage.outputTokens, 56);
});

test("transcribeUploadedAudio throws on a non-2xx status", async () => {
  const transport = fakeTransport({ POST: () => ({ status: 500, body: { error: "oops" } }) });
  await assert.rejects(() => transcribeUploadedAudio("files/abc", transport, API_KEY), /generateContent failed with status 500/);
});
