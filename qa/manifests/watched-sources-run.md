# Manifest — watched-sources-run

**Contract:** `qa/contracts/watched-sources-entrypoint.md` + `qa/contracts/guarded-fetcher.md`.
Checker: please author `qa/contracts/watched-sources-run.md` for the composition.
**Goal task:** T-027 / catalogue **A13**.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** none new. **Closes the orphan:** the guarded fetcher had no caller.
**Status:** ready-for-check
**Branch:** `lane/c-unrun-writers`

## Why — and a course correction

T-027 built every piece of Watched Sources and wired none of them. `listActive` →
`isDueForCheck` → `checkWatchedSource` → `recordFetch` has **never existed as a single call**, so no
watched source has ever actually been fetched.

I then spent three fix cycles and six checker rounds perfecting a **guarded fetcher that nothing
called** — the same pattern I criticised in the search-store seam this morning. The honest order
was to build the composition first and discover the guard was needed. This unit is that correction:
it makes the chain real end-to-end.

## What changed

| File | Change |
|---|---|
| `packages/ingest/src/watched/run.ts` | **new** — `runWatchedSources`, the missing composition. |
| `packages/ingest/src/watched/run.test.ts` | **new** — 7 tests, written first. |
| `packages/ingest/src/sources/node-transport.ts` | **new** — the real transport. |
| `packages/ingest/src/sources/node-transport.test.ts` | **new** — 2 tests. |
| `apps/api/src/routes/watched-sources.ts` | `POST /watched-sources/run`. |
| `apps/api/src/store.ts` | composes the guarded fetcher with the real transport. |

## The three properties that make this safe rather than merely working

1. **One bad source never abandons the run.** These are unattended periodic fetches of
   user-supplied URLs, so a blocked or dead target is the **normal** case — the guard is *expected*
   to refuse some by design. Failures are collected per source and returned; the run continues, and
   the route reports them in a 200 summary rather than a 500.
2. **The transport does not follow redirects** (`redirect: "manual"`). Following them there would
   step straight past the guard, which re-resolves and re-checks every hop. That is the whole
   control.
3. **`resolveAll` returns every address** (`all: true`). Returning one would reinstate the coin-flip
   bypass ISS-007 closed — a host publishing one public and one private A record.

It also closes **ISS-015** at the layer that owns the socket: `AbortSignal.timeout` genuinely
cancels the in-flight request, which `Promise.race` in the guard could not do. The body is read in
chunks and abandoned mid-stream past `maxBytes`, rather than allocated and then measured.

`store.ts` is the feature's **SSRF boundary** — swap that one line for a bare `fetch` and every
control in `guarded-fetch.ts` is bypassed while every test still passes. Called out in the code.

## Evidence

```
$ pnpm --filter '@lkb/ingest' test   tests 88   pass 88   fail 0   cancelled 0
$ pnpm --filter '@lkb/api'    test   tests 134  pass 134  fail 0   cancelled 0
$ pnpm -r typecheck                  exit 0
$ pnpm lint:structure                green; depcruise 286 modules / 0 violations
```

`cancelled` is now reported alongside `fail`: the cycle-3 checker showed Node counts a timed-out
test under `cancelled`, so a `fail 0` summary can hide a killed mutant — my own harness did exactly
that.

Also renamed `TransportResponse` → `HttpTransportResponse` and `request` → `httpRequest` after
`lint-dupes` caught a collision with `packages/ai/src/provider.ts`.

## Known gaps

1. **A13 still does not flip on this unit** — the chain is reachable but no row has been written or
   run against live data. It flips when a real `POST /watched-sources` then `POST
   /watched-sources/run` happens and appears in a live-verify artifact. I am **not** writing a
   placeholder row to move a probe.
2. **No changed-content reaction.** A changed hash is recorded and counted; nothing re-ingests. The
   pipeline back into `sources`/`sessions` is T-023's `createUrlSource` and is a separate unit.
3. **No scheduling trigger.** The run is invoked by a route, not a timer — deliberately: a real
   scheduler is an ops concern and the route makes the whole chain testable first.
4. **The transport is untested against real HTTP.** Its two tests cover `resolveAll` only; `fetch`
   itself is not exercised, so redirect/size/timeout behaviour is proven in the guard's fakes, not
   against a live server.

## Note to the checker

Gap 4 is the one I would push on: the transport is the only code here that touches the network and
it has the least coverage. Judge whether that is acceptable, or whether this unit needs a local
HTTP server fixture proving `redirect: "manual"`, the size abort and the `AbortSignal` actually
behave against real sockets. If you think so, FAIL it — I would rather find out now than after
something is scheduled against it.
