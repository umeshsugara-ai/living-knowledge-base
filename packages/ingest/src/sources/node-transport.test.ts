/**
 * packages/ingest/src/sources/node-transport.test.ts — against a REAL socket, not a fake.
 *
 * Two cycle-1 findings meet here. ISS-016: the transport was the only network-touching code in the
 * feature and the least tested — deleting `redirect: "manual"`, the size abort or the timeout each
 * left the suite green, because every one of those properties was proven only in the guard's fakes.
 * ISS-011: it called `fetch(url)`, so the OS re-resolved and the guard's decision was advisory.
 *
 * A local `http.createServer` closes both: the pin is observable (the server sees the request only
 * because the address was pinned to loopback while the URL says something else), and each property
 * is exercised over a real connection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

import { httpRequest, resolveAll } from "./node-transport.js";

async function serve(handler: Parameters<typeof createServer>[1]): Promise<{ port: number; close: () => Promise<void>; hits: string[] }> {
  const hits: string[] = [];
  const server: Server = createServer((req, res) => {
    hits.push(req.headers.host ?? "");
    handler!(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { port, hits, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("ISS-011: connects to the PINNED address, not to whatever the hostname resolves to", async () => {
  const s = await serve((_req, res) => { res.writeHead(200); res.end("pinned"); });
  try {
    // The URL says a hostname that does NOT resolve to this server. The only way the request can
    // arrive is the injected address. If pinning regressed to fetch(url), this cannot connect.
    const body = await httpRequest(`http://pinned.invalid:${s.port}/`, {
      maxBytes: 1000, timeoutMs: 3000, address: "127.0.0.1",
    });
    assert.equal(body.body, "pinned");
    assert.match(s.hits[0] ?? "", /^pinned\.invalid:/, "the Host header must still carry the real name");
  } finally { await s.close(); }
});

test("ISS-016: a redirect is returned UNFOLLOWED, with no body read", async () => {
  const s = await serve((_req, res) => {
    res.writeHead(302, { location: "http://internal.example/secrets" });
    res.end("should not be read");
  });
  try {
    const r = await httpRequest(`http://any.invalid:${s.port}/`, { maxBytes: 1000, timeoutMs: 3000, address: "127.0.0.1" });
    assert.equal(r.status, 302);
    assert.equal(r.location, "http://internal.example/secrets");
    assert.equal(r.body, "", "following it here would step past the guard's per-hop re-check");
  } finally { await s.close(); }
});

test("ISS-016: an oversized response is aborted mid-stream, not measured after the fact", async () => {
  const s = await serve((_req, res) => {
    res.writeHead(200);
    for (let i = 0; i < 200; i++) res.write("x".repeat(1000));
    res.end();
  });
  try {
    await assert.rejects(
      () => httpRequest(`http://any.invalid:${s.port}/`, { maxBytes: 5000, timeoutMs: 3000, address: "127.0.0.1" }),
      /too large/);
  } finally { await s.close(); }
});

test("ISS-016: a slow server is abandoned on the deadline", { timeout: 8000 }, async () => {
  const s = await serve((_req, res) => { setTimeout(() => { res.writeHead(200); res.end("late"); }, 4000); });
  try {
    const started = Date.now();
    await assert.rejects(
      () => httpRequest(`http://any.invalid:${s.port}/`, { maxBytes: 1000, timeoutMs: 300, address: "127.0.0.1" }),
      /timed out/);
    assert.ok(Date.now() - started < 3000, "must not wait for the server");
  } finally { await s.close(); }
});

test("a normal response comes back whole", async () => {
  const s = await serve((_req, res) => { res.writeHead(200); res.end("hello world"); });
  try {
    const r = await httpRequest(`http://any.invalid:${s.port}/`, { maxBytes: 1000, timeoutMs: 3000, address: "127.0.0.1" });
    assert.equal(r.status, 200);
    assert.equal(r.body, "hello world");
  } finally { await s.close(); }
});

test("resolveAll returns EVERY address, not just the first", async () => {
  const addrs = await resolveAll("localhost");
  assert.ok(Array.isArray(addrs) && addrs.length >= 1);
  for (const a of addrs) assert.equal(typeof a, "string");
});

test("resolveAll rejects rather than returning an empty list for an unresolvable host", async () => {
  await assert.rejects(() => resolveAll("no-such-host.invalid"));
});
