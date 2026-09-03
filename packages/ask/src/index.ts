// @lkb/ask — CRAG-style evaluator + router (T-005 port).
export { evaluate, UPPER_THRESHOLD, LOWER_THRESHOLD } from "./evaluator.js";
export type { ScoreFn, ScoreResult, Verdict, Scored, Evaluation } from "./evaluator.js";
export { ask } from "./router.js";
export type { AskResult, InternalSource, TreeSearchFn, WebFallbackFn, WebSource } from "./router.js";
