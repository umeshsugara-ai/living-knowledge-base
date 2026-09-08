# Contract — guarded-fetcher

**Status:** active
**North star:** `.goal/goal.json` — A13 (watched sources re-fetch/diff over time).
**Owns:** `packages/ingest/src/sources/guarded-fetch.ts` and its tests.
**Inherits:** `[I3]` of `watched-sources-entrypoint.md` — the SSRF defence that contract
deliberately deferred to this unit. This file is where that debt is now judged.

## Scope boundary

This unit owns the *outbound request primitive*: given a URL, either return its body or refuse.
It does not own the scheduler, the diff, or the wiring into `createUrlSource`. Nothing in the
repo calls it yet, which is the point at which its shape is cheapest to get right — a seam
changed before it has callers costs nothing, and after it has callers costs a migration.

## Acceptance criteria

- **[C1] The verdict is on the resolved address, at fetch time, uncached.** The address checked
  must be the one DNS returned immediately before this request. A verdict computed at
  registration, or cached across hops or across calls, reopens the rebinding window this unit
  exists to close.
- **[C2] Every redirect hop is re-resolved and re-checked.** A public URL that 302s to a private
  one must be refused at the hop, not followed. Non-`http(s)` redirect targets are refused. The
  hop count is bounded.
- **[C3] The IPv4 range table covers the internal and reserved space:** `0.0.0.0/8`, `10/8`,
  `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `192.0.0.0/24`, `100.64/10` (CGNAT),
  `198.18/15` (benchmarking), and everything `>= 224.0.0.0` (multicast, reserved, broadcast).
- **[C4] The IPv6 range table covers the internal space AND every prefix that embeds an IPv4
  address.** `::`, `::1`, `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8`, and — judged on the
  **embedded v4, in BOTH dotted and hex-group notation** — `::ffff:0:0/96` (v4-mapped),
  `::/96` (v4-compatible), `2002::/16` (6to4), `64:ff9b::/96` (NAT64), `2001::/32` (Teredo).
  An attacker controls their own AAAA record, so any prefix whose address bits are routed by an
  embedded v4 is a direct path to the ranges `[C3]` blocks. Blocking the dotted spelling while
  allowing the hex spelling of the same address is not a control.
- **[C5] Fails closed.** Empty, unparseable, unresolvable, or non-`http(s)` input is refused.
  A parser disagreement must never resolve toward "allow".
- **[C6] The module's claims match the module's behaviour.** Any comment, docstring, or commit
  message stating what window the guard closes must be true of the code as written, and any
  residual window (notably: the address checked is not pinned to the address connected to) must
  be stated in the same place rather than implied away.
- **[C7] Resource bounds actually bound.** A declared byte cap must constrain what is read, not
  merely be asserted after the whole body is already in memory, and it must apply on redirect
  hops too. An unattended timer-driven fetcher must bound request *duration* as well as size.

## Invariants

- **[I1] The table only ever tightens.** Adding a blocked range is routine. Removing or narrowing
  one is a CRITICAL amendment requiring the human — a security range is never dropped because a
  test or a caller is inconvenienced by it.
- **[I2] `lookup` and `request` are injected.** The unit is fully testable with no network, and
  every blocked range is exercised by a test that fails when the range is removed. A range in
  the table with no test is an untested branch in a security guard, one refactor from deletion.
- **[I3] (inherited) A stored watched source is a future outbound request target.** The
  network-level defence lives here, on the resolved IP after DNS. This unit MUST NOT be accepted
  without it.

## Out of scope / ignore

- The real transport (`node:https` / undici) behind the injected `request` — a later unit.
- Wiring into `createUrlSource` / the scheduler.
- Allow-listing, per-tenant policy, robots.txt, rate limiting.
- Cosmetic concerns: comment length, error-string wording, export granularity.

## Amendment log

- 2026-09-08 · routine · Initial contract authored by the checker at cycle 1 of `guarded-fetcher`,
  no contract having existed. `[C1]`/`[C2]`/`[C5]` derive from the cycle-1 placement ruling on
  `watched-sources-entrypoint` `[I3]`. `[C3]`/`[C4]` were written by enumerating the ranges
  against the submitted table and probing each one. `[C4]`'s v4-embedding clause and `[C6]` and
  `[C7]` are written from defects found in this check — recorded as criteria rather than as
  one-off issue text so the next cycle inherits them.
