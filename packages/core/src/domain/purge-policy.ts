/**
 * packages/core/src/domain/purge-policy.ts — T-026. Pure decision functions for D-008's gated
 * purge rule (recording is purged only once every claim citing it is verified; ±15s evidence
 * clips are retained permanently regardless) and the grill's F6 mitigation ("provenance rot via
 * purge" — retain a clip per cited turn so a disputed claim can still be traced to audio). No I/O
 * anywhere in this file — a future worker unit reads `isPurgeEligible`'s verdict and performs the
 * actual delete/retention-field update against Mongo; that wiring is out of scope here (see
 * `docs/adr/0003-purge-retention-policy.md`).
 */
import type { Media } from "../generated/media.js";
import type { Claims } from "../generated/claims.js";
import type { Turns } from "../generated/turns.js";

export interface PurgeVerdict {
  eligible: boolean;
  reason: string;
}

function citingClaims(turnRefs: string[], claims: Claims[]): Claims[] {
  const wanted = new Set(turnRefs);
  return claims.filter((c) => c.evidence.some((e) => wanted.has(e.turnId)));
}

/**
 * `media` — the candidate for purge. `claimsForTenant` — every claim for this media's tenant
 * (this function filters to the ones that actually cite `media.turnRefs` itself).
 */
export function isPurgeEligible(media: Media, claimsForTenant: Claims[]): PurgeVerdict {
  if (media.kind === "evidence-clip") {
    return { eligible: false, reason: "evidence clips are retained permanently (D-008)" };
  }

  const turnRefs = media.turnRefs ?? [];
  if (turnRefs.length === 0) {
    return { eligible: false, reason: "no turns linked to this media yet" };
  }

  const citing = citingClaims(turnRefs, claimsForTenant);
  if (citing.length === 0) {
    return { eligible: false, reason: "no claim has cited this media yet — nothing has been verified" };
  }

  const unverified = citing.filter((c) => c.status !== "verified");
  if (unverified.length > 0) {
    return {
      eligible: false,
      reason: `${unverified.length} claim(s) citing this media are not yet verified`,
    };
  }

  return { eligible: true, reason: `all ${citing.length} citing claim(s) are verified` };
}

export interface EvidenceClipWindow {
  sessionId: string;
  turnId: string;
  tStart: number;
  tEnd: number;
}

function windowKey(w: Pick<EvidenceClipWindow, "sessionId" | "turnId">): string {
  return `${w.sessionId}::${w.turnId}`;
}

/**
 * For every `verified` claim's evidence entries, derives a padded evidence-clip window around
 * the cited turn (grill F6: retained permanently so a disputed claim can still be traced to
 * audio even after the underlying recording is purged). An evidence entry whose turn cannot be
 * resolved in `turns` is skipped, not thrown on (a genuinely missing turn is a data-gap concern,
 * not this function's job to raise — matches T-006's gap-tracking precedent). De-duplicates a
 * turn cited by more than one verified claim into a single window.
 */
export function deriveEvidenceClipWindows(claims: Claims[], turns: Turns[],
  paddingSeconds = 15): EvidenceClipWindow[] {
  const turnById = new Map(turns.map((t) => [`${t.sessionId}::${t._id}`, t]));
  const seen = new Set<string>();
  const windows: EvidenceClipWindow[] = [];

  for (const claim of claims) {
    if (claim.status !== "verified") continue;
    for (const e of claim.evidence) {
      const turn = turnById.get(`${e.sessionId}::${e.turnId}`);
      if (!turn) continue;
      const key = windowKey({ sessionId: e.sessionId, turnId: e.turnId });
      if (seen.has(key)) continue;
      seen.add(key);
      windows.push({
        sessionId: e.sessionId,
        turnId: e.turnId,
        tStart: Math.max(0, turn.tStart - paddingSeconds),
        tEnd: turn.tEnd + paddingSeconds,
      });
    }
  }

  return windows;
}
