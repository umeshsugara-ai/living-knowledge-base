# Verdict — watched-sources-run

**Date:** 2026-09-08
**Cycle checked:** 1
**Commit checked:** `d12232a`
**Project root:** `D:/KnowledgeBase-lanes/c-unrun-writers` (bound; no other worktree touched)
**Contracts:** `qa/contracts/watched-sources-run.md` (authored by this check, at the maker's
request), inheriting `watched-sources-entrypoint.md` and `guarded-fetcher.md`.

```
VERDICT: FAIL
SCOREBOARD: 7/11 criteria met, 4/5 invariants hold
FAILURES:
- [C7] sev: high · The transport does not pin the approved address — httpRequest calls bare fetch(url), so the OS re-resolves independently of the addresses the guard just checked, and the check→connect window stays fully open. This unit IS the transport unit that ISS-C-UNRUN-WRITERS-011 was ruled BLOCKING on, and store.ts:294 → production.ts:87 makes the window reachable in the production path rather than theoretical · Connect to the approved address with the original Host header and SNI (node:https `lookup` option, or undici with a pinned connector), or state plainly why that is a separate unit and get it ruled on before a scheduler is pointed at this · issue: ISS-C-UNRUN-WRITERS-011
- [C6] sev: high · All three of the transport's network-facing safety properties survive mutation — deleting `redirect: "manual"`, the size abort, or the `AbortSignal` each leaves ingest at pass 88 / fail 0 / cancelled 0. The only network-touching code in the feature is the only code with no behavioural test · A local http.createServer fixture; the checker wrote one and all three passed against real sockets first time, so this is ~40 lines, not a redesign · issue: ISS-C-UNRUN-WRITERS-016
- [C8] sev: medium · The SSRF boundary can be swapped for a bare fetch with apps/api still at 134/134 — the maker's own claim, reproduced · Assert the composition, in the style the suite already uses for treeIndexRootFilter, or brand the guarded fetcher so the run refuses an unbranded one · issue: ISS-C-UNRUN-WRITERS-017
- [C9] sev: medium · POST /watched-sources/run's tenant argument is unpinned: `deps.run(req.auth!.tenantId)` → `deps.run("other-tenant")` passes 134/134, because fixtures.ts:131's fake `run` takes no argument and cannot observe one — the exact fake anti-pattern entrypoint [I1] names · Make the fake record its tenant and assert it, as create and listActive already do · issue: ISS-C-UNRUN-WRITERS-018
- [I3] sev: medium · recordFetch's `matchedCount > 0` boolean is discarded, so a run that persisted nothing returns {checked:2, changed:2, failed:[]} — a true-looking summary for work that did not happen · Treat `false` as a per-source failure, the shape a throw already gets · issue: ISS-C-UNRUN-WRITERS-019
ISSUES-WRITTEN: ISS-C-UNRUN-WRITERS-016, -017, -018, -019, -020 (new); -011 escalated medium→high; -015 marked fixed
EXPLANATION: The composition itself is right and it is the correct course correction — the chain
finally exists, failure isolation is real (a throwing hasher and a throwing recordFetch are both
isolated, not just a throwing fetcher), and every behavioural claim in the manifest reproduced
under my own probes. It fails on the layer beneath: the transport arrives without the address
pinning a prior cycle ruled blocking on precisely this unit, and without a single test over the
three properties the guard's every control assumes. Both are cheap — I proved the transport's
behaviour correct with a 40-line local server in one run, which is the same fixture the fix needs.
```

## What I re-ran myself

| Command | Result | Manifest claim |
|---|---|---|
| `pnpm --filter '@lkb/ingest' test` | tests 88 · pass 88 · fail 0 · cancelled 0 | matches |
| `pnpm --filter '@lkb/api' test` | tests 134 · pass 134 · fail 0 · cancelled 0 | matches |
| `pnpm -r typecheck` | exit 0 | matches |
| `pnpm lint:structure` | exit 0 · depcruise 286 modules / 0 violations · SNAPSHOT fresh · tracker G1 OK | matches |

Every pasted number reproduced. `cancelled` is now reported and is 0 in both suites — the D-020
lesson is genuinely applied, and I grepped for it in every mutation run below as well.

## Mutation table (with a no-op control, D-020 restore-on-trap, `cmp`-verified)

