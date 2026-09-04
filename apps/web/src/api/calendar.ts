import { apiFetch } from "./client.js";
import type { UpcomingMeeting } from "./types.js";

export function listUpcomingMeetings(apiKey: string | null): Promise<{ meetings: UpcomingMeeting[] }> {
  return apiFetch("/calendar/upcoming", apiKey);
}
