import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, beforeEach } from "vitest";
import { AuthProvider } from "./AuthContext.js";
import { LoginGate } from "./LoginGate.js";

function renderGate() {
  return render(
    <AuthProvider>
      <LoginGate>
        <div>real protected content</div>
      </LoginGate>
    </AuthProvider>,
  );
}

describe("LoginGate", () => {
  beforeEach(() => localStorage.clear());

  test("hides children until a key is submitted", () => {
    renderGate();
    expect(screen.queryByText("real protected content")).not.toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toBeInTheDocument();
  });

  test("submitting a key reveals children and persists the key to localStorage", async () => {
    renderGate();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("API key"), "real-key-123");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("real protected content")).toBeInTheDocument();
    expect(localStorage.getItem("lkbApiKey")).toBe("real-key-123");
  });

  test("an already-stored key skips the gate on next render", () => {
    localStorage.setItem("lkbApiKey", "already-there");
    renderGate();
    expect(screen.getByText("real protected content")).toBeInTheDocument();
  });
});
