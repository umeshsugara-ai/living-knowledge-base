# Contract — watched-sources (T-027)

> Ground truth for Watched Sources (A13), per plan §4c A13 and Umesh's explicit ask: "bookmark
> reputed websites / landing pages / specific URLs as 'gold' sources → periodic fetch → content
> hash + diff → only changed sections re-enter the pipeline." Depends T-023 (URL adapter, done).
> Drafted by the maker; /checker adopts or amends on first check.

## Scope
A `watched_sources` collection (bookmark + reputation tier + last-fetch provenance) + two pure
decision functions in `packages/ingest/src/watched/` that reuse T-023's `UrlFetcher`/`UrlHasher`
seam (not a second fetch/hash abstraction): `isDueForCheck` (when to re-fetch) and
`checkWatchedSource` (fetch + hash + diff-against-last-known-hash). **Change notifications and the
periodic-scheduling job itself are out of scope** — same "process doc, not code" posture as T-006
(`docs/adr/0002-standing-ask-process.md`): a future scheduled worker calls `checkWatchedSource`
per due source and, on `changed: true`, is responsible for re-ingesting via T-023's `url` adapter
and for any actual notification.

## Criteria (each machine-checkable)

1. **`schema/watched_sources.schema.json`** + fixtures: `{_id, tenantId, url, label?,
   reputationTier: 'official'|'community'|'blog', checkIntervalHours, active, lastFetch?:
   {fetchedAt, hash, diffFrom: string|null}}` — `required: tenantId, url, reputationTier,
   checkIntervalHours, active`. `reputationTier` reuses the brain's source-priority-tier
   vocabulary (`multi-portal-source-priority-tiers`, referenced in plan A13) — official > community
   > blog. Extends `schema/validate.py`'s loop (21→22 collections).
2. **`packages/db/src/collections/watched-sources.ts`**: `coll(tenantId)` accessor matching the
   existing pattern (`gaps.ts`/`eval-runs.ts`) — `create`, `recordFetch(tenantId, id, {fetchedAt,
   hash, diffFrom})`, `listActive`.
3. **`packages/ingest/src/watched/schedule.ts`**: `isDueForCheck(source, now: string): boolean` —
   pure. Never fetched (`lastFetch` absent) → always due. Otherwise due iff `now - lastFetch.
   fetchedAt >= checkIntervalHours` (hours, converted to ms). An inactive (`active: false`) source
   is never due, regardless of timing.
4. **`packages/ingest/src/watched/check.ts`**: `checkWatchedSource(source, fetcher: UrlFetcher,
   hasher: UrlHasher, now: () => string): Promise<WatchCheckResult>` — `WatchCheckResult =
   {changed: boolean, hash, fetchedAt, diffFrom: string | null}`. Fetches via the injected
   `UrlFetcher` (T-023's type, imported not redeclared), hashes via the injected `UrlHasher`
   (same). `diffFrom` = the source's previous hash (or `null` if never fetched before). `changed`
   = true if never fetched before OR the new hash differs from the previous one.
5. **`docs/adr/0004-watched-sources-scheduling.md`** (≤60 lines, matching 0001-0003's budget) —
   the human-facing process: who owns the reputation-tier assignment (official/community/blog),
   the default `checkIntervalHours` (pick and justify one value, matching ADR-0002's "pick a
   default, document why" pattern), and that re-ingestion on `changed: true` is future-worker
   territory, not built here.
6. **Tests exist and pass**: `packages/ingest/src/watched/schedule.test.ts` (never-fetched is
   always due; inactive is never due regardless of elapsed time; due/not-due boundary at exactly
   `checkIntervalHours`) and `packages/ingest/src/watched/check.test.ts` (first-ever check on a
   source with no `lastFetch` is always `changed: true`; identical content on a second check is
   `changed: false`; different content is `changed: true` with `diffFrom` set to the prior hash) —
   both via fake fetcher/hasher, no live network.
7. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py` (22/22), `pnpm lint:structure` all clean.

## Non-goals for T-027
- No scheduled job/cron that actually calls `isDueForCheck`/`checkWatchedSource` on a cadence.
  No live notification (Slack/email) on `changed: true` — a documented human/future-worker
  concern, per ADR-0004. No automatic re-ingestion pipeline wiring (a future worker composes
  `checkWatchedSource` + T-023's `createUrlSource` — not built here). No UI for
  bookmarking/managing watched sources.
