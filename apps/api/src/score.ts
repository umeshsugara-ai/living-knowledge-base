/**
 * apps/api/src/score.ts — T-009 heuristic scorer + T-009b's real LLM judge.
 * `heuristicScore` is the deterministic keyword-overlap fallback (kept as a named export, never
 * deleted — useful offline and as the documented degrade path when the judge call fails).
 * `createLlmScorer` (T-009b) wraps a `@lkb/ai` `complete` (routed for jobKind "evaluator" per
 * `config/ai-routing.yaml") and asks it to score relevance 0-1 with a reason, per the CRAG paper's
 * "be conservative with high scores" guidance (brain page `corrective-rag-crag`) — a judge that
 * scores generously collapses the correct/ambiguous/incorrect split this router depends on.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { Job, CompleteResult } from "@lkb/ai";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

export const heuristicScore = (query: string, node: TreeIndexNode): [number, string] => {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [0, "empty query"];
  const nodeTokens = tokenize(`${node.title} ${node.summary}`);
  let overlap = 0;
  for (const t of queryTokens) if (nodeTokens.has(t)) overlap += 1;
  const score = overlap / queryTokens.size;
  return [score, `${overlap}/${queryTokens.size} query terms matched title+summary (heuristic, not LLM)`];
};

export type CompleteFn = (job: Job) => Promise<CompleteResult>;

const JUDGE_SYSTEM_PROMPT = [
  "You are a retrieval relevance judge. Score how well the given document (title + summary)",
  "answers the query, on a scale from 0 to 1. Be conservative with high scores: only score",
  "above 0.7 when the document directly and completely answers the query (CRAG evaluator rule).",
  "Respond with ONLY a JSON object: {\"score\": <0-1 number>, \"reason\": \"<one sentence>\"}.",
].join(" ");

function parseJudgeResponse(text: string): [number, string] | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const { score, reason } = parsed as { score?: unknown; reason?: unknown };
    if (typeof score !== "number" || Number.isNaN(score)) return undefined;
    const clamped = Math.min(1, Math.max(0, score));
    return [clamped, typeof reason === "string" ? reason : "llm judge (no reason given)"];
  } catch {
    return undefined;
  }
}

/**
 * `createLlmScorer(complete)` returns a `ScoreFn` (T-009b widened `ScoreFn` to allow this to be
 * async). Never throws into the caller — a `complete` rejection or an unparseable response falls
 * back to `heuristicScore` so `/ask` and `/compete/start` never crash because the judge call failed.
 */
export function createLlmScorer(
  complete: CompleteFn,
): (query: string, node: TreeIndexNode) => Promise<[number, string]> {
  return async (query, node) => {
    try {
      const result = await complete({
        kind: "evaluator",
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: `Query: ${query}\n\nDocument title: ${node.title}\nDocument summary: ${node.summary}` },
        ],
      });
      const parsed = parseJudgeResponse(result.text);
      if (parsed !== undefined) return parsed;
      const [fallbackScore, fallbackReason] = heuristicScore(query, node);
      return [fallbackScore, `${fallbackReason} (llm judge response unparseable, fell back)`];
    } catch (err) {
      const [fallbackScore, fallbackReason] = heuristicScore(query, node);
      const message = err instanceof Error ? err.message : String(err);
      return [fallbackScore, `${fallbackReason} (llm judge call failed: ${message}, fell back)`];
    }
  };
}
