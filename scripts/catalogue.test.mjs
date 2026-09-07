/**
 * scripts/catalogue.test.mjs — regression cover for the progress scorer's honesty guards
 * (plan §10 U0.5, ISS-030). Every one of these was proven by hand once and then had NO test, so a
 * later refactor could have silently deleted the guard and the score would have gone back to
 * being self-assessment. Each case below is an ATTACK on the score, not a happy path.
 *
 * Covers: (a) a manual upgrade is refused; (b) a lowering is honoured; (c) an unknown verdict
 * string cannot slip past the ordering check; (d) dropping a feature to shrink the denominator is
 * refused; (e) scoring is deterministic; (f) the probe fingerprint changes when a probe is edited.
 * Run: node --test scripts/catalogue.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCatalogue, assertDenominator, hashProbes, expectedIds } from "./lib/catalogue.mjs";

/** Signals under which "chunks" is empty and POST /ask is live — mirrors the real repo state. */
const SIGNALS = {
  routes: { live: new Set(["POST /ask"]), stubs: new Set(["GET /search"]) },
  counts: { claims: 81, chunks: 0 },
  pages: new Set(["/sessions"]),
  packages: new Set(["@lkb/db"]),
};

/** A full-size catalogue (so assertDenominator passes) with the first row overridable. */
function catalogueWith(firstRow = {}) {
  const features = expectedIds().map((id) => ({ id, group: id[0], name: id, probes: {}, manual: null }));
  features[0] = { ...features[0], ...firstRow };
  return { features };
}

test("a manual upgrade is refused, and the auto verdict stands", () => {
  const c = catalogueWith({ probes: { collections: ["chunks"] }, manual: { verdict: "REAL", reason: "wishful" } });
  const s = scoreCatalogue(c, SIGNALS);
  assert.equal(s.rows[0].auto, "MISSING", "chunks is empty, so auto must be MISSING");
  assert.equal(s.rows[0].verdict, "MISSING", "the upgrade must NOT be applied");
  assert.equal(s.upgrades.length, 1, "the attempt must be reported so the CLI can exit non-zero");
});

test("a manual downgrade IS honoured — humans may only lower", () => {
  const c = catalogueWith({ probes: { routes: ["POST /ask"] }, manual: { verdict: "PARTIAL", reason: "tree-only retrieval" } });
  const s = scoreCatalogue(c, SIGNALS);
  assert.equal(s.rows[0].auto, "REAL");
  assert.equal(s.rows[0].verdict, "PARTIAL");
  assert.equal(s.upgrades.length, 0);
});

test("an unknown verdict string cannot bypass the ordering check", () => {
  // Regression for ISS-031: ORDER["EXCELLENT"] is undefined and `undefined > 0` is false, so the
  // upgrade branch was skipped and the bogus verdict was written out labelled "lowered", exit 0.
  const c = catalogueWith({ probes: { collections: ["chunks"] }, manual: { verdict: "EXCELLENT", reason: "nope" } });
  const s = scoreCatalogue(c, SIGNALS);
  assert.equal(s.rows[0].verdict, "MISSING", "a bogus verdict must never reach the output");
  assert.match(s.upgrades[0], /not one of/);
});

test("dropping a feature to shrink the denominator is refused", () => {
  // Regression for ISS-029: deleting the probe-less rows moved the real score 20.2% -> 30.3%
  // with every gate green. Guarding the numerator alone was not enough.
  const c = catalogueWith();
  c.features.pop();
  assert.throws(() => assertDenominator(c), /dropped feature/);
});

test("an unknown or duplicated feature id is refused", () => {
  const extra = catalogueWith();
  extra.features.push({ id: "Z9", group: "Z", name: "smuggled", probes: {}, manual: null });
  assert.throws(() => assertDenominator(extra), /unknown feature/);

  const dupe = catalogueWith();
  dupe.features[1] = { ...dupe.features[1], id: dupe.features[0].id };
  assert.throws(() => assertDenominator(dupe), /duplicate id|dropped feature/);
});

test("the canonical denominator is 57 features, and a correct catalogue passes", () => {
  assert.equal(expectedIds().length, 57);
  assert.doesNotThrow(() => assertDenominator(catalogueWith()));
});

test("scoring is deterministic for identical input", () => {
  const a = scoreCatalogue(catalogueWith({ probes: { collections: ["claims"] } }), SIGNALS);
  const b = scoreCatalogue(catalogueWith({ probes: { collections: ["claims"] } }), SIGNALS);
  assert.deepEqual(a.rows.map((r) => r.verdict), b.rows.map((r) => r.verdict));
  assert.equal(a.adjustedPercent, b.adjustedPercent);
});

test("editing a probe changes the fingerprint, so the edit shows as a diff", () => {
  const before = hashProbes(catalogueWith({ probes: { collections: ["chunks"] } }));
  const after = hashProbes(catalogueWith({ probes: { collections: ["claims"] } }));
  assert.notEqual(before, after, "repointing a probe at a populated collection must be visible");
});

test("a stub route scores STUB, not REAL — a deliberate 501 is not a shipped feature", () => {
  const s = scoreCatalogue(catalogueWith({ probes: { routes: ["GET /search"] } }), SIGNALS);
  assert.equal(s.rows[0].verdict, "STUB");
});

test("a package imported by nothing scores STUB — dead code is not a feature", () => {
  const s = scoreCatalogue(catalogueWith({ probes: { packages: ["@lkb/meeting-bot"] } }), SIGNALS);
  assert.equal(s.rows[0].verdict, "STUB");
});
