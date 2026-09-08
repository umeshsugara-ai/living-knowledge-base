# Verdict — watched-sources-entrypoint

**Date:** 2026-09-08
**Cycle checked:** 1
**Bound root:** `D:\KnowledgeBase-lanes\c-unrun-writers` (branch `lane/c-unrun-writers`, commit `4aef342`)
**Contract:** `qa/contracts/watched-sources-entrypoint.md` — **authored by this check** (none existed; the manifest requested it)
**Ledger:** `qa/issues.c-unrun-writers.jsonl` per D-019

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 5/5 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: ISS-C-UNRUN-WRITERS-001, -002, -003, -004 (none is a failure of this unit; -002 is owed by the unbuilt fetcher)
EXPLANATION: Re-ran all four gates myself and reproduced every number in the manifest exactly
(131/131, pnpm -r test green, typecheck exit 0, lint:structure green incl. tracker-audit G1 and
depcruise 279 modules / 0 violations). Mutation-tested the route against a no-op control: the
control stayed 131/131 and each of four separate mutations — url check disabled, tenant argument
hardcoded, interval check removed, scope guard removed — cost exactly one test, so the seven new
tests are load-bearing rather than decorative. The URL validator survived adversarial probing on
scheme: protocol-relative, javascript:, file:, relative and empty are all refused, and uppercase
HTTPS:// is accepted correctly as https rather than bypassing. What it does not do is normalise
(ISS-001) or block internal addresses (ISS-002) — I rule the second out of this unit's scope on
engineering grounds, not generosity, and wrote it into the contract as an invariant the fetcher
must satisfy.
```

## What I re-ran (not read — executed)

| Command | My result | Manifest claim | Match |
|---|---|---|---|
| `pnpm --filter '@lkb/api' test` | `tests 131  pass 131  fail 0` | 131/131 | yes |
| `pnpm -r test` | all packages green | green | yes |
| `pnpm -r typecheck` | exit 0 | exit 0 | yes |
| `pnpm lint:structure` | lint-loc/dirsize/root/dupes/migrations OK · snapshot matches · `tracker-audit: OK (gate G1)` · depcruise 279 modules, 0 violations | same | yes |

### Mutation test (control-anchored)

| Variant | Result |
|---|---|
| **Control** — appended a comment only | `pass 131  fail 0` (control is clean; the harness is not failing on noise) |
| `if (!isHttpUrl(body.url))` → `if (false)` | `pass 130  fail 1` |
| `deps.create(req.auth!.tenantId, doc)` → `deps.create("tenant-a", doc)` | `pass 130  fail 1` |
| the `hours <= 0` clause removed | `pass 130  fail 1` |
| `requireScope("sources")` removed from both routes | `pass 130  fail 1` |

Working tree restored byte-clean after every mutation (`git status --porcelain` empty).

## Criteria

- **[C1] 201 + stored doc** — met. `watched-sources.ts:46-77`; test *"POST /watched-sources registers a source and returns it"* asserts 201, the url, `active: true` and a non-empty `_id`.
- **[C2] GET returns this tenant's active sources only** — met. Test *"GET ... lists what was registered"* plus the isolation test; `listActive` filters on `active` in both the fake and the real accessor.
- **[C3] non-http(s) refused, nothing stored** — met, and probed harder than the tests do. My own probe of `isHttpUrl`: `//evil.com/x` **false**, `javascript:alert(1)` **false**, `file:///etc/passwd` **false**, `not-a-url` **false**, empty **false**. `HTTPS://EVIL.COM/x` and `HtTp://evil.com` return **true** — that is correct, not a bypass: WHATWG lowercases the scheme, so these *are* https/http URLs and the case-insensitive comparison the maker gets for free is the right behaviour. The "nothing stored" half is asserted by a follow-up GET returning `sources.length === 0`, so `[I2]` is tested rather than assumed.
- **[C4] reputationTier enumeration** — met. The `TIERS` set at `:28` matches the schema's three values; `"gold"` 400s.
- **[C5] positive checkIntervalHours** — met, and the reasoning is right: `isDueForCheck` uses `elapsed >= interval`, so `0` is "always due". `0`, `-1` and `"soon"` all 400. `Number.isFinite` also excludes `NaN`/`Infinity`.
- **[C6] auth + scope** — met. The router is mounted at `server.ts:72`, **after** `app.use(requireAuth(...))` at `:67`, so unauthenticated is 401 from the global middleware and the `req.auth!` non-null assertions in the route are actually safe. `requireScope("sources")` guards both handlers; the 403 test covers POST and GET, and mutation 4 proves it is load-bearing.
- **[C7] delegates, touches nothing of T-027's** — met, **verified by diff, not taken on trust**. `git show --stat 4aef342` is nine files: the new route + its test, `fixtures.ts`, `server.ts`, `store.ts`, `production.ts`, `TASKS.md`, `.goal/goal.json`, and the manifest. `packages/db/src/collections/watched-sources.ts`, the `WatchedSources` schema and `packages/ingest/src/watched/schedule.ts` are all untouched. `createMongoWatchedSourceDeps` (`store.ts:280-288`) is a two-method delegation to `createWatchedSource`/`listActive` with no second Mongo path. The claim holds.
- **[C8] tests load-bearing** — met; see the mutation table.

