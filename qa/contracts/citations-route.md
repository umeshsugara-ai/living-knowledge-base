# Contract — citations-route (plan §10 U0.8)

> Ground truth for `GET /citations/:claimId` — `apps/api/src/routes/citations.ts`,
> `createMongoCitationsDeps()` in `apps/api/src/store.ts`, and `fakeCitationsDeps()` in
> `apps/api/src/fixtures.ts`. Created and adopted by /checker in the same action: the manifest
> explicitly deferred contract-writing to the checker per the project's segregation-of-duties
> rule (ISS-006), so there is no separate maker draft to react to — this file *is* the first
> draft, written from the manifest's proposed criteria plus this checker's own independent read
> of the route, the store wiring, `server.ts`, and `stubs.ts`.
>
> **Why this contract exists:** this route un-stubs a real `501` into a real read path over
> `claims`/`turns`/`sessions`. The risk this contract guards against is narrow but sharp: a claim
> resolving to a citation whose evidence silently omits a deleted turn/session (making a real
> data-integrity gap invisible instead of visible), or the 404-vs-501 distinction collapsing back
> into one status code (making "unknown claim" indistinguishable from "not built yet").

## Scope

`apps/api/src/routes/citations.ts` (`CitationsDeps`, `createCitationsRouter`),
`createMongoCitationsDeps()` in `apps/api/src/store.ts`, `fakeCitationsDeps()` in
`apps/api/src/fixtures.ts`, the route's mount order in `apps/api/src/server.ts`, and its removal
from `STUB_ROUTES` in `apps/api/src/routes/stubs.ts`. Out of scope: the `claims`/`turns`/
`sessions` accessors themselves (governed by `packages/db`'s own tests, unchanged by this unit),
and any future citation-adjacent feature (e.g. citation search/filtering) — a later unit's
contract, not this one's.

## Criteria (each machine-checkable)

1. **[C1] Injected-deps pattern matches `routes/brain.ts`.** `CitationsDeps.getCitation(tenantId,
   claimId)` is the sole injection point; the router never imports `@lkb/db` or touches Mongo
   directly. Verified by reading the file — no `getDb`/`*Coll` import in `citations.ts`.
2. **[C2] 404, never 501, for an unknown claim id.** A `null` return from `getCitation` maps to
   `404 {error: "not_found", ...}`, distinct from `stubs.ts`'s `501 not_implemented`. Machine-
   checked by `citations.test.ts`'s "unknown id returns 404, not a stub 501" test and by the
   mutation test below.
3. **[C3] `citations` scope required.** The route is mounted behind `requireScope("citations")`;
   a key lacking that scope gets `403`, never a silent `200`. Machine-checked by
   `citations.test.ts`'s scope test.
4. **[C4] Per-evidence-item null-safety.** Each `CitationEvidence.turn`/`.session` is
   independently `null` when the referenced row is missing — one missing row never fails the
   whole citation. Verified by reading `createMongoCitationsDeps()`: `turn`/`session` are resolved
   via `findOne(...) ?? null` per evidence entry, in parallel via `Promise.all`, never a single
   combined failure path.
5. **[C5] Real route wins over the removed stub.** `/citations/:claimId` is absent from
   `STUB_ROUTES` in `stubs.ts`, and `createCitationsRouter` is mounted in `server.ts` before
   `createStubsRouter()`. (Both conditions matter for defense-in-depth: Express registration
   order alone would suffice, but the stub entry must also be gone or `docs-ui`'s route table —
   which renders directly from `STUB_ROUTES` — would misreport this route as still-stubbed.)
6. **[C6] Build stays green.** `pnpm --filter @lkb/api typecheck`, `pnpm -r typecheck`, and
   `pnpm --filter @lkb/api test` (all tests, including the 3 new `citations.test.ts` tests and the
   pre-existing stub-501 test) all pass.
7. **[C7] Mutation-provable.** Reverting the 404 condition (`if (!citation)` → `if (false)`) must
   redden exactly the "unknown id returns 404" test and no other — proving the test actually
   exercises that branch, not merely asserting a status code coincidentally already true.
8. **[C8] Structure budget.** `pnpm lint:structure` exits 0 with these files tracked in git.

## Invariants

- **[I1] Evidence integrity is visible per-item, never all-or-nothing.** An accessor change that
  makes a missing turn/session throw (instead of resolving to `null`) collapses a data-integrity
  signal into an opaque 500 and must be rejected even if it still typechecks.
- **[I2] 404 and 501 must never re-collapse into one code.** Any future edit that makes
  `/citations/:claimId` fall through to the stub handler (e.g. a mount-order regression, or the
  stub entry being re-added) violates C2/C5 and is a contract break, not a style nit.
- **[I3] The route stays read-only.** No write path is added to `CitationsDeps` under this
  contract — citation evidence resolution is inherently read-only; a future write capability
  needs its own manifest and, per ISS-006, its own checker-authored contract amendment or new
  file, not a drive-by extension of this one.

## Out of scope / ignore
- Citation search, filtering, or pagination: not built, not claimed by this unit.
- The `claims`/`turns`/`sessions` accessors' own correctness: governed by `packages/db`'s tests.
- `docs-ui`'s rendering of `STUB_ROUTES` as a table: covered by `server.test.ts`'s own docs-ui
  tests, unchanged by this unit beyond the entry removal itself (C5).

## Amendment log
- 2026-09-08 · routine · Contract CREATED and ADOPTED by /checker in the same action on the
  `citations-route` cycle-1 check, from the manifest's proposed criteria (deferred per ISS-006
  segregation-of-duties) plus this checker's own independent verification of `citations.ts`,
  `store.ts`'s `createMongoCitationsDeps()`, `server.ts`'s mount order, `stubs.ts`'s removed
  entry, a fresh mutation test (reverted `if (!citation)` → `if (false)`, confirmed exactly the
  404 test reddens, restored, confirmed 3/3 green), and independently re-derived
  typecheck/test/lint:structure/catalogue-score results. START stands on plan §10 U0.8.