Each mutant applied to the working tree, suite run under `timeout 300`, file restored from a
byte-compared backup before the next. Working tree confirmed clean afterwards (`git status
--porcelain` empty, probe file removed).

| # | Mutation | pass / fail / cancelled | Killed? |
|---|---|---|---|
| M0 | control: appended a comment to `run.ts` | 88 / 0 / 0 | — (control clean) |
| M1 | `if (!isDueForCheck(...))` → `if (false)` | 86 / 2 / 0 | **yes** |
| M2 | failure isolation removed (`catch { throw err }`) | 86 / 2 / 0 | **yes** |
| M3 | `redirect: "manual"` deleted | 88 / 0 / 0 | **no** |
| M4 | `signal: AbortSignal.timeout(...)` deleted | 88 / 0 / 0 | **no** |
| M5 | size abort neutered (`if (false)`) | 88 / 0 / 0 | **no** |
| M6 | `{ all: true, verbatim: true }` → `{ verbatim: true }` | 87 / 1 / 0 | **yes** |
| M7 | `createGuardedFetcher(...)` → bare `fetch` in `store.ts` | 134 / 0 / 0 | **no** |
| M8 | `requireScope("sources")` removed from `/run` | 133 / 1 / 0 | **yes** |
| M9 | `deps.run(req.auth!.tenantId)` → `deps.run("other-tenant")` | 134 / 0 / 0 | **no** |

The composition's own tests are load-bearing (M1, M2, M6, M8). Everything that survives is in the
transport or in the wiring — the two things this unit added that nothing else covers.

## The three safety properties, probed against real sockets

The maker asked me to judge these rather than take them on the fakes, so I ran the transport
against a local `http.createServer` (probe file written under `packages/ingest/src/`, run with
`tsx`, deleted before this verdict; tree verified clean).

| Probe | Result |
|---|---|
| P6 plain 200 | `{status:200, location:null, body:"hello"}` |
| P7 302 with a `Location` and a body | `{status:302, location:"…", body:""}` — **not followed, body not read** |
| P8 streamed multi-MB body, `maxBytes: 50_000` | threw `node-transport: response too large (> 50000 bytes)` — aborted mid-stream |
| P9 server sleeping 3000ms, `timeoutMs: 300` | threw `The operation was aborted due to timeout` after **308ms** |
| P10 guarded fetch of `http://127.0.0.1:<port>/ok` | blocked — `resolves to a private or reserved address (127.0.0.1)` |
| P11 guarded fetch of `http://localhost:<port>/ok` | blocked — `(::1)` |

**All three properties are correct as written.** That is why `[C3]`, `[C4]` and `[C5]` are marked
met and why ISS-015 moves to `fixed`: `AbortSignal.timeout` genuinely tears the socket down, and
because `guarded-fetch.ts:232` hands it the *remaining* total budget (`left`), the transport's own
deadline coincides with the guard's rather than granting a fresh one per hop. P10/P11 also confirm
the composed production path refuses loopback end to end, which is the first time in this feature
that has been demonstrated outside a fake.

## Failure isolation, probed beyond the fetcher

The manifest's property 1 is tested only through a throwing fetcher, so I probed the other two
per-source steps directly:

