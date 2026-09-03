# ADR-0004 — Watched Sources: reputation tiers + check cadence (T-027)

## Status
Accepted (maker draft per contract `qa/contracts/watched-sources.md` C5; checker to adopt/amend
on first check).

## Context
Umesh's explicit ask (grill capture, plan §4c A13): "bookmark reputed websites / landing pages /
specific URLs as 'gold' sources → periodic fetch → content hash + diff → only changed sections
re-enter the pipeline." This ADR fixes the two things the ask left unspecified: who decides a
source's trust tier, and how often a source gets re-checked.

## Decision
1. **Reputation tiers reuse the brain's existing vocabulary** (`multi-portal-source-priority-
   tiers`): `official` (government/university pages — highest trust, e.g. immigration ministries,
   university admissions pages), `community` (TOC/expert-group-adjacent sites, forums), `blog`
   (lowest trust, informational only). Tier assignment is a **human decision at bookmark time**
   (whoever adds the watched source picks the tier) — no automated tier inference in this unit.
2. **Default `checkIntervalHours`: 24** (once daily). Chosen because official/government pages
   (visa rules, program pages) change on the order of days-to-weeks, not hours — a 24h cadence
   catches changes promptly without hammering the source (matching ADR-0002's "pick a default,
   document why, override per-instance" reasoning). Callers set a shorter interval per source if
   a specific page is known to be more volatile; there is no per-tenant global override yet
   (YAGNI until a second global value is needed).
3. **First check is always "changed".** `checkWatchedSource` treats a source with no `lastFetch`
   as `changed: true` unconditionally — the first successful fetch IS new content to ingest, not
   a no-op.
4. **Re-ingestion and notification are future-worker territory, not this unit.** A scheduled
   worker (not built here) reads `listActive` (packages/db), filters to `isDueForCheck(source,
   now)`, calls `checkWatchedSource` per due source, persists the result via `recordFetch`, and —
   on `changed: true` — is responsible for actually re-ingesting via T-023's `createUrlSource` and
   for any human-facing notification. No live Slack/email exists yet, matching ADR-0002's posture
   for gap escalation.

## Consequences
No page is ever actually re-checked by this unit alone — `isDueForCheck`/`checkWatchedSource` are
advisory pure functions until a worker calls them on a real cadence. A watched source with
`active: false` is permanently skipped regardless of elapsed time, by design (an explicit
pause/archive mechanism, not a bug).
