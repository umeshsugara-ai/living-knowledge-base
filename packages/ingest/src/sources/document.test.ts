/**
 * packages/ingest/src/sources/document.test.ts — T-020 C6 (document half). `detect` matches
 * document extensions; `document.toTurns()` produces paragraph turns with correct `tStart`
 * offsets from a fixture text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createDocumentSource, splitIntoParagraphTurns } from "./document.js";
import { baseConsent, fakeTextReader, fakeHasher, TENANT, FIXED_NOW } from "../testUtils.js";

test("detect matches document extensions and the document hint", () => {
  const adapter = createDocumentSource({ hasher: fakeHasher, reader: fakeTextReader({}) });
  assert.equal(adapter.detect("notes.pdf"), true);
  assert.equal(adapter.detect("notes.docx"), true);
  assert.equal(adapter.detect("notes.txt"), true);
  assert.equal(adapter.detect("notes.md"), true);
  assert.equal(adapter.detect({ kind: "document", path: "notes.rtf" }), true);
  assert.equal(adapter.detect("call.mp3"), false);
});

test("fetch reads via the injected reader and sets captureMode from context", async () => {
  const adapter = createDocumentSource({
    hasher: fakeHasher,
    reader: fakeTextReader({ "notes.md": "para one" }),
    now: () => FIXED_NOW,
  });

  const { source, media } = await adapter.fetch(
    { kind: "document", path: "notes.md", tenantId: TENANT },
    baseConsent({ captureMode: "notes" }),
  );

  assert.equal(source.kind, "document");
  assert.equal(source.captureMode, "notes");
  assert.equal(source.hash, fakeHasher("para one"));
  assert.equal(source.createdAt, FIXED_NOW);
  assert.deepEqual(media, []);
});

test("splitIntoParagraphTurns produces paragraph turns with correct tStart offsets", () => {
  const text = "First paragraph.\n\nSecond paragraph\nspans two lines.\n\nThird.";
  const turns = splitIntoParagraphTurns(text);

  assert.equal(turns.length, 3);
  assert.equal(turns[0]!.text, "First paragraph.");
  assert.equal(turns[0]!.tStart, 0);
  assert.equal(turns[1]!.text, "Second paragraph\nspans two lines.");
  assert.equal(turns[1]!.tStart, text.indexOf("Second paragraph"));
  assert.equal(turns[2]!.text, "Third.");
  assert.equal(turns[2]!.tStart, text.indexOf("Third."));
});

test("document.toTurns() reads the source path and splits into paragraph turns", async () => {
  const adapter = createDocumentSource({
    hasher: fakeHasher,
    reader: fakeTextReader({ "notes.md": "Only paragraph here." }),
  });
  const { source } = await adapter.fetch(
    { kind: "document", path: "notes.md", tenantId: TENANT },
    baseConsent(),
  );

  const turns = await adapter.toTurns(source);
  assert.equal(turns.length, 1);
  assert.equal(turns[0]!.text, "Only paragraph here.");
  assert.equal(turns[0]!.tStart, 0);
});
