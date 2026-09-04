/**
 * apps/web/src/pages/BrainPage.test.tsx — `react-force-graph-2d` renders to a real `<canvas>`
 * and drives its own physics simulation; jsdom has no real 2D canvas context and pixel-accurate
 * node hit-testing isn't something a component test should assert on anyway. So the library is
 * mocked here with a tiny stand-in that exposes the exact prop contract BrainPage depends on
 * (`graphData`, `onNodeClick`) via a real DOM button per node -- this tests BrainPage's own
 * drill-down LOGIC (which real API calls fire, what the side panel renders) independent of the
 * rendering library, which is the part of this component that's actually ours to get right.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { vi, describe, test, expect } from "vitest";
import { AuthProvider } from "../auth/AuthContext.js";
import { BrainPage } from "./BrainPage.js";
import * as graphApi from "../api/graph.js";
import * as sessionsApi from "../api/sessions.js";

vi.mock("react-force-graph-2d", () => ({
  default: (props: { graphData: { nodes: { id: string; label: string }[] }; onNodeClick: (n: { id: string }) => void }) => (
    <div data-testid="mock-graph">
      {props.graphData.nodes.map((n) => (
        <button key={n.id} onClick={() => props.onNodeClick({ id: n.id })}>{n.label}</button>
      ))}
    </div>
  ),
}));

function renderWithKey() {
  localStorage.setItem("lkbApiKey", "test-key");
  return render(
    <AuthProvider>
      <MemoryRouter>
        <BrainPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("BrainPage", () => {
  test("loads the real graph and renders session/topic nodes", async () => {
    vi.spyOn(graphApi, "loadGraph").mockResolvedValue({
      nodes: [
        { id: "s1", label: "Session One", kind: "session" },
        { id: "visas", label: "Visas", kind: "topic" },
      ],
      edges: [{ source: "s1", target: "visas", kind: "session-topic", inferred: false }],
    });
    renderWithKey();
    await waitFor(() => expect(screen.getByTestId("mock-graph")).toBeInTheDocument());
    expect(screen.getByText("Session One")).toBeInTheDocument();
    expect(screen.getByText("Visas")).toBeInTheDocument();
  });

  test("clicking a session node fetches the real session detail and shows it in the side panel", async () => {
    vi.spyOn(graphApi, "loadGraph").mockResolvedValue({
      nodes: [{ id: "s1", label: "Session One", kind: "session" }],
      edges: [],
    });
    vi.spyOn(sessionsApi, "getSession").mockResolvedValue({
      session: { _id: "s1", title: "Session One", date: "2026-04-21", status: { transcribe: "done", index: "done" } },
      page: { summary: "A real summary." },
      claims: [{ _id: "c1", text: "claim", status: "verified" }],
      turns: [],
    });
    renderWithKey();
    const user = userEvent.setup();
    await user.click(await screen.findByText("Session One"));
    await waitFor(() => expect(screen.getByText("A real summary.")).toBeInTheDocument());
    expect(sessionsApi.getSession).toHaveBeenCalledWith("test-key", "s1");
  });

  test("clicking a topic node shows its linked sessions derived from the graph payload (no extra fetch)", async () => {
    vi.spyOn(graphApi, "loadGraph").mockResolvedValue({
      nodes: [
        { id: "s1", label: "Session One", kind: "session" },
        { id: "visas", label: "Visas", kind: "topic" },
      ],
      edges: [{ source: "s1", target: "visas", kind: "session-topic", inferred: false }],
    });
    const getSessionSpy = vi.spyOn(sessionsApi, "getSession");
    renderWithKey();
    const user = userEvent.setup();
    await user.click(await screen.findByText("Visas"));
    await waitFor(() => expect(screen.getByText("Session One", { selector: ".row-meta" })).toBeInTheDocument());
    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  test("a linked session inside a topic panel is itself clickable and opens its real content", async () => {
    vi.spyOn(graphApi, "loadGraph").mockResolvedValue({
      nodes: [
        { id: "s1", label: "Session One", kind: "session" },
        { id: "visas", label: "Visas", kind: "topic" },
      ],
      edges: [{ source: "s1", target: "visas", kind: "session-topic", inferred: false }],
    });
    vi.spyOn(sessionsApi, "getSession").mockResolvedValue({
      session: { _id: "s1", title: "Session One", date: "2026-04-21", status: { transcribe: "done", index: "done" } },
      page: { summary: "A real summary." },
      claims: [],
      turns: [],
    });
    renderWithKey();
    const user = userEvent.setup();
    await user.click(await screen.findByText("Visas"));
    // Two buttons now read "Session One": the mocked graph's own node button, and the panel's
    // linked-session link -- the panel's is the last one rendered (it's a sibling after the
    // graph container in DOM order).
    const linkedButtons = await screen.findAllByRole("button", { name: "Session One" });
    await user.click(linkedButtons[linkedButtons.length - 1]!);
    await waitFor(() => expect(screen.getByText("A real summary.")).toBeInTheDocument());
    expect(sessionsApi.getSession).toHaveBeenCalledWith("test-key", "s1");
  });

  test("shows an honest empty state when the tenant has no tree index yet", async () => {
    vi.spyOn(graphApi, "loadGraph").mockResolvedValue({ nodes: [], edges: [] });
    renderWithKey();
    await waitFor(() => expect(screen.getByText(/No tree index built/)).toBeInTheDocument());
  });
});
