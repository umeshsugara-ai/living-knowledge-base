/**
 * apps/api/src/gws-gmail.ts — T-028. Real Gmail scan for meeting-shaped mail, backed by the
 * same already-authenticated `gws` CLI as `gws-calendar.ts` (`gmail.readonly` is already among
 * its granted scopes). Shells out via `cmd /c`, same wrapping as `gws-calendar.ts`/
 * `doc-polisher`'s `run_gws()`.
 *
 * Search scope: Gmail's own `q` query restricts the list to recent mail mentioning a known
 * video-conference host — real server-side filtering, not a client-side scan of the whole
 * inbox. Each matching message is then fetched with `format=metadata` (Subject/From/Date only —
 * never the full body) to build a candidate row. A meeting URL is extracted ONLY when one
 * literally appears in the message's own snippet text (a real substring match) — never
 * fabricated when absent; `meetingUrl` stays undefined in that case, same "real data or an
 * honest gap" rule the calendar adapter follows.
 *
 * On any failure (`gws` missing, not authenticated, network error, malformed output) this
 * returns an empty list rather than throwing, matching `gws-calendar.ts`'s failure contract.
 */
import { execFile } from "node:child_process";

export interface GmailMeetingCandidate {
  messageId: string;
  subject: string;
  senderEmail: string;
  senderDomain: string;
  meetingUrl?: string;
}

interface GwsMessageListResponse {
  messages?: { id: string }[];
}

interface GwsMessageHeader { name: string; value: string; }
interface GwsMessageMetadata {
  id: string;
  snippet?: string;
  payload?: { headers?: GwsMessageHeader[] };
}

const MEETING_QUERY = "newer_than:14d (meet.google.com OR zoom.us OR teams.microsoft.com)";
const MEETING_URL_RE = /https?:\/\/[^\s"'<>]*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)[^\s"'<>]*/i;
const FROM_RE = /<?([^\s<>]+@[^\s<>]+)>?\s*$/;

function parseGwsJson(stdout: string): unknown {
  const lines = stdout.split("\n");
  const startIdx = lines.findIndex((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
  if (startIdx === -1) throw new Error("gws produced no JSON output");
  return JSON.parse(lines.slice(startIdx).join("\n"));
}

function runGws(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("cmd", ["/c", "gws", ...args], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(err); return; }
      resolve(stdout);
    });
  });
}

function header(headers: GwsMessageHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractEmail(fromHeader: string): string {
  const match = FROM_RE.exec(fromHeader.trim());
  return (match?.[1] ?? fromHeader).toLowerCase();
}

async function fetchOne(messageId: string): Promise<GmailMeetingCandidate | null> {
  const params = JSON.stringify({
    userId: "me", id: messageId, format: "metadata", metadataHeaders: ["Subject", "From"],
  });
  const stdout = await runGws(["gmail", "users", "messages", "get", "--params", params, "--format", "json"]);
  const msg = parseGwsJson(stdout) as GwsMessageMetadata;
  const headers = msg.payload?.headers;
  const senderEmail = extractEmail(header(headers, "From"));
  if (!senderEmail.includes("@")) return null;
  const senderDomain = senderEmail.split("@")[1] ?? "";
  const meetingUrl = MEETING_URL_RE.exec(msg.snippet ?? "")?.[0];

  return {
    messageId: msg.id,
    subject: header(headers, "Subject") || "(no subject)",
    senderEmail,
    senderDomain,
    ...(meetingUrl ? { meetingUrl } : {}),
  };
}

export async function scanGmailForMeetingCandidates(maxMessages = 15): Promise<GmailMeetingCandidate[]> {
  try {
    const listParams = JSON.stringify({ userId: "me", q: MEETING_QUERY, maxResults: maxMessages });
    const listStdout = await runGws(["gmail", "users", "messages", "list", "--params", listParams, "--format", "json"]);
    const list = parseGwsJson(listStdout) as GwsMessageListResponse;
    const ids = (list.messages ?? []).map((m) => m.id);

    const results = await Promise.all(ids.map((id) => fetchOne(id).catch(() => null)));
    return results.filter((c): c is GmailMeetingCandidate => c !== null);
  } catch {
    return [];
  }
}
