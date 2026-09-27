"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const LISTENERS = new Set<() => void>();

function emit() {
  LISTENERS.forEach((l) => l());
}

function subscribe(cb: () => void) {
  LISTENERS.add(cb);
  return () => { LISTENERS.delete(cb); };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("ard-theme");
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

/** Icon toggle for light / dark. Persists to localStorage; defaults to system preference. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  // Keep DOM class in sync with the store (layout script already set it before paint).
  if (typeof document !== "undefined") applyTheme(theme);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add("theme-animating");
    const next: Theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("ard-theme", next); } catch {}
    applyTheme(next);
    emit();
    window.setTimeout(() => root.classList.remove("theme-animating"), 220);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/70 text-muted hover:bg-surface hover:text-foreground"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
