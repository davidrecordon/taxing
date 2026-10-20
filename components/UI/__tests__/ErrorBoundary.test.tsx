import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../ErrorBoundary";

// Throws while `shouldThrow` is set, so a test can let it recover
let shouldThrow = false;
function Calculation() {
  if (shouldThrow) throw new Error("calculation failed");
  return <p>Results</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = false;
    // React logs every error a boundary catches
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows its children when nothing goes wrong", () => {
    render(
      <ErrorBoundary>
        <Calculation />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Results")).toBeInTheDocument();
  });

  it("shows a message in place of children that fail", () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Calculation />
      </ErrorBoundary>,
    );

    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    expect(
      screen.getByText(/couldn't complete your tax calculation/),
    ).toBeInTheDocument();
  });

  it("shows a custom fallback when one is given", () => {
    shouldThrow = true;
    render(
      <ErrorBoundary fallback={<p>Custom message</p>}>
        <Calculation />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });

  it("tries the children again from the Go Back button", async () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Calculation />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(screen.getByText("Results")).toBeInTheDocument();
  });
});
