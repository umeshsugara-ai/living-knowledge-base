#!/usr/bin/env node
/**
 * scripts/transcribe-toc-session.mjs — T-003 C2. Real CLI: uploads a TOC session's audio file to
 * Gemini's File API, polls until ACTIVE, transcribes+diarizes via generateContent, and writes the
 * parsed turns into data/toc-migrated/<sessionId>/turns.json (replacing T-002's placeholder
 * `speakerRef: "unknown"` entries). Same `tsx/esm/api` register() pattern as seed-toc.mjs for
 * loading packages/ai's TS sources at runtime. REAL network calls, REAL API cost -- not a dry run.
 *
 * Usage: node scripts/transcribe-toc-session.mjs <sessionId>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { register } from "tsx/esm/api";
import { Agent, setGlobalDispatcher } from "undici";

// Real audio transcription (generateContent processing a large uploaded file server-side) can
// legitimately take several minutes to return headers — undici's default headersTimeout (300s)
// tripped on a real 35MB file during this unit's own first test run. Widen it for this script
// only (a real, long-running CLI tool), not for the library code (packages/ai's fetch calls stay
// on Node's default via apps/api's production transport).
setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data", "toc-migrated");
const AUDIO_DIR = join(ROOT, "raw", "TOC", "TOC-Materials", "Audio");

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("usage: node scripts/transcribe-toc-session.mjs <sessionId>");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not set in environment/.env");
  process.exit(1);
}

register();

const MIME_BY_EXT = { ".m4a": "audio/mp4", ".mp4": "video/mp4", ".mp3": "audio/mpeg" };

/** Real UploadTransport — fetch()-based, reads response headers (needed for the resumable
 * upload's x-goog-upload-url handoff), which apps/api/src/ai-transport.ts's httpTransport
 * (built for the JSON-only Transport seam) does not expose. */
async function realUploadTransport(req) {
  const headers = { ...req.headers };
  const isRawBytes = req.body instanceof Uint8Array;
  const res = await fetch(req.url, {
    method: req.method,
    headers,
    body: isRawBytes ? req.body : req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  const respHeaders = {};
  for (const [k, v] of res.headers.entries()) respHeaders[k.toLowerCase()] = v;
  return { status: res.status, headers: respHeaders, body };
}

function findAudioFile(sid) {
  // T-002's source.json.path is the ORIGINAL raw transcript file (e.g.
  // "raw/TOC/TOC-Materials/Transcripts/23rd-May-UniAccess-ATLAS-Skilltech.content.md") — its
  // basename (minus ".content.md") is the exact same stem the Audio/ directory's extracted audio
  // uses. This is an exact-basename match, not a fuzzy title-word heuristic (which mismatched
  // "UniAccess Live: ATLAS SkillTech University" against a different UniAccess session's audio
  // on first use — real bug caught by the proof-of-concept run itself).
  const sourceJsonPath = join(DATA_DIR, sid, "source.json");
  if (!existsSync(sourceJsonPath)) throw new Error(`no data/toc-migrated/${sid}/source.json found`);
  const source = JSON.parse(readFileSync(sourceJsonPath, "utf8"));
  const rawStem = source.path.split("/").pop().replace(/\.content\.md$/i, "");

  const files = readdirSync(AUDIO_DIR).filter((f) => [".m4a", ".mp4", ".mp3"].includes(extname(f).toLowerCase()));
  const match = files.find((f) => f.slice(0, f.lastIndexOf(".")).toLowerCase() === rawStem.toLowerCase());
  if (!match) {
    throw new Error(`no exact audio-file basename match for "${rawStem}" (from source.json path "${source.path}") among: ${files.join(", ")}`);
  }
  return { path: join(AUDIO_DIR, match), filename: match };
}

async function main() {
  const { uploadFile, pollFileState, transcribeUploadedAudio } = await import("../packages/ai/src/stt/gemini-file-upload.ts");

  const { path: audioPath, filename } = findAudioFile(sessionId);
  const mimeType = MIME_BY_EXT[extname(filename).toLowerCase()] ?? "audio/mp4";
  const bytes = readFileSync(audioPath);
  console.log(`uploading ${filename} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, ${mimeType})...`);

  const { fileUri, name } = await uploadFile(bytes, mimeType, realUploadTransport, apiKey, filename);
  console.log(`uploaded: ${name}`);

  const MAX_POLLS = 20;
  const POLL_DELAY_MS = 5000;
  let state = "PROCESSING";
  for (let i = 0; i < MAX_POLLS && state === "PROCESSING"; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    state = await pollFileState(name, realUploadTransport, apiKey);
    console.log(`poll ${i + 1}/${MAX_POLLS}: ${state}`);
  }
  if (state !== "ACTIVE") {
    throw new Error(`file never became ACTIVE (last state: ${state}) after ${MAX_POLLS} polls`);
  }

  console.log("transcribing...");
  const { turns, usage } = await transcribeUploadedAudio(fileUri, realUploadTransport, apiKey);
  console.log(`got ${turns.length} turns. usage: inputTokens=${usage.inputTokens} outputTokens=${usage.outputTokens}`);

  const turnsPath = join(DATA_DIR, sessionId, "turns.json");
  const existingTurns = existsSync(turnsPath) ? JSON.parse(readFileSync(turnsPath, "utf8")) : [];

  // Defense in depth (belt-and-braces alongside gemini-file-upload.ts's own empty-response
  // guard): never overwrite existing turns with an empty result, regardless of why parsing came
  // up empty. A real session already known to have content must never regress to zero turns.
  if (turns.length === 0 && existingTurns.length > 0) {
    throw new Error(
      `transcribeUploadedAudio parsed 0 turns for "${sessionId}" but ${existingTurns.length} ` +
      `existing turn(s) are on disk — refusing to overwrite. Investigate the raw response before retrying.`,
    );
  }
  const realTurns = turns.map((t, i) => ({
    _id: `${sessionId}-t${String(i + 1).padStart(3, "0")}`,
    tenantId: "toc",
    sessionId,
    speakerRef: t.speakerRef,
    tStart: t.tStart,
    tEnd: t.tEnd,
    text: t.text,
  }));
  writeFileSync(turnsPath, JSON.stringify(realTurns, null, 2) + "\n", "utf8");
  console.log(`wrote ${realTurns.length} real diarized turns -> ${turnsPath} (replaced ${existingTurns.length} placeholder turn(s))`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
