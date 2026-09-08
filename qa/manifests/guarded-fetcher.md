# Manifest — guarded-fetcher

**Contract:** `qa/contracts/guarded-fetcher.md` (authored by the cycle-1 checker); extends
`watched-sources-entrypoint.md` invariant **[I3]**.
**Goal task:** T-027 / catalogue A13.
**Date:** 2026-09-08
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** **ISS-C-UNRUN-WRITERS-002** (high, the SSRF control), and this cycle
**-006** (high), **-007** (high), **-008** (medium), **-009** (medium), **-010** (high).
**Status:** ready-for-check (cycle 2)
**Branch:** `lane/c-unrun-writers`

## ISS-010 first: this manifest did not exist for cycle 1

The checker found **no manifest, in the worktree or in git history** — a handshake violation, and I
dispatched a check without one.

Cause: the pre-commit hook is a **PreToolUse** hook. It saw `git commit` in the command string and
**denied the entire Bash call**, so the heredoc writing this manifest at the top of that same
command never ran either. I read the block as "the commit was refused" and re-ran only the commit.

Worth stating plainly because the lesson generalises: **a denied or failed tool call means nothing
in it happened**, not just the part that tripped the guard. It then happened a SECOND time while
writing this cycle — a two-heredoc command failed at bash parse time and the manifest silently did
not appear. Same class, twice in one unit.

## Why the unit exists

Watched Sources fetches a stored URL **on a timer, unattended, from inside the perimeter** — a
textbook SSRF surface. Per the cycle-1 ruling the control cannot live at registration, because a
store-time hostname check **cannot survive DNS rebinding**; it lives on the resolved address at
fetch time, with every redirect hop re-resolved.

`UrlFetcher` was **only a type** — no implementation existed — so this builds the fetcher and its
guard together. Guarding a fetcher that does not exist would repeat the `replaceOne` mistake.

## Fix cycle 2 — the guard matched TEXT, not addresses

> `64:ff9b::127.0.0.1` blocked. **`64:ff9b::7f00:1` — the same address — was allowed.**

The old code took the substring after the last colon and unwrapped it only when it looked like
dotted-quad, so every v4-embedding IPv6 prefix was blocked in one spelling and open in the other.
Reproduced before fixing: **6 of 9 probes were holes**, including `::ffff:7f00:1` (mapped
loopback), `2002:7f00:0001::1` and `2002:c0a8:0101::1` (6to4 to loopback and RFC1918), `fec0::1`,
and Teredo.

**Blocking one spelling of an address while allowing another is not a control.**

`isBlockedAddress` now **parses** into 8 groups — handling `::` expansion, dotted tails, brackets
and zone ids — and judges the numbers, unwrapping `::ffff:0:0/96`, `::/96`, `2002::/16` and
`64:ff9b::/96` onto their embedded v4.

### ISS-007 — a docstring overclaim worse than the gap

The old comment said *"the resolution the guard checks is the same one the caller will use."*
**That was false.** `request` re-resolves independently, so a check-to-connect window remains that
only connect-time pinning closes. An overclaim in a security docstring is worse than the gap it
papers over, because it stops the next reader from looking. Corrected, and the residual window is
now stated as a limit rather than denied.

`lookup` returns **all** addresses and every one must pass — the checker's reason is sharper than
rebinding: a host publishing one public and one private A record gets a **coin flip on every
fetch**, no timing required. An empty answer fails closed: "no addresses" must never read as
"nothing to object to".

### ISS-008 / ISS-009

`fec0::/10` is blocked. Response size is enforced on **every hop including redirects** — previously
asserted only on the final response, so a redirect chain could stream unbounded bodies.

## Evidence

```
$ pnpm --filter '@lkb/ingest' test   tests 75   pass 75   fail 0   (61 + 14 new)
$ pnpm -r typecheck                  exit 0
```

**Mutation table** (baseline 75/0), run under **D-020**: `timeout` on every mutation, restore in a
trap on EXIT/INT/TERM/ERR, `cmp`-verified after each.

| mutation | result |
|---|---|
| stop unwrapping 6to4 | **73 / 2** |
| stop unwrapping NAT64 | **73 / 2** |
| allow `fec0::/10` | **74 / 1** |
| check only the FIRST resolved address | **74 / 1** |
| allow an empty resolver answer | **74 / 1** |
| **no-op control** | **75 / 0** |

## Corrections to my own cycle-1 claims

- **The mutation count was wrong.** I reported the address-check mutant as 47/13; it is **48/13**.
  The checker caught that 47+13 does not sum to 61. Every other row was exact.
- **The encodings are blocked, but not by the mechanism I described.** I claimed `0177.0.0.1` and
  `2130706433` fail as unparseable. In fact `new URL` normalises them to `127.0.0.1` before my
  parser sees them — the fail-closed path is not what saves it. Right outcome, wrong reason.

## Known gaps

1. **The check-to-connect window remains** (ISS-007). Closing it needs a transport accepting a
   pinned address; the seam has no callers yet, so widening it later is cheap.
2. **No request timeout.** Part of ISS-009; belongs with the real transport.
3. **No real transport at all** — `request` is an injected seam. **A13 does not move.**
4. **No allowlist mode.** Deny-by-range only.

## Note to the checker

Attack the new parser rather than the old table: malformed `::` (`1::2::3`), over-long groups, more
than 8 groups, `::ffff:` with a bad tail, an all-zero 6to4, and IPv4-in-IPv6 spellings I have not
thought of. Also rule on gap 1 — is stating the check-to-connect window acceptable here, or must
`request` take the pinned address now, before the seam has callers?
