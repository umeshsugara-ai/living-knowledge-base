import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../../auth/AuthContext.js";
import { SessionDetailPage } from "./SessionDetailPage.js";
import * as sessionsApi from "../../api/sessions.js";

function renderAt(id: string) {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/sessions/${id}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("SessionDetailPage", () => {
  test("labels an audio turn's tStart/tEnd in seconds", async () => {
    vi.spyOn(sessionsApi, "getSession").mockResolvedValue({
      session: { _id: "s1", title: "Real Session", date: "2026-04-21", status: { transcribe: "done", index: "done" } },
      page: null,
      claims: [],
      turns: [{ _id: "t1", speakerRef: "spk:0", tStart: 0, tEnd: 28, text: "Hello." }],
    });
    renderAt("s1");
    await waitFor(() => expect(screen.getByText("spk:0 · 0s–28s")).toBeInTheDocument());
  });

  test("real bug fix: labels an ingested URL turn's tStart/tEnd in characters, not seconds", async () => {
    // tStart/tEnd for a url-ingested turn are character offsets (packages/ingest's
    // splitIntoParagraphTurns), not real time -- a real UI bug found live 2026-09-04 labeled
    // these as seconds, which was factually wrong for ingested content.
    vi.spyOn(sessionsApi, "getSession").mockResolvedValue({
      session: { _id: "s2", title: "https://example.com/article", date: "2026-09-04", status: { transcribe: "done", index: "pending" } },
      page: null,
      claims: [],
      turns: [{ _id: "t1", speakerRef: "url", tStart: 0, tEnd: 28, text: "Title: Example" }],
    });
    renderAt("s2");
    await waitFor(() => expect(screen.getByText("url · 0chars–28chars")).toBeInTheDocument());
  });
});
