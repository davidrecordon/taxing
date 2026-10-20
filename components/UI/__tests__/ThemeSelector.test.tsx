import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeSelector from "../ThemeSelector";

const STORAGE_KEY = "tax-calc-theme";

// jsdom has no matchMedia; this one lets a test change the system preference
let systemPrefersDark = false;
let notifySystemChange: () => void = () => {};

describe("ThemeSelector", () => {
  beforeEach(() => {
    systemPrefersDark = false;
    notifySystemChange = () => {};
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        get matches() {
          return systemPrefersDark;
        },
        addEventListener: (_: string, listener: () => void) => {
          notifySystemChange = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in light mode and offers dark", () => {
    render(<ThemeSelector />);

    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
  });

  it("uses the theme chosen on an earlier visit", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    render(<ThemeSelector />);

    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("uses the theme already set on the page when none is stored", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeSelector />);

    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("switches the page to dark, remembers it, and offers light", async () => {
    render(<ThemeSelector />);

    await userEvent.click(screen.getByRole("button"));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("switches back to light on a second click", async () => {
    render(<ThemeSelector />);

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("button"));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("follows the system setting while no theme has been chosen", () => {
    render(<ThemeSelector />);

    systemPrefersDark = true;
    act(() => notifySystemChange());

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("ignores the system setting once a theme has been chosen", async () => {
    render(<ThemeSelector />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("button"));

    systemPrefersDark = true;
    act(() => notifySystemChange());

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
