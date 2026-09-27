"use client";

import { useState } from "react";
import { BrandMark, Wordmark } from "@/components/desk/ui";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, password }) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) { setError(json.error ?? "Sign-in failed. Try again."); setBusy(false); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-3xl"><Wordmark /></h1>
          <p className="mt-1 text-sm text-muted">Weekend engagement → ready-to-approve pipeline, on graph8</p>
        </div>

        <form onSubmit={submit} className="rounded-[12px] border border-border bg-surface p-6 shadow-warm">
          <h2 className="mb-4 text-base font-semibold text-foreground">Sign in</h2>

          <label htmlFor="user" className="mb-1 block text-xs font-medium text-muted">Username</label>
          <input id="user" autoComplete="username" autoFocus required value={user} onChange={(e) => setUser(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent" />

          <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent" />

          {error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="w-full rounded-lg bg-btn-weekend px-4 py-2.5 text-sm font-semibold text-white shadow-warm hover:bg-btn-weekend-hover disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-soft">Live graph8 data · every send waits for human approval</p>
      </div>
    </main>
  );
}
