# Contract — watched-sources-entrypoint

**Status:** active
**Authored by:** checker, 2026-09-08 (cycle 1 — no contract existed; the manifest requested one)
**North star:** catalogue **A13** — Watched Sources. Goal task T-027 shipped the schema, the
tenant-scoped accessors and the pure due-check, all checker-PASSed, and no caller. This contract
governs the *entrypoint* only: the user action that can put a row in `watched_sources`.

## Scope boundary (read this before judging any future cycle)

This contract covers **reachability + admission control**: `POST /watched-sources` and
`GET /watched-sources`. It does **not** cover the scheduler (`listActive` → `isDueForCheck` →
`checkWatchedSource` → `recordFetch`), which is a separate unit and carries the invariants marked
`[I3]` below. A13 cannot score REAL under this contract alone — see `[I5]`.

## Acceptance criteria

- **[C1]** `POST /watched-sources` creates a watched source for the authenticated tenant and
  returns 201 with the stored document.
- **[C2]** `GET /watched-sources` returns that tenant's active watched sources, and only those.
- **[C3]** A `url` that is not an absolute `http:`/`https:` URL is rejected with 400 and **nothing
  is stored**. Explicitly covered: `javascript:`, `file://`, protocol-relative `//host`, relative,
  and empty. Scheme comparison is case-insensitive (WHATWG-normalised), so `HTTPS://` is accepted
  as https and is not a bypass.
- **[C4]** `reputationTier` is validated against the schema's exact enumeration
  (`official` | `community` | `blog`); anything else is 400.
- **[C5]** `checkIntervalHours` must be a finite number `> 0`. `0` is refused because
  `isDueForCheck` compares `elapsed >= interval` and would make the source permanently due.
- **[C6]** Both routes are behind authentication and require the `sources` scope; a key without it
  gets 403, never a silent 200, and an unauthenticated request gets 401.
- **[C7]** The route delegates to T-027's existing accessors. It does not reimplement Mongo access,
  and it does not modify T-027's schema, accessors or pure logic.
- **[C8]** The unit's tests are load-bearing: removing any one of the url check, the interval check,
  the scope guard, or the tenant argument makes at least one test fail (mutation-tested against a
  no-op control).

## Invariants

- **[I1] Tenant isolation is structural, not incidental.** The tenant id comes from
  `req.auth.tenantId` — never from the request body or a query parameter — and every store call
  passes it. The production path must go through `scopedCollection`, so a tenant-less query is a
  compile error. The test fake must be **partitioned by tenant**: a fake backed by one shared array
  cannot fail an isolation test, and would make `[C2]`'s "and only those" unfalsifiable.
- **[I2] Reject-and-store-nothing.** A rejected request must leave the collection unchanged. A 400
  that has already written is worse than no validation, because it looks safe.
- **[I3] A stored watched source is a future outbound request target.** The system will fetch these
  URLs on a timer with no user in the loop, which makes this a **stored SSRF surface**. The
  network-level defence — refusing loopback, link-local (`169.254.169.254`), RFC1918, and other
  internal destinations — **belongs at fetch time, in the fetcher unit, applied to the resolved IP
  after DNS**, because a store-time hostname check cannot survive DNS rebinding between
  registration and fetch. The fetcher unit MUST NOT be accepted without it. Recording it here so
  that it cannot be lost between two units neither of which owns it.
- **[I4] What is validated must be what is stored.** The value parsed by the validator and the
  value written to the collection should not be two different strings; a downstream fetcher using a
  different URL parser must not be able to resolve the stored value to a different host than the
  one this route approved.
- **[I5] A13 does not score REAL on reachability.** A13's substance is re-fetching, hashing and
  diffing a watched source over time. Rows in the collection, reached through this entrypoint, earn
  A13 **PARTIAL at most** — the same call already made on B3 and B10. Any probe or report that
  scores A13 REAL on row count alone is wrong and must be human-downgraded.

## Out of scope / ignore

- De-duplication of identical URLs (disclosed gap; tracked as a ledger issue, not a defect here).
- Update / delete / deactivate routes.
- Any `apps/web` UI.
- `recordFetch` remaining uncalled, and the `gaps` accessor set (A5/D8).
- Cosmetic concerns: `_id` generation style, response envelope naming, comment length.

## Amendment log

- 2026-09-08 · routine · Initial contract authored by the checker at cycle 1, at the maker's
  request in the manifest (no contract existed). Criteria derived from the unit's stated purpose,
  the T-027 accessors it wires, and the adversarial probing performed during the check; `[I3]`/`[I4]`
  added from findings that are real but out of this unit's scope, so the next unit inherits them.
