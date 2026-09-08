/**
 * packages/index/src/chunk/build-chunks.ts — plan §10 U1.2. Groups a session's turns into
 * overlapping chunks for embedding.
 *
 * PURE, and no I/O: it takes turns and returns chunk plans. The caller embeds and persists (U1.3),
 * which keeps this testable without a model, a database or a network.
 *
 * THREE DECISIONS WORTH THE WORDS:
 *
 * 1. **Never split mid-turn.** A turn is one speaker's contiguous utterance and is already the
 *    atomic citable unit everywhere else in this system (`claims.evidence`, `session_pages`,
 *    `/citations`). Splitting one would produce a chunk whose `turnRefs` cannot honestly point at
 *    what it contains, and every answer citing it would be citing more than it used.
 *
 * 2. **Overlap by TURNS, not characters.** An answer that straddles a boundary — a question in one
 *    turn, its answer in the next — is invisible to both neighbouring chunks unless they share
 *    turns. Overlapping by character count would re-split mid-turn and reintroduce (1).
 *
 * 3. **`text` is returned but NEVER persisted.** ADR-0001: "media/chunks reference turns by id
 *    only — never duplicate text", grounded in the `pageindex-multi-source-merge` and
 *    `vectorless-rag` patterns. Plan §10 U1.2 asks for a stored `text` field; that contradicts a
 *    recorded architectural decision, so this follows the ADR and the chunk row stores ids plus
 *    the vector. Display text is resolved from `turnRefs` at read time, exactly as `search-store`
 *    already resolves turns and sessions for `/search`. Flagged for the checker rather than
 *    silently chosen.
 */

/** The subset of a turn this needs. Deliberately structural — callers pass real `Turns` rows. */
export interface ChunkableTurn {
  _id: string;
  text: string;
}

export interface ChunkPlan {
  chunkIndex: number;
  turnRefs: string[];
  /** Concatenated turn text, for the embedding call ONLY. Not persisted — see decision 3. */
  text: string;
}

export interface ChunkOptions {
  /** Soft lower bound: a chunk closes once it reaches this, so most land between it and ~2x. */
  targetChars?: number;
  /** Hard ceiling: a chunk never starts a new turn that would carry it past this. */
  maxChars?: number;
  /** How many trailing turns of a chunk are repeated at the start of the next. */
  overlapTurns?: number;
}

const DEFAULTS = { targetChars: 400, maxChars: 800, overlapTurns: 1 };

/**
 * @returns chunk plans in session order, `chunkIndex` dense from 0.
 *
 * A single turn longer than `maxChars` still becomes its own chunk rather than being dropped or
 * split: an over-long chunk is a cost problem, a dropped one is a correctness problem, and a split
 * one breaks decision (1).
 */
export function buildChunks(turns: ChunkableTurn[], options: ChunkOptions = {}): ChunkPlan[] {
  const { targetChars, maxChars, overlapTurns } = { ...DEFAULTS, ...options };
  const usable = turns.filter((t) => (t.text ?? "").trim().length > 0);
  if (usable.length === 0) return [];

  const plans: ChunkPlan[] = [];
  let current: ChunkableTurn[] = [];
  let chars = 0;

  const flush = () => {
    if (current.length === 0) return;
    plans.push({
      chunkIndex: plans.length,
      turnRefs: current.map((t) => t._id),
      text: current.map((t) => t.text.trim()).join(" "),
    });
    // Carry the tail forward so a boundary-straddling answer is reachable from both sides.
    // `slice` on a shorter array is safe and simply carries everything, which is what a chunk of
    // one long turn should do.
    current = overlapTurns > 0 ? current.slice(-overlapTurns) : [];
    chars = current.reduce((n, t) => n + t.text.trim().length, 0);
  };

  for (const turn of usable) {
    const len = turn.text.trim().length;
    // Close before adding, not after: adding first and then checking is what pushes a chunk past
    // maxChars. The `current.length > 0` guard is what lets an over-long single turn through.
    if (current.length > 0 && chars + len > maxChars) flush();
    current.push(turn);
    chars += len;
    if (chars >= targetChars) flush();
  }

  // The tail after the final flush is overlap already emitted; only emit it if it holds new turns.
  const emitted = new Set(plans.flatMap((p) => p.turnRefs));
  if (current.some((t) => !emitted.has(t._id))) {
    plans.push({
      chunkIndex: plans.length,
      turnRefs: current.map((t) => t._id),
      text: current.map((t) => t.text.trim()).join(" "),
    });
  }

  return plans;
}

/**
 * Every turn appears in at least one chunk. Exported because "the index silently skipped some of
 * the corpus" is the failure this whole layer is most likely to have and least likely to show —
 * a search simply never returns the missing material, and nothing errors.
 */
export function coversAllTurns(turns: ChunkableTurn[], plans: ChunkPlan[]): boolean {
  const covered = new Set(plans.flatMap((p) => p.turnRefs));
  return turns.filter((t) => (t.text ?? "").trim().length > 0).every((t) => covered.has(t._id));
}
