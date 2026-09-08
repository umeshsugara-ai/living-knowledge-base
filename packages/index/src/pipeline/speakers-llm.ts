/**
 * packages/index/src/pipeline/speakers-llm.ts — U2.4 (catalogue B3/B10), the LLM half.
 *
 * `speakers.ts` resolves 78/494 positional turns (15.8%) from explicit self-naming alone. This is
 * the path to the other ~84%, and it inherits `claims.ts`'s posture wholesale: the model is asked
 * to cite real turn ids, and its output is NEVER trusted blind.
 *
 * One guard here has no counterpart in `claims.ts`, and it is the reason this module exists in
 * this shape. A claim is prose the model composes, so it can only be checked for *provenance*. A
 * speaker name is a string that must actually have been SPOKEN — so it can be checked for
 * *identity*, and it is: every `displayName` must appear verbatim in every turn cited as its
 * evidence (plan §10, "zero speaker name that does not appear verbatim in a cited turn").
 *
 * That check is not theoretical. The generated summary for one real session says "Juben Thakur"
 * while its transcript says "Jubin Thakkar" — a normalisation the summarizer introduced. A model
 * given the same corpus can reach the same wrong spelling honestly. Without this guard a
 * plausible, well-formed, completely unspoken name would ship as a cited fact about a real person.
 *
 * Degradation is deliberate and follows §10's "keep the regex as the degradation fallback": if the
 * provider call fails or returns junk, this falls back to the deterministic pass rather than
 * returning an empty result that a caller would mistake for "no speakers in this session"
 * (the ISS-056 failure mode that made `claims.ts` grow its own `degraded` flag).
 */
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";
import { parseJsonLoose } from "@lkb/ai";
import { personIdFor, resolveSpeakers, type ResolvedSpeaker } from "./speakers.js";

export type SpeakersCompleteFn = (job: Job) => Promise<CompleteResult>;

const POSITIONAL = /^spk:\d+$/;

const SPEAKERS_SYSTEM_PROMPT = [
  "You identify who each anonymous speaker in a transcript actually is. Each line is one turn,",
  "prefixed with its real turn id and its anonymous speaker label, e.g. [id:t12] [spk:0] ...",
  "Some speakers introduce themselves, are greeted by name, or are handed over to by name.",
  'Respond with ONLY a JSON array: [{"speakerRef": "<the exact spk:N label>",',
  '"displayName": "<the person\'s name EXACTLY as it is spelled in the transcript>",',
  '"turnIds": ["<turn ids that show this person is that speaker>"]}, ...].',
  "Copy the name character-for-character from the transcript -- never correct, normalise or",
  "complete a spelling, and never supply a name the transcript does not contain. Copy every",
  "turnId exactly from the [id:...] prefixes. If you cannot tell who a speaker is, leave them out",
  "entirely -- an unnamed speaker is correct, a guessed one is a serious error. If no speaker can",
  "be identified, respond with an empty array [].",
].join(" ");

/**
 * Name particles that are legitimately lowercase INSIDE a name ("van der Berg", "de Souza").
 * Never valid as the first token, which is why `looksLikeAName` only allows them at i > 0.
 */
const NAME_PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "dos", "du", "la", "le",
  "bin", "binte", "ibn", "al", "el",
]);

/**
 * Is this string shaped like a person's name at all?
 *
 * The model supplies `displayName`, so "it appears in the transcript" is not sufficient -- a
 * greeting appears in the transcript too. The cycle-1 checker got `"Good morning"` shipped as
 * `person:good-morning` on exactly that gap. Requiring each token to be capitalised (bar interior
 * particles) rejects prose while keeping real names.
 *
 * Deliberately conservative, consistent with "leave low-confidence speakers unresolved rather than
 * guessing": an all-lowercase real name, or one longer than four tokens, is refused not guessed.
 */
export function looksLikeAName(name: string): boolean {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  return tokens.every((tok, i) => {
    if (/^\p{Lu}[\p{L}'’.-]*$/u.test(tok)) return true;
    return i > 0 && i < tokens.length - 1 && NAME_PARTICLES.has(tok.toLowerCase());
  });
}

/**
 * Does `text` contain `name` as WHOLE WORDS?
 *
 * A bare `includes()` let `"Ruby"` match `"My name is Rubykumar Shah."` and ship as `person:ruby`
 * -- a different real person. Unicode-aware lookarounds are used rather than ``, which is
 * ASCII-only and would misjudge non-Latin scripts.
 */
export function containsNameVerbatim(text: string, name: string): boolean {
  // Deliberately not a RegExp: building one from a model-supplied string means escaping it
  // correctly every time, and a mis-escape here fails OPEN (it would widen what counts as a
  // match). indexOf plus an explicit boundary test has no escaping surface at all.
  const isWordChar = (ch: string | undefined): boolean =>
    ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
  for (let from = 0; ; ) {
    const at = text.indexOf(name, from);
    if (at === -1) return false;
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + name.length])) return true;
    from = at + 1;
  }
}