- throwing `hasher` → `{checked:0, changed:0, skipped:0, failed:[{id:"a",…},{id:"b",…}]}` — isolated
- throwing `recordFetch` → both sources reported as failures, run completes — isolated
- throwing `listActive` → the run throws (correct: there is no per-source context yet, and the
  route's 500 is the honest signal for "could not read the source list")
- throwing `now()` → the run throws. `now` is called once before the loop; a throwing clock is not
  a realistic failure mode. Noted, not filed.
- `recordFetch` returning **`false`** → `{checked:2, changed:2, failed:[]}`. **This one is a real
  hole** and is the `[I3]` failure above: the boolean the db layer deliberately returns is dropped.

So the property holds for the case the maker built it for and for two more I invented, and breaks
only on the non-throwing failure — which is the classic silent-failure shape, not a gap in the
isolation design.

## Rulings on the five questions the maker asked

**1. Is `store.ts` as the SSRF boundary acceptable, or does it need a structural guard?**
Confirmed fragile — M7 reproduces the claim exactly. **It needs a guard.** A composition root is
always where a swap is possible; what is not acceptable is that the swap is *silent*. Three fix
cycles and six checker rounds of range tables can be removed by one word with nothing on disk
objecting, and the module comment saying so is documentation, not a control. The cheapest fix is
already in this repo's own test suite: apps/api asserts that `store.ts` imports and uses
`treeIndexRootFilter` at both call sites. The same source-level assertion here costs one test.
A stronger option, if you want the guarantee at runtime rather than at test time: have
`createGuardedFetcher` brand the function it returns and have `runWatchedSources` refuse an
unbranded fetcher — that makes the boundary structural rather than conventional, which is what
`[I1]` of the entrypoint contract already demands of tenancy. Either satisfies `[C8]`; I am not
prescribing which.

**2. Does the transport need a local HTTP server fixture? Rule plainly.**
**Yes — and this is a FAIL, as you invited.** But read the shape of it precisely, because it is
better news than you feared: the code is *right*. I ran the fixture you were asking about and
`redirect: "manual"`, the size abort and the `AbortSignal` all behaved correctly against real
sockets on the first attempt (P7/P8/P9 above). What is missing is not correctness, it is the
guard against losing it: M3, M4 and M5 each delete one of those three properties and the suite
stays green at 88/88. Your own guarded-fetcher contract already refuses this exact situation one
layer up — `[I2]`, "a range in the table with no test is an untested branch in a security guard,
one refactor from deletion". `redirect: "manual"` is a one-word deletion that converts the whole
guard into decoration, and nothing would notice. The fixture took me about forty lines and one
run. Write it.

**3. Do the three safety properties hold in the composed path?**
Yes for all three, verified independently (P7, P10/P11 for the guard composition, and M6 kills the
`all: true` removal). Failure isolation holds for a throwing fetcher, hasher and `recordFetch`;
it does not cover `recordFetch` returning `false`, which is `[I3]` / ISS-019. `resolveAll` returns
every address and the run refuses loopback end to end through the real transport.

**4. Is 200 with per-source failures right, or should an all-failed run signal differently?**
200 is right, and I would resist changing it. This is a batch summary endpoint: the per-source
outcome is *data*, and a blocked target is the designed-for case, not an error of the run. An
all-failed run is not distinguishable from a partly-failed one in kind, only in degree, and
picking a threshold at which the status code flips would make the caller's parsing depend on
arithmetic rather than on the summary it already receives. `checked`, `changed`, `skipped` and
`failed[]` say everything a caller needs. Two things I would ask for instead: the run currently
returns 200 for "zero sources were due" and "every source was refused" with the same shape, so
a caller cannot alert on the second without doing the arithmetic itself — worth one derived field
if anything ever alerts on this; and `listActive` throwing *does* correctly produce a 500, which is
the right place for the distinction to live. `[C11]` met, no issue filed.

**5. Is refusing to write a placeholder row to move A13 the correct call?**
**Yes, unreservedly, and it is the most important sentence in the manifest.** A13's substance is
re-fetching and diffing a watched source over time; a row written to satisfy a probe measures the
probe, not the feature. `watched-sources-entrypoint.md` `[I5]` already says a probe scoring A13
REAL on row count is wrong and must be human-downgraded — writing the row yourself would have been
the same error with an extra step, and it would have been the one kind of defect no later check
could detect, because the artifact would look exactly like success. Recorded as `[I4]` of the new
contract so it binds the next cycle too. A13 stays unflipped and that is the correct state.

## On the course correction

Worth saying: the manifest opens by naming the pattern — three fix cycles perfecting a fetcher
nothing called — and this unit fixes it. That is the right instinct and it produced a real result:
composing the pieces immediately surfaced two things no amount of further fake-testing would have
(the transport's untested surface, and the boundary at `store.ts`). It is also, precisely, why
`[C7]` fails now rather than later: the guard's honest-limit docstring said closing the window
"needs a transport that accepts a pinned address", the transport has arrived, and it does not. The
ledger row that carried that ruling forward is doing exactly what it was written to do.

## Fix cycle

Cycle 1 of max 3. Five failures, none requiring a redesign: one test fixture (`[C6]`), one
composition assertion (`[C8]`), one fake that observes its argument (`[C9]`), one `if` on a boolean
already being returned (`[I3]`), and one genuine design question (`[C7]` — pin the address, or
argue on the record that it belongs to a separate unit and get that ruled before anything is
scheduled against this).
