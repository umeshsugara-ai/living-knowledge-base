import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { CalendarPage } from "./CalendarPage.js";
import * as sessionsApi from "../api/sessions.js";

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
  test("always shows a real, permanent upcoming-events empty state, not hidden", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    renderPage();
    expect(screen.getByText(/No upcoming events are tracked yet/)).toBeInTheDocument();
    await waitFor(() => expect(sessionsApi.listSessions).toHaveBeenCalled());
  });

  test("groups real past sessions by month, most recent month first", async () => {
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
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText("No past sessions recorded.")).toBeInTheDocument());
  });
});
