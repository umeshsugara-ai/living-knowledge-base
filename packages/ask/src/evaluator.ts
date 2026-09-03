/**
 * packages/ask/src/evaluator.ts — CRAG-style retrieval evaluator (port of
 * ask_router/evaluator.py, T-005 → T-016; behaviour-identical; async-capable since T-009b).
 *
 * Scores each candidate tree-index node against the query via an injected `scoreFn` (no
 * vendor/model hardcoded — a real LLM scorer, a stub, or a test double all satisfy this seam).
 * Thresholds default to the CRAG paper values (brain page `corrective-rag-crag`): upper=0.7
 * ("correct"), lower=0.3 ("incorrect" below, "ambiguous" between) — tunable per call.
 *
 * `scoreFn(query, node)` may return a bare number in [0, 1], a `[score, reason]` tuple, or a
 * Promise of either (T-009b — an LLM judge is necessarily async). `evaluate()` stays SYNCHRONOUS
 * (returns `Evaluation`, not a Promise) whenever every call actually resolved synchronously — this
 * is why the existing sync fakes in router.test.ts still work unmodified without `await`. Only
 * when at least one `scoreFn` call returns a thenable does `evaluate()` return `Promise<Evaluation>`.
 */
import type { TreeIndexNode } from "@lkb/core";

export const UPPER_THRESHOLD = 0.7;
export const LOWER_THRESHOLD = 0.3;

export type ScoreResult = number | [number, string];
export type MaybePromise<T> = T | Promise<T>;
export type ScoreFn = (query: string, node: TreeIndexNode) => MaybePromise<ScoreResult>;
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

export function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === "object" && value !== null
    && typeof (value as { then?: unknown }).then === "function";
}

function normalize(result: ScoreResult): [number, string] {
  if (Array.isArray(result)) return [Number(result[0]), String(result[1])];
  return [Number(result), ""];
}

function validateThresholds(lower: number, upper: number): void {
  if (!(0 <= lower && lower <= upper && upper <= 1)) {
    throw new RangeError(
      `thresholds must satisfy 0 <= lower <= upper <= 1, got lower=${lower} upper=${upper}`);
  }
}

function finish(pairs: { node: TreeIndexNode; result: ScoreResult }[], upper: number,
  lower: number): Evaluation {
  const scored: Scored[] = [];
  const goodDocs: TreeIndexNode[] = [];
  for (const { node, result } of pairs) {
    const [score, reason] = normalize(result);
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

// Overloads (not just a union return type) so a sync scoreFn keeps evaluate() typed as returning
// a plain `Evaluation` at the call site — TS resolves the overload from the scoreFn's static type,
// which is why every pre-T-009b sync fake in router.test.ts still compiles + reads `.verdict`
// without `await`, unmodified.
export function evaluate(query: string, candidates: TreeIndexNode[],
  scoreFn: (query: string, node: TreeIndexNode) => ScoreResult,
  upper?: number, lower?: number): Evaluation;
export function evaluate(query: string, candidates: TreeIndexNode[], scoreFn: ScoreFn,
  upper?: number, lower?: number): Evaluation | Promise<Evaluation>;
export function evaluate(query: string, candidates: TreeIndexNode[], scoreFn: ScoreFn,
  upper: number = UPPER_THRESHOLD, lower: number = LOWER_THRESHOLD): Evaluation | Promise<Evaluation> {
  validateThresholds(lower, upper);

  const pending = candidates.map((node) => ({ node, result: scoreFn(query, node) }));
  const anyAsync = pending.some((p) => isPromiseLike(p.result));

  if (!anyAsync) {
    return finish(pending as { node: TreeIndexNode; result: ScoreResult }[], upper, lower);
  }
  return Promise.all(pending.map(async (p) => ({ node: p.node, result: await p.result })))
    .then((resolved) => finish(resolved, upper, lower));
}
