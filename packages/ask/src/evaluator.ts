/**
 * packages/ask/src/evaluator.ts — CRAG-style retrieval evaluator (port of
 * ask_router/evaluator.py, T-005 → T-016; behaviour-identical).
 *
 * Scores each candidate tree-index node against the query via an injected `scoreFn` (no
 * vendor/model hardcoded — a real LLM scorer, a stub, or a test double all satisfy this seam).
 * Thresholds default to the CRAG paper values (brain page `corrective-rag-crag`): upper=0.7
 * ("correct"), lower=0.3 ("incorrect" below, "ambiguous" between) — tunable per call.
 *
 * `scoreFn(query, node)` may return a bare number in [0, 1] or a `[score, reason]` tuple; a
 * bare number gets an empty reason. Every call returns a per-candidate reason and a top-level
 * verdict reason so the decision is auditable (ARCHITECTURE §2.2).
 */
import type { TreeIndexNode } from "@lkb/core";

export const UPPER_THRESHOLD = 0.7;
export const LOWER_THRESHOLD = 0.3;

export type ScoreResult = number | [number, string];
export type ScoreFn = (query: string, node: TreeIndexNode) => ScoreResult;
export type Verdict = "correct" | "ambiguous" | "incorrect";

export interface Scored { node: TreeIndexNode; score: number; reason: string }

export interface Evaluation {
  scored: Scored[];
  /** score >= lower, regardless of verdict */
  good_docs: TreeIndexNode[];
  verdict: Verdict;
  /** why this verdict, citing the thresholds used */
  reason: string;
}

function normalize(result: ScoreResult): [number, string] {
  if (Array.isArray(result)) return [Number(result[0]), String(result[1])];
  return [Number(result), ""];
}

export function evaluate(query: string, candidates: TreeIndexNode[], scoreFn: ScoreFn,
  upper: number = UPPER_THRESHOLD, lower: number = LOWER_THRESHOLD): Evaluation {
  if (!(0 <= lower && lower <= upper && upper <= 1)) {
    throw new RangeError(
      `thresholds must satisfy 0 <= lower <= upper <= 1, got lower=${lower} upper=${upper}`);
  }

  const scored: Scored[] = [];
  const goodDocs: TreeIndexNode[] = [];
  for (const node of candidates) {
    const [score, reason] = normalize(scoreFn(query, node));
    scored.push({ node, score, reason });
    if (score >= lower) goodDocs.push(node);
  }

  const scores = scored.map((s) => s.score);
  let verdict: Verdict;
  let reason: string;
  if (scores.length > 0 && scores.some((s) => s >= upper)) {
    verdict = "correct";
    reason = `at least one candidate scored >= upper threshold ${upper}`;
  } else if (scores.length === 0 || scores.every((s) => s < lower)) {
    verdict = "incorrect";
    reason = scores.length === 0 ? "no candidates"
      : `all candidates scored < lower threshold ${lower}`;
  } else {
    verdict = "ambiguous";
    reason = `no candidate >= ${upper} but at least one >= ${lower}`;
  }

  return { scored, good_docs: goodDocs, verdict, reason };
}
