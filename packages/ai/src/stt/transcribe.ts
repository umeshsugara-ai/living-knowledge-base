/**
 * packages/ai/src/stt/transcribe.ts — T-019 C6. The shared STT interface (ARCHITECTURE H9:
 * "pluggable STT ... transcribe(audio, opts) -> turns[]"). `whisper.ts` and `gemini.ts` both
 * implement `transcribe`; nothing else re-declares this shape.
 */
import type { Transport } from "../provider.js";

/** Matches schema/turns.schema.json minus the ids the caller (ingest pipeline) fills in. */
export interface Turn {
  speakerRef: string;
  tStart: number;
  tEnd: number;
  text: string;
  confidence?: number;
}

export interface TranscribeOpts {
  language?: string;
  diarize?: boolean;
}

export type Transcribe = (audio: Uint8Array, opts: TranscribeOpts) => Promise<Turn[]>;

/** Every STT adapter takes an injected `Transport` — no real process/network call in tests. */
export interface SttAdapter {
  readonly name: string;
  transcribe: Transcribe;
}

export type SttAdapterFactory = (transport: Transport) => SttAdapter;
