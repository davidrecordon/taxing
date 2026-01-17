"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// Subscribe to theme changes via storage events
function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("tax-calc-theme") as Theme | null;
  const htmlTheme = document.documentElement.getAttribute(
    "data-theme"
  ) as Theme | null;
  return stored || htmlTheme || "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

// Sun icon for light mode
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

// Moon icon for dark mode
function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeSelector() {
  const currentTheme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerSnapshot
  );

  // Listen for system preference changes when no stored preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const stored = localStorage.getItem("tax-calc-theme");
      if (!stored) {
        const newTheme = mediaQuery.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        window.dispatchEvent(new StorageEvent("storage"));
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    // Remove inline style set by init script so CSS transitions take over
    document.documentElement.style.removeProperty("background-color");
    localStorage.setItem("tax-calc-theme", newTheme);
    window.dispatchEvent(new StorageEvent("storage"));
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center p-2 rounded-[var(--radius-md)]
                 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                 hover:bg-[var(--color-bg-card)] border border-transparent
                 hover:border-[var(--color-border)] transition-all duration-200"
      aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
    >
      {currentTheme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
