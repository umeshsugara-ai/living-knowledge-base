# Manifest — watched-sources-url-normalisation

**Contract:** `qa/contracts/watched-sources-entrypoint.md`. No new criteria; this tightens what
the existing URL criterion actually guarantees.
**Goal task:** T-027 / catalogue A13.
**Date:** 2026-09-08
**Fix cycle:** 1 of max 3
**Dual check:** no
**Issues addressed:** **ISS-C-UNRUN-WRITERS-001** (medium).
**Status:** ready-for-check
**Branch:** `lane/c-unrun-writers`

## Why

The route validated a **parsed** URL and stored the **raw** string. So the value approved and the
value stored could differ under a different parser — and this row is a **future outbound fetch
target**, which is exactly the case where that gap bites: whatever the fetcher re-parses must be
the thing this check actually approved, not a string that merely normalises to it here.

Filed by the cycle-1 checker as the one defect this unit genuinely owned.

## What changed

`apps/api/src/routes/watched-sources.ts` only. `isHttpUrl()` (boolean) becomes
`normalisedHttpUrl()`, returning the parsed `href` or `null`, and the stored document carries that
value. Making it return the url rather than a boolean is the point: the approved object and the
stored object become the same thing, instead of two strings that happen to agree today.

## Evidence

```
$ pnpm --filter '@lkb/api' test   tests 132   pass 132   fail 0   (131 + 1 new, written first, red before the fix)
$ pnpm -r typecheck               exit 0
$ pnpm lint:structure             green; depcruise 279 modules / 0 violations
```

Stored value for input `HTTPS://Example.AC.uk/fees?b=2&a=1` is now exactly
`new URL(...).href` — scheme and host lowercased — and the same value comes back from `GET`.

**Mutation:** reverting `return parsed.href` to `return value` reddens exactly the new test
(131/132). Restored `cmp`-identical.

## Known gaps

1. **The internal-address control is still absent, deliberately.** Per the cycle-1 ruling it belongs
   in the fetcher, on the **resolved IP after DNS**, with redirects re-checked per hop — a store-time
   hostname check cannot survive DNS rebinding. Tracked as ISS-C-UNRUN-WRITERS-002 (high) and
   contract invariant `[I3]`, queued before the fetcher unit is built.
2. **Normalisation is not de-duplication.** `https://x.com/a` and `https://x.com/a#frag` still create
   two rows; the fragment is preserved by `href`. ISS-C-UNRUN-WRITERS-003 covers duplicates.
3. **A13 unchanged** — still MISSING; no row has been written.

## Note to the checker

Judge whether `href` is the right normal form for a stored fetch target, or whether something
stricter is wanted (dropping the fragment, sorting query params). I chose `href` because it is what
`new URL` guarantees the fetcher will re-derive; anything cleverer would diverge from the fetcher's
own parse, which is the defect this unit exists to close.
