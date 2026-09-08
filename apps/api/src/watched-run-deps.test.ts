/**
 * apps/api/src/watched-run-deps.test.ts — ISS-C-UNRUN-WRITERS-017.
 *
 * Watched Sources fetches user-supplied URLs unattended on a timer, so the guarded fetcher is the
 * feature's SSRF boundary. While it was composed inline inside the route's `run`, swapping it for
 * a bare fetch left 134/134 tests green: no test could reach the composition. These assert on the
 * production deps object itself, so that mutant dies here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isGuardedFetcher } from "@lkb/ingest";
import { createWatchedRunDeps } from "./store.js";

test("the production watched-run deps use a BRANDED guarded fetcher, not a bare one", () => {
  assert.equal(isGuardedFetcher(createWatchedRunDeps().fetcher), true);
});

test("isGuardedFetcher rejects a plain function -- the brand is not incidental", () => {
  assert.equal(isGuardedFetcher(async (_url: string) => ""), false);
  assert.equal(isGuardedFetcher(globalThis.fetch), false);
});

test("the deps supply a real sha256 hasher and an ISO clock", () => {
  const deps = createWatchedRunDeps();
  assert.equal(
    deps.hasher("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.match(deps.now(), /^\d{4}-\d{2}-\d{2}T/);
});
