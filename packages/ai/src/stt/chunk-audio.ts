/**
 * packages/ai/src/stt/chunk-audio.ts — T-003 long-audio-chunking. Pure functions only — no
 * ffmpeg/filesystem I/O here (that's a real CLI script's concern, `scripts/transcribe-long-
 * session.mjs`). Needed because a single non-streaming `generateContent` call was found to
 * silently stop producing usable transcript content somewhere around the 60-minute mark on real
 * ~100-minute sessions (checker-caught real data loss, commit `709c6c0`) — splitting into
 * shorter chunks, each transcribed independently through the existing upload/poll/transcribe
 * pipeline, keeps every individual call well under that limit.
 */
import type { Turn } from "./transcribe.js";

export interface ChunkBoundary {
  start: number;
  end: number;
}

/** Non-overlapping chunks covering `[0, durationSeconds)`. The last chunk may be shorter than
 * `chunkSeconds` if `durationSeconds` doesn't divide evenly. A duration shorter than one chunk
 * produces a single chunk spanning the whole duration. */
export function computeChunkBoundaries(durationSeconds: number, chunkSeconds: number): ChunkBoundary[] {
  if (durationSeconds <= 0) return [];
  if (chunkSeconds <= 0) throw new Error("computeChunkBoundaries: chunkSeconds must be > 0");

  const boundaries: ChunkBoundary[] = [];
  for (let start = 0; start < durationSeconds; start += chunkSeconds) {
    boundaries.push({ start, end: Math.min(start + chunkSeconds, durationSeconds) });
  }
  return boundaries;
}

export interface TranscribedChunk {
  /** Seconds into the ORIGINAL (unchunked) audio where this chunk starts. */
  offsetSeconds: number;
  turns: Turn[];
}

/**
 * Concatenates turns across chunks in chunk order, adding each chunk's `offsetSeconds` to every
 * one of its turns' `tStart`/`tEnd` so timestamps are relative to the original full-length audio,
 * not the individual chunk. `speakerRef`/`text` pass through unchanged — cross-chunk speaker
 * identity continuity is a disclosed, out-of-scope limitation: `spk:0` in one chunk and `spk:0`
 * in another are NOT guaranteed to be the same real person, since each chunk is transcribed
 * independently with no shared context.
 */
export function mergeChunkedTurns(chunks: TranscribedChunk[]): Turn[] {
  const merged: Turn[] = [];
  for (const chunk of chunks) {
    for (const turn of chunk.turns) {
      merged.push({
        speakerRef: turn.speakerRef,
        tStart: turn.tStart + chunk.offsetSeconds,
        tEnd: turn.tEnd + chunk.offsetSeconds,
        text: turn.text,
      });
    }
  }
  return merged;
}

export interface TimeGap {
  gapStart: number;
  gapEnd: number;
  gapSeconds: number;
}

/**
 * Real bug found live (2026-09-04): checking only the LAST turn's `tEnd` against the total real
 * duration ("coverage") is NOT sufficient to prove completeness — a chunk can itself stop early
 * partway through its own assigned span (observed: a 40-minute chunk's transcription cut off at
 * minute ~35, leaving a real ~5-minute silent gap at the seam with the next chunk), and the
 * overall last-turn/duration ratio can still read as ~100% because the LATER chunks cover the
 * rest of the timeline. This function finds every gap between consecutive turns (by `tStart`,
 * chronologically) wider than `thresholdSeconds` — the real, load-bearing completeness check.
 */
export function findTimeGaps(turns: Turn[], thresholdSeconds: number): TimeGap[] {
  const sorted = [...turns].sort((a, b) => a.tStart - b.tStart);
  const gaps: TimeGap[] = [];
  let coveredUntil = 0;

  for (const turn of sorted) {
    const gapSeconds = turn.tStart - coveredUntil;
    if (gapSeconds > thresholdSeconds) {
      gaps.push({ gapStart: coveredUntil, gapEnd: turn.tStart, gapSeconds });
    }
    coveredUntil = Math.max(coveredUntil, turn.tEnd);
  }

  return gaps;
}
