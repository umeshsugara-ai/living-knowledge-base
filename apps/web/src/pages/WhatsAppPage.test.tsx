import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { WhatsAppPage } from "./WhatsAppPage.js";
import * as whatsappApi from "../api/whatsapp.js";
import { ApiError } from "../api/client.js";

function renderPage() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <WhatsAppPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("WhatsAppPage", () => {
  test("shows real tracked groups", async () => {
    vi.spyOn(whatsappApi, "listWhatsAppGroups").mockResolvedValue({
      groups: [{ groupJid: "g1@g.us", ownerUserId: "u1", subject: "Millionaires", trackedPersonCount: 3 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Millionaires")).toBeInTheDocument());
    expect(screen.getByText("3 tracked participants")).toBeInTheDocument();
  });

  test("shows an honest empty state when there are no tracked groups", async () => {
    vi.spyOn(whatsappApi, "listWhatsAppGroups").mockResolvedValue({ groups: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No tracked groups found/)).toBeInTheDocument());
  });

  test("shows the real error message on a failed fetch, never a silent blank page", async () => {
    vi.spyOn(whatsappApi, "listWhatsAppGroups").mockRejectedValue(new ApiError(403, "missing whatsapp scope"));
    renderPage();
    await waitFor(() => expect(screen.getByText("missing whatsapp scope")).toBeInTheDocument());
  });

  test("clicking Ingest calls the real endpoint and shows the real result with a link to the new session", async () => {
    vi.spyOn(whatsappApi, "listWhatsAppGroups").mockResolvedValue({
      groups: [{ groupJid: "g1@g.us", ownerUserId: "u1", subject: "Millionaires", trackedPersonCount: 3 }],
    });
    const ingestSpy = vi.spyOn(whatsappApi, "ingestWhatsAppGroup").mockResolvedValue({
      sessionId: "s1", sourceId: "src1", turnCount: 50,
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Ingest into knowledge base/ }));
    expect(ingestSpy).toHaveBeenCalledWith("test-key", "g1@g.us", "u1");
    await waitFor(() => expect(screen.getByText(/Ingested 50 real message/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "View it" })).toHaveAttribute("href", "/sessions/s1");
  });

  test("a failed ingest shows the real error message", async () => {
    vi.spyOn(whatsappApi, "listWhatsAppGroups").mockResolvedValue({
      groups: [{ groupJid: "g1@g.us", ownerUserId: "u1", subject: "Millionaires", trackedPersonCount: 3 }],
    });
    vi.spyOn(whatsappApi, "ingestWhatsAppGroup").mockRejectedValue(new ApiError(502, "whatsapp_msg Mongo unreachable"));
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Ingest into knowledge base/ }));
    await waitFor(() => expect(screen.getByText("whatsapp_msg Mongo unreachable")).toBeInTheDocument());
  });
});
