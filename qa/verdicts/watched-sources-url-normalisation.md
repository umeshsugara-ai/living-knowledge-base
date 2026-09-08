# Verdict — watched-sources-url-normalisation

**Checked:** 2026-09-08
**Cycle checked:** 1
**Contract:** `qa/contracts/watched-sources-entrypoint.md`
**Manifest:** `qa/manifests/watched-sources-url-normalisation.md`
**Commit:** `c8da5ee`
**Worktree:** `D:\KnowledgeBase-lanes\c-unrun-writers` (branch `lane/c-unrun-writers`)
**Ledger:** `qa/issues.c-unrun-writers.jsonl` (D-019)

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 5/5 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
```

## What I re-ran myself

Working tree was clean at `c8da5ee` before and after every command below.

| Command | My result |
|---|---|
| `pnpm --filter '@lkb/api' test` | `tests 132 · pass 132 · fail 0` — matches the manifest |
| `pnpm -r test` | exit 0, all packages green |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint:structure` | green; `279 modules / 853 dependencies · 0 violations`; SNAPSHOT fresh; tracker-audit gate G1 OK |

**Mutation, with a no-op control (both restored `cmp`-identical afterwards):**

- No-op control (append `// no-op control` to the `TIERS` line) → `132/132 pass`. The suite is not
  merely sensitive to any edit of the file.
- `return parsed.href;` → `return value;` → `pass 131 · fail 1`, the single failure being
  `✖ the STORED url is the normalised one, not the raw input`. **Exactly the new test reddens** —
  the maker's mutation claim reproduces precisely, and the test is load-bearing (`[C8]`).

## Is ISS-C-UNRUN-WRITERS-001 genuinely closed? — yes

The issue was: `isHttpUrl()` validated a *parsed* URL and line 70 stored `body.url` verbatim, so a
future fetcher with a different parser could resolve the stored string to a different host than the
one this route approved. The fix removes the second string entirely — `normalisedHttpUrl()` returns
`parsed.href`, and that same value is what is written (`url,` at
`apps/api/src/routes/watched-sources.ts:74`) and what the 201 body and the subsequent `GET` return.
There is no longer a raw-string path to store; this is a structural close, not a patched symptom.

I re-ran the two probes that produced the original finding:

- `" https://ok.com \n"` → stored `https://ok.com/`. Whitespace is gone from the stored row.
- `"http:/\/\evil.com/"` (backslashes after the scheme) → stored `http://evil.com/`. This was the
  sharp end of ISS-001: previously the row kept the backslashes, and a non-WHATWG parser
  (Go `net/url`, python-requests) reading `https://good.com\@evil.com/` sees userinfo `good.com\`
  and **host `evil.com`**, while this route had approved host `good.com`. Storing `href` collapses
  that to `https://good.com/@evil.com/`, which every parser resolves to `good.com`. The
  parser-disagreement window the issue described is closed, not narrowed.

Ledger row `ISS-C-UNRUN-WRITERS-001` moved `open → fixed` (`fixed_date: 2026-09-08`). It stays at
`fixed` rather than `verified` per the ledger rule — only a later re-check promotes it.

## The four questions the dispatch asked

### 1. Is `href` the right normal form for a stored fetch target? — Yes. Ruling: keep it.

The property `[I4]` actually needs is *"the stored string re-parses to the object that was
approved."* `href` is by construction the canonical serialisation of that object, and I confirmed it
round-trips: over 15 adversarial inputs, `new URL(new URL(x).href).href === new URL(x).href` for
every one. That idempotence is what makes the stored value a fixed point rather than a string that
happens to agree today.

Anything stricter fails on its own terms:

- **Dropping the fragment** — a fragment is never sent on the wire, so removing it does not change
  what the fetcher fetches; it only makes the stored row differ from what the fetcher would
  re-derive, i.e. it reintroduces the exact divergence this unit exists to remove. The real reason
  someone wants it is de-duplication, which is a *different* operation on a *comparison key*, and is
  ISS-C-UNRUN-WRITERS-004's business, not the stored value's.
- **Sorting query params** — actively wrong. `?a=1&a=2` is order-significant, and plenty of real
  endpoints treat parameter order as meaningful. Sorting would mean the row no longer names the
  resource the user asked to watch.

The maker's stated reasoning ("anything cleverer would diverge from the fetcher's own parse") is
correct and is the reasoning I would have given. If a canonical *comparison key* is later wanted for
de-dup, it should be a **separate derived field**, never a rewrite of `url`.

The one thing I would tighten is **stripping userinfo** — but that is an admission-policy change
(it changes what is accepted or how, not what the normal form is), it is already filed as
ISS-C-UNRUN-WRITERS-003, and demanding it here would be scope creep on a unit whose accept-set is
deliberately unchanged. Recommend ISS-003 be owned by the fetcher unit or a follow-on route unit.

### 2. Does normalisation open a NEW way to smuggle a target past the check? — No, and this is provable rather than probed.

The decisive point is that **the admission predicate is byte-for-byte unchanged**. Old: non-empty
after trim → `new URL(value)` succeeds → protocol is `http:`/`https:`. New: identical three
conditions, differing only in returning `parsed.href` instead of `true`. Nothing that was rejected
is now accepted, and nothing accepted is now rejected. A change that cannot alter the accept set
cannot introduce a bypass of it. The mutation and the 131 pre-existing tests are consistent with
this.

