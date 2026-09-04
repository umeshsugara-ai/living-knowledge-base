/**
 * packages/index/src/pipeline/summarize.ts — real session summarization, the piece
 * `config/ai-routing.yaml`'s already-declared `summarize` jobKind never had an implementation
 * for (T-002's TOC session_pages were a one-time backfill from pre-written `.md` summaries, not
 * a reusable pipeline function — confirmed by reading `scripts/seed-toc.mjs`). This is that
 * function: any ingested session's turns -> a real LLM call -> a real `session_pages`-shaped
 * result, so newly ingested content (WhatsApp, URL, anything future) gets the same treatment TOC
 * sessions already have, instead of sitting invisible to the Brain graph and `/ask`.
 *
 * Injected `CompleteFn` — no provider hardcoded, same seam every other LLM-backed module in this
 * workspace uses (`packages/ask`'s `CompleteFn`, `apps/api/src/score.ts`'s judge). Never throws:
 * an unparseable or failed completion degrades to an honest, clearly-labeled fallback summary
 * (the raw transcript's first slice) rather than crashing the ingest pipeline over it.
 */
import type { Turns } from "@lkb/core";
import type { CompleteResult, Job } from "@lkb/ai";
import { parseJsonLoose } from "@lkb/ai";

export type SummarizeCompleteFn = (job: Job) => Promise<CompleteResult>;

export interface SessionSummaryResult {
  summary: string;
  keyInsights: string[];
  decisions: string[];
  actionItems: string[];
}

const SUMMARIZE_SYSTEM_PROMPT = [
  "You summarize a transcript for a searchable knowledge base. Read the transcript below (each",
  "line is one turn, prefixed with the speaker) and produce a summary of what was actually said",
  "-- never invent a fact, number, or name that does not appear in the transcript.",
  'Respond with ONLY a JSON object: {"summary": "<2-4 sentence summary>",',
  '"keyInsights": ["<insight>", ...], "decisions": ["<decision>", ...],',
  '"actionItems": ["<action item>", ...]}. Omit an array entirely (use []) if the transcript has',
  "none of that kind.",
].join(" ");

function buildTranscript(turns: Turns[]): string {
  return turns.map((t) => `[${t.speakerRef}] ${t.text}`).join("\n");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function parseSummaryResponse(text: string): SessionSummaryResult | undefined {
  const parsed = parseJsonLoose(text);
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const { summary, keyInsights, decisions, actionItems } = parsed as Record<string, unknown>;
  if (typeof summary !== "string" || summary.trim() === "") return undefined;
  return {
    summary,
    keyInsights: asStringArray(keyInsights),
    decisions: asStringArray(decisions),
    actionItems: asStringArray(actionItems),
  };
}

const FALLBACK_SLICE_LENGTH = 500;

/** Real summary from real turns, via the injected LLM `complete`. Never throws — a rejected
 * `complete()` call or an unparseable response degrades to a clearly-labeled fallback (the raw
 * transcript's first slice) rather than blocking the ingest pipeline. */
export async function summarizeSession(turns: Turns[], complete: SummarizeCompleteFn): Promise<SessionSummaryResult> {
  if (turns.length === 0) {
    return { summary: "(no content to summarize)", keyInsights: [], decisions: [], actionItems: [] };
  }

  const transcript = buildTranscript(turns);
  try {
    const completion = await complete({
      kind: "summarize",
      messages: [
        { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    const parsed = parseSummaryResponse(completion.text);
    if (parsed) return parsed;
  } catch {
    // fall through to the honest degraded summary below
  }

  return {
    summary: `(fallback, LLM summary unavailable) ${transcript.slice(0, FALLBACK_SLICE_LENGTH)}`,
    keyInsights: [],
    decisions: [],
    actionItems: [],
  };
}