function buildCitableTranscript(turns: Turns[]): string {
  return turns.map((t) => `[id:${t._id}] [${t.speakerRef}] ${t.text}`).join("\n");
}

export interface SpeakerExtractionResult {
  resolved: ResolvedSpeaker[];
  /** Positional labels still unnamed. Reported, never guessed at. */
  unresolved: string[];
  /** `null` when extraction genuinely ran; a reason when the result means "unknown", not "none". */
  degraded: { reason: string } | null;
}

interface RawSpeaker {
  speakerRef?: unknown;
  displayName?: unknown;
  turnIds?: unknown;
}

function positionalLabels(turns: Turns[]): string[] {
  return [...new Set(turns.filter((t) => POSITIONAL.test(t.speakerRef ?? "")).map((t) => t.speakerRef))].sort();
}

/** The deterministic pass, relabelled as a degraded result. */
function fallback(turns: Turns[], reason: string): SpeakerExtractionResult {
  const { resolved, unresolved } = resolveSpeakers(turns);
  return { resolved, unresolved, degraded: { reason } };
}

/**
 * Speaker identities for one session's positional labels, via the injected LLM `complete`.
 *
 * Never throws. Every returned `displayName` is verbatim-present in every turn it cites, every
 * cited turn id is real, and a label the model names two different ways is left unresolved rather
 * than settled by a coin flip.
 */
export async function extractSpeakers(turns: Turns[], complete: SpeakersCompleteFn): Promise<SpeakerExtractionResult> {
  if (turns.length === 0) return { resolved: [], unresolved: [], degraded: null };

  const byId = new Map(turns.map((t) => [t._id, t]));
  const labels = new Set(positionalLabels(turns));

  let raw: unknown;
  try {
    const completion = await complete({
      kind: "speakers",
      messages: [
        { role: "system", content: SPEAKERS_SYSTEM_PROMPT },
        { role: "user", content: buildCitableTranscript(turns) },
      ],
    });
    raw = completion.json ?? parseJsonLoose(completion.text);
  } catch (err) {
    return fallback(turns, `speakers provider call failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!Array.isArray(raw)) return fallback(turns, "speakers response was not a JSON array");

  // label -> name -> evidence. Kept per-name so a contradiction is visible rather than overwritten.
  const claims = new Map<string, Map<string, { turnId: string; sessionId: string }[]>>();

  for (const entry of raw as RawSpeaker[]) {
    if (typeof entry !== "object" || entry === null) continue;

    const speakerRef = entry.speakerRef;
    // Only anonymous labels are in scope: never rename a turn that already carries a real name,
    // and never name a speaker who does not appear in this transcript.
    if (typeof speakerRef !== "string" || !labels.has(speakerRef)) continue;

    const displayName = entry.displayName;
    if (typeof displayName !== "string" || displayName.trim() === "") continue;
    const name = displayName.trim();
    // Shape check BEFORE containment: a greeting can be verbatim in the transcript and still not
    // be a name. Cheaper too -- it rejects without touching any turn.
    if (!looksLikeAName(name)) continue;

    const cited = Array.isArray(entry.turnIds) ? entry.turnIds : [];
    const evidence: { turnId: string; sessionId: string }[] = [];
    for (const id of cited) {
      if (typeof id !== "string") continue;
      const t = byId.get(id);
      if (!t) continue;                                  // fabricated turn id
      // THE RULE: the name must appear in its evidence as whole words, never as a substring
      // buried inside a longer word ("Ruby" inside "Rubykumar" is a different person).
      if (!containsNameVerbatim(t.text ?? "", name)) continue;
      if (evidence.some((e) => e.turnId === id)) continue;
      evidence.push({ turnId: id, sessionId: t.sessionId });
    }
    if (evidence.length === 0) continue;                 // nothing survived -- the speaker does not ship

    const byName = claims.get(speakerRef) ?? new Map<string, { turnId: string; sessionId: string }[]>();
    byName.set(name, [...(byName.get(name) ?? []), ...evidence]);
    claims.set(speakerRef, byName);
  }

  const resolved: ResolvedSpeaker[] = [];
  for (const [speakerRef, byName] of claims) {
    if (byName.size !== 1) continue;                     // contradiction: not ours to settle
    const entry = [...byName.entries()][0];
    if (!entry) continue;
    const [displayName, evidence] = entry;
    resolved.push({ speakerRef, displayName, personId: personIdFor(displayName), evidence });
  }
  resolved.sort((a, b) => a.speakerRef.localeCompare(b.speakerRef));

  const named = new Set(resolved.map((r) => r.speakerRef));
  return {
    resolved,
    unresolved: [...labels].filter((l) => !named.has(l)).sort(),
    degraded: null,
  };
}
