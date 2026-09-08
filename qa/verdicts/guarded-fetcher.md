# Verdict — guarded-fetcher

**Date:** 2026-09-08
**Cycle checked:** 1
**Commit under check:** 43c1281
**Bound root:** `D:\KnowledgeBase-lanes\c-unrun-writers` (branch `lane/c-unrun-writers`)
**Contract:** `qa/contracts/guarded-fetcher.md` (authored by this check; none existed)
**Ledger:** `qa/issues.c-unrun-writers.jsonl` (D-019 lane ledger)

```
VERDICT: FAIL
SCOREBOARD: 4/7 criteria met, 2/3 invariants hold
```

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/ingest' test` | **61 pass / 0 fail** — matches the claim |
| `pnpm -r test` | green (apps/api 132 pass / 0 fail, all packages Done) |
| `pnpm -r typecheck` | green, all packages Done |
| `pnpm lint:structure` | green — lint-migrations OK (903 files), SNAPSHOT.md fresh, tracker-audit OK (G1), 0 dependency violations |

Plus a direct probe of the exported `isBlockedAddress` over a 38-address table, and a
`new URL` normalisation probe. Nothing here is taken from the commit message.

## Mutation table (D-020: byte backup, `trap` on EXIT/INT/TERM/ERR, `timeout 180`, `cmp` verify)

| Mutant | pass/fail | killed? |
|---|---|---|
| no-op control | 61 / 0 | — (control holds) |
| delete the IPv4-mapped unwrap | **60 / 1** | yes |
| remove the `169.254` rule | 58 / 3 | yes |
| fail OPEN on unparseable (`return true` to `return false`) | 60 / 1 | yes |
| remove the address check at fetch (`if (isBlockedAddress(...))` to `if (false)`) | 48 / 13 | yes |

Every restore verified byte-identical with `cmp`; `scripts/lib/mutate.mjs` apply/restore wrapped
each run; working tree clean afterwards.

**A note against myself, in the spirit of D-020.** My first batched run reported the mapped-unwrap
mutant SURVIVING at 61/0, which would have contradicted the maker directly. It was my harness that
was wrong, not the maker: the batched form applied the mutation in a subshell whose effect did not
reach the test run. I caught it because the result was inconsistent with reading the code, re-ran
the mutant standalone, confirmed the deleted line (`grep -c 'const embedded'` returned 0) and got a
clean 60/1 with the assertion failing on the exact line the maker cites. Reported here because a
checker that quietly discards its own bad row is doing the thing it exists to prevent.

## The three rulings requested

**1. Gap 3 — `lookup` returns a single address. Acceptable?**
**No — and it must change in this seam, in the next cycle, not later.** But the reasoning matters
more than the verdict: resolving all records does *not* close the rebinding window, because nothing
pins the approved address to the connection at all (ISS-007). What single-address costs you today is
narrower and still real — a hostname with several A records is judged on whichever one the resolver
happened to hand back, so an attacker who publishes one public and one private A record gets a
straight coin flip on every fetch, with no rebinding trick required. That is a bypass with a
probability attached, which is not a control. Change `lookup` to `Promise<string[]>` and require
**every** returned record to pass. Do it now specifically because nothing consumes this seam yet —
the maker's own (correct) argument for building the fetcher now is exactly the argument for getting
the signature right before it has callers.

**2. Was building the fetcher and its guard together the right call?**
**Yes, and I verified the premise rather than accepting it.** `grep -rn UrlFetcher` over
`packages` and `apps` returns one type alias (`packages/ingest/src/sources/url.ts:16`), some
consumers of that type, and test fakes (`testUtils.ts:39`) — there is no production implementation
of `UrlFetcher` anywhere in the repo. A guard bolted to a type with no implementation is a control
on a path nothing can execute, which is the `replaceOne` failure precisely. Building both together
was right, and the unit is scoped correctly: the transport stays behind the injected seam.

**3. Is the IPv4-mapped unwrap "right by accident", now genuinely pinned?**
**Confirmed, both halves.** With the unwrap deleted, `isBlockedAddress('::ffff:127.0.0.1')` still
returns `true` — the fail-closed `^[0-9a-f:]+$` branch catches the dots — so the original
loopback-only test could not have detected its absence, and the maker's self-report is accurate.
The added public-mapped case (`'::ffff:93.184.216.34'` expecting `false`) is what kills the mutant,
and it does: 60/1, `AssertionError ... true !== false` at `guarded-fetch.test.ts:149`. This is the
best work in the unit — the maker mutation-tested its own guard, found the branch was passing for
the wrong reason, and said so.

