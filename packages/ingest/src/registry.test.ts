/**
 * packages/ingest/src/registry.test.ts — T-020 C6 (registry half). `detectSource` picks the
 * right adapter for a recording input and a document input, and throws `NoMatchingSourceError`
 * for neither.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectSource, NoMatchingSourceError } from "./registry.js";
import { createRecordingSource } from "./sources/recording.js";
import { createDocumentSource } from "./sources/document.js";
import { createUrlSource } from "./sources/url.js";
import { fakeBytesReader, fakeTextReader, fakeUrlFetcher, fakeHasher } from "./testUtils.js";

const recording = createRecordingSource({
  hasher: fakeHasher,
  reader: fakeBytesReader({}),
  transcribe: async () => [],
});
const document = createDocumentSource({ hasher: fakeHasher, reader: fakeTextReader({}) });
const url = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({}) });
const adapters = [recording, document, url];

test("detectSource picks the recording adapter for an audio path", () => {
  const adapter = detectSource("session-42.mp3", adapters);
  assert.equal(adapter.name, "recording");
});

test("detectSource picks the document adapter for a document path", () => {
  const adapter = detectSource("notes.md", adapters);
  assert.equal(adapter.name, "document");
});

test("detectSource throws NoMatchingSourceError when no adapter matches", () => {
  assert.throws(() => detectSource("session.xyz", adapters), NoMatchingSourceError);
});

test("T-023: detectSource picks the url adapter for an http(s) input, no ambiguity with document/recording", () => {
  const adapter = detectSource("https://example.com/webinar-notes", adapters);
  assert.equal(adapter.name, "url");

  // A URL that happens to end in a document-like extension is still a URL, not a local path —
  // document.ts's hasDocumentExtension check only ever runs on a local path, so this must not
  // false-match the document adapter first.
  const pdfUrl = detectSource("https://example.com/report.pdf", adapters);
  assert.equal(pdfUrl.name, "url");
});

test("detectSource picks the first matching adapter in order", () => {
  const alwaysTrue = { name: "always-true", detect: () => true, fetch: recording.fetch, toTurns: recording.toTurns };
  const adapter = detectSource("anything.mp3", [alwaysTrue, recording]);
  assert.equal(adapter.name, "always-true");
});
