/**
 * packages/core/src/domain/purge-policy.test.ts — T-026 C4. `isPurgeEligible` and
 * `deriveEvidenceClipWindows` against fixture Media/Claims/Turns — no I/O.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Media } from "../generated/media.js";
import type { Claims } from "../generated/claims.js";
import type { Turns } from "../generated/turns.js";
import { isPurgeEligible, deriveEvidenceClipWindows } from "./purge-policy.js";

const TENANT = "toc";

function media(overrides: Partial<Media> = {}): Media {
  return {
    _id: "media1", tenantId: TENANT, sourceRef: "src1", kind: "recording",
    turnRefs: ["t1", "t2"], retention: { purgeAfterVerified: false },
    ...overrides,
  };
}

function claim(id: string, status: Claims["status"], turnIds: string[]): Claims {
  return {
    _id: id, tenantId: TENANT, text: `claim ${id}`, status,
    evidence: turnIds.map((turnId) => ({ turnId, sessionId: "sess1" })) as Claims["evidence"],
  };
}

test("evidence-clip media is never eligible, even with all-verified citing claims", () => {
  const m = media({ kind: "evidence-clip" });
  const claims = [claim("c1", "verified", ["t1"])];
  const verdict = isPurgeEligible(m, claims);
  assert.equal(verdict.eligible, false);
  assert.match(verdict.reason, /retained permanently/);
});

test("media with no linked turns is not eligible", () => {
  const m = media({ turnRefs: [] });
  const verdict = isPurgeEligible(m, [claim("c1", "verified", ["t1"])]);
  assert.equal(verdict.eligible, false);
  assert.match(verdict.reason, /no turns linked/);
});

test("media with turns but no citing claims is not eligible", () => {
  const m = media();
  const verdict = isPurgeEligible(m, [claim("c1", "verified", ["t99-unrelated"])]);
  assert.equal(verdict.eligible, false);
  assert.match(verdict.reason, /no claim has cited/);
});

test("media with a mix of verified/unverified citing claims is not eligible, names the count", () => {
  const m = media();
  const claims = [
    claim("c1", "verified", ["t1"]),
    claim("c2", "needs-review", ["t2"]),
  ];
  const verdict = isPurgeEligible(m, claims);
  assert.equal(verdict.eligible, false);
  assert.match(verdict.reason, /1 claim\(s\)/);
});

test("media with only verified citing claims is eligible", () => {
  const m = media();
  const claims = [
    claim("c1", "verified", ["t1"]),
    claim("c2", "verified", ["t2"]),
    claim("c3", "verified", ["t99-unrelated"]), // not a citing claim, must not affect the verdict
  ];
  const verdict = isPurgeEligible(m, claims);
  assert.equal(verdict.eligible, true);
  assert.match(verdict.reason, /2 citing claim\(s\)/);
});

test("deriveEvidenceClipWindows pads, clamps at 0, skips unresolvable turns, and de-duplicates", () => {
  const turns: Turns[] = [
    { _id: "t1", tenantId: TENANT, sessionId: "sess1", speakerRef: "spk:0", tStart: 5, tEnd: 20, text: "a" },
    { _id: "t2", tenantId: TENANT, sessionId: "sess1", speakerRef: "spk:1", tStart: 100, tEnd: 110, text: "b" },
  ];
  const claims: Claims[] = [
    claim("c1", "verified", ["t1"]),
    claim("c2", "needs-review", ["t2"]), // not verified — must not produce a window
    claim("c3", "verified", ["t1"]), // same turn as c1 — must de-duplicate to one window
    claim("c4", "verified", ["t-missing"]), // unresolvable turn — must be skipped, not throw
  ];

  const windows = deriveEvidenceClipWindows(claims, turns);

  assert.equal(windows.length, 1, "only t1's window survives: t2 unverified, t-missing unresolvable, t1 deduped");
  assert.deepEqual(windows[0], { sessionId: "sess1", turnId: "t1", tStart: 0, tEnd: 35 },
    "tStart=5-15 clamps to 0; tEnd=20+15=35");
});

test("deriveEvidenceClipWindows respects a custom padding", () => {
  const turns: Turns[] = [
    { _id: "t1", tenantId: TENANT, sessionId: "sess1", speakerRef: "spk:0", tStart: 50, tEnd: 60, text: "a" },
  ];
  const claims: Claims[] = [claim("c1", "verified", ["t1"])];
  const windows = deriveEvidenceClipWindows(claims, turns, 5);
  assert.deepEqual(windows[0], { sessionId: "sess1", turnId: "t1", tStart: 45, tEnd: 65 });
});
