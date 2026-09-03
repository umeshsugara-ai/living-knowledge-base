// @lkb/index — tree (vectorless, T-004 port; topic/org levels + regenerate added T-004b).
// eval/ (recall@k harness + heuristic retriever) added T-021. vector/ and graph/ land in
// their own tasks (D-003).
export { buildTree, type Summarize } from "./tree/build.js";
export { treeSearch } from "./tree/search.js";
export { extractTopicRefs, type ExtractTopicRefs } from "./tree/extract-topics.js";
export { regenerate } from "./tree/regenerate.js";

export { computeRecallAtK, type GoldenQuestion, type RetrieveFn, type RecallResult, type RecallMiss } from "./eval/recall.js";
export { createHeuristicRetriever } from "./eval/heuristic-retriever.js";
