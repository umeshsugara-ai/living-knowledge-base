/**
 * packages/ingest/src/source.test.ts — T-020 C5. `assertProvidedFirst` (D-008 provided-first
 * soft gate): warns for silent-without-confirmation, is silent (no warning) otherwise.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { assertProvidedFirst } from "./source.js";
import { baseConsent } from "./testUtils.js";

test("warns when captureMode is 'silent' without confirmedNoAlternative", () => {
  const warning = assertProvidedFirst(baseConsent({ captureMode: "silent" }));
  assert.equal(typeof warning, "string");
  assert.match(warning!, /silent/);
});

test("does not warn when captureMode is 'silent' and confirmedNoAlternative is true", () => {
  const warning = assertProvidedFirst(
    baseConsent({ captureMode: "silent", confirmedNoAlternative: true }),
  );
  assert.equal(warning, undefined);
});

test("does not warn for provided/public/notes capture modes", () => {
  for (const captureMode of ["provided", "public", "notes"] as const) {
    const warning = assertProvidedFirst(baseConsent({ captureMode }));
    assert.equal(warning, undefined, `unexpected warning for captureMode=${captureMode}`);
  }
});
