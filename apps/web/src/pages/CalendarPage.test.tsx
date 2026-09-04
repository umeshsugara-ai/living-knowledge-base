import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { vi, describe, test, expect, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { CalendarPage } from "./CalendarPage.js";
import * as sessionsApi from "../api/sessions.js";
import * as calendarApi from "../api/calendar.js";
import * as candidatesApi from "../api/meeting-candidates.js";
import { ApiError } from "../api/client.js";

function renderPage() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  // Every test exercises Sessions/Calendar-specific behavior; the Gmail review section defaults
  // to an empty, no-op state unless a test overrides it.
  vi.spyOn(candidatesApi, "listMeetingCandidates").mockResolvedValue({ candidates: [] });
});

describe("CalendarPage", () => {
  test("shows real upcoming meetings from the connected calendar", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({
      meetings: [{ id: "evt-1", title: "Real Sync", startTime: "2026-09-08T05:30:00.000Z", endTime: "2026-09-08T06:00:00.000Z", meetingUrl: "https://meet.google.com/real", organizer: "umeshsugara@vidysea.com" }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Real Sync")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Join/ })).toHaveAttribute("href", "https://meet.google.com/real");
  });

  test("shows an honest empty state when there are no upcoming meetings", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({ meetings: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No upcoming meetings found/)).toBeInTheDocument());
  });

  test("a failed calendar fetch shows its own error, never blocking the Past sessions section", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({
      sessions: [{ _id: "a", title: "April Session", date: "2026-04-21", status: { transcribe: "done", index: "done" } }],
    });
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockRejectedValue(new ApiError(403, "missing calendar scope"));
    renderPage();
    await waitFor(() => expect(screen.getByText("missing calendar scope")).toBeInTheDocument());
    expect(await screen.findByText("April Session")).toBeInTheDocument();
  });

  test("groups real past sessions by month, most recent month first", async () => {
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({ meetings: [] });
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({
      sessions: [
        { _id: "a", title: "April Session", date: "2026-04-21", status: { transcribe: "done", index: "done" } },
        { _id: "b", title: "August Session", date: "2026-08-27", status: { transcribe: "done", index: "done" } },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("April Session")).toBeInTheDocument());
    const headings = screen.getAllByText(/2026$/).map((el) => el.textContent);
    expect(headings[0]).toMatch(/August/);
    expect(headings[1]).toMatch(/April/);
  });

  test("shows an honest empty state when there are no past sessions either", async () => {
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({ meetings: [] });
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText("No past sessions recorded.")).toBeInTheDocument());
  });

  test("shows real pending Gmail meeting candidates and approving one removes it from the review list", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({ meetings: [] });
    vi.spyOn(candidatesApi, "listMeetingCandidates").mockResolvedValue({
      candidates: [{ _id: "mc1", messageId: "gm-1", subject: "Invite: Weekly Sync", senderEmail: "manish.k@vidysea.com", senderDomain: "vidysea.com", status: "pending", detectedAt: "2026-09-04T00:00:00Z" }],
    });
    const approveSpy = vi.spyOn(candidatesApi, "approveMeetingCandidate").mockResolvedValue({ ok: true });
    renderPage();
    await screen.findByText("Invite: Weekly Sync");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(approveSpy).toHaveBeenCalledWith("test-key", "mc1");
  });

  test("scanning Gmail reports a real created/auto-approved count", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(calendarApi, "listUpcomingMeetings").mockResolvedValue({ meetings: [] });
    vi.spyOn(candidatesApi, "scanGmail").mockResolvedValue({ created: 2, autoApproved: 1 });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Scan Gmail" }));
    await waitFor(() => expect(screen.getByText(/Found 2 new candidate/)).toBeInTheDocument());
  });
});
