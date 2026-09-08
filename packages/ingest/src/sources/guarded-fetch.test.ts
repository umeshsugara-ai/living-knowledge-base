/**
 * packages/ingest/src/sources/guarded-fetch.test.ts — ISS-C-UNRUN-WRITERS-002 (high), contract
 * invariant [I3] of watched-sources-entrypoint.
 *
 * A watched source is a URL the system fetches on a timer, unattended, from inside the network.
 * That is a server-side request forgery surface, and the cycle-1 checker ruled where the control
 * belongs and why: NOT at registration time, because a store-time hostname check cannot survive
 * DNS rebinding between registration and fetch. It belongs here, on the RESOLVED IP, with every
 * redirect hop re-checked.
 *
 * So these tests are almost entirely about refusal, and the important ones are the two that a
 * naive implementation passes anyway: rebinding (hostname resolves public at registration, private
 * at fetch) and redirect (a public URL 302s to a private one).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createGuardedFetcher, isBlockedAddress } from "./guarded-fetch.js";

function fetcher(opts: {
  lookup?: Record<string, string | string[]>;
  responses?: Record<string, { status: number; location?: string; body?: string }>;
  maxRedirects?: number;
  maxBytes?: number;
}) {
  const seen: string[] = [];
  const f = createGuardedFetcher({
    lookup: async (host) => {
      const ip = opts.lookup?.[host];
      if (!ip) throw new Error(`no test DNS entry for ${host}`);
      return Array.isArray(ip) ? ip : [ip];
    },
    request: async (url) => {
      seen.push(url);
      const r = opts.responses?.[url] ?? { status: 200, body: "ok" };
      return { status: r.status, location: r.location ?? null, body: r.body ?? "" };
    },
    ...(opts.maxRedirects !== undefined ? { maxRedirects: opts.maxRedirects } : {}),
    ...(opts.maxBytes !== undefined ? { maxBytes: opts.maxBytes } : {}),
  });
  return { f, seen };
}

test("fetches a genuinely public host", async () => {
  const { f } = fetcher({ lookup: { "example.com": "93.184.216.34" } });
  assert.equal(await f("https://example.com/page"), "ok");
});

for (const [label, ip] of [
  ["loopback", "127.0.0.1"],
  ["private 10/8", "10.0.0.5"],
  ["private 172.16/12", "172.20.1.1"],
  ["private 192.168/16", "192.168.1.1"],
  ["link-local / cloud metadata", "169.254.169.254"],
  ["CGNAT 100.64/10", "100.64.0.1"],
  ["unspecified", "0.0.0.0"],
  ["IPv6 loopback", "::1"],
  ["IPv6 unique-local", "fc00::1"],
  ["IPv6 link-local", "fe80::1"],
  ["IPv4-mapped IPv6 loopback", "::ffff:127.0.0.1"],
] as [string, string][]) {
  test(`refuses to fetch a host resolving to ${label} (${ip})`, async () => {
    const { f, seen } = fetcher({ lookup: { "evil.test": ip } });
    await assert.rejects(() => f("https://evil.test/"), /blocked|private|not permitted/i);
    assert.deepEqual(seen, [], "the request must never be issued");
  });
}

test("DNS REBINDING: the check is on the resolved ip at fetch time, not the hostname", async () => {
  // The exact case a store-time hostname denylist cannot catch: a name that looked fine when it
  // was registered and resolves to the metadata service now.
  const { f, seen } = fetcher({ lookup: { "totally-normal.example": "169.254.169.254" } });
  await assert.rejects(() => f("https://totally-normal.example/"), /blocked|private|not permitted/i);
  assert.deepEqual(seen, []);
});

test("REDIRECT: a public url that redirects to a private one is refused at the hop", async () => {
  const { f, seen } = fetcher({
    lookup: { "public.example": "93.184.216.34", "internal.example": "10.1.2.3" },
    responses: {
      "https://public.example/": { status: 302, location: "https://internal.example/secrets" },
    },
  });
  await assert.rejects(() => f("https://public.example/"), /blocked|private|not permitted/i);
  assert.deepEqual(seen, ["https://public.example/"], "the first hop happened, the second must not");
});

test("a redirect to another PUBLIC host is followed", async () => {
  const { f, seen } = fetcher({
    lookup: { "a.example": "93.184.216.34", "b.example": "93.184.216.35" },
    responses: {
      "https://a.example/": { status: 301, location: "https://b.example/final" },
      "https://b.example/final": { status: 200, body: "arrived" },
    },
  });
  assert.equal(await f("https://a.example/"), "arrived");
  assert.deepEqual(seen, ["https://a.example/", "https://b.example/final"]);
});

test("a redirect loop is bounded, not followed forever", async () => {
  const { f, seen } = fetcher({
    lookup: { "loop.example": "93.184.216.34" },
    responses: { "https://loop.example/": { status: 302, location: "https://loop.example/" } },
    maxRedirects: 3,
  });
  await assert.rejects(() => f("https://loop.example/"), /redirect/i);
  assert.ok(seen.length <= 4, `bounded, got ${seen.length} requests`);
});

test("a non-http(s) redirect target is refused", async () => {
  const { f } = fetcher({
    lookup: { "public.example": "93.184.216.34" },
    responses: { "https://public.example/": { status: 302, location: "file:///etc/passwd" } },
  });
  await assert.rejects(() => f("https://public.example/"), /http|scheme|blocked/i);
});

test("an oversized body is refused rather than buffered whole", async () => {
  const { f } = fetcher({
    lookup: { "big.example": "93.184.216.34" },
    responses: { "https://big.example/": { status: 200, body: "x".repeat(5000) } },
    maxBytes: 1000,
  });
  await assert.rejects(() => f("https://big.example/"), /too large|size/i);
});

test("isBlockedAddress is exported and honest about what it blocks", () => {
  assert.equal(isBlockedAddress("93.184.216.34"), false);
  assert.equal(isBlockedAddress("10.0.0.1"), true);
  assert.equal(isBlockedAddress("::1"), true);
  // An address it cannot parse is treated as blocked -- fail closed, never open.
  assert.equal(isBlockedAddress("not-an-ip"), true);
});

/**
 * Pins the IPv4-mapped unwrap. Mutation testing showed the earlier `::ffff:127.0.0.1` case passed
 * even with the unwrap removed -- the fail-closed branch caught it, because the string contains
 * dots and fails the v6-literal shape check. So the guard was right by accident there.
 *
 * The unwrap's real job is the other direction: judging a mapped address on its embedded v4 so a
 * legitimate PUBLIC one is allowed rather than swept up by fail-closed. Without this case the line
 * is untested, and an untested branch in a security guard is one refactor from being deleted as
 * dead code.
 */
