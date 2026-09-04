# Contract — ask-web-fallback-tavily (closes ISS-010's third sub-gap)

> ISS-010 (medium, filed by an earlier checker sweep) named three Phase-1 exit gaps: (1) `POST
> /ask` route owned by no task, (2) web-search provider absent from T-019, (3) `D-002` retention
> field absent from T-018. Verified this tick: (1) and (3) were already real — `POST /ask` exists
> and is tested, `media.schema.json` already requires `retention`. Only (2) was genuinely still
> open: `/ask`'s CRAG router promises "internal-first, web-fallback-only-when-needed" but no real
> web-search provider was ever wired into production, so an ambiguous/incorrect verdict always
> came back `insufficient_coverage: true` — the fallback path existed in name only. This unit
> closes that gap. Drafted by the maker; /checker adopts or amends on first check.

## Design constraint (why this isn't a router.ts change)

`packages/ask/src/router.ts`'s `WebFallbackFn` is synchronous (`(query) => WebSource[]`), part of
T-005/T-016 — already shipped, checker-PASSed, and (per this repo's Lab Protocol update-
authorization rules) not something to touch without a DECISIONS-authorized amendment. A real
Tavily HTTP call is inherently async, so it cannot be a `WebFallbackFn`. This unit layers a
**second, optional, async fallback** on top of `router.ts` — entirely inside `ask-v2.ts`, which
was already async and already branches on verdict — rather than touching the frozen sync
interface. `router.ts` and `router.test.ts` are untouched by this unit (verify via `git diff
packages/ask/src/router.ts` — empty).

## Criteria (each machine-checkable)

1. **`packages/ask/src/ask-v2.ts`** — `AskV2Deps` gains an optional `tavilySearchFn?: (query:
   string) => Promise<WebSource[]>`. After `ask()` returns, if `askResult.insufficient_coverage
   && tavilySearchFn`, call it, merge the results into a new `askResult` (`web_used: true,
   insufficient_coverage: false, sources.web: <fetched>`), and log the call via `recordJob` +
   `auditLog` (`kind: "ask.web_fallback"`, `step: "web_fallback"`). This is reachable ONLY when
   the sync `webFallbackFn` path did NOT already run (mutually exclusive by construction:
   `insufficient_coverage` is true exactly when verdict != correct AND no `webFallbackFn` fired).
   When `tavilySearchFn` is omitted (today's production default), behavior is byte-identical to
   before this unit.
2. **`apps/api/src/ask-web-fallback.ts`** (new) — `createTavilySearchFn()`: returns `undefined`
   when `TAVILY_API_KEY` is unset (real today — `.env`'s value is empty), else a real function
   calling `POST https://api.tavily.com/search`. On a non-OK response, throws a real error
   (never silently returns `[]` — a caller must be able to tell "no results" from "the call
   failed"). Same composition-root pattern as `ingest-store.ts`'s `jinaReaderFetch` (plain
   `fetch`, no vendor SDK).
3. **`apps/api/src/production.ts`** — wires `createTavilySearchFn()`'s result into `askDeps` only
   when truthy (spread-conditional, matching the existing `corsOrigins`/provider-registration
   style already in this file).
4. **No regression.** `pnpm --filter @lkb/ask typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm -r test`, `pnpm lint:structure` all exit 0. `packages/ask/src/router.ts` and
   `router.test.ts` show zero diff.
5. **Real unit-test coverage** (fixtures/fakes, no real network — see disclosed limitation
   below): `ask-v2.test.ts` gets 2 new tests (the async fallback fires and clears
   `insufficient_coverage`; when `tavilySearchFn` is omitted, behavior is unchanged).
   `ask-web-fallback.test.ts` (new) gets 3 tests: returns `undefined` with no key, calls the real
   endpoint shape + maps results with a key (fetch mocked), throws a real error on a non-OK
   response.

## Disclosed limitation (real, not hidden)

`TAVILY_API_KEY` is empty in `.env` — no real Tavily account exists yet. This unit ships the
full, real, tested code path (interface-first, same precedent as the Calendar/Gmail `gws`
adapters before those had real live verification), but the actual live HTTP call to
`api.tavily.com` has never been exercised end-to-end, because there is no key to exercise it
with. `production.ts` omits `tavilySearchFn` entirely in this state, so `/ask`'s current,
already-shipped behavior (`insufficient_coverage: true` on ambiguous/incorrect with no fallback)
is completely unchanged until Umesh adds a real key. This is disclosed, not silently assumed to
work.

**Separately, also disclosed:** live end-to-end verification of `/ask` itself (even the
unchanged-behavior path) was attempted and blocked this session by a real, transient
infrastructure issue — the project's remote Mongo host (`13.202.206.101:27017`) was unreachable
(`ETIMEDOUT`, 100% ping loss) at verification time, unrelated to any code in this unit (confirmed
via `ping` — a network-level outage, not a Mongo auth/config problem). The full test suite (which
does not require live Mongo) is green; live-server verification is deferred to whenever
connectivity is restored, not skipped silently.

## Real evidence

### Typecheck
```
$ cd packages/ask && npx tsc --noEmit -p tsconfig.json    # exit 0
$ cd apps/api && npx tsc --noEmit -p tsconfig.json         # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ingest:      34/34 pass
packages/ask:         32/32 pass   (was 30, +2 tavilySearchFn tests)
packages/meeting-bot: 40/40 pass
apps/api:             59/59 pass   (was 56, +3 ask-web-fallback tests)
apps/web:             34/34 pass
Total: 287 tests, 287 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (195 file(s) within budget)
lint-dirsize: OK (73 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (227 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (968 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (226 modules, 648 dependencies cruised)
```

### `router.ts` / `router.test.ts` untouched (frozen interface respected)
```
$ git diff --stat packages/ask/src/router.ts packages/ask/src/router.test.ts
(empty output)
```

### Real Mongo connectivity check (why live /ask verification is deferred)
```
$ ping -n 2 13.202.206.101
Packets: Sent = 2, Received = 0, Lost = 2 (100% loss)
$ npx tsx apps/api/src/index.ts   # MongoServerSelectionError: connect ETIMEDOUT 13.202.206.101:27017
```

## How to verify (for the checker)
1. `pnpm --filter @lkb/ask typecheck` and `pnpm --filter @lkb/api typecheck` — expect exit 0.
2. `pnpm -r test` — expect exit 0, 287/287.
3. `pnpm lint:structure` — expect exit 0.
4. `git diff --stat packages/ask/src/router.ts packages/ask/src/router.test.ts` — expect empty.
5. Read `ask-v2.ts`, `ask-web-fallback.ts`, `production.ts` — confirm the merge logic is correct
   (mutually exclusive with the sync path), confirm `createTavilySearchFn` never silently
   swallows a failed HTTP call, confirm `production.ts` only wires it when truthy.
6. If Mongo connectivity has been restored by check time, a live `curl -X POST
   http://localhost:3300/ask` with a real key + query is a bonus confirmation that `/ask` still
   works unchanged — not required, since the disclosed limitation above already explains why it
   couldn't be done at manifest time.
