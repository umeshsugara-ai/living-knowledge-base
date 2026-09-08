/**
 * packages/index/src/eval/baseline.ts — plan §10 U0.10 groundwork. A recall@k number on its own
 * is not evidence: without a control you cannot tell "the retriever is good" from "the task is
 * trivial", and without a saturation check you cannot tell "1.000 means excellent" from "1.000
 * means the metric has no room left to move".
 *
 * `data/eval/recall-report.json` currently records `recallAtK: 1.000, misses: []` — a perfect
 * score with zero misses. That is the shape a SATURATED metric has: every future change can only
 * hold at 1.000 or drop, so it can never demonstrate an improvement, which is exactly the
 * "Phase 1 is unfalsifiable" problem plan §10 U0.10 exists to fix. Swapping the heuristic
 * retriever for a real LLM (U0.10's prescribed remedy) does not fix that on its own — a saturated
 * instrument stays saturated whoever is measured against it.
 *
 * Nothing here invents a methodology: a chance-floor control and a ceiling check are the two
 * standard sanity conditions any retrieval score is read against.
 */
import type { RecallResult, RetrieveFn } from "./recall.js";

/**
 * A retriever that IGNORES the question entirely and returns the same first-k session ids every
 * time. This is the floor: any real retriever must beat it, and if the measured retriever does
 * NOT beat it, the score is measuring the shape of the task rather than the retriever.
 * Deterministic (not random) so the control is reproducible run to run.
 */
export function createNullRetriever(sessionIds: string[]): RetrieveFn {
  const ordered = [...sessionIds];
  return (_question: string, k: number): string[] => ordered.slice(0, k);
}

export type BaselineVerdict = "informative" | "saturated" | "at-chance";

export interface BaselineAssessment {
  k: number;
  sessionCount: number;
  /** k / sessionCount — the recall a question-blind retriever gets by construction. */
  chanceFloor: number;
  measuredRecall: number;
  /** What the null retriever actually scored on this same golden set. */
  controlRecall: number;
  /** measuredRecall - controlRecall. <= 0 means the question contributed nothing. */
  liftOverControl: number;
  /** A perfect score with no misses: the metric is pinned at its ceiling. */
  saturated: boolean;
  verdict: BaselineVerdict;
  reason: string;
}

/**
 * Judges whether a recall result can support a claim about retrieval quality at all.
 *
 * `at-chance` beats `saturated` in precedence deliberately: a retriever that does not beat a
 * question-blind control is the more fundamental failure, and reporting it as merely "saturated"
 * would flatter it.
 */
export function assessBaseline(
  measured: RecallResult,
  control: RecallResult,
  sessionCount: number,
): BaselineAssessment {
  const k = measured.k;
  const chanceFloor = sessionCount === 0 ? 0 : Math.min(1, k / sessionCount);
  const liftOverControl = measured.recallAtK - control.recallAtK;
  const saturated = measured.recallAtK >= 1 && measured.misses.length === 0;

  let verdict: BaselineVerdict;
  let reason: string;
  if (liftOverControl <= 0) {
    verdict = "at-chance";
    reason =
      `the measured retriever (${measured.recallAtK.toFixed(3)}) does not beat a question-blind ` +
      `control (${control.recallAtK.toFixed(3)}), so this score says nothing about retrieval quality`;
  } else if (saturated) {
    verdict = "saturated";
    reason =
      `${measured.hits}/${measured.total} with zero misses — the metric is pinned at its ceiling, ` +
      `so it can register a regression but can never demonstrate an improvement; a harder or ` +
      `independently-authored question set is needed before this number can support a claim`;
  } else {
    verdict = "informative";
    reason =
      `${measured.recallAtK.toFixed(3)} vs a ${control.recallAtK.toFixed(3)} question-blind control ` +
      `(+${liftOverControl.toFixed(3)}), with ${measured.misses.length} miss(es) left to move`;
  }

  return {
    k, sessionCount, chanceFloor,
    measuredRecall: measured.recallAtK,
    controlRecall: control.recallAtK,
    liftOverControl, saturated, verdict, reason,
  };
}
