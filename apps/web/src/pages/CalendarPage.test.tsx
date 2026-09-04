import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { CalendarPage } from "./CalendarPage.js";
import * as sessionsApi from "../api/sessions.js";
import * as calendarApi from "../api/calendar.js";
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
});
