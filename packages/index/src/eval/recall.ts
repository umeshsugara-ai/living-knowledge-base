/**
 * packages/index/src/eval/recall.ts — T-021 C2. Pure recall@k computation over an injected
 * `retrieveFn` — no I/O, no network, no vendor. `retrieveFn` owns the ranking; this function
 * only checks whether the expected session id lands inside the top-k results, and names every
 * miss (matching the evaluator's own per-candidate `reason` discipline in `packages/ask`) rather
 * than just counting them, so a low score is diagnosable.
 */

export interface GoldenQuestion {
  id: string;
  question: string;
  expectedSessionId: string;
}

/** Returns ranked session ids (most relevant first), length <= k. Injected — a heuristic
 * stand-in (`heuristic-retriever.ts`) or a real LLM-backed retriever both satisfy this shape. */
export type RetrieveFn = (question: string, k: number) => string[];

export interface RecallMiss {
  id: string;
  question: string;
  expectedSessionId: string;
  got: string[];
}

export interface RecallResult {
  k: number;
  total: number;
  hits: number;
  recallAtK: number;
  misses: RecallMiss[];
}

export function computeRecallAtK(questions: GoldenQuestion[], retrieve: RetrieveFn,
  k: number): RecallResult {
  const misses: RecallMiss[] = [];
  let hits = 0;

  for (const q of questions) {
    const got = retrieve(q.question, k).slice(0, k);
    if (got.includes(q.expectedSessionId)) {
      hits += 1;
    } else {
      misses.push({ id: q.id, question: q.question, expectedSessionId: q.expectedSessionId, got });
    }
  }

  const total = questions.length;
  return { k, total, hits, recallAtK: total === 0 ? 0 : hits / total, misses };
}