## Criteria

| | Verdict |
|---|---|
| **[C1]** verdict on the resolved address, at fetch time, uncached | **MET** — `guarded-fetch.ts:113-121`, inside the hop loop, no memoisation; mutant 48/13 |
| **[C2]** every redirect hop re-resolved and re-checked, non-http(s) refused, bounded | **MET** — `:125-130`, `continue` re-enters the loop before any request; scheme check via `httpUrlOrNull` |
| **[C3]** IPv4 range table complete | **MET** — all 11 ranges probed and blocked; `172.32.0.1` and `8.8.8.8` correctly allowed |
| **[C4]** IPv6 table incl. every v4-embedding prefix, both notations | **FAILED** — ISS-006, ISS-008 |
| **[C5]** fails closed | **MET** — empty, `not-an-ip`, bracketed, zone-suffixed and all odd v4 encodings block; mutant 60/1 |
| **[C6]** claims match behaviour | **FAILED** — ISS-007 |
| **[C7]** resource bounds actually bound | **FAILED** — ISS-009 |

## Invariants

- **[I1]** the table only tightens — **holds** (nothing removed).
- **[I2]** `lookup`/`request` injected, every range tested — **holds**; 21 new tests, no network.
- **[I3]** (inherited) SSRF defence lives here, on the resolved IP — **DOES NOT HOLD YET.** It holds
  for IPv4 and for most of IPv6, and the placement ruling was implemented faithfully. It does not
  hold for the v4-embedding v6 prefixes (ISS-006), which reach the same internal addresses `[C3]`
  refuses. **ISS-C-UNRUN-WRITERS-002 stays `open`**, not `fixed`.

## Answers to the maker's specific probes

