# Verdict — search-turn-query-count

**Date:** 2026-09-09
**Mode:** A (unit check)
**Contract:** `qa/contracts/search-route.md` C9 and I3
**Manifest:** `qa/manifests/search-turn-query-count.md`
**Cycle checked: 1** (matches `Fix cycle: 1 of max 3`)
**Bound to:** `D:/KnowledgeBase`
**Dual check:** no

```
VERDICT: PASS
SCOREBOARD: 1/1 criteria met, 1/1 invariants hold
FAILURES: none
LIVE-BROWSER: not-applicable (apps/api/src/search-store.test.ts; no UI path changed)
ISSUES-WRITTEN: ISS-085 moved open -> fixed (not verified)
EXPLANATION: The test counts exactly one turns.find call, zero turns.findOne calls, and one
session lookup per distinct session on a non-vacuous three-hit/two-session fixture. An independent
output-preserving N+1 mutation compiled but reddened exactly this focused guard with three per-hit
turn lookups; the production file was restored byte-identically and all checks returned green.
```

## Independent evidence

| Check | Result |
|---|---|
| Focused `node --test --import tsx --test-name-pattern="turns load once" src/search-store.test.ts` | PASS, 1/1 |
| Full API `node --test --import tsx "src/**/*.test.ts"` | PASS, 173/173 |
| API typecheck `node_modules/.bin/tsc.cmd --noEmit -p apps/api/tsconfig.json` | exit 0 |
| `npm run lint:structure` | PASS: 288 files, 78 directories, fresh snapshot, tracker G1/G4, 0 dependency violations across 305 modules |
| `git diff --check -- apps/api/src/search-store.test.ts qa/manifests/search-turn-query-count.md` | exit 0 |

The repository's `pnpm` wrapper attempted an automatic dependency reinstall and stopped at its
non-TTY purge prompt before executing the suite. The same checks were therefore run directly
through the already-installed Node and TypeScript binaries; both instruments completed.

## C9 / I3 inspection

`apps/api/src/search-store.test.ts:203-213` exercises `createMongoSearchDeps` through the filtering,
call-capturing injected database. The query `"2026"` returns three hits over two distinct sessions,
so both per-hit turn lookup and lost session dedup are observable. Assertions require exactly one
`turns.find`, zero `turns.findOne`, and a `sessions.findOne` count equal to distinct sessions.

The shipped implementation at `apps/api/src/search-store.ts:65-80` fetches turns once, builds
`turnById` from that array, deduplicates session ids with `Set`, and resolves from in-memory maps.

## Mutation replay and restore

At `apps/api/src/search-store.ts:71`, I temporarily replaced the in-memory map with
`Promise.all(scored.map(... turnsColl(tenantId).findOne({_id: hit.turnId}) ...))`. The mutation
preserves output, remains tenant-scoped, and reintroduces one turn lookup per hit while leaving the
initial `find` in place.

- Mutated API typecheck: exit 0.
- Mutated focused test: FAIL, 0/1, with exactly
  `3 turns.findOne calls — per-hit turn lookup reintroduces N+1` (`3 !== 0`).
- Restored SHA-256:
  `05376AAD57261973D0F0B9FAF31C173BC75DD0DA90105F63D7315F5541159142`.
- `git hash-object` and `git rev-parse HEAD:apps/api/src/search-store.ts` both:
  `7ca2c8315ef8b50083dac920d1c4dd2c319c8a4f`.
- After restoration: focused 1/1 and full API 173/173.

No UI surface changed, so Mode D is not applicable. ISS-085 moves to `fixed`, not `verified`.
