/**
 * packages/meeting-bot/src/platform.ts — T-024 C1. Pure URL-shape detection, no I/O. Recognizes
 * the four platform buckets the grill's blindspot resolution calls for (contract
 * qa/contracts/meeting-bot-capture.md C1): Meet, Teams, Zoom, Webex, else `unknown`.
 */

export type Platform = "meet" | "teams" | "zoom" | "webex" | "unknown";

/** Pattern-matches real URL shapes. Never throws — an unparseable URL is just `unknown`. */
export function detectPlatform(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  if (host === "meet.google.com" || host.endsWith(".meet.google.com")) return "meet";
  if (
    host === "teams.microsoft.com" ||
    host.endsWith(".teams.microsoft.com") ||
    host === "teams.live.com" ||
    host.endsWith(".teams.live.com")
  ) {
    return "teams";
  }
  if (host === "zoom.us" || host.endsWith(".zoom.us") || host === "zoom.com" || host.endsWith(".zoom.com")) {
    return "zoom";
  }
  if (host === "webex.com" || host.endsWith(".webex.com")) return "webex";

  return "unknown";
}
