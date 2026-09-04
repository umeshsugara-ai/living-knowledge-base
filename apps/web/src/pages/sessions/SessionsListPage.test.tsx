import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../../auth/AuthContext.js";
import { SessionsListPage } from "./SessionsListPage.js";
import * as sessionsApi from "../../api/sessions.js";
import { ApiError } from "../../api/client.js";

function renderPage() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SessionsListPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("SessionsListPage", () => {
  test("renders real sessions with a working link to the detail route", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({
      sessions: [{ _id: "s1", title: "A Real Session", date: "2026-04-21", org: "TOC", status: { transcribe: "done", index: "done" } }],
    });
    renderPage();
    const link = await screen.findByRole("link", { name: /A Real Session/ });
    expect(link).toHaveAttribute("href", "/sessions/s1");
  });

  test("renders real transcribe/index status badges per session", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({
      sessions: [{ _id: "s1", title: "A Real Session", date: "2026-04-21", org: "TOC", status: { transcribe: "done", index: "processing" } }],
    });
    renderPage();
    await screen.findByRole("link", { name: /A Real Session/ });
    expect(screen.getByText("transcribe: done")).toBeInTheDocument();
    expect(screen.getByText("index: processing")).toBeInTheDocument();
  });

  test("shows an honest empty state when there are no sessions", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({ sessions: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText("No sessions found for this tenant.")).toBeInTheDocument());
  });

  test("shows the real error message on a failed fetch, never a silent blank page", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockRejectedValue(new ApiError(403, "missing sessions scope"));
    renderPage();
    await waitFor(() => expect(screen.getByText("missing sessions scope")).toBeInTheDocument());
  });
});
