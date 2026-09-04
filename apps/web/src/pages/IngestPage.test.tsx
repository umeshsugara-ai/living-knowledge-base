import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { IngestPage } from "./IngestPage.js";
import * as ingestApi from "../api/ingest.js";
import { ApiError } from "../api/client.js";

function renderPage() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <IngestPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("IngestPage", () => {
  test("ingesting a real URL shows the real result with a link to the new session", async () => {
    vi.spyOn(ingestApi, "ingestUrl").mockResolvedValue({ sessionId: "s-123", sourceId: "src-1", turnCount: 12 });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("URL"), "https://example.com/article");
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(screen.getByText(/12 real paragraph turn/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "View it" })).toHaveAttribute("href", "/sessions/s-123");
  });

  test("a real fetch failure shows the real error message, never a silent failure", async () => {
    vi.spyOn(ingestApi, "ingestUrl").mockRejectedValue(new ApiError(502, "Jina Reader could not fetch this URL (HTTP 404)"));
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("URL"), "https://example.com/gone");
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(screen.getByText(/HTTP 404/)).toBeInTheDocument());
  });

  test("submitting an empty URL never calls the API", async () => {
    const spy = vi.spyOn(ingestApi, "ingestUrl");
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    expect(screen.getByText("enter a URL first")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  test("discloses that document/recording upload isn't real yet", () => {
    renderPage();
    expect(screen.getByText(/Document upload.*need real file-upload handling/)).toBeInTheDocument();
  });
});
