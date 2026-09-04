import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { DashboardPage } from "./DashboardPage.js";
import * as sessionsApi from "../api/sessions.js";
import * as sourcesApi from "../api/sources.js";
import * as keysApi from "../api/keys.js";
import * as gapsApi from "../api/gaps.js";
import { ApiError } from "../api/client.js";

function renderPage() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

function mockAll(overrides: {
  sessions?: Parameters<typeof sessionsApi.listSessions>;
  gaps?: Awaited<ReturnType<typeof gapsApi.listGaps>>["gaps"];
} = {}) {
  vi.spyOn(sessionsApi, "listSessions").mockResolvedValue({
    sessions: [
      { _id: "s1", title: "Older Session", date: "2026-04-21", org: "TOC", status: { transcribe: "done", index: "done" } },
      { _id: "s2", title: "Newer Session", date: "2026-08-27", org: "TOC", status: { transcribe: "done", index: "done" } },
    ],
  });
  vi.spyOn(sourcesApi, "listSources").mockResolvedValue({
    sources: [{ _id: "src1", kind: "document", captureMode: "provided", createdAt: "2026-08-01T00:00:00Z" }],
  });
  vi.spyOn(keysApi, "listKeys").mockResolvedValue({
    keys: [
      { _id: "k1", label: "active-key", scopes: ["sessions"], createdAt: "2026-01-01T00:00:00Z", revokedAt: null },
      { _id: "k2", label: "old-key", scopes: ["sessions"], createdAt: "2026-01-01T00:00:00Z", revokedAt: "2026-02-01T00:00:00Z" },
    ],
  });
  vi.spyOn(gapsApi, "listGaps").mockResolvedValue({
    gaps: overrides.gaps ?? [{ _id: "g1", kind: "missing-recording", description: "no recording yet", status: "open" }],
  });
}

describe("DashboardPage", () => {
  test("renders real stat cards and orders recent sessions newest-first", async () => {
    mockAll();
    renderPage();
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument()); // sessions count
    expect(screen.getAllByText("1").length).toBeGreaterThan(0); // sources + active-keys counts (both 1)
    const links = await screen.findAllByRole("link");
    const sessionLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/sessions/"));
    expect(sessionLinks[0]).toHaveAttribute("href", "/sessions/s2");
  });

  test("shows an honest empty state when there are no gaps", async () => {
    mockAll({ gaps: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No gaps recorded for this tenant/)).toBeInTheDocument(),
    );
  });

  test("shows the real error message on a failed fetch, never a silent blank page", async () => {
    vi.spyOn(sessionsApi, "listSessions").mockRejectedValue(new ApiError(403, "missing sessions scope"));
    vi.spyOn(sourcesApi, "listSources").mockResolvedValue({ sources: [] });
    vi.spyOn(keysApi, "listKeys").mockResolvedValue({ keys: [] });
    vi.spyOn(gapsApi, "listGaps").mockResolvedValue({ gaps: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText("missing sessions scope")).toBeInTheDocument());
  });
});
