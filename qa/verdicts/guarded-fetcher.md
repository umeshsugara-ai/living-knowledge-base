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

---

# Verdict — guarded-fetcher · **Cycle checked: 2**

**Date:** 2026-09-08
**Cycle checked:** 2
**Commit under check:** 26e283a
**Bound root:** `D:\KnowledgeBase-lanes\c-unrun-writers` (branch `lane/c-unrun-writers`)
**Contract:** `qa/contracts/guarded-fetcher.md`
**Manifest:** `qa/manifests/guarded-fetcher.md` (present this cycle — ISS-010 closed)
**Ledger:** `qa/issues.c-unrun-writers.jsonl` (D-019 lane ledger)

```
VERDICT: FAIL
SCOREBOARD: 6/7 criteria met, 3/3 invariants hold
```

The security core of this unit is now right, and I could not break the new parser. It fails on one
criterion only — `[C7]`, which the manifest claims as addressed while its own Known-gaps section
admits half of it is not.

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/ingest' test` | **75 pass / 0 fail** — matches the claim exactly |
| `pnpm -r test` | green (apps/api 132 pass / 0 fail; all packages Done) |
| `pnpm -r typecheck` | green, all packages Done |
| `pnpm lint:structure` | green — lint-loc 263 files, lint-dirsize 75 dirs, lint-root 15, lint-dupes 286 exports, lint-migrations 906 files, SNAPSHOT.md fresh, tracker-audit OK (G1), 0 dependency violations (281 modules / 857 deps) |
| `grep -niE 'timeout\|abort\|deadline\|signal\|setTimeout'` over the module | **no matches** — see `[C7]` |

Plus a 52-address direct probe of the exported `isBlockedAddress`, executed via `tsx` against the
shipped source. Nothing below is taken from the manifest.

## Attacking the new parser

This is where the cycle-1 hole was, so it is where I pushed. Every probe the dispatch named, plus
the ones I could invent. **Blocked** unless stated otherwise:

*Malformed / fail-closed:* `1::2::3` (double `::`) · `1:2:3:4:5:6:7:8:9` and `…:9:10` (>8 groups) ·
`12345::` (over-long group) · `::ffff:` (empty tail) · `::ffff:g.1.1.1` · `::ffff:1.2.3` (short
dotted tail) · `::ffff:1.2.3.4.5` (long dotted tail) · `""` · `not-an-ip` · `localhost` ·
`0177.0.0.1` · `2130706433`.

*IPv4-in-IPv6, every spelling I could construct:* `::ffff:7f00:1` · `::FFFF:127.0.0.1` ·
`0:0:0:0:0:ffff:7f00:1` (fully written) · `0:0:0:0:0:FFFF:7F00:1` (uppercase) · `64:ff9b::7f00:1` ·
`64:ff9b::127.0.0.1` · `64:FF9B::7F00:1` · `2002:7f00:0001::1` · `2002:c0a8:0101::1` ·
`2002:0a00:0001::1` · **`2002:a9fe:a9fe::1`** (6to4 → 169.254.169.254, mine) · `2002::` (all-zero
6to4 → 0.0.0.0) · `::127.0.0.1` · `::` · `::1` · `[::1]` · `fe80::1%eth0`.

*Internal v6:* `fc00::1` · `fdff::1` · `fe80::1` · `febf::1` · `fec0::1` · `feff::1` · `ff02::1` ·
`2001::1` · `2001:0:1:2::3`.

*Correctly ALLOWED (proving it does not simply block the prefixes wholesale):* `2002:0808:0808::1`
(6to4 → 8.8.8.8) · `64:ff9b::8.8.8.8` · `::ffff:93.184.216.34` · `2606:4700:4700::1111` ·
`2001:db8::1` (doc range, correctly not confused with Teredo) · `8.8.8.8` · `172.32.0.1`.

**Result: 0 mismatches on anything the contract enumerates.** Three probes returned `false` where I
had guessed `true`; on inspection two are the contract's own specified behaviour or
non-exploitable, and one was my error:

- `::8.8.8.8` allowed — **my expectation was wrong.** `[C4]` says `::/96` is judged **on the
  embedded v4**, and 8.8.8.8 is public. The code does exactly what the contract specifies. Not a
  finding.
- `::ffff:0:127.0.0.1` and its hex form `::ffff:0:7f00:1` allowed — RFC 2765 IPv4-translated
  `::ffff:0:0:0/96` (the `0xffff` sits at `g[4]`, not `g[5]`, so the mapped branch at `:150` does
  not match). Not in `[C4]`'s enumeration, and I could not demonstrate a live bypass: no mainstream
  stack kernel-translates it, so a connect leaves as ordinary unreachable IPv6. Filed **low**,
  ISS-012.
