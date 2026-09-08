# Contract — watched-sources-run

**Status:** active
**Authored by:** checker, 2026-09-08 (cycle 1 of `watched-sources-run`, at the maker's request in
the manifest — no contract existed for the composition).
**North star:** catalogue **A13** — Watched Sources.
**Owns:** `packages/ingest/src/watched/run.ts`, `packages/ingest/src/sources/node-transport.ts`,
`POST /watched-sources/run` in `apps/api/src/routes/watched-sources.ts`, and the production
composition in `apps/api/src/store.ts` (`createMongoWatchedSourceDeps().run`).
**Inherits:** `watched-sources-entrypoint.md` `[I1]` (structural tenant isolation), `[I3]`
(stored SSRF surface), `[I5]` (A13 does not score REAL on reachability); `guarded-fetcher.md`
`[C1]`, `[C2]`, `[C7]`, `[I2]`.

## Scope boundary

This contract governs the **composition and the real transport**: the single call that turns
`listActive` → `isDueForCheck` → guarded fetch → `recordFetch` into something that runs, the
`node:` code that actually opens a socket, and the wiring that decides *which* fetcher production
gets. It does **not** own the guard's range tables (`guarded-fetcher.md`), the admission route
(`watched-sources-entrypoint.md`), re-ingestion of changed content (T-023's `createUrlSource`), or
a real scheduler/timer.

The two prior units were built with **no caller at all**. That is the specific hazard this contract
exists to police: every property those units proved was proved against injected fakes, and this is
the unit where the fakes are replaced by sockets and by a production composition root.

## Acceptance criteria

- **[C1] The chain exists as one tenant-scoped call.** `runWatchedSources(tenantId, deps)` reads
  active sources, filters with `isDueForCheck`, fetches+hashes with `checkWatchedSource`, and
  persists with `recordFetch`, returning counts of checked / changed / skipped / failed.
- **[C2] Failure isolation is total, not fetcher-specific.** A throw from *any* per-source step —
  the fetcher, the hasher, or `recordFetch` — is recorded against that source and the run
  continues. A blocked target is the expected case for unattended fetches of user-supplied URLs.
- **[C3] The transport never follows redirects** (`redirect: "manual"`). Following a hop inside the
  transport steps past the guard, which re-resolves and re-checks every hop; that is the whole
  control.
- **[C4] The transport resolves EVERY address** (`all: true`). One address reinstates the coin-flip
  bypass ISS-C-UNRUN-WRITERS-007 closed.
- **[C5] The transport bounds size and duration at the socket.** An oversized body is abandoned
  mid-stream rather than allocated and then measured; the request is genuinely cancelled at the
  deadline via `AbortSignal`, not merely raced by the caller.
- **[C6] The transport's network-facing behaviour is proven against a real HTTP server, not only in
  the guard's fakes.** Removing `redirect: "manual"`, the size abort, or the `AbortSignal` must
  each fail at least one test. This is the only code in the feature that touches the network, and
  it is the code whose correctness the guard's every control assumes; `guarded-fetcher.md` `[I2]`
  already refuses an untested branch in a security guard, and this criterion applies the same
  standard to the layer beneath it.
- **[C7] The transport connects to a pinned, pre-approved address.** The address the guard approved
  must be the address the socket connects to, with the original Host header and SNI preserved.
  A transport that re-resolves the URL leaves the check→connect window open, which is the DNS
  rebinding path the whole guard exists to close. (Ruled BLOCKING on this unit at cycle 2 of
  `guarded-fetcher` — ISS-C-UNRUN-WRITERS-011 — and recorded there precisely so it could not be
  lost between two units neither of which owned it.)
- **[C8] The production composition is asserted by a test.** Replacing the guarded fetcher in
  `store.ts` with a bare `fetch` must fail at least one test. A security boundary that one word can
  remove silently is not a boundary; the repo already contains this exact style of assertion
  (`store.ts imports treeIndexRootFilter and both its tree_index call sites use it`).
- **[C9] The run route passes the authenticated tenant.** `POST /watched-sources/run` derives the
  tenant from `req.auth`, never from body or query, and a test fails if it does not. The test fake
  must actually observe the tenant argument — a fake whose `run` ignores it cannot fail an
  isolation test (`watched-sources-entrypoint.md` `[I1]`).
- **[C10] The run route is behind authentication and the `sources` scope**; a key without it gets
  403.
- **[C11] Per-source failures are reported, not signalled as a server error.** A run in which some
  or all sources were refused returns 200 with the summary; the counts, not the status code, carry
  the per-source outcome.

## Invariants

- **[I1] The transport is the only code in the feature that touches the network**, and the guarded
  fetcher is the only thing composed with it in production.
- **[I2] One bad source never abandons the run.**
- **[I3] A run must not silently claim work it did not do.** A persistence call that reports it
  matched nothing is not a successful check, and must not be counted as one.
- **[I4] (inherited) A13 does not flip on reachability.** A reachable chain is not a run against
  live data. A placeholder row written to move a probe is a falsified measurement, never
  acceptable.
- **[I5] The run is bounded.** An unattended, network-bound loop invoked from an HTTP request must
  not be able to occupy a request handler for an unbounded time, and two concurrent runs must not
  double-fetch the same sources.

## Out of scope / ignore

- Re-ingestion of changed content (T-023 `createUrlSource`) and the scheduler/timer.
- Update / delete / deactivate routes; any `apps/web` UI.
- Cosmetic concerns: response envelope naming, comment length, export granularity.

## Amendment log

- 2026-09-08 · routine · Initial contract authored by the checker at cycle 1, at the maker's
  request. `[C1]`–`[C5]`, `[C10]`, `[C11]` derive from the unit's stated purpose and the three
  safety properties the manifest names. `[C6]`, `[C7]`, `[C8]`, `[C9]`, `[I3]`, `[I5]` are written
  from findings produced during this check (mutation table + a local-HTTP-server probe), recorded
  as criteria rather than as one-off issue text so the next cycle inherits them. `[C7]` is not new:
  it is ISS-C-UNRUN-WRITERS-011's blocking ruling, promoted from the ledger to the contract now
  that the unit it blocks has arrived.
