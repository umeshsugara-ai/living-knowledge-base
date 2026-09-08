/**
 * packages/index/src/vector/retriever.ts — plan §10 U1.4. Adapts brute-force cosine to the two
 * shapes the rest of the system already speaks.
 *
 * THE AWKWARD FACT THIS FILE EXISTS FOR: `RetrieveFn` (eval/recall.ts) is **synchronous** —
 * `(question, k) => string[]` — because the tree and heuristic retrievers it was written for need
 * no I/O. Vector retrieval does: the question must be embedded first. Rather than make `RetrieveFn`
 * async (which would touch every existing retriever and the harness for one caller's benefit), the
 * embedding is hoisted OUT of the hot path: `createVectorRetriever` takes questions already
 * embedded, so the harness stays sync and the network call happens once, up front, where it can be
 * batched.
 *
 * That is not a workaround, it is the honest split — the retriever's actual job is ranking, and
 * ranking is pure.
 */
import type { RetrieveFn } from "../eval/recall.js";
import { rankSessionsByCosine, type ScorableChunk } from "./cosine.js";

export interface VectorRetrieverOptions {
  /** Skip chunks whose dimensions differ from the query rather than throwing. Default: throw. */
  skipMismatched?: boolean;
  /**
   * What to do when a question has no precomputed embedding. Default THROWS, deliberately: the
   * alternative is returning `[]`, which the recall harness cannot distinguish from "the retriever
   * ran and found nothing" — it would score as a miss and quietly depress the recall number with
   * no indication the retriever never ran at all. A metric that reports a plumbing failure as a
   * retrieval failure is worse than no metric.
   */
  onMissingEmbedding?: "throw" | "empty";
}

/**
 * @param questionVectors question text -> its embedding. Built once by the caller (one batched
 *        `embed()` call), so the returned function does no I/O and satisfies `RetrieveFn`.
 * @param chunks the corpus, already loaded. Pure data in, ranking out.
 */
export function createVectorRetriever(
  questionVectors: Map<string, number[]>,
  chunks: ScorableChunk[],
  options: VectorRetrieverOptions = {},
): RetrieveFn {
  const { skipMismatched, onMissingEmbedding = "throw" } = options;
  return (question: string, k: number): string[] => {
    const qv = questionVectors.get(question);
    if (!qv) {
      if (onMissingEmbedding === "empty") return [];
      throw new Error(
        `createVectorRetriever: no embedding for question ${JSON.stringify(question.slice(0, 60))} — ` +
          "returning an empty result here would be scored as a retrieval MISS, hiding a plumbing bug",
      );
    }
    return rankSessionsByCosine(qv, chunks, k, { skipMismatched }).map((s) => s.sessionId);
  };
}