- `1:2:3:4:5:6:7:8::` and `::1:2:3:4:5:6:7:8` parse instead of returning `null`. Malformed under
  RFC 4291 (`::` must compress at least one group), reaching the `fill === 0` path at `:113-117`.
  Not a hole I can exploit: the groups returned are the same literal groups written, so the parse is
  a *superset* reading and any private prefix still matches — and these strings cannot arise from a
  resolver. Filed **low**, ISS-012, with the above.

Neither low is a `[C5]` failure. `[C5]` says a parser disagreement must never resolve toward
"allow"; these are laxnesses in *accepting* a string, and in both cases the accepted reading still
reaches the same block decision. I could not build an under-block, so they stay notes rather than
FAILURES.

## Mutation table (D-020: byte backup, `trap` restore on EXIT/INT/TERM/ERR, `timeout 180`, `cmp` verify)

Baseline 75/0. The maker's five rows re-derived independently, **plus three of my own**:

| Mutant | pass/fail | killed? | maker's claim |
|---|---|---|---|
| **no-op control** | **75 / 0** | — (control holds) | 75 / 0 ✔ |
| stop unwrapping 6to4 | **73 / 2** | yes | 73 / 2 ✔ |
| stop unwrapping NAT64 | **73 / 2** | yes | 73 / 2 ✔ |
| allow `fec0::/10` | **74 / 1** | yes | 74 / 1 ✔ |
| check only the FIRST resolved address | **74 / 1** | yes | 74 / 1 ✔ |
| allow an empty resolver answer | **74 / 1** | yes | 74 / 1 ✔ |
| *(mine)* delete the `::ffff:0:0/96` mapped unwrap | **72 / 3** | yes | — |
| *(mine)* fail OPEN on an unparseable address (`return true` → `false`) | **74 / 1** | yes | — |
| *(mine)* drop the redirect-hop size check | **74 / 1** | yes | — |

**Every one of the maker's five rows reproduces exactly** — no repeat of the cycle-1 arithmetic
slip. All three of my additional mutants die too. Restore verified byte-identical with `cmp` after
every run; `git status --short` and `git diff --stat` empty afterwards; `node scripts/lib/mutate.mjs
assert-clean` reports none outstanding.

## Criteria

| | Verdict |
|---|---|
| **[C1]** verdict on the resolved address, at fetch time, uncached | **MET** — `guarded-fetch.ts:196-215`, inside the hop loop, no memoisation. Strengthened this cycle: `lookup` returns `string[]` and **all** must pass (`:210`), an empty answer failing closed (`:205-208`). Mutants 74/1 and 74/1 |
| **[C2]** every redirect hop re-resolved and re-checked, non-http(s) refused, bounded | **MET** — `:214-219`; `continue` re-enters the loop before any request; scheme checked via `httpUrlOrNull`; hop count bounded |
| **[C3]** IPv4 range table complete | **MET** — all 11 ranges re-probed and blocked; `172.32.0.1` and `8.8.8.8` correctly allowed |
| **[C4]** IPv6 table incl. every v4-embedding prefix, **both notations** | **MET** — the cycle-1 failure is closed. The text matcher is gone, replaced by `parseIpv6Groups` (`:80-119`); every enumerated prefix blocks in dotted, hex, fully-written, uppercase, bracketed and zone-suffixed spellings; three unwrap mutants die |
| **[C5]** fails closed | **MET** — 12 malformed/garbage inputs all block; the fail-open mutant dies 74/1. Two accept-side laxnesses noted as ISS-012, neither producing an under-block |
| **[C6]** claims match behaviour | **MET** — the false pinning sentence is gone; `:17-24` states the residual check-to-connect window explicitly and names what the module *does* guarantee. See ruling 1 |
| **[C7]** resource bounds actually bound | **FAILED** — ISS-009. One of three parts fixed |

## Invariants

- **[I1]** the table only tightens — **holds.** `fec0::/10` and `2001::/32` added; nothing removed or narrowed.
- **[I2]** `lookup`/`request` injected, every blocked range exercised by a test that fails when the range is removed — **holds.** 75 tests, no network; 6/6 guard mutants died, three of them chosen by me rather than the maker.
- **[I3]** (inherited) the SSRF defence lives here, on the resolved IP after DNS — **HOLDS** as of this cycle. It now holds for IPv4 and for the full v6 table in every spelling, which is precisely what it did not do at cycle 1. `ISS-C-UNRUN-WRITERS-002` moves `open → fixed`.

## The three rulings requested

### 1. Gap 1 — is *stating* the check-to-connect window enough, or must `request` take the pinned address now?

**Stating it is sufficient for this unit. It is not sufficient for the feature, and I am making that
structural rather than trusting a comment to survive.**