## Invariants

- **[I1] tenant isolation** — holds, on **both** paths, which is the part I was asked to confirm rather than assume.
  - *Route:* the tenant id is read only from `req.auth!.tenantId` (`:75`, `:81`). It is never read from the body or the query — I grepped the route for any other source and there is none. The body is cast to `Record<string, unknown>` and only `url`, `reputationTier`, `checkIntervalHours` and `label` are ever lifted off it, so a client-supplied `tenantId` is silently discarded rather than trusted.
  - *Production:* `createWatchedSource` and `listActive` (`packages/db/src/collections/watched-sources.ts:13,32`) both go through `watchedSources(tenantId)` → `scopedCollection`. That wrapper's `insertOne` merges `{ tenantId }` into the document and its `find` merges it into the filter (`lib/tenantScope.ts:38-42`), and it deliberately exposes **no raw handle** — ISS-065 removed it. So a tenant-less call is a compile error, and `listActive`'s `{ active: true }` filter becomes `{ active: true, tenantId }`. Genuinely tenant-scoped, not nominally.
  - *Fake:* `fakeWatchedSourceDeps` is a `Map<string, WatchedSources[]>` keyed by tenant, so the isolation test is falsifiable — mutation 2 (hardcoding the tenant) does in fact turn it red. The maker's reasoning that a shared-array fake could not fail this test is correct, and I confirmed it empirically rather than agreeing with it.
- **[I2] reject-and-store-nothing** — holds; every validation branch returns before `deps.create`.
- **[I3] stored SSRF / internal addresses** — holds **as written**, because I wrote it to sit in the fetcher. See the ruling below.
- **[I4] validated value == stored value** — **does not hold** as an absolute; ISS-001. I did not fail the unit on it (reasoning below), but it is now a contract invariant, so the next cycle that touches this route inherits it.
- **[I5] A13 is PARTIAL at best** — holds; ruled below.

## The rulings you asked for

### 1. URL validation — what got past it, and what I think belongs here

Probed directly against the route's `isHttpUrl`. Refused: `//evil.com`, `javascript:`, `file://`, relative, empty. Accepted: uppercase `HTTPS://` (correct), embedded credentials, `169.254.169.254`, `localhost:27017`, `127.0.0.1:6379`, `[::1]`, `10.0.0.5`, and Cyrillic homographs (`раypal.com` → `xn--ypal-43d9g.com`).

**On the internal-address block, plainly, since you asked me to commit:** I do **not** think it belongs in this unit, and this is an engineering judgement rather than a courtesy to the maker. A hostname check at registration time is not a control — the fetcher resolves DNS at fetch time, hours or days later, and an attacker who controls the hostname simply re-points it at `169.254.169.254` after the row is stored. Blocking a literal `http://169.254.169.254/` at this route buys nothing against anyone who can spell a domain name, while creating exactly the impression of safety that makes the real control feel optional later. **The sound control is in the fetcher, on the resolved IP, after DNS, with redirects re-checked at every hop.** That is where I put it: contract invariant `[I3]` says the fetcher unit must not be accepted without it, and ISS-002 (high) is filed now so it is queued before that unit is built rather than remembered afterwards. Redirects are likewise fetcher-scope — this unit issues no requests, so it cannot follow one.

**What I do think this unit owns is ISS-001 (medium):** it validates a *parsed* URL and stores an *unparsed* string. `new URL(value)` is called for the scheme check and then thrown away; `body.url` goes into the document verbatim. So a value with a trailing newline, or one written with backslashes after the scheme, is approved on the basis of the parse and then stored in a form a different parser may read differently. Storing `new URL(body.url).href` would cost one line and make the approved value and the stored value the same object. I did **not** fail the unit on it: `[C3]` is about refusing non-http(s) schemes and it does refuse them — every accepted string above genuinely *is* an http(s) URL under the parser that will most likely fetch it. It is a hardening gap in something the unit got substantially right, so it is filed rather than charged.

Homographs and credentials: homographs are a human-trust problem (the operator registering the source reads the URL), not a machine-safety one, and `new URL` already punycodes them — no finding. Credentials are ISS-003 (low), because `GET /watched-sources` hands them back and a fetcher will log them.

### 2. Tenant isolation — confirmed on the real path