- **`192.0.0.0/24` blocked, `192.0.2.0/24` not — right?** Yes, right as it stands. `192.0.0.0/24`
  is IETF protocol assignments (it contains the DS-Lite `192.0.0.0/29` and the NAT64 well-known
  prefix's v4 side) and blocking it is correct. `192.0.2.0/24` is TEST-NET-1, documentation space —
  not routable, not internal, not an SSRF target. Blocking it would be tidy but it is not a defect.
  I have deliberately **not** written it into `[C3]`; adding it later is a routine amendment.
- **Decimal/octal/hex encodings.** Blocked, but **not for the reason the maker gives**, and the
  distinction matters. `new URL` normalises them before the parser ever sees them:
  `0177.0.0.1`, `2130706433`, `0x7f.1`, `0x7f000001` and `127.1` all yield `hostname` exactly
  `"127.0.0.1"`. So `lookup` is called with the normalised form, `parseIpv4` succeeds, and
  `blockedIpv4` blocks it as ordinary loopback — the fail-closed path is not what saves you.
  **And the hostname the request would use matches what was checked:** `deps.lookup(current.hostname)`
  and `deps.request(current.href)` read the same `URL` object, and `href` carries the normalised
  host. Confirmed. `parseIpv4`'s rejection of `0177...` is still correct defence in depth for the
  case where a resolver hands back an odd string.
- **Is `fd00::/8` caught by `f[cd]`?** Yes. `/^f[cd][0-9a-f]{0,2}:/` matches `fd00:`, `fc00:`,
  `fdff:` and the compressed `fd::`; `fd00::1` probes BLOCK. `fc00::/7` is covered.
- **`fec0::/10`?** **No — ALLOW.** ISS-008.
- **`64:ff9b::/96` NAT64?** **Dotted form blocked, hex form ALLOWED.** ISS-006.
- **`2002::/16` 6to4 embedding a private v4?** **ALLOWED**, both `2002:7f00:0001::1` (127.0.0.1)
  and `2002:c0a8:0101::1` (192.168.1.1). ISS-006.
- **Trailing-dot hostnames.** `new URL('http://192.168.1.1./')` normalises to `192.168.1.1`, so the
  v4 case is safe. `localhost.` keeps its dot and is handed to `lookup` as `"localhost."` — which a
  real resolver answers as `127.0.0.1`, so the guard blocks it on the returned address. Correct by
  construction: the guard never trusts the hostname, only the answer.
- **A hostname that is already an IP literal — does it call lookup?** Yes, always; there is no
  literal short-circuit. For `http://127.0.0.1/` that is harmless (`dns.lookup` returns the literal,
  which blocks). For an IPv6 literal it is worth knowing that `new URL` yields `hostname` **with the
  brackets** (`"[::1]"`), and `dns.lookup("[::1]")` throws — so it blocks via the resolve-error path
  rather than the address path. Fail-closed, so not a security defect, but a *public* IPv6-literal
  URL will also fail to fetch. Noted, not filed.
- **Anything else let through that should not be.** Beyond ISS-006/008: nothing in IPv4. Two low
  notes, not filed as defects: `hop <= maxRedirects` issues `maxRedirects + 1` requests (6 by
  default), and credentials embedded in the URL are neither stripped nor redacted before reaching
  `request` and the error strings — already tracked as ISS-C-UNRUN-WRITERS-003 against the route,
  and this unit inherits it the moment a real transport lands.

## FAILURES

- **[C4]** sev: **high** · The v4-embedding IPv6 prefixes are blocked only in dotted notation, so
  `2002:7f00:0001::1`, `2002:c0a8:0101::1` and `64:ff9b::7f00:1` reach loopback/RFC1918 through a
  guard that refuses those same addresses when spelled with dots · Parse the address into groups and
  reconstruct the embedded v4 for `::ffff:0:0/96`, `::/96`, `2002::/16`, `64:ff9b::/96`; block
  `2001::/32` · issue: ISS-C-UNRUN-WRITERS-006
- **[C6]** sev: **high** · The docstring tells a future reader the checked resolution is the one the
  caller uses, but `request(url)` re-resolves independently and no address is ever pinned · Either
  widen the seam to carry the resolved address, or state the residual check-to-connect window
  plainly · issue: ISS-C-UNRUN-WRITERS-007
- **[C4]** sev: **medium** · `fec0::/10` site-local is allowed by `/^fe[89ab]/` · Widen to
  `fe[89a-f]` or block `fe00::/8` · issue: ISS-C-UNRUN-WRITERS-008
- **[C7]** sev: **medium** · `maxBytes` is asserted after the body is fully materialised, is skipped
  on redirect hops, and there is no request timeout on an unattended timer-driven fetcher · Push the
  cap into the transport seam and add a deadline · issue: ISS-C-UNRUN-WRITERS-009
- **[handshake]** sev: **high** · No manifest exists for this unit, in the worktree or in git
  history, though the dispatch names it at `ready-for-check` cycle 1 · Write it retroactively before
  the cycle-2 dispatch · issue: ISS-C-UNRUN-WRITERS-010

## Explanation

The placement ruling was implemented faithfully and the hard parts are right: the check is on the
resolved address inside the hop loop with no caching, redirects are re-resolved rather than
followed, it fails closed on every malformed input I could construct, and four of my five mutants
died — including the mapped-unwrap mutant, which confirms the maker's own self-criticism about the
branch that was previously passing for the wrong reason. That is good security work and the FAIL is
not a rejection of the design.

It fails on the range table, which is exactly where the maker asked me to push hardest and exactly
where hand-written tables die. The table already blocks `64:ff9b::127.0.0.1` — so its author knew
these prefixes embed v4 — but the unwrap reads only the text after the last colon, so the identical
address written `64:ff9b::7f00:1` sails through, as do 6to4 addresses embedding loopback and
RFC1918. An attacker publishes their own AAAA record; producing the hex spelling costs nothing.
Blocking one spelling of an address while allowing another is not a control, so `[I3]` does not yet
hold and ISS-002 stays open. Alongside that, the docstring claims a pinning property the seam
cannot provide, which in a security module is a defect in its own right — a future maintainer reads
that sentence and stops looking.

Two process notes. There is no manifest: the verify commands, the gaps and the mutation table lived
only in a commit message, which is the transcript-only failure the file handshake exists to
prevent. I checked anyway because real defects were reachable, but it should not recur. And the
commit's mutation row for the address check reads 47/13 against a 61-test suite; the reproduced
figure is 48/13 — trivial in itself, and worth saying only because every other row reproduced
exactly.
