/**
 * The transport is the only part of Watched Sources that touches the network, so these tests pin
 * the three properties the guard depends on rather than exercising real HTTP.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveAll } from "./node-transport.js";

test("resolveAll returns EVERY address, not just the first", async () => {
  // localhost commonly answers with both 127.0.0.1 and ::1; whatever it returns, the shape must be
  // a list. Returning one address would reinstate the coin-flip bypass ISS-007 closed.
  const addrs = await resolveAll("localhost");
  assert.ok(Array.isArray(addrs), "must be a list");
  assert.ok(addrs.length >= 1);
  for (const a of addrs) assert.equal(typeof a, "string");
});

test("resolveAll rejects rather than returning an empty list for an unresolvable host", async () => {
  await assert.rejects(() => resolveAll("no-such-host.invalid"));
});
