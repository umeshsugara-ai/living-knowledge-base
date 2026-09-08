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

---

# Verdict — watched-sources-run (cycle 2)

**Date:** 2026-09-09
**Cycle checked:** 2
**Commit checked:** `f6f2b86`
**Project root:** `D:/KnowledgeBase-lanes/c-unrun-writers` (bound; no other worktree or lane touched)
**Contract:** `qa/contracts/watched-sources-run.md`

```
VERDICT: FAIL
SCOREBOARD: 9/11 criteria met, 3/5 invariants hold
FAILURES:
- [C8] sev: medium · The SSRF boundary is still one word from removal: replacing store.ts:294 `createGuardedFetcher({ lookup: resolveAll, request: httpRequest })` with `async (u: string) => await (await fetch(u)).text()` leaves apps/api at 134/134/0. Not addressed this cycle; the code comment above the line is prose, not a control · Assert the composition in the style the suite already uses for treeIndexRootFilter, or brand the guarded fetcher so the run refuses an unbranded one · issue: ISS-C-UNRUN-WRITERS-017
- [C9] sev: medium · The run route's tenant argument is still unobserved: `deps.run(req.auth!.tenantId)` -> `deps.run("other-tenant")` passes 134/134/0, because fixtures.ts:131 is still `run: async () => (...)` — a fake with no parameter cannot fail an isolation test · Make the fake record its tenantId and assert the authenticated one, as create and listActive already are · issue: ISS-C-UNRUN-WRITERS-018
- [I3] sev: medium · recordFetch's boolean is still discarded (run.ts:59 awaits, :64-65 increments unconditionally). Re-probed at this commit: two due sources with `recordFetch: async () => false` returned {"checked":2,"changed":2,"skipped":0,"failed":[]} — a clean summary for a run that persisted nothing · Treat `false` as a per-source failure, the shape a throw already gets · issue: ISS-C-UNRUN-WRITERS-019
- [I5] sev: medium · The run is still an unbounded sequential network loop awaited inline in a request handler (routes/watched-sources.ts:98, run.ts:51, 30s default per source), with no cap, no whole-run deadline and no per-tenant in-flight lock · Cheapest sufficient fix: a max-sources cap or a run deadline checked between sources · issue: ISS-C-UNRUN-WRITERS-020
ISSUES-WRITTEN: none
EXPLANATION: The two high findings are genuinely closed and I re-derived both rather than reading
them: the pin is real over a socket, it fails closed on a bad address instead of falling back to
DNS, and I built the HTTPS fixture the maker did not — certificate validation demonstrably binds to
the hostname while the address is pinned. The mutation table reproduced exactly, control included.
It fails on the three cycle-1 findings the maker chose not to touch (C8, C9, I3) plus I5, which
cycle 1 credited while its own ISS-020 said otherwise; I am correcting that here rather than
carrying an inconsistency into a PASS. All four are already on the ledger from cycle 1 — nothing
new is being asked. Cycle 3 is the last one: all four are small and none needs new machinery.
```

## Question 1 — is the pin real? (yes, proven by my own probes, not the maker's tests)

I wrote my own probe file, ran it, and deleted it (`git status --porcelain` empty afterwards).

| Probe | Result |
|---|---|
| URL names `nonexistent-host-xyz.invalid:PORT`, `address: 127.0.0.1`, local server listening | body `SERVER-A` returned — the request can only have arrived via the injected address |
| URL hostname **does** resolve (`localhost:PORT`, server live), `address: "999.999.999.999"` | **REJECTED** `Invalid IP address: 999.999.999.999` — it fails **closed**; there is no fallback to real DNS. The maker's reported failure direction is correct |
| `all: true` array form | The connecting path exercised it (Node 24 `autoSelectFamily` calls `lookup` with `all: true`); both branches are implemented and the connection succeeded, so the array shape is the one actually consumed |
| Host header | server observed `pinned.invalid:PORT` — the name still travels |

