/**
 * packages/index/src/search/lexical.ts — plan §10 U0.7 (second half). Real lexical retrieval
 * over `turns` — the un-stub for `GET /search`, and the seam plan §10 U1.5's later hybrid merge
 * is meant to reuse ("the hybrid merge reuses this lexical scorer").
 *
 * Same bag-of-words tokenize+overlap technique already used three times in this codebase
 * (`apps/api/src/score.ts`'s `heuristicScore`, `packages/index/src/eval/heuristic-retriever.ts`,
 * `packages/index/src/tree/extract-topics.ts`'s heuristic extractor) — reusing the established,
 * dependency-free pattern rather than introducing a fourth, DIFFERENT scoring approach (BM25,
 * embeddings) for what the plan itself calls a starting "lexical" implementation. A genuine
 * refactor to a single shared `tokenize`/`overlap` util is a real candidate for a later cleanup
 * unit, but out of scope here — this unit's job is un-stubbing the route, not a cross-cutting
 * dedup pass touching three other files' established behavior.
 */

export interface LexicalHit {
  turnId: string;
  sessionId: string;
  /** query-token overlap ratio, 0..1 — same scale as every other heuristic scorer in this repo. */
  score: number;
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

export interface SearchableTurn {
  _id: string;
  sessionId: string;
  text: string;
}

/** Pure function — no I/O. Scores every turn against `query`, keeps only score > 0, returns the
 * top `k` sorted descending by score (ties broken by input order, i.e. stable sort). */
export function lexicalSearchTurns(query: string, turns: SearchableTurn[], k: number): LexicalHit[] {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];
  const hits: LexicalHit[] = [];
  for (const turn of turns) {
    const turnTokens = tokenize(turn.text);
    let overlap = 0;
    for (const t of queryTokens) if (turnTokens.has(t)) overlap += 1;
    const score = overlap / queryTokens.size;
    if (score > 0) hits.push({ turnId: turn._id, sessionId: turn.sessionId, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
