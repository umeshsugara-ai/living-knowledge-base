/**
 * packages/meeting-bot/src/capture.test.ts — T-024 C6. `capture()` end-to-end with fake joiners
 * + a fake ingest `Source`: produces non-empty `turns`, and the D-008 warning (reusing
 * packages/ingest's T-020 `assertProvidedFirst` test pattern) when `consent.captureMode ===
 * 'silent'` without `confirmedNoAlternative`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { capture } from "./capture.js";
import { baseConsent, fakeIngestSource, fakeJoiners, TENANT, FIXED_NOW } from "./testUtils.js";

test("capture() end-to-end: detects platform, joins, fetches + transcribes, returns non-empty turns", async () => {
  const joiners = fakeJoiners("fixture-recording.wav");
  const ingestSource = fakeIngestSource([{ speakerRef: "spk:0", tStart: 0, tEnd: 2, text: "hello world" }]);

  const result = await capture(
    "https://meet.google.com/abc-defg-hij",
    { tenantId: TENANT, consent: baseConsent({ captureMode: "provided" }) },
    { joiners, ingestSource, now: () => FIXED_NOW },
  );

  assert.equal(result.turns.length, 1);
  assert.equal(result.turns[0]!.text, "hello world");
  assert.equal(result.source.tenantId, TENANT);
  assert.equal(result.session.sourceId, result.source._id);
  assert.equal(result.session.tenantId, TENANT);
  assert.deepEqual(result.warnings, []);

  // meet -> vexa strategy (strategy.ts) is the one that should have been used.
  assert.deepEqual(joiners.vexa.calls.joined, ["https://meet.google.com/abc-defg-hij"]);
  assert.deepEqual(joiners.browser.calls.joined, []);
  assert.deepEqual(joiners["system-audio"].calls.joined, []);
  // join is always stopped, even on success.
  assert.deepEqual(joiners.vexa.calls.stopped, ["fixture-recording.wav"]);
});

test("capture() routes an unknown platform to the system-audio joiner", async () => {
  const joiners = fakeJoiners();
  const result = await capture(
    "https://example.com/some-other-call",
    { tenantId: TENANT, consent: baseConsent() },
    { joiners, ingestSource: fakeIngestSource() },
  );
  assert.equal(result.source.tenantId, TENANT);
  assert.deepEqual(joiners["system-audio"].calls.joined, ["https://example.com/some-other-call"]);
  assert.deepEqual(joiners.vexa.calls.joined, []);
});

test("capture() warns (does not throw) when captureMode is silent without confirmation", async () => {
  const joiners = fakeJoiners();
  const result = await capture(
    "https://meet.google.com/abc-defg-hij",
    { tenantId: TENANT, consent: baseConsent({ captureMode: "silent" }) },
    { joiners, ingestSource: fakeIngestSource() },
  );
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /silent/);
});

test("capture() does not warn when captureMode is silent with confirmedNoAlternative", async () => {
  const joiners = fakeJoiners();
  const result = await capture(
    "https://meet.google.com/abc-defg-hij",
    { tenantId: TENANT, consent: baseConsent({ captureMode: "silent", confirmedNoAlternative: true }) },
    { joiners, ingestSource: fakeIngestSource() },
  );
  assert.deepEqual(result.warnings, []);
});

test("capture() stops the joiner even when the ingest fetch throws", async () => {
  const joiners = fakeJoiners("bad-handle");
  const throwingSource = fakeIngestSource();
  throwingSource.fetch = async () => {
    throw new Error("boom");
  };
  await assert.rejects(
    () =>
      capture(
        "https://meet.google.com/abc-defg-hij",
        { tenantId: TENANT, consent: baseConsent() },
        { joiners, ingestSource: throwingSource },
      ),
    /boom/,
  );
  assert.deepEqual(joiners.vexa.calls.stopped, ["bad-handle"]);
});
