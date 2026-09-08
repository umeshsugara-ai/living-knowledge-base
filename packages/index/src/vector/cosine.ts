/**
 * packages/index/src/vector/cosine.ts — plan §10 U1.4. Brute-force exact vector search.
 *
 * WHY BRUTE FORCE (D-a). Atlas Vector Search does not exist here: the Mongo is self-hosted on a
 * raw EC2 IP (`mongodb://13.202.206.101:27017`, no `+srv`), so `$vectorSearch` is unavailable. At
 * the real corpus size — 1452 chunks × 3072 dims, measured 2026-09-08 — an exhaustive scan is a
 * few million multiply-adds, which is milliseconds, and it is **exact**. An ANN index would be
 * slower to build, approximate, and would trade recall for a speed budget nothing is asking for.
 * The `vectorSearchFn` seam means swapping this for a real vector DB later is an injection change,
 * not a rewrite.
 *
 * PURE, and no I/O: it takes vectors and returns rankings. The caller embeds the query and loads
 * the chunks. That is what makes the recall harness able to drive it without a model or a network.
 */

/** The subset of a `chunks` row this needs. Deliberately structural — callers pass real rows. */
export interface ScorableChunk {
  _id: string;
  sourceRef: string;
  vector: number[];
  dims?: number;
}

export interface ScoredChunk {
  chunkId: string;
  sessionId: string;
  score: number;
}

/**
 * Cosine similarity of two equal-length vectors.
 *
 * TWO REFUSALS, both load-bearing:
 *
 * 1. **Different lengths throw.** Comparing a 3072-dim query against a 768-dim chunk by truncating
 *    to the shorter one would return a plausible number that means nothing — the single worst
 *    failure mode here, because a silently wrong ranking looks exactly like a correct one. This is
 *    reachable in practice: a re-embed under a changed model leaves old and new rows side by side.
 * 2. **A zero-magnitude vector scores 0, never NaN.** Cosine divides by the product of the
 *    magnitudes, so a zero vector is 0/0. `NaN` would poison every comparison it touches and sort
 *    unpredictably. Returning 0 says the honest thing: a vector with no direction is similar to
 *    nothing. (`gemini.ts` already refuses to *store* empty vectors — ISS-096 — so this is the
 *    second line of defence, not the first.)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (${a.length} vs ${b.length}) — refusing to compare ` +
        "vectors from different embedding spaces, which would return a meaningless score",
    );
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Ranks chunks against a query vector, best first.
 *
 * `skipMismatched` exists because the two sane responses to a mixed-dimension corpus are opposite
 * and both defensible: fail loudly (a re-embed is half-done and every number is suspect), or skip
 * the strays (most of the corpus is fine, return what is comparable). The default is to THROW,
 * because a partial index that silently returns fewer results is the failure this whole layer
 * exists to make visible. A caller that has decided otherwise opts in explicitly.
 */
export function rankByCosine(
  queryVector: number[],
  chunks: ScorableChunk[],
  k: number,
  options: { skipMismatched?: boolean } = {},
): ScoredChunk[] {
  if (k <= 0) return [];
  const scored: ScoredChunk[] = [];
  for (const c of chunks) {
    if (c.vector.length !== queryVector.length) {
      if (options.skipMismatched) continue;
      throw new Error(
        `rankByCosine: chunk ${c._id} has ${c.vector.length} dims, query has ${queryVector.length}`,
      );
    }
    scored.push({ chunkId: c._id, sessionId: c.sourceRef, score: cosineSimilarity(queryVector, c.vector) });
  }
  // Tie-break by chunkId so a given corpus always produces the SAME ranking. Without it, two
  // chunks with identical scores order by whatever the input happened to be, and a recall number
  // measured twice on the same data could differ — which would make the metric untrustworthy for
  // exactly the delta comparisons U1.4 exists to enable.
  scored.sort((x, y) => (y.score - x.score) || (x.chunkId < y.chunkId ? -1 : x.chunkId > y.chunkId ? 1 : 0));
  return scored.slice(0, k);
}

/**
 * Collapses ranked chunks to ranked SESSIONS, keeping each session's best chunk.
 *
 * The recall harness asks "is the right session in the top k", not "is the right chunk". Ranking
 * chunks and truncating would let one long session occupy every slot with near-duplicate
 * neighbours and push out the correct answer — the failure the overlapping chunker makes *more*
 * likely, since adjacent chunks deliberately share turns. So dedupe first, then take k.
 */
export function rankSessionsByCosine(
  queryVector: number[],
  chunks: ScorableChunk[],
  k: number,
  options: { skipMismatched?: boolean } = {},
): ScoredChunk[] {
  if (k <= 0) return [];
  // Rank ALL chunks (not k), then dedupe — otherwise the truncation happens before the dedupe and
  // reintroduces exactly the crowding this function exists to prevent.
  const all = rankByCosine(queryVector, chunks, chunks.length, options);
  const best = new Map<string, ScoredChunk>();
  for (const s of all) {
    if (!best.has(s.sessionId)) best.set(s.sessionId, s);
  }
  return [...best.values()].slice(0, k);
}
