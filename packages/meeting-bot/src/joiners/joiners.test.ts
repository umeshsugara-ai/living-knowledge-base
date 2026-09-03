/**
 * packages/meeting-bot/src/joiners/joiners.test.ts — T-024 C6. Each stub joiner delegates
 * join/stop to its injected transport/launcher/capture-fn — no real network/browser/audio call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createVexaJoiner } from "./vexa-joiner.js";
import { createBrowserJoiner } from "./browser-joiner.js";
import { createSystemAudioJoiner } from "./system-audio-joiner.js";

test("vexa-joiner: join posts to {baseUrl}/bots via the injected transport and returns sessionHandle", async () => {
  const calls: unknown[] = [];
  const joiner = createVexaJoiner({
    baseUrl: "https://vexa.example",
    transport: async (req) => {
      calls.push(req);
      return { status: 200, body: { sessionHandle: "sess-1" } };
    },
  });

  const result = await joiner.join("https://meet.google.com/abc", { tenantId: "t1" });
  assert.equal(result.sessionHandle, "sess-1");
  assert.equal((calls[0] as { url: string }).url, "https://vexa.example/bots");

  await joiner.stop("sess-1");
  assert.equal((calls[1] as { url: string }).url, "https://vexa.example/bots/sess-1/stop");
});

test("vexa-joiner: throws when the transport reports a non-2xx status", async () => {
  const joiner = createVexaJoiner({
    baseUrl: "https://vexa.example",
    transport: async () => ({ status: 500, body: {} }),
  });
  await assert.rejects(() => joiner.join("https://meet.google.com/abc", { tenantId: "t1" }));
});

test("browser-joiner: join delegates to the injected launcher", async () => {
  let calledWith: unknown;
  const joiner = createBrowserJoiner({
    launch: async (url, opts) => {
      calledWith = { url, opts };
      return { sessionHandle: "browser-sess", mediaStream: undefined };
    },
  });
  const result = await joiner.join("https://acme.webex.com/j/1", { tenantId: "t1" });
  assert.equal(result.sessionHandle, "browser-sess");
  assert.deepEqual(calledWith, { url: "https://acme.webex.com/j/1", opts: { tenantId: "t1" } });
});

test("system-audio-joiner: join/stop delegate to the injected capture functions", async () => {
  const calls = { started: 0, stopped: [] as string[] };
  const joiner = createSystemAudioJoiner({
    startCapture: async () => {
      calls.started++;
      return { sessionHandle: "sys-sess", mediaStream: undefined };
    },
    stopCapture: async (handle) => {
      calls.stopped.push(handle);
    },
  });
  const result = await joiner.join("https://example.com/other", { tenantId: "t1" });
  assert.equal(result.sessionHandle, "sys-sess");
  assert.equal(calls.started, 1);

  await joiner.stop("sys-sess");
  assert.deepEqual(calls.stopped, ["sys-sess"]);
});