Covered under `[I1]`. The real `store.ts` path is tenant-partitioned through `scopedCollection`, not merely by convention, and the escape hatch that caused ISS-060 and ISS-065 no longer exists.

### 3. The "no accessor, schema or pure-logic file was touched" claim

**Verified by diff. It is true.** Nine files, none of them T-027's. Worth stating explicitly because it was the right claim to make and it survived checking — the delegation in `store.ts` is genuinely a delegation, not a quiet second implementation.

### 4. Gap 2 — A13 is PARTIAL, and the unit boundary is right

**I agree with the maker, and I have written it into the contract as `[I5]` so it does not have to be re-argued.** A13's substance is *watching*: re-fetching a source on a timer, hashing it, and noticing that it changed. This unit delivers registration. Rows in `watched_sources` prove a user can express intent to watch; they prove nothing has ever been watched. `listActive` → `isDueForCheck` → `checkWatchedSource` → `recordFetch` is still an unwired chain, and `recordFetch` has still never been called by anything. A probe that scores A13 REAL on row count is measuring reachability and reporting capability — the same error already caught on B3 and B10. **PARTIAL, and only once a row actually exists; as of this commit A13 is still MISSING**, because this unit makes a write reachable without performing one. The maker states that itself in gap 1, and it is right not to claim the flip.

**On the boundary: no, shipping the entrypoint without the scheduler is not the wrong split — it is the better one.** The entrypoint is independently valuable (its absence is what made the feature dead), independently testable in-process with no network, and a hard prerequisite for the scheduler, which cannot be meaningfully exercised against an empty collection. Bundling them would have produced a unit whose SSRF surface, retry semantics, hashing and diffing all landed in one cycle alongside the validation — and the validation is precisely the part that deserved a check of its own. The one thing the split risks is exactly what ISS-002 guards against: a security control belonging to neither unit falling into the gap between them. That is now written down in both the contract and the ledger, which is what makes the split safe rather than merely convenient.

### 5. The two tracker corrections

**Correction 1 (the maker's own, U2.4 `partial` → `in_progress`): correct and required.** G1 enumerates open / pending / in_progress / blocked / done; `partial` is not among them. The instinct behind it was good — the detailed note is unusually honest about what is *not* done — but a status field is a controlled vocabulary and the prose note is where nuance belongs. It kept the note. Right fix.

**Correction 2 (reconciling the other lane's `U1.0` row): legitimate, and I checked rather than assumed it was load-bearing.** I deleted the `U1.0` row and re-ran the gate:

```
$ node scripts/tracker-audit.mjs --gate g1
tracker-audit --gate G1: 1 finding(s)
  G1 row-set: in goal.json but not TASKS.md — U1.0
exit=1
```

So without the reconciliation `lint:structure` fails, and `lint:structure` is this unit's own acceptance evidence. Leaving it failing would have meant submitting a unit that cannot demonstrate its own green gate, for a reason having nothing to do with the unit. That is the "should it have been left failing and reported?" question, and the answer is no: the maker would have had to report a red gate it could not fix without touching that row — the same action, minus the disclosure.

What makes it legitimate rather than lane-trespass is *what* was copied and *how*. It is a tracker row, not another lane's code, manifest or verdict — none of which may be touched. Its content derives entirely from committed artifacts: `.goal/goal.json`'s `U1.0` entry (status `done`, title matching) and `qa/verdicts/chunk-backfill.md`, which exists in this worktree. Nothing was invented, and the row is explicitly labelled *"reconciled from `.goal/goal.json` by the `lane/c-unrun-writers` session, not authored by it."* That label is what turns a cross-lane edit into an auditable one.

Two things I would still flag, neither a failure. **(a)** Both lanes now edit `TASKS.md`, so this row is a near-certain merge conflict when they converge — whoever merges should take the other lane's authored row over this reconciled one, and the "reconciled-not-authored" label is exactly the marker that makes that resolution obvious. **(b)** The cleaner form of "reconcile *and* report" would have been a one-line low ledger note alongside the row, so the cross-lane touch appears in the ledger and not only in a manifest section. The manifest disclosure is honest and prominent, so I am not charging it; I record it as the pattern to prefer next time a lane must unblock itself on shared tracker state.

## Notes to the maker (not failures)

- Four issues are on the ledger; **none is a defect of this unit**, and `ISSUES-WRITTEN: none` was a reasonable expectation. -002 is queued against work that does not exist yet, -004 is your own disclosed gap 3 recorded so it survives, -003 is minor, and -001 is the one thing I would actually change in this file, cheaply, whenever it is next opened.
- The manifest's known-gaps section made this check faster and softened no judgement. Disclosing that A13 will not flip, in a unit whose entire justification is A13, is the behaviour that makes the rest of the manifest credible.
