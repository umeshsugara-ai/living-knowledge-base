import { render, screen } from "@testing-library/react";
import { describe, test, expect } from "vitest";
import { MeetingBotPage } from "./MeetingBotPage.js";

describe("MeetingBotPage", () => {
  test("honestly discloses that no joiner has ever joined a real meeting", () => {
    render(<MeetingBotPage />);
    expect(screen.getByText(/no joiner has ever actually joined a live meeting/)).toBeInTheDocument();
  });

  test("lists the real, tested building blocks without claiming they're a live connection", () => {
    render(<MeetingBotPage />);
    expect(screen.getByText("Platform detection")).toBeInTheDocument();
    expect(screen.getByText("Consent gate")).toBeInTheDocument();
    expect(screen.getByText("Join-strategy selection")).toBeInTheDocument();
    expect(screen.getByText("Private-segment exclusion")).toBeInTheDocument();
  });
});
