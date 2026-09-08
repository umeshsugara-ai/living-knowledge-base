/**
 * apps/api/src/search-prefilter.ts — ISS-072. Builds the Mongo pre-filter `GET /search` uses to
 * avoid shipping every turn to Node.
 *
 * Extracted from `search-store.ts` for the same reason `health-probe.ts` was extracted from
 * `store.ts`: the correctness property lived in a file no test could reach. `lexical.test.ts`
 * pinned `lexicalQueryTokens` inside `packages/index`, but nothing pinned that the file which
 * actually SHIPS the filter consumes it correctly — a checker reintroduced the exact `length > 2`
 * defect this design exists to prevent, directly in the shipping file, and all 148 tests stayed
 * green. A property nothing can fail on is not enforced, it is documented.
 *
 * **The invariant, in its precise form** (checker's [I6], stricter than "share a tokenizer"):
 * the filter's token set must be a SUPERSET of the scorer's — `filterTokens ⊇ scorerTokens`.
 * ADDING tokens is safe; REMOVING any is what breaks it. That distinction matters because
 * "use the same tokenizer" reads as though symmetric changes are fine, and they are not: adding
 * a stopword filter to BOTH sides still changes answers, because the scorer would then score
 * turns the filter never fetched.
 *
 * Known bound (ISS-073, low, 0 live occurrences in 2118 turns): JS `toLowerCase()` does full
 * Unicode case mapping while Mongo's `$options: "i"` is ASCII-only, so text containing U+0130 or
 * U+212A can be scored but not matched. Recorded rather than fixed — the fix needs Mongo-side
 * collation, and nothing in the corpus triggers it.
 */
import { lexicalQueryTokens } from "@lkb/index";

/** One `$or` branch per query token — the shape Mongo receives. */
export interface TurnPrefilter {
  $or: { text: { $regex: string; $options: string } }[];
}

/** Escapes regex metacharacters so a query like "c++" or "what?" builds a literal match rather
 * than a broken or unintended pattern. Mongo compiles `$regex` as a real expression, so an
 * unescaped user token is both a correctness and a denial-of-service surface. */
export function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The pre-filter for `query`, or `null` when no token can match.
 *
 * `null` (rather than an empty `$or`) is deliberate twice over: `lexicalSearchTurns` returns `[]`
 * for a query with no tokens, so short-circuiting matches the scorer's own contract instead of
 * inventing one; and `$or: []` is rejected by Mongo outright.
 */
export function buildTurnPrefilter(query: string): TurnPrefilter | null {
  const tokens = lexicalQueryTokens(query);
  if (tokens.length === 0) return null;
  return { $or: tokens.map((t) => ({ text: { $regex: escapeRegex(t), $options: "i" } })) };
}

/** Evaluates a built filter against a turn's text the way Mongo would. Exported so tests can
 * assert the superset property against the REAL filter object rather than re-deriving it. */
export function prefilterMatches(filter: TurnPrefilter, text: string): boolean {
  return filter.$or.some((clause) => new RegExp(clause.text.$regex, clause.text.$options).test(text));
}