Start with the part the dispatch asks me to be honest about: **my own cycle-1 finding was the
overclaim, not the window.** ISS-007's fix direction was written disjunctively and deliberately —
*"Either widen the seam … **or** amend the docstring … and name the residual window."* The maker took
the second branch. A checker that now punishes the branch it offered is moving the goalposts, and
that is worse than the gap itself, because it teaches a maker that honest disclosure is penalised.
So ISS-007 is genuinely closed, and the honest statement is what I asked for.

But "sufficient" needs a reason beyond consistency, because the counter-argument is strong: at
cycle 1 I forced `lookup` to change signature *pre-callers*, on exactly the argument the contract's
scope paragraph makes — a seam changed before it has callers costs nothing. Why not `request`?

Because the two cases differ in kind, not merely in degree:

- **`lookup` was a live, exploitable defect today.** A host publishing one public and one private A
  record won a coin flip on every fetch — no rebinding, no timing required. And the correct
  signature was not in doubt: `Promise<string[]>`, all must pass. Cheap, obvious, and it closed a
  hole that existed at the moment of the check.
- **Pinning is not a signature tweak.** Connecting to a pre-approved address while still presenting
  the original `Host` header and the correct SNI, plus the certificate validation that follows, is a
  *transport* contract. The contract explicitly places "the real transport (`node:https` / undici)
  behind the injected `request`" **out of scope** for this unit. A `request(url, pinnedAddress)`
  written now, with nothing behind it, would be a **guess at the contract the transport needs** —
  which is exactly what produces the expensive migration the scope paragraph exists to avoid.
  Getting a seam right before it has callers means designing it against a known consumer, not
  inventing one.

So the ruling is yes-with-teeth. The failure mode of accepting an honest comment is that the comment
becomes the place the gap goes to be forgotten — prose is not a gate. I have therefore **split the
window out of ISS-007 into its own open row, `ISS-C-UNRUN-WRITERS-011` (medium), marked BLOCKING on
the transport unit:** the real-transport unit must not be accepted unless it connects to a pinned,
pre-approved address with the original Host and SNI. That row cannot be closed by editing a
docstring. `[C6]` is satisfied by the honest statement; the debt now has an owner and a gate instead
of a sentence.

### 2. Are the maker's corrections to its own cycle-1 claims accurate?

**Both accurate, and both were mine to check.**

- **48/13, not 47/13.** Correct. I reproduced 48/13 myself at cycle 1 and recorded it in the
  cycle-1 verdict above; the original figure did not sum against the 61-test suite. The maker
  adopted the corrected number and said why.
- **The odd encodings are blocked by `new URL` normalisation, not by the fail-closed path.**
  Correct, and the more substantive of the two. I verified at cycle 1 that `0177.0.0.1`,
  `2130706433`, `0x7f.1`, `0x7f000001` and `127.1` all yield `hostname === "127.0.0.1"` before the
  parser ever runs, so `parseIpv4` succeeds and `blockedIpv4` blocks them as ordinary loopback.
  Right outcome, wrong mechanism — exactly as the maker now states it. `parseIpv4`'s rejection of
  `0177…` remains correct defence in depth for a resolver that returns an odd string.

Correcting your own reported evidence downward, unprompted, in the same document that asks to be
passed is the behaviour this pair exists to produce. Worth saying plainly even inside a FAIL.

### 3. Is the ISS-010 root cause right, and is there a durable fix worth filing?

**The diagnosis is right, and I confirmed it independently rather than taking it.**

`.claude/hooks/mc-precommit.ps1` is registered as a **PreToolUse** hook on `Bash|PowerShell`
(`.claude/settings.json`), and it emits `permissionDecision: "deny"` when `qa/.mutations-active`
exists and `mutate.mjs assert-clean` fails. A PreToolUse deny blocks the **entire tool call** — the
command string never reaches a shell — so a heredoc placed ahead of `git commit` in one command dies
with it. That this actually fired in *this* worktree is corroborated by the maker's own
`ISS-C-UNRUN-WRITERS-005`, filed the same day for a spurious cross-lane DENY caused by the hook
resolving `qa/.mutations-active` against `CLAUDE_PROJECT_DIR` instead of the worktree being
committed to. The two issues fit together, and neither was written to excuse the other.

The generalisation the manifest draws — **"a denied or failed tool call means nothing in it
happened, not just the part that tripped the guard"** — is the correct lesson, and the second
recurrence (a bash parse error in a two-heredoc command) is the same class with a different cause.
I hit that exact class myself while writing this cycle's ledger update, which is some evidence it is
a property of the tooling rather than of one maker.

**A durable fix is worth filing, in two parts, and I have filed it as `ISS-C-UNRUN-WRITERS-013`
(low):**

- **(a) Discipline, available now, no approval needed:** write the manifest as its own tool call and
  confirm it on disk *before* issuing any command containing `git commit`. Never bundle an artifact
  write with a commit. This alone would have prevented both occurrences.
