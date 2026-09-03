/**
 * packages/ingest/src/sources/url.test.ts — T-023 C6. `detect` matches http(s) urls and the url
 * hint; `fetch` computes hash via the injected hasher and sets captureMode/url; `fetch` throws
 * when tenantId is missing; `toTurns` produces paragraph turns with speakerRef "url" via the
 * injected fetcher, no live network call anywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createUrlSource } from "./url.js";
import { baseConsent, fakeUrlFetcher, fakeHasher, TENANT, FIXED_NOW } from "../testUtils.js";

test("detect matches http(s) urls and the url hint, rejects everything else", () => {
  const adapter = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({}) });
  assert.equal(adapter.detect("https://example.com/article"), true);
  assert.equal(adapter.detect("http://example.com/article"), true);
  assert.equal(adapter.detect({ kind: "url", url: "https://example.com/x" }), true);
  assert.equal(adapter.detect("notes.pdf"), false);
  assert.equal(adapter.detect("not a url at all"), false);
  assert.equal(adapter.detect({ kind: "document", path: "notes.pdf" }), false);
});

test("fetch reads via the injected fetcher and sets captureMode/url from context", async () => {
  const url = "https://example.com/nz-visas";
  const adapter = createUrlSource({
    hasher: fakeHasher,
    fetcher: fakeUrlFetcher({ [url]: "NZ post-study work visa rules." }),
    now: () => FIXED_NOW,
  });

  const { source, media } = await adapter.fetch(
    { kind: "url", url, tenantId: TENANT },
    baseConsent({ captureMode: "public" }),
  );

  assert.equal(source.kind, "url");
  assert.equal(source.url, url);
  assert.equal(source.captureMode, "public");
  assert.equal(source.hash, fakeHasher("NZ post-study work visa rules."));
  assert.equal(source.createdAt, FIXED_NOW);
  assert.deepEqual(media, []);
});

test("fetch accepts the url hint object with tenantId", async () => {
  const url = "https://example.com/plain";
  const adapter = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({ [url]: "text" }) });
  const { source } = await adapter.fetch({ kind: "url", url, tenantId: TENANT }, baseConsent());
  assert.equal(source.url, url);
});

test("fetch throws when tenantId is missing (never silently defaults tenancy)", async () => {
  const url = "https://example.com/no-tenant";
  const adapter = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({ [url]: "text" }) });
  await assert.rejects(
    () => adapter.fetch({ kind: "url", url }, baseConsent()),
    /tenantId/,
  );
});

test("fetch throws on an unrecognized input", async () => {
  const adapter = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({}) });
  await assert.rejects(() => adapter.fetch("not a url", baseConsent()), /unrecognized input/);
});

test("url.toTurns() re-fetches the source url and splits into paragraph turns with speakerRef 'url'", async () => {
  const url = "https://example.com/two-paragraphs";
  const adapter = createUrlSource({
    hasher: fakeHasher,
    fetcher: fakeUrlFetcher({ [url]: "First paragraph.\n\nSecond paragraph." }),
  });
  const { source } = await adapter.fetch({ kind: "url", url, tenantId: TENANT }, baseConsent());

  const turns = await adapter.toTurns(source);
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.text, "First paragraph.");
  assert.equal(turns[0]!.speakerRef, "url");
  assert.equal(turns[1]!.text, "Second paragraph.");
});

test("toTurns throws when source.url is missing", async () => {
  const adapter = createUrlSource({ hasher: fakeHasher, fetcher: fakeUrlFetcher({}) });
  await assert.rejects(
    () => adapter.toTurns({ _id: "x", tenantId: TENANT, kind: "url", captureMode: "public",
      hash: "h", consent: { given: true, recordedBy: "r" }, createdAt: FIXED_NOW } as never),
    /source\.url/,
  );
});
