# ADR-0003 — Recording purge/retention policy (T-026)

## Status
Accepted (maker draft per contract `qa/contracts/purge-retention-policy.md` C3; checker to
adopt/amend on first check).

## Context
D-008 (`docs/DECISIONS.md`) established silent capture as a last resort and left "purge-after-
processing to a defined level" as a mitigation deferred, not designed. The grill's pre-mortem
(F6, `C:/Users/Lenovo/.claude/plans/thik-hai-and-you-nested-cat.md`) named the concrete risk:
purging a recording *before* every claim citing it is verified breaks the "who said what, when"
promise exactly when it matters — an expert disputes a quote and there is no audio left to check.
Umesh accepted the mitigation (Q12: "haan, dono ilaaj lagao") but the mechanics were unspecified.

## Decision
1. **Purge is per-media, gated on citing claims.** A `media` doc (kind `recording`/`audio`/
   `video`) is purge-eligible only once EVERY `claims` doc that cites one of its `turnRefs` has
   `status === "verified"`. Media with no citing claims yet is NOT eligible (conservative —
   "nothing verified yet" is not the same as "vacuously all verified"). This is
   `isPurgeEligible()` in `packages/core/src/domain/purge-policy.ts`.
2. **`evidence-clip` media is exempt, permanently.** `schema/media.schema.json`'s `kind` enum
   already carries this value (T-018); this ADR fixes its purpose: a short (±15s) padded clip
   around every verified claim's cited turn, retained forever regardless of the parent
   recording's fate. `deriveEvidenceClipWindows()` computes these windows from verified claims +
   their turns.
3. **The delete itself is future work.** These are pure decision functions — no Mongo write, no
   scheduled job. A future purge worker reads `isPurgeEligible(media, claims)` for each `recording`/
   `audio`/`video` doc, and on `eligible: true` (a) ensures evidence clips exist for every verified
   claim citing it (via `deriveEvidenceClipWindows` + an actual clip-extraction step, not built
   here), (b) sets `media.retention.purgeAfterVerified = true` and `purgedAt` to now, (c) deletes
   the underlying file. That worker is a separate maker unit.
4. **Padding default: 15 seconds**, matching the grill capture verbatim ("±15 s evidence clips
   retained"). Configurable per call (`deriveEvidenceClipWindows(claims, turns, paddingSeconds)`)
   but no per-tenant config yet (YAGNI until a second value is needed, same reasoning as
   ADR-0002's SLA default).

## Consequences
No recording is ever actually deleted by this unit — `isPurgeEligible` is advisory until a worker
consumes it. A claim that stays `needs-review`/`conflicting` forever keeps its media un-purgeable
forever, by design (the policy favors provenance retention over storage cost when in doubt).
