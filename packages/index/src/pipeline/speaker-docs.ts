/**
 * packages/index/src/pipeline/speaker-docs.ts — U2.4 apply step, the PURE half.
 *
 * Everything upstream of this file could only ever REFUSE to name someone. This one writes
 * identities down, so its failure mode is different in kind: it can assert that two different
 * human beings are the same person.
 *
 * That risk is concrete and was carried here as a blocking item from three checker cycles.
 * `personId` is derived from the spoken name (`personIdFor` in `speakers.ts`), so two people
 * legitimately called "Ruby" in different sessions produce the same id. No amount of pattern work
 * upstream fixes that — it is an identity question, not a text question.
 *
 * The rule this module adopts: **merge, but never silently.**
 *   - Same session, same name -> one person. Diarization splitting one voice across `spk:N` labels
 *     is the common case, and treating those as two people would be the worse error.
 *   - Different sessions, same name -> merged into one document, but recorded as a COLLISION and
 *     the document's confidence is lowered. A caller cannot report a clean write over an
 *     ambiguous one, because the collisions come back alongside the docs.
 *
 * What it deliberately does NOT do: decide that two same-named speakers are different people. There
 * is no evidence in the corpus that could settle it, and inventing a disambiguator ("person:ruby-2")
 * would fabricate a distinction as confidently as merging fabricates an identity.
 */
import type { Speakers } from "@lkb/core";
import type { ResolvedSpeaker } from "./speakers.js";

export interface SessionResolution {
  sessionId: string;
  resolved: ResolvedSpeaker[];
}

/** A `personId` claimed by evidence from more than one session. Reported, never hidden. */
export interface SpeakerCollision {
  personId: string;
  sessionIds: string[];
  aliases: string[];
}

export interface SpeakerDocsResult {
  docs: Speakers[];
  collisions: SpeakerCollision[];
}

/** Observed in a single session: the name was spoken there and cited there. */
const CONFIDENCE_SINGLE_SESSION = 0.9;
/** Merged across sessions on a name match alone: an inference, and priced as one. */
const CONFIDENCE_CROSS_SESSION = 0.6;

/**
 * `Speakers` documents from per-session resolutions.
 *
 * Pure and synchronous — it does not touch Mongo, so the decision of what to write is reviewable
 * separately from the act of writing it. A speaker with no surviving evidence is dropped rather
 * than written with an empty `evidence` array, which `speakers.schema.json` forbids anyway
 * (`minItems: 1`) — the same posture as `claims.ts`.
 */
export function buildSpeakerDocs(tenantId: string, sessions: SessionResolution[]): SpeakerDocsResult {
  const byPerson = new Map<string, {
    aliases: string[];
    evidence: { turnId: string; sessionId: string }[];
    sessionIds: Set<string>;
  }>();

  for (const session of sessions) {
    for (const speaker of session.resolved) {
      if (speaker.evidence.length === 0) continue; // never write empty evidence
      const entry = byPerson.get(speaker.personId) ?? { aliases: [], evidence: [], sessionIds: new Set() };
      if (!entry.aliases.includes(speaker.displayName)) entry.aliases.push(speaker.displayName);
      for (const e of speaker.evidence) {
        if (!entry.evidence.some((x) => x.turnId === e.turnId)) entry.evidence.push(e);
        entry.sessionIds.add(e.sessionId);
      }
      byPerson.set(speaker.personId, entry);
    }
  }

  const docs: Speakers[] = [];
  const collisions: SpeakerCollision[] = [];

  for (const [personId, entry] of byPerson) {
    const sessionIds = [...entry.sessionIds].sort();
    const crossSession = sessionIds.length > 1;
    if (crossSession) collisions.push({ personId, sessionIds, aliases: [...entry.aliases] });

    const alias0 = entry.aliases[0];
    if (alias0 === undefined) continue; // unreachable in practice; the schema needs minItems 1
    docs.push({
      _id: `${tenantId}-${personId}`,
      tenantId,
      personId,
      aliases: [alias0, ...entry.aliases.slice(1)],
      confidence: crossSession ? CONFIDENCE_CROSS_SESSION : CONFIDENCE_SINGLE_SESSION,
      evidence: [entry.evidence[0]!, ...entry.evidence.slice(1)],
    });
  }

  docs.sort((a, b) => a.personId.localeCompare(b.personId));
  collisions.sort((a, b) => a.personId.localeCompare(b.personId));
  return { docs, collisions };
}
