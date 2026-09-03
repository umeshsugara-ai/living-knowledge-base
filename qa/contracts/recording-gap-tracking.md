# Contract — recording-gap-tracking (T-006)

> Ground truth for "recording pending" gap tracking, per `Living-Knowledge-Base-Architecture.html`
> §1's process-first fallback ("standing ask to Bhakti/TOC; if it never arrives, logged as a
> gap entry rather than silently dropped") and ARCHITECTURE §5's "never silently drop" rule.
> Drafted by the maker; /checker adopts or amends on first check.

## Scope
A `gaps` collection (schema + accessor) tracking sessions/sources known to exist but not yet
captured (a webinar happened, no recording arrived yet), plus a small status-transition module in
`packages/ingest` that any adapter can call when it detects a gap (e.g., `packages/meeting-bot`'s
T-024 `assertProvidedFirst` path already surfaces warnings — this unit gives those warnings a
durable home instead of a one-off console message). No live Mongo, no live notification/email
required to PASS — same injectable-store pattern as every prior unit.

## Criteria (each machine-checkable)

1. **`schema/gaps.schema.json`** + fixtures: `{_id, tenantId, kind: 'recording-pending'|'source-
   pending', description, requestedFrom, requestedAt, status: 'open'|'received'|'expired',
   sla: {dueAt}, sourceRef?}` — `required: tenantId, kind, status`. Passes
   `schema/validate.py`'s existing loop (19→20 collections; extend, don't fork the validator).
2. **`packages/db/src/collections/gaps.ts`**: `coll(tenantId)`-pattern accessor matching T-018's
   existing 4 accessors exactly (same shape, same file structure) — `create`, `markReceived`,
   `markExpired`, `listOpen`.
3. **`packages/ingest/src/gap-tracking.ts`**: `recordGap(reason, context, store): Promise<GapDoc>`
   — called when an adapter's `assertProvidedFirst` (T-020) warns, or when a `capture()` (T-024)
   fails to join, or when a document/URL fetch 404s. Pure composition, no new I/O beyond the
   injected `store` (the `gaps` accessor from criterion 2).
4. **Wire into T-024's `capture.ts`**: on any `assertProvidedFirst` warning OR a `Joiner.join`
   failure, call `recordGap` (injected, so existing T-024 tests are unaffected unless they choose
   to assert on gap-recording — add ONE new test case for this wiring, don't rewrite T-024's
   existing suite).
5. **Standing-ask process, documented not coded:** `docs/adr/0002-standing-ask-process.md` (≤40
   lines) — the human-facing process (who gets asked, SLA default, escalation) per the
   architecture doc's "standing ask to Bhakti/TOC" pattern, generalized to any source. This is a
   process doc, not a feature — criterion is that it exists and is referenced from the `gaps`
   schema's `sla`/`requestedFrom` fields (so the code and the process agree on vocabulary).
6. **Tests exist and pass:** `packages/ingest/src/gap-tracking.test.ts` covering `recordGap`
   writes a correctly-shaped doc via a fake store; `packages/db/src/collections/gaps.test.ts`
   (if the existing 4 accessors have tests to mirror — check first) covering the accessor's
   tenant-safety (matches T-018's `@ts-expect-error` pattern if that's how the existing 4 do it).
7. **No regression:** `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py` (20/20), `pnpm lint:structure` all clean.

## Non-goals for T-006
- No live email/Slack notification (the "standing ask" is a documented human process for now, not
  an automated send). No SLA-countdown UI (deck's Missing Recording Workflow screen — later unit
  once a UI surface exists). No live Mongo write.