- **(b) Machine backstop:** `mc-precommit.ps1:31-35` already walks `qa/manifests` counting
  `Status: ready-for-check` and warns when units await a verdict — but it says nothing when a commit
  touches `packages/` or `apps/` source and **no manifest names that unit at all**, which is
  precisely the silent case. Extending it to WARN there is small. It is an **enforcement path**, so
  per the project CLAUDE.md it needs a DECISIONS entry carrying `Approved-by: Umesh` — it is not a
  maker fix, and it should ride along with the ISS-005 decision on the same file rather than opening
  a second gate.

## FAILURES

- **[C7]** sev: **medium** · The declared byte cap is still asserted on `res.body.length` *after*
  `request` has returned a fully materialised string (`guarded-fetch.ts:209`), and the module has
  **no duration bound at all** — no `timeout` field on `GuardedFetchDeps`, no `AbortSignal`, no
  `Promise.race`; `grep -niE 'timeout|abort|deadline|signal|setTimeout'` over the module returns
  nothing. `[C7]` requires the cap to constrain what is *read*, and requires an unattended
  timer-driven fetcher to bound request *duration* as well as size. Only the redirect-hop half was
  fixed, yet the manifest lists ISS-009 under *Issues addressed*. The timeout half needs no
  transport whatsoever, so it is an unforced miss rather than a scope boundary · Add `timeoutMs` to
  `GuardedFetchDeps` and race `deps.request` against it — a slow-loris endpoint currently hangs the
  scheduler indefinitely — and pass `maxBytes` into the seam so the transport can abort the stream,
  rather than measuring a string that is already allocated · issue: ISS-C-UNRUN-WRITERS-009

## Ledger

- `ISS-C-UNRUN-WRITERS-002` → **fixed** (the `[I3]` half; the residual window is ISS-011, not this row)
- `ISS-C-UNRUN-WRITERS-006` → **fixed** (52-address probe + 3 mutants)
- `ISS-C-UNRUN-WRITERS-007` → **fixed** (the overclaim; see ruling 1)
- `ISS-C-UNRUN-WRITERS-008` → **fixed** (`fec0::1` and `feff::1` block; mutant 74/1)
- `ISS-C-UNRUN-WRITERS-010` → **fixed** (manifest present; diagnosis independently confirmed)
- `ISS-C-UNRUN-WRITERS-009` → **stays open**, narrowed to the two unfixed parts
- **NEW** `ISS-C-UNRUN-WRITERS-011` (medium) — connect-time pinning, BLOCKING on the transport unit
- **NEW** `ISS-C-UNRUN-WRITERS-012` (low) — `::ffff:0:0:0/96`; malformed-`::` parse laxness
- **NEW** `ISS-C-UNRUN-WRITERS-013` (low) — durable fix for the missing-manifest class

All statuses are `fixed`, not `verified`; only a later re-check promotes them.

## Explanation

The cycle-1 hole is genuinely closed, and closed the right way — by deleting the text matcher and
parsing the address into numbers, which is the difference between a guard that blocks a spelling and
one that blocks an address. I attacked the new parser with every malformed and alternate-notation
input I could construct, including several the dispatch did not name (`2002:a9fe:a9fe::1` reaching
the cloud metadata endpoint through 6to4, the fully-written and uppercase mapped forms, an all-zero
6to4), and found nothing that under-blocks a contract-enumerated prefix. All five of the maker's
mutation rows reproduced exactly, and three mutants of my own choosing died as well, so the tests are
load-bearing rather than decorative. `[I3]` now holds and ISS-002 is closed. The two low notes are
laxnesses on the accept side that I could not turn into a bypass, and I have said so rather than
inflating them into findings.

It fails on `[C7]`, and on the half of it that has no excuse. The redirect-hop size gap is fixed; the
two remaining parts are that the cap is still measured on a string already in memory, and that there
is still no request timeout of any kind on a fetcher whose entire purpose is to run unattended on a
timer. The first genuinely needs the transport seam to carry the cap. The second does not — a
`timeoutMs` on the deps plus a `Promise.race` around the injected `request` is enforceable at this
layer today, and without it a slow-loris endpoint hangs the scheduler forever, in a project that
already has D-020 because an unbounded hang took out its test suite. The manifest lists ISS-009 under
*Issues addressed* while its own Known-gaps section admits the timeout is unfixed; that is the same
species of overclaim as ISS-007, in the same unit, which is why I am charging the criterion rather
than waving it through on disclosure.

Two things on the record in the maker's favour, since this is a FAIL. It corrected its own cycle-1
mutation count downward and corrected its own explanation of why the odd IPv4 encodings are blocked
— both accurate, both verified by me, both volunteered in the document asking to be passed. And its
diagnosis of the missing manifest is right, non-self-serving, and generalises to a real property of
the tooling that bit me too while writing this verdict. One criterion, one cycle left, and the
security core of the unit is sound.
