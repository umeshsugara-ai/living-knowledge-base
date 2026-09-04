/**
 * packages/index/src/pipeline/claims.ts — real claim extraction, the other half of the
 * "make ingested content searchable" pipeline `summarize.ts` starts. `config/ai-routing.yaml`
 * already declares a `claims` jobKind; this is its first real implementation.
 *
 * The hard rule this module exists to enforce (ARCHITECTURE H-provenance, the AI-engineer
 * pipeline design's "no fact without citation"): a claim's evidence must cite REAL turn ids that
 * really exist in the session's own transcript. The LLM is asked to cite `turnId`s, but its
 * output is NEVER trusted blind — `extractClaims` cross-checks every cited id against the real
 * `turns` passed in and drops any claim whose evidence doesn't survive that check (including
 * dropping the claim entirely if it ends up with zero real evidence, since `claims.schema.json`
 * requires `evidence.minItems: 1` — no claim ships with fabricated or empty evidence).
 */
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";
import { parseJsonLoose } from "@lkb/ai";

export type ClaimsCompleteFn = (job: Job) => Promise<CompleteResult>;

export interface ExtractedClaim {
  text: string;
  /** Real `turns._id` values, already verified to exist in the session's transcript. */
  evidenceTurnIds: string[];
}

const CLAIMS_SYSTEM_PROMPT = [
  "You extract atomic, verifiable factual claims from a transcript for a searchable knowledge",
  "base. Each line below is one turn, prefixed with its real turn id and speaker. A claim is one",
  "self-contained fact someone could look up or cite later -- never invent a claim the transcript",
  "does not actually support.",
  'Respond with ONLY a JSON array: [{"text": "<the claim, one sentence>",',
  '"turnIds": ["<the exact turn id(s) from the transcript that support this claim>"]}, ...].',
  "Every turnId you cite MUST be copied exactly from the transcript's [id:...] prefixes -- never",
  "invent one. If the transcript supports no clear factual claims, respond with an empty array [].",
].join(" ");

function buildCitableTranscript(turns: Turns[]): string {
  return turns.map((t) => `[id:${t._id}] [${t.speakerRef}] ${t.text}`).join("\n");
}

interface RawClaim {
  text?: unknown;
  turnIds?: unknown;
}

/** Real claims from real turns, via the injected LLM `complete`. Never throws — a rejected
 * `complete()` call or an unparseable response degrades to an empty array (an honest "no claims
 * extracted yet", never a fabricated one). Every returned claim's `evidenceTurnIds` is a
 * verified-real subset of the input `turns`' ids; a claim with zero surviving real ids is
 * dropped entirely rather than shipped with empty evidence. */
export async function extractClaims(turns: Turns[], complete: ClaimsCompleteFn): Promise<ExtractedClaim[]> {
  if (turns.length === 0) return [];

  const validTurnIds = new Set(turns.map((t) => t._id));
  const transcript = buildCitableTranscript(turns);

  let raw: unknown;
  try {
    const completion = await complete({
      kind: "claims",
      messages: [
        { role: "system", content: CLAIMS_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    raw = completion.json ?? parseJsonLoose(completion.text);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  const claims: ExtractedClaim[] = [];
  for (const entry of raw as RawClaim[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const text = entry.text;
    if (typeof text !== "string" || text.trim() === "") continue;
    const turnIds = Array.isArray(entry.turnIds) ? entry.turnIds : [];
    const evidenceTurnIds = turnIds.filter((id): id is string => typeof id === "string" && validTurnIds.has(id));
    if (evidenceTurnIds.length === 0) continue; // no fabricated/empty-evidence claims ship
    claims.push({ text, evidenceTurnIds });
  }
  return claims;
}
