/**
 * packages/ingest/src/watched/run.test.ts — A13's missing composition.
 *
 * T-027 built every piece and wired none of them: `listActive` → `isDueForCheck` →
 * `checkWatchedSource` → `recordFetch` has never existed as a single call, so no watched source
 * has ever been re-fetched. This is that call, and it is the difference between A13 being a stored
 * intention and a working feature.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { WatchedSources } from "@lkb/core";

import { runWatchedSources, type WatchedRunDeps } from "./run.js";

function source(over: Partial<WatchedSources> = {}): WatchedSources {
  return {
    _id: "ws-1", tenantId: "toc", url: "https://example.ac.uk/fees",
    reputationTier: "official", checkIntervalHours: 24, active: true, ...over,
  } as WatchedSources;
}

function deps(over: Partial<WatchedRunDeps> = {}) {
  const recorded: { id: string; hash: string; diffFrom: string | null }[] = [];
  const fetched: string[] = [];
  return {
    recorded, fetched,
    d: {
      listActive: async () => [source()],
      fetcher: async (url: string) => { fetched.push(url); return "body-v1"; },
      hasher: (t: string) => `h(${t})`,
      recordFetch: async (_tenantId: string, id: string, lf: { hash: string; diffFrom: string | null }) => {
        recorded.push({ id, hash: lf.hash, diffFrom: lf.diffFrom }); return true;
      },
      now: () => "2026-09-08T12:00:00.000Z",
      ...over,
    },
  };
}

test("fetches a due source, hashes it, and records the fetch", async () => {
  const { d, recorded, fetched } = deps();
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.deepEqual(fetched, ["https://example.ac.uk/fees"]);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.hash, "h(body-v1)");
  assert.equal(recorded[0]?.diffFrom, null, "first fetch has nothing to diff from");
  assert.equal(r.checked, 1);
  assert.equal(r.changed, 1, "a first fetch counts as changed");
});

test("skips a source that is not due yet, and does not fetch it", async () => {
  const { d, fetched, recorded } = deps({
    listActive: async () => [source({ lastFetch: { fetchedAt: "2026-09-08T11:00:00.000Z", hash: "h", diffFrom: null } })],
  });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.deepEqual(fetched, [], "an interval that has not elapsed must not cause a fetch");
  assert.deepEqual(recorded, []);
  assert.equal(r.skipped, 1);
  assert.equal(r.checked, 0);
});

test("an inactive source is never fetched, however overdue", async () => {
  const { d, fetched } = deps({
    listActive: async () => [source({ active: false, lastFetch: { fetchedAt: "2020-01-01T00:00:00.000Z", hash: "h", diffFrom: null } })],
  });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.deepEqual(fetched, []);
  assert.equal(r.skipped, 1);
});

test("an unchanged source records the fetch but is not reported as changed", async () => {
  const { d, recorded } = deps({
    listActive: async () => [source({ lastFetch: { fetchedAt: "2020-01-01T00:00:00.000Z", hash: "h(body-v1)", diffFrom: null } })],
  });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.equal(r.changed, 0, "same hash means nothing changed");
  assert.equal(recorded[0]?.diffFrom, "h(body-v1)", "and the previous hash is carried as diffFrom");
});

test("ONE source failing does not abandon the rest -- the failure is reported, not thrown", async () => {
  const { d, fetched } = deps({
    listActive: async () => [source({ _id: "ws-bad", url: "https://bad.example/" }), source({ _id: "ws-ok" })],
    fetcher: async (url: string) => {
      fetched.push(url);
      if (url.includes("bad.example")) throw new Error("guarded-fetch: blocked -- private address");
      return "body-v1";
    },
  });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.equal(r.checked, 1, "the good source still got through");
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0]?.reason ?? "", /blocked/);
  assert.equal(r.failed[0]?.id, "ws-bad");
});

test("a blocked URL is a per-source failure, never a crash of the run", async () => {
  const { d } = deps({ fetcher: async () => { throw new Error("guarded-fetch: blocked -- 169.254.169.254"); } });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.equal(r.failed.length, 1);
  assert.equal(r.checked, 0);
});

test("no active sources is a clean no-op, not an error", async () => {
  const { d } = deps({ listActive: async () => [] });
  assert.deepEqual(await runWatchedSources("toc", d as WatchedRunDeps), { checked: 0, changed: 0, skipped: 0, failed: [], remaining: 0 });
});

/**
 * ISS-C-UNRUN-WRITERS-019. `recordFetch` returns false when it matched no row — the source was
 * deleted, or belongs to another tenant. Discarding that boolean made a run which persisted
 * NOTHING report `{checked: 2, changed: 2, failed: []}`: a clean success for a write that never
 * happened. This mutant survived the whole suite before this test existed.
 */
test("a recordFetch that matched no row is a FAILURE, never a silent success", async () => {
  const { d } = deps({ recordFetch: async () => false });
  const r = await runWatchedSources("toc", d as WatchedRunDeps);
  assert.equal(r.checked, 0, "nothing was persisted, so nothing was checked");
  assert.equal(r.changed, 0);
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0]!.reason, /nothing was persisted/);
});

/**
 * ISS-C-UNRUN-WRITERS-020. The loop is a sequential chain of network calls awaited inline in an
 * HTTP handler. Without the cap it runs until something else gives up, and an unreported
 * truncation reads exactly like a complete run — so `remaining` is asserted, not just the count.
 */
test("maxSources caps the run and REPORTS what it left untouched", async () => {
  const many = Array.from({ length: 5 }, (_, i) => source({ _id: `ws-${i}` }));
  const { d, fetched } = deps({ listActive: async () => many });
  const r = await runWatchedSources("toc", d as WatchedRunDeps, { maxSources: 2 });
  assert.equal(fetched.length, 2, "the cap must stop the network calls, not just the counter");
  assert.equal(r.checked, 2);
  assert.equal(r.remaining, 3);
});

test("an elapsed deadline stops the run and reports the remainder", async () => {
  const many = Array.from({ length: 4 }, (_, i) => source({ _id: `ws-${i}` }));
  const { d, fetched } = deps({ listActive: async () => many });
  const r = await runWatchedSources("toc", d as WatchedRunDeps, { timeoutMs: -1 });
  assert.deepEqual(fetched, [], "a spent budget must fetch nothing at all");
  assert.equal(r.remaining, 4);
});

test("under the cap, nothing is reported as remaining", async () => {
  const { d } = deps();
  assert.equal((await runWatchedSources("toc", d as WatchedRunDeps, { maxSources: 25 })).remaining, 0);
});