test("an IPv4-mapped IPv6 address is judged on its embedded v4, both ways", () => {
  assert.equal(isBlockedAddress("::ffff:127.0.0.1"), true, "mapped loopback is blocked");
  assert.equal(isBlockedAddress("::ffff:10.0.0.1"), true, "mapped private is blocked");
  assert.equal(isBlockedAddress("::ffff:169.254.169.254"), true, "mapped metadata is blocked");
  assert.equal(isBlockedAddress("::ffff:93.184.216.34"), false, "mapped PUBLIC is allowed -- this is what pins the unwrap");
});

/**
 * Fix cycle 2. The cycle-1 verdict FAILED this unit, and the headline finding is the one worth
 * remembering: the guard matched TEXT, not addresses. It took the substring after the last colon
 * and unwrapped it only when that looked like dotted-quad — so `64:ff9b::127.0.0.1` blocked while
 * `64:ff9b::7f00:1`, THE SAME ADDRESS, was allowed. Blocking one spelling while allowing another
 * is not a control. `isBlockedAddress` now parses into 8 groups and judges the numbers.
 */
for (const [label, ip] of [
  ["NAT64 in hex form", "64:ff9b::7f00:1"],
  ["NAT64 in dotted form (same address)", "64:ff9b::127.0.0.1"],
  ["6to4 wrapping loopback", "2002:7f00:0001::1"],
  ["6to4 wrapping 192.168.1.1", "2002:c0a8:0101::1"],
  ["IPv4-mapped loopback in hex", "::ffff:7f00:1"],
  ["IPv4-compatible loopback", "::127.0.0.1"],
  ["site-local fec0::/10", "fec0::1"],
  ["Teredo 2001::/32", "2001:0:1::1"],
  ["bracketed loopback", "[::1]"],
  ["link-local with a zone id", "fe80::1%eth0"],
] as [string, string][]) {
  test(`ISS-006: blocks ${label} (${ip})`, () => {
    assert.equal(isBlockedAddress(ip), true, `${ip} reaches an internal address`);
  });
}

test("ISS-006: genuinely public IPv6 is still allowed, including public 6to4 and mapped", () => {
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
  assert.equal(isBlockedAddress("2002:5db8:d822::1"), false, "6to4 wrapping a public v4");
  assert.equal(isBlockedAddress("::ffff:93.184.216.34"), false, "mapped public v4");
});

test("ISS-007: EVERY resolved address must pass, not just the first", async () => {
  // A host publishing one public and one private record gives the resolver a coin flip on every
  // fetch -- no rebinding, no timing. Checking one address and connecting to another is not a
  // control, so all of them are checked.
  const { f, seen } = fetcher({ lookup: { "split.example": ["93.184.216.34", "10.0.0.7"] } });
  await assert.rejects(() => f("https://split.example/"), /blocked|private/i);
  assert.deepEqual(seen, [], "the request must never be issued");
});

test("ISS-007: an empty resolver answer fails CLOSED", async () => {
  const { f, seen } = fetcher({ lookup: { "void.example": [] } });
  await assert.rejects(() => f("https://void.example/"), /blocked|no addresses/i);
  assert.deepEqual(seen, []);
});

test("ISS-009: an oversized body is refused on a REDIRECT hop too, not only the final one", async () => {
  const { f } = fetcher({
    lookup: { "a.example": "93.184.216.34", "b.example": "93.184.216.35" },
    responses: {
      "https://a.example/": { status: 302, location: "https://b.example/x", body: "x".repeat(5000) },
      "https://b.example/x": { status: 200, body: "small" },
    },
    maxBytes: 1000,
  });
  await assert.rejects(() => f("https://a.example/"), /too large|size/i);
});
