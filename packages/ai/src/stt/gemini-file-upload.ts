/**
 * packages/ai/src/stt/gemini-file-upload.ts — T-003. The Gemini File API flow for audio too
 * large for `gemini.ts`'s inline-base64 path (most of the real TOC session recordings are
 * 20-60MB). Behind its own small `UploadTransport` seam — the shared `Transport` type in
 * `provider.ts` doesn't expose response headers, which the resumable-upload handoff needs (the
 * upload-start response returns the actual upload URL in an `x-goog-upload-url` header, not the
 * body) — a deliberate, narrow addition rather than widening the type every other adapter
 * depends on. No real network call anywhere in this module's own logic; a real implementation is
 * injected by the caller (a script, not a test).
 */
import type { Turn } from "./transcribe.js";

export interface UploadTransportRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  /** JSON object (upload-start) or raw bytes (upload-finalize PUT). */
  body?: unknown;
}

export interface UploadTransportResponse {
  status: number;
  /** Lowercased header names. */
  headers: Record<string, string>;
  /** Parsed JSON body when the response is JSON; undefined otherwise. */
  body?: unknown;
}

export type UploadTransport = (req: UploadTransportRequest) => Promise<UploadTransportResponse>;

const DEFAULT_MODEL = "gemini-3.5-flash";

function assertOk(res: UploadTransportResponse, step: string): void {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`gemini file upload: ${step} failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

/** Starts + finalizes a resumable file upload. Returns the uploaded file's `uri` (for
 * `generateContent`'s `fileData`) and `name` (for polling status). */
export async function uploadFile(bytes: Uint8Array, mimeType: string, transport: UploadTransport,
  apiKey: string, displayName = "audio"): Promise<{ fileUri: string; name: string }> {
  const start = await transport({
    method: "POST",
    url: `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: { file: { display_name: displayName } },
  });
  assertOk(start, "upload-start");

  const uploadUrl = start.headers["x-goog-upload-url"];
  if (!uploadUrl) {
    throw new Error("gemini file upload: upload-start response carried no x-goog-upload-url header");
  }

  const finalize = await transport({
    method: "PUT",
    url: uploadUrl,
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: bytes,
  });
  assertOk(finalize, "upload-finalize");

  const body = finalize.body as { file?: { uri?: string; name?: string } } | undefined;
  if (!body?.file?.uri || !body.file.name) {
    throw new Error("gemini file upload: finalize response missing file.uri/file.name");
  }
  return { fileUri: body.file.uri, name: body.file.name };
}

export type FileState = "ACTIVE" | "FAILED" | "PROCESSING";

/** A SINGLE poll — the caller (a real script, never a test) retries with its own backoff. */
export async function pollFileState(name: string, transport: UploadTransport,
  apiKey: string): Promise<FileState> {
  const res = await transport({
    method: "GET",
    url: `https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`,
  });
  assertOk(res, "poll-file-state");

  const body = res.body as { state?: string } | undefined;
  const state = body?.state;
  if (state === "ACTIVE" || state === "FAILED" || state === "PROCESSING") return state;
  throw new Error(`gemini file upload: unexpected file state "${String(state)}"`);
}

// Speaker capture is non-greedy up to a colon followed by whitespace ("<speaker>: text"), not
// just any colon — a speakerRef like "spk:1" contains its own colon with no following space, so
// a naive "first colon" split would wrongly cut it at "spk".
const TIMESTAMP_LINE_RE = /^\[(\d{1,3}):(\d{2})\]\s*(.+?):\s+(.+)$/;

function parseTimestamp(minutes: string, seconds: string): number {
  return Number(minutes) * 60 + Number(seconds);
}

/**
 * Parses `[MM:SS] SpeakerName: text` lines (one turn per line) into `Turn[]`. `tEnd` for each
 * turn is the NEXT turn's `tStart`; the LAST turn's `tEnd` is its own `tStart + 30` seconds — a
 * documented fallback since the transcript's timestamps alone don't carry a true end time.
 * Non-matching lines (blank lines, stray prose) are skipped, never thrown on.
 */
export function parseDiarizedTranscript(text: string): Turn[] {
  const parsed: { speakerRef: string; tStart: number; text: string }[] = [];
  for (const line of text.split("\n")) {
    const match = TIMESTAMP_LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, mm, ss, speaker, turnText] = match;
    parsed.push({ speakerRef: speaker!.trim(), tStart: parseTimestamp(mm!, ss!), text: turnText!.trim() });
  }

  const LAST_TURN_FALLBACK_SECONDS = 30;
  return parsed.map((turn, i) => ({
    speakerRef: turn.speakerRef,
    tStart: turn.tStart,
    tEnd: i + 1 < parsed.length ? parsed[i + 1]!.tStart : turn.tStart + LAST_TURN_FALLBACK_SECONDS,
    text: turn.text,
  }));
}

export interface TranscribeUploadedResult {
  turns: Turn[];
  usage: { inputTokens: number; outputTokens: number };
}

const DIARIZE_PROMPT = [
  "Transcribe and diarize this audio in full, start to end.",
  "Output ONLY the transcript as one line per turn, in this EXACT format:",
  "[MM:SS] SpeakerName: spoken text",
  "Use the speaker's actual name if it is said aloud or clearly inferable from context;",
  "otherwise use spk:0, spk:1, etc. consistently for the same voice.",
  "No headers, no summary, no commentary outside the transcript lines.",
].join(" ");

/** Calls `generateContent` against an already-uploaded file (criterion 1's `uploadFile`). */
export async function transcribeUploadedAudio(fileUri: string, transport: UploadTransport,
  apiKey: string, model: string = DEFAULT_MODEL): Promise<TranscribeUploadedResult> {
  const res = await transport({
    method: "POST",
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    headers: { "content-type": "application/json" },
    body: {
      contents: [
        {
          parts: [
            { text: DIARIZE_PROMPT },
            { fileData: { mimeType: "audio/mp4", fileUri } },
          ],
        },
      ],
    },
  });
  assertOk(res, "generateContent");

  const body = res.body as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | undefined;
  const text = (body?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");

  return {
    turns: parseDiarizedTranscript(text),
    usage: {
      inputTokens: body?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body?.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
