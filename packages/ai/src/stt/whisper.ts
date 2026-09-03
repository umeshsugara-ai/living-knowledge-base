/**
 * packages/ai/src/stt/whisper.ts — T-019 C6. Default, local STT adapter: self-hosted
 * faster-whisper + VAD diarization worker (ARCHITECTURE H9; `workers/transcribe/`). This
 * package never spawns the worker itself — it calls it through the injected `transport` as a
 * local HTTP job endpoint, so tests use a fake transport instead of a real worker process.
 */
import type { Transport } from "../provider.js";
import type { SttAdapter, Turn, TranscribeOpts } from "./transcribe.js";

const DEFAULT_BASE_URL = "http://localhost:8899";

export interface WhisperConfig {
  baseUrl?: string;
}

export function createWhisperAdapter(transport: Transport, config: WhisperConfig = {}): SttAdapter {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  return {
    name: "whisper",
    async transcribe(audio: Uint8Array, opts: TranscribeOpts): Promise<Turn[]> {
      const res = await transport({
        kind: "http",
        url: `${baseUrl}/transcribe`,
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: { audio: Array.from(audio), language: opts.language, diarize: opts.diarize ?? true },
      });

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`whisper worker error ${res.status}: ${JSON.stringify(res.body)}`);
      }

      const body = res.body as { turns?: Turn[] };
      return body.turns ?? [];
    },
  };
}
