/**
 * packages/ask/src/eval/calibration.ts — T-022. Pure MAE (mean absolute error) calibration over
 * an injected `ScoreFn` — the real evaluator seam type (`evaluator.ts`), so this harness works
 * against ANY scorer (heuristic, fake, or a real LLM judge once ISS-015 clears) with zero
 * modification. Always awaits the scorer (matching `evaluator.ts`'s own async-capable handling),
 * so a sync or async `scoreFn` both work unmodified.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { ScoreFn, ScoreResult } from "../evaluator.js";

export interface CalibrationPair {
  id: string;
  query: string;
  node: TreeIndexNode;
  /** A "clearly relevant" (1.0) / "clearly irrelevant" (0.0) proxy — see contract's disclosed
   * scope-down: derived mechanically, not human-hand-scored. */
  referenceScore: number;
}

export interface CalibrationDetail {
  id: string;
  predicted: number;
  reference: number;
  absError: number;
}

export interface CalibrationResult {
  mae: number;
  n: number;
  details: CalibrationDetail[];
}

function normalize(result: ScoreResult): number {
  return Array.isArray(result) ? Number(result[0]) : Number(result);
}

export async function computeMAE(pairs: CalibrationPair[], scoreFn: ScoreFn): Promise<CalibrationResult> {
  const details: CalibrationDetail[] = [];
  let sumAbsError = 0;

  for (const pair of pairs) {
    const predicted = normalize(await Promise.resolve(scoreFn(pair.query, pair.node)));
    const absError = Math.abs(predicted - pair.referenceScore);
    sumAbsError += absError;
    details.push({ id: pair.id, predicted, reference: pair.referenceScore, absError });
  }

  const n = pairs.length;
  return { mae: n === 0 ? 0 : sumAbsError / n, n, details };
}
