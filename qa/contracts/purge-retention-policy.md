# Contract — purge-retention-policy (T-026)

> Ground truth for the recording purge policy, per D-008 (`docs/DECISIONS.md`) and the grill's F6
> mitigation ("purge is gated: media may be deleted only when every claim citing it has status
> `verified`; an evidence clip (±15s) per cited turn is retained permanently"). Drafted by the
> maker; /checker adopts or amends on first check.

## Scope
Two pure decision functions in `packages/core/src/domain/purge-policy.ts` (the monorepo design's
own designated home for "generated types + pure functions, NO I/O" — D-003) plus a short process
ADR. **No live deletion, no live Mongo write** — same "seam first, real wiring later" pattern
every prior unit followed (T-019's providers, T-020's adapters); a worker/job that actually calls
these functions and performs the delete is a later unit, not this one.

## Criteria (each machine-checkable)

1. **`isPurgeEligible(media, turnsForMedia, claimsForTenant): {eligible: boolean, reason: string}`**
   — `media: Media` (schema/media.schema.json). Rules, in order:
   - `media.kind === "evidence-clip"` → `{eligible: false, reason: "evidence clips are retained permanently (D-008)"}`, unconditionally, regardless of any claim status.
   - `media.turnRefs` empty/undefined → `{eligible: false, reason: "no turns linked to this media yet"}`.
   - No claim in `claimsForTenant` cites (`evidence[].turnId`) any id in `media.turnRefs` → `{eligible: false, reason: "no claim has cited this media yet — nothing has been verified"}` (conservative: unprocessed media is never purge-eligible, not vacuously true).
   - At least one citing claim has `status !== "verified"` → `{eligible: false, reason: "N claim(s) citing this media are not yet verified"}` (N in the message).
   - Otherwise (≥1 citing claim, all verified) → `{eligible: true, reason: "all N citing claim(s) are verified"}`.
2. **`deriveEvidenceClipWindows(claims, turns, paddingSeconds = 15): EvidenceClipWindow[]`** —
   `EvidenceClipWindow = {sessionId, turnId, tStart, tEnd}`. For every `status === "verified"`
   claim's `evidence[]` entry, resolve the cited turn from `turns` (by `_id === turnId &&
   sessionId === evidence.sessionId`) and emit a window `{tStart: max(0, turn.tStart -
   paddingSeconds), tEnd: turn.tEnd + paddingSeconds, turnId, sessionId}`. Skips (does not throw)
   an evidence entry whose turn can't be resolved — logged as absent from the result, not a crash
   (matches this codebase's "never silently drop, but never crash on a data gap either" pattern —
   T-006's gap tracking is the precedent; a genuinely missing turn is a data problem for the gap
   ledger, not this pure function's job to raise). De-duplicates identical `{sessionId, turnId}`
   windows (a turn cited by two different verified claims produces one window, not two).
3. **`docs/adr/0003-purge-retention-policy.md`** (≤60 lines, matching `0001`/`0002`'s own budget)
   — states the human-facing rule these functions encode: purge is per-media, gated on every
   citing claim being verified; `evidence-clip` media is exempt and permanent; the actual delete
   operation (a worker consuming `isPurgeEligible`'s verdict) is future work, referenced but not
   built here. References `media.retention.purgeAfterVerified` (schema/media.schema.json, T-018)
   as the field a future purge worker would set from this function's `eligible` result.
4. **Tests exist and pass**: `packages/core/src/domain/purge-policy.test.ts` covering: an
   evidence-clip media is never eligible even with all-verified claims; media with no linked
   turns is not eligible; media with turns but no citing claims is not eligible; media with a
   mix of verified/unverified citing claims is not eligible, reason names the count; media with
   only verified citing claims is eligible; `deriveEvidenceClipWindows` produces correctly padded
   windows, clamps `tStart` at 0, skips an unresolvable turn without throwing, and de-duplicates.
5. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-026
- No live Mongo delete/update — a later worker unit wires these pure functions to an actual purge
  job (reads `isPurgeEligible` per media doc, sets `retention.purgeAfterVerified` / `purgedAt`,
  performs the delete only after that). No scheduling/cron. No UI. No change to
  `schema/media.schema.json` (its `retention` shape already supports this, from T-018).
