# Manifest — watched-sources-run

**Contract:** `qa/contracts/watched-sources-entrypoint.md` + `qa/contracts/guarded-fetcher.md`.
Checker: please author `qa/contracts/watched-sources-run.md` for the composition.
**Goal task:** T-027 / catalogue **A13**.
**Date:** 2026-09-08
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** none new. **Closes the orphan:** the guarded fetcher had no caller.
**Status:** ready-for-check (cycle 2)
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

---

# Fix cycle 2 — responding to the cycle-1 FAIL

FAILed 7/11. The serious finding is the one I flagged against myself and the checker confirmed was
worse than I described.

## ISS-011 (high) — the guard's decision was advisory, not binding

`httpRequest` called `fetch(url)`, so **the OS resolved the hostname again**, independently of the
addresses the guard had just vetted. The guard could approve `93.184.216.34` and the connection
still land on `169.254.169.254`, because nothing carried the decision across. Reachable in
production via `store.ts` → `production.ts`.

**A control the next layer is free to ignore is advice.**

**Fix:** the approved address now travels with the request (`opts.address`), and the transport uses
`node:http`/`node:https` instead of `fetch` — for one reason: they accept a custom `lookup`, which
is the supported way to say *connect to this address*. The hostname still travels in the `Host`
header and in `servername`, so the server sees a normal request and **TLS still verifies against
the name** — only the address is pinned.

## ISS-016 (high) — the only network-touching code had no behavioural test

Deleting `redirect: "manual"`, the size abort or the `AbortSignal` each left the suite green.
Now tested against a **real socket** via `http.createServer`. The pin test is the interesting one:
the URL names a host that does not resolve to the server, so the request can *only* arrive via the
injected address — if pinning regresses, it cannot connect at all.

## Evidence

```
$ pnpm --filter '@lkb/ingest' test   tests 93   pass 93   fail 0   cancelled 0
$ pnpm -r test                       apps/api 134/0, meeting-bot 40/0 — all green
$ pnpm -r typecheck                  exit 0
$ pnpm lint:structure >/dev/null 2>&1; echo $?   → 0
```

**Mutation table** (baseline 93/0), pure-Python harness under D-020, restores asserted
byte-identical:

| mutation | result |
|---|---|
| **unpin — resolve the hostname instead** | **88 / 5** |
| remove the size abort | 92 / 1 |
| neuter the timeout | 92 / 1 |
| **do not destroy the redirect body stream** | **93 / 0 — UNPINNED, see below** |
| **no-op control** | **93 / 0** |

### One line is not pinned, and I am not claiming it is

`res.destroy()` on the redirect path survives mutation. My test asserts the returned body is empty,
which holds either way because the body is never read into the response. So the `destroy()` is
**resource hygiene, not a control** — without it the socket keeps draining a body nobody uses.

I could have written a test that appears to cover it. Given ISS-137 two units ago — a fix declared
with nothing enforcing it — stating it plainly is the honest option. Low severity; worth a line in
whichever unit next touches this file.

## Known gaps

1. **`addresses[0]` is pinned, not all of them.** Every returned address is *checked*; the first is
   *used*. That is correct and closes the window, but if the first is unreachable there is no
   failover to the second — an availability limit, not a security one.
2. **No TLS test.** The pin is exercised over plain HTTP; `servername`/certificate behaviour under
   a pinned address is reasoned, not proven. A real HTTPS fixture needs a self-signed cert.
3. **A13 still does not flip.** Nothing has run against live data, and no placeholder row will be
   written to move a probe.

## Note to the checker

Gap 2 is where I would push: the whole point of `servername` is that TLS still validates the
hostname while the address is pinned, and that is exactly the part not proven. If you think this
unit needs a self-signed HTTPS fixture before anything is scheduled against it, FAIL it.
