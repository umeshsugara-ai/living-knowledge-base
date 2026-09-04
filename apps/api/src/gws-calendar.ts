/**
 * apps/api/src/gws-calendar.ts — real upcoming-meetings adapter backed by the `gws` CLI, already
 * OAuth'd as umeshsugara@vidysea.com (the same credential the `doc-polisher` skill's
 * `gws_doc_polisher.py` uses for Docs — `calendar.readonly` is already among its granted scopes,
 * confirmed live via `gws auth status`). No new Google Cloud project or OAuth flow needed.
 *
 * Shells out to `gws calendar events list` via `cmd /c` (the same wrapping
 * `gws_doc_polisher.py`'s `run_gws()` uses — plain `execFile("gws", …)` cannot resolve npm's
 * Windows `.cmd`/`.ps1` shims). The `--params` JSON is built entirely from values this file
 * computes (a fixed time window) — no caller input ever reaches the shell. `gws` always prefixes
 * its JSON stdout with a "Using keyring backend: …" diagnostic line; `parseGwsJson` skips to the
 * first `{`/`[`, same as `run_gws()` does in Python.
 *
 * "Relevant" = has a real joinable video-conference link (`hangoutLink` or a `conferenceData`
 * video entry point). An event with nothing to click is nothing a person or a meeting-bot can
 * join, so it is filtered out rather than shown as a hollow row.
 *
 * Disclosed limitation: this only works on a machine with the `gws` CLI + its OAuth keyring
 * configured (Umesh's own machine today) — not yet portable to a hosted multi-tenant deployment,
 * and it reads one calendar ("primary"), not a per-tenant mapping. On any failure (`gws` missing,
 * not authenticated, network error, malformed output) this returns an empty list rather than
 * throwing, so the Calendar page still renders an honest state instead of a 500.
 */
import { execFile } from "node:child_process";
import type { UpcomingMeeting } from "./routes/calendar.js";

interface GwsEventListResponse {
  items?: GwsCalendarEvent[];
}

interface GwsCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
  organizer?: { email?: string };
}

function parseGwsJson(stdout: string): unknown {
  const lines = stdout.split("\n");
  const startIdx = lines.findIndex((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
  if (startIdx === -1) throw new Error("gws produced no JSON output");
  return JSON.parse(lines.slice(startIdx).join("\n"));
}

function meetingUrlOf(event: GwsCalendarEvent): string | undefined {
  if (event.hangoutLink) return event.hangoutLink;
  return event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
}

function runGws(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("cmd", ["/c", "gws", ...args], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(err); return; }
      resolve(stdout);
    });
  });
}

export async function listUpcomingGwsMeetings(windowDays = 14): Promise<UpcomingMeeting[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();
  const params = JSON.stringify({
    calendarId: "primary", maxResults: 25, orderBy: "startTime", singleEvents: true, timeMin, timeMax,
  });

  try {
    const stdout = await runGws(["calendar", "events", "list", "--params", params, "--format", "json"]);
    const parsed = parseGwsJson(stdout) as GwsEventListResponse;
    const mapped: UpcomingMeeting[] = (parsed.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? "(untitled)",
      startTime: e.start?.dateTime ?? e.start?.date ?? "",
      endTime: e.end?.dateTime ?? e.end?.date ?? "",
      meetingUrl: meetingUrlOf(e),
      organizer: e.organizer?.email,
    }));
    return mapped.filter((m) => Boolean(m.meetingUrl) && Boolean(m.startTime));
  } catch {
    return [];
  }
}