I still ran the specific probes named in the dispatch, against `new URL` directly:

| Input | Stored `href` | Host approved | Read |
|---|---|---|---|
| `https://user:pass@evil.com/` | unchanged, userinfo preserved | `evil.com` | No rewrite. Every parser agrees on `evil.com`. Credential exposure is ISS-003, pre-existing, not worsened. |
| `https://evil.com\@good.com` | `https://evil.com/@good.com` | `evil.com` | The stored string now *un*ambiguously names the host the route approved. Strictly safer than storing the raw form. |
| `https://good.com\@evil.com/` | `https://good.com/@evil.com/` | `good.com` | Same, in the direction that matters: the raw form is the one a second parser reads as `evil.com`. |
| `https://пример.example/пут` | `https://xn--e1afmkfd.example/%D0%BF…` | `xn--e1afmkfd.example` | Punycode is the wire form; the check already approved this host. Storing it removes the risk of a fetcher applying a different IDNA mapping. |
| `https://google.com。evil.com/` | `https://google.com.evil.com/` | `google.com.evil.com` | The host is "rewritten" only in the sense that the ideographic full stop is mapped — but the route approved `google.com.evil.com` **in both the old and new code**, because the old check also parsed. Storing the normalised form makes the row honest about where it points instead of hiding it behind a homoglyph. |
| `https://exAMPLE.com./path` | `https://example.com./path` | `example.com.` | Trailing dot preserved, not silently dropped. Correct — dropping it would be a host change. |
| `%41%62`, `%7e` | preserved as written | — | Percent-encoding case is **not** normalised; no surprise there. |
| `https://example.com/%2e%2e/%41%62` | `https://example.com/%41%62` | `example.com` | Dot-segment removal collapses the traversal. A path-only rewrite, host untouched, and it is what any fetcher would send anyway. Not a defect; noted for completeness. |
| `:443` / `:80`, spaces, surrounding whitespace | default port dropped, spaces `%20`-encoded, whitespace trimmed | unchanged | All parser-agnostic improvements. |
| `https://example.com／evil.com/` (fullwidth solidus) | parse throws → 400 | — | Rejected, same as before. |

The dispatch's stated worry — *"a normal form that silently rewrites a host is worse than storing
the raw string"* — is the right worry, and it does not land here, because **the host was never taken
from the raw string in the first place.** The old code approved `parsed.host` and then stored a
string that might not yield it; the new code stores a string that provably yields it. Every case
above moves in that direction, none against it.

### 3. Route-only, entrypoint unit otherwise untouched — confirmed.

`git show --stat c8da5ee` = three files: `apps/api/src/routes/watched-sources.ts` (+26/−8), its own
test file (+27, one added test, nothing edited or deleted), and the new manifest. No change to
`packages/db`, T-027's accessors, the schema, or the pure due-check — so `[C7]` holds unchanged.
`grep -rn isHttpUrl apps/ packages/` returns nothing: the rename left no stale caller. The 131
pre-existing tests all still pass unmodified (132 = 131 + 1), which is the direct evidence that
`[C1]`–`[C6]` and `[I1]`/`[I2]` are untouched — including the tenant-partitioned fake and the
reject-and-store-nothing assertions. The `POST` 201 body echoes `doc`, so the response now carries
the normalised url too, consistent with `[C1]`'s "returns the stored document".

### 4. Internal-address control deliberately absent — still the right call, and ISS-002 stays correctly scoped.

Confirmed and unchanged. `https://127.0.0.1/`, `https://[::1]:8080/` and
`https://169.254.169.254/latest/` all still pass admission and would be stored; my cycle-1 ruling
was that a store-time hostname check cannot survive DNS rebinding between registration and fetch,
so the sound control is at fetch time on the **resolved IP after DNS, re-checked per redirect hop**.
Nothing in this unit changes that analysis — normalisation is about *which string*, the SSRF control
is about *which address*, and they are genuinely different units. Adding a hostname denylist here
would have been worse than useless: it would look like a control while leaving the rebinding path
open, and this contract's `[I3]` exists precisely so that appearance cannot be traded for the real
thing. ISS-C-UNRUN-WRITERS-002 remains `open`, high, correctly owned by the unbuilt fetcher unit and
mirrored in `[I3]`, which says the fetcher unit MUST NOT be accepted without it. Left as is.

## Low notes (not failures; no fix cycle owed)

- **Manifest mis-citation.** Known gap 2 says fragments creating two rows is covered by
  "ISS-C-UNRUN-WRITERS-003". ISS-003 is the plaintext-credentials issue; de-duplication is
  **ISS-C-UNRUN-WRITERS-004**. The gap itself is disclosed correctly, only the id is wrong.
  Bookkeeping, not behaviour.
- The 400 message ("url must be an absolute http(s) URL") is unchanged and still accurate for the
  new null-returning shape. No action.
- Fragments and userinfo surviving into the stored row are both real and both already ledgered
  (ISS-004, ISS-003). Neither is a defect of this unit; recorded here so a later cycle does not
  rediscover them as new.

## Contract

No amendment. This unit added no criteria and weakened none; `[I4]` was already the rule it satisfies
and it now has a load-bearing test behind it, which is exactly what `[I4]` was written for at cycle 1.

## Goal wiring

No `.goal/goal.json` task matches this unit slug in this worktree (T-027 tracks the parent unit and
remains open — A13 is still PARTIAL at most per `[I5]`, and this unit does not move it). No goal
task closed.