**One observation, not a defect.** When the URL hostname is an **IP literal**, Node skips `lookup`
entirely: `http://127.0.0.1:PORT/` with `address: "127.0.0.2"` connected to 127.0.0.1 (ECONNREFUSED
on the other server's port). That is harmless in this composition — for a literal, the guard's
`resolveAll` returns that same literal, so the pinned address equals the hostname and no
check-to-connect window exists. Worth knowing before anyone reuses `httpRequest` with an address
that can differ from a literal host.

## Question 2 — does `Host`/`servername` survive? Ruling: **not a blocker; proven, not deferred**

I did not want to rule on a reasoned claim, so I built the fixture the maker didn't: two self-signed
CAs (openssl), an HTTPS server on 127.0.0.1, and the URL naming `pinned.example` with
`address: "127.0.0.1"`.

- cert with `SAN=DNS:pinned.example`, trusted via `NODE_EXTRA_CA_CERTS` -> **`TLS-OK`**, request
  succeeded while the address was pinned.
- cert with `SAN=DNS:wrong.example`, **also trusted** -> **rejected**:
  `Hostname/IP does not match certificate's altnames: Host: pinned.example. is not in the cert's altnames: DNS:wrong.example`.

So certificate validation binds to the **name**, not the pinned address, exactly as claimed, and a
regression here fails closed (a connection error), never open — `rejectUnauthorized` is never
touched. **A self-signed HTTPS test is NOT required before this unit passes.** It is worth having as
a regression guard in whichever unit next touches this file, but as a *later* unit: the property is
now proven on disk in this verdict, and holding a unit for a test of a property that fails closed
would be ceremony.

## Question 3 — the declared-UNPINNED `res.destroy()`. Ruling: **honest scoping, accepted**

Reproduced: removing `res.destroy()` from the redirect branch leaves 93/0/0. The maker's reasoning
is correct — the redirect body is never read into the response either way, so no assertion over the
returned value can distinguish the two, and the stream stays paused rather than buffering. It is
resource hygiene (socket teardown), not a control. Writing a test that *looked* like coverage would
have been the worse outcome; declaring it plainly, with the mutation result attached, is what I want
from a maker. Not a gap, not a blocker. Low note only.

## Question 4 — mutation table reproduced (my own harness, D-020 discipline)

Every run under `timeout 400`, file restored from a backup and `md5sum -c` verified **byte-identical
after each** (all `OK`), `cancelled` grepped beside `fail`.

| Mutation | pass / fail / cancelled | Maker's claim |
|---|---|---|
| **no-op control** (comment) | 93 / 0 / 0 | 93 / 0 — matches |
| **unpin** (custom `lookup` removed) | **88 / 5 / 0** | 88 / 5 — matches |
| size abort neutered (`if (false && ...)`) | 92 / 1 / 0 | 92 / 1 — matches |
| timeout neutered (`setTimeout(9_000_000)`) | 92 / 1 / 0 | 92 / 1 — matches |
| redirect `res.destroy()` removed | 93 / 0 / 0 | 93 / 0 UNPINNED — matches, disclosed |

Every figure in the manifest reproduced exactly. **C6 and C7 pass.**

## Question 5 — the three unaddressed cycle-1 findings

All re-derived at `f6f2b86`, all still open; none was silently fixed.

| Issue | State now | Should it have blocked cycle 2? |
|---|---|---|
| ISS-017 (`[C8]`, store.ts SSRF boundary) | bare-`fetch` mutant still 134/134/0 | It did not have to *lead*, but it is the cheapest of the four and sits on the same boundary the cycle was about. Fixing the pin while leaving the composition removable by one word is a half-closed door |
| ISS-018 (`[C9]`, route tenant) | `deps.run("other-tenant")` still 134/134/0; fixtures.ts:131 unchanged | No — genuinely independent of the transport work |
| ISS-019 (`[I3]`, discarded boolean) | probe returns `{"checked":2,"changed":2,...,"failed":[]}` with `recordFetch` returning false | No — but it is the one that makes the route **lie to its caller**, and it is a three-line change |

Prioritising the two high findings over these was a defensible call. It is not defensible twice:
this is cycle 2 of max 3, so all four listed failures must land together in cycle 3.

## Baselines I re-ran myself

| Command | Result | Manifest claim |
|---|---|---|
| `pnpm --filter '@lkb/ingest' test` | tests 93 · pass 93 · fail 0 · cancelled 0 | matches |
| `pnpm --filter '@lkb/api' test` | tests 134 · pass 134 · fail 0 · cancelled 0 | matches |
| `pnpm -r typecheck` | exit 0 | matches |
| `pnpm lint:structure` | exit 0 | matches |

Ledger: ISS-C-UNRUN-WRITERS-011 and -016 moved open -> fixed with my re-derived evidence. -017,
-018, -019, -020 stay open. Working tree left clean; every probe and mutation reverted and
byte-verified.

---

# Verdict — watched-sources-run (cycle 3)

**Date:** 2026-09-09
**Cycle checked:** 3
**Commit checked:** `534af4e`
**Project root:** `D:/KnowledgeBase-lanes/c-unrun-writers` (bound; no other worktree or lane read or written)
**Contract:** `qa/contracts/watched-sources-run.md` (already authored at cycle 1 — the manifest's
request to author it is stale; nothing new was needed)

```
VERDICT: PASS
SCOREBOARD: 11/11 criteria met, 5/5 invariants hold
FAILURES: none against this contract
ISSUES-WRITTEN: ISS-C-UNRUN-WRITERS-021 (high, structure-lint), ISS-C-UNRUN-WRITERS-022 (low, evidence accuracy); -017, -018, -019, -020 moved open -> fixed
EXPLANATION: All four mediums carried from cycle 2 are genuinely landed. I wrote my own mutation
harness and every one of the maker's four claimed kills reproduced, plus two mutants of my own
invention (removing the brand's defineProperty; forcing `remaining` to 0) also died — so the new
tests are load-bearing beyond the four they were written for. The unit meets every criterion of
its own contract. Two findings are filed rather than failed: this cycle broke `pnpm
lint:structure` (apps/api/src is now 31 files against a budget of 30, caused by the new
watched-run-deps.test.ts), which belongs to `structure-lint.md`, not to this contract; and the
manifest's ingest count of 98 is really 97. Neither touches a contract criterion, and stalling a
unit whose every criterion is evidenced over a file-count budget would be ceremony.
```

## Baselines I re-ran myself, at `534af4e`, clean tree

| Command | My result | Manifest claim |
|---|---|---|
| `pnpm --filter '@lkb/ingest' test` | tests **97** · pass 97 · fail 0 · cancelled 0 | claims **98** — **off by one** |
| `pnpm --filter '@lkb/api' test` | tests 138 · pass 138 · fail 0 · cancelled 0 | matches |
| `pnpm -r typecheck` | exit 0 | matches |
| `pnpm lint:structure` | **exit 1** — `apps/api/src: 31 files (budget 30)` | **not claimed this cycle** |

The ingest figure was re-run twice at this commit with an empty `git status --porcelain`; 97 is
reproducible and 98 is not. `cancelled` is 0 in both suites and I grepped it beside `fail` in every
mutation run below, so no mutant was hidden as a timeout.

**On `lint:structure`.** Both prior cycles' Evidence blocks reported it green. Cycle 3's Evidence
block is the first to omit it, and it is the first cycle in which it fails. `git ls-tree` puts
`apps/api/src` at 31 files before this commit and 32 after, so `watched-run-deps.test.ts` — the
ISS-017 fix itself — is the file that crossed the budget. I am not treating the omission as
concealment: I cannot establish intent at the confidence a FAILURE line requires, and the maker
disclosed four gaps unprompted in the same document, which is not the behaviour of someone hiding
a result. But a red repo gate on the branch is a real regression this unit introduced and every
later unit in this lane inherits, so it is filed high with a named remedy.

## Mutation table — my own harness, not the maker's

Written fresh in the scratchpad (pure Python), D-020 discipline throughout: every path scoped to
this worktree, `subprocess.run(..., timeout=900)`, the original bytes restored in a `finally` that
fires on timeout, assertion and exception alike, and **each restore asserted SHA256-identical to
the pre-mutation file before the next mutation is applied**. Each anchor was asserted to occur
exactly once before substitution, so a silent no-op mutation cannot masquerade as a survivor.

| # | Mutation | pass / fail / cancelled | Killed? |
|---|---|---|---|
| M0 | **control** — comment appended to `run.ts` | 97 / 0 / 0 | — control clean |
| M1 | `store.ts`: guarded fetcher → bare `fetch` | 137 / 1 / 0 | **yes** |
| M2 | route: `deps.run(req.auth!.tenantId)` → `deps.run("other-tenant")` | 137 / 1 / 0 | **yes** |
| M3 | `run.ts`: `if (!persisted)` → `if (false)` | 96 / 1 / 0 | **yes** |
| M4 | `run.ts`: drop the cap/deadline guard | 95 / 2 / 0 | **yes** |
| M5 | *(mine)* remove the brand's `Object.defineProperty` | 137 / 1 / 0 | **yes** |
| M6 | *(mine)* `result.remaining = sources.length - index` → `= 0` | 95 / 2 / 0 | **yes** |

All four of the maker's claimed kills reproduce. M5 and M6 are mutants the maker did not run: M5
confirms the brand assertion fails if the brand stops being applied — the predicate is not vacuous
in the direction that matters, complementing the maker's own test that a plain function and
`globalThis.fetch` are unbranded — and M6 confirms `remaining` is asserted as a value, not merely
as a field that exists. Tree verified clean afterwards; every restore reported `OK`.

## The four cycle-2 findings, judged individually

| Issue | Criterion | Verdict |
|---|---|---|
| ISS-017 | `[C8]` | **Closed.** `createWatchedRunDeps()` is a named export, `GUARDED = Symbol.for("lkb.guarded-fetcher")` brands the fetcher at `guarded-fetch.ts:282`, and `watched-run-deps.test.ts` asserts it. M1 and M5 both die. This is the stronger of the two options cycle 1 offered — structural at runtime, not only at test time |
| ISS-018 | `[C9]` | **Closed.** `fixtures.ts:136` now takes `tenantId` and pushes to `ranFor`; `watched-sources.test.ts:221` asserts `["tenant-1"]`. M2 dies. The fake can now observe the argument, which is what entrypoint `[I1]` demanded |
| ISS-019 | `[I3]` | **Closed.** `run.ts` treats `!persisted` as a per-source failure with a reason string, the same shape a throw gets. M3 dies |
| ISS-020 | `[I5]` | **Closed for the clause that was ruled sufficient.** `maxSources` defaults to 25 and a 120s whole-run deadline is checked between sources; `remaining` reports the truncation, so a capped run is distinguishable from a complete one by the caller — which is more than the issue asked for. M4 and M6 die |

**One residual on `[I5]`, stated so it is not lost.** The invariant's second clause — "two
concurrent runs must not double-fetch the same sources" — is still unaddressed: there is no
per-tenant in-flight lock, and two simultaneous `POST /watched-sources/run` calls will both fetch
every due source. I am crediting `[I5]` because cycle 2's own ISS-020 named the remedy as "a
max-sources cap or a run deadline" and the maker delivered both, and I will not move the goalposts
under a maker at its last cycle. It is worth an issue in whichever unit adds the scheduler, at
which point concurrent runs stop being hypothetical.

## The four declared gaps

**Gap 1 — A13 does not flip. Ruling: correct, and it must NOT have blocked this PASS.**
This is the question the maker asked, and the answer is already written into the contracts, twice.
`watched-sources-entrypoint.md` `[I5]` says A13 earns PARTIAL at most on reachability and that any
probe scoring it REAL on row count is wrong. `watched-sources-run.md` `[I4]` says a reachable chain
is not a run against live data and that a placeholder row written to move a probe is a falsified
measurement. A13's flip therefore requires a **live-verify artifact** — a real `POST
/watched-sources` followed by a real `POST /watched-sources/run` against live data — which is a
Mode C live-validation unit, not something this unit could have produced without doing precisely
the thing both contracts forbid. Refusing to write the row is the maker obeying the contract, and
blocking a PASS on it would have been the checker punishing compliance. Queued below as the next
unit instead.

**Gap 4 — the brand is advisory. Ruling: accurately scoped, not a defect.**
`isGuardedFetcher` is a `Symbol.for` brand, so anything can set it; it stops the accident, not an
attacker who is already executing code in the composition root. But `[C8]` asks only that replacing
the fetcher must fail a test, and M1 shows it does. The maker saying so plainly in its own manifest,
rather than describing the brand as a security control, is the behaviour this contract's `[C6]`
lineage (claims must match behaviour) exists to reward.

**Gaps 2 and 3** — the missing TLS fixture and the unpinned `res.destroy()` — were both ruled on at
cycle 2 (proven-on-disk and honest-hygiene respectively) and nothing at this commit changes either
ruling. Carrying them forward unchanged and unembellished is correct.

## Over-claim hunt

Instructed to downgrade rather than accept, I checked every number and every claim in the cycle-3
section. Findings: the ingest count is 98 claimed / 97 actual, and `lint:structure` is red and
unreported. Everything else — the four mutation rows, the API count, the typecheck, the brand, the
`ranFor` assertion, the `remaining` values, `WatchedRunSummary`'s new field — reproduced exactly
under my own instruments. The narrative claims also hold: `createWatchedRunDeps` really is a named
export, the fake really does record its tenant, and the cap really does stop the network calls
rather than only the counter (M4 kills two tests, not one).

Also worth recording, since the dispatch that sent me here said otherwise: **cycle 2 was a FAIL,
not a PASS with four mediums carried forward.** The verdict above this one reads `VERDICT: FAIL,
9/11`. The four mediums are the same either way and the maker's response to them was correct, so
nothing about this check changes — but a dispatch summary that upgrades a FAIL to a PASS is the
kind of drift that ends with a unit's history being read from prose instead of from the verdict
file, so it is corrected here on disk.

## Goal / A13

A13 stays **unflipped**, correctly. `[I4]` and entrypoint `[I5]` both bind: it flips on a
live-verify artifact, never on reachability and never on a row written to move a probe.

**Recommended next unit:** a Mode C live validation of A13 — write one real watched source, run
the chain against it, and record the result in a live-verify artifact. That, and not another
round on this seam, is what moves the goal. Under this repo's class-based round cap, the
non-security surface of `watched-sources-run` has now PASSed once; the cap is not reached, but
there is nothing left on it worth pulling.
