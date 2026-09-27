"use client";

import type { ReactNode } from "react";

// Small shared building blocks for the Revenue Desk UI. Neutral surfaces, one accent,
// status shown as a dot + word rather than coloured panels.

export function Button({ children, onClick, variant = "secondary", size = "md", disabled, title, type = "button", ...rest }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md";
  disabled?: boolean; title?: string; type?: "button" | "submit"; "data-tour"?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const sizes = { sm: "h-7 px-2.5 text-xs", md: "h-8 px-3 text-[13px]" }[size];
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover dark:text-white",
    secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
    ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
    danger: "border border-border bg-surface text-danger hover:bg-danger/5",
  }[variant];
  return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${sizes} ${variants}`} {...rest}>{children}</button>;
}

export type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const DOT: Record<Tone, string> = { neutral: "bg-pending-dot", accent: "bg-accent", good: "bg-score", warn: "bg-warn", bad: "bg-danger" };
const TXT: Record<Tone, string> = { neutral: "text-muted", accent: "text-accent", good: "text-score", warn: "text-warn", bad: "text-danger" };

export function Status({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TXT[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]} ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const cls = { neutral: "bg-surface-muted text-muted", accent: "bg-accent-soft text-accent", good: "bg-score/10 text-score", warn: "bg-warn/10 text-warn", bad: "bg-danger/10 text-danger" }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function Panel({ title, action, children, tour, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; tour?: string; className?: string }) {
  return (
    <section data-tour={tour} className={`mc-card min-w-0 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => <p className="text-[13px] text-muted-soft">{children}</p>;

/* ---- Icons (1.5px stroke, 16px) ---- */
const I = ({ d, className = "h-4 w-4" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
export const Icon = {
  today: (p: { className?: string }) => <I {...p} d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" />,
  approvals: (p: { className?: string }) => <I {...p} d="M4 13l4 4L20 5M4 5h8M4 9h5" />,
  account: (p: { className?: string }) => <I {...p} d="M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h.01M12 9h.01M16 9h.01" />,
  activity: (p: { className?: string }) => <I {...p} d="M3 12h4l3-8 4 16 3-8h4" />,
  learning: (p: { className?: string }) => <I {...p} d="M12 3l9 5-9 5-9-5 9-5zM6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />,
  settings: (p: { className?: string }) => <I {...p} d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9c.2.6.8 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />,
  play: (p: { className?: string }) => <I {...p} d="M7 5l12 7-12 7V5z" />,
  reset: (p: { className?: string }) => <I {...p} d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0011.9 2.5M18.5 9A7 7 0 006.6 6.5" />,
  download: (p: { className?: string }) => <I {...p} d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  check: (p: { className?: string }) => <I {...p} d="M5 12l5 5 9-10" />,
  x: (p: { className?: string }) => <I {...p} d="M6 6l12 12M18 6L6 18" />,
  search: (p: { className?: string }) => <I {...p} d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" />,
  back: (p: { className?: string }) => <I {...p} d="M15 18l-6-6 6-6" />,
  help: (p: { className?: string }) => <I {...p} d="M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 114 2c-.9.6-1.5 1.2-1.5 2.5M12 17h.01" />,
  logout: (p: { className?: string }) => <I {...p} d="M15 4h4v16h-4M10 16l4-4-4-4M14 12H4" />,
  mail: (p: { className?: string }) => <I {...p} d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  phone: (p: { className?: string }) => <I {...p} d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  retry: (p: { className?: string }) => <I {...p} d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5" />,
};

/** "Revenue Desk." with the blue full stop. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-semibold tracking-tight text-foreground ${className}`}>Revenue Desk<span className="text-accent">.</span></span>;
}

/** "3m 04s" / "42s" */
export function formatElapsed(ms: number) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;
}
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
