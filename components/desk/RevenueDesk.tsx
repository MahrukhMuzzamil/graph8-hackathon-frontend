"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tour from "@/components/Tour";
import ThemeToggle from "@/components/ThemeToggle";
import { ToastStack, useToasts } from "@/components/Toasts";
import { API_URL, api } from "@/lib/api";
import { toastFor } from "@/lib/toast-messages";
import type { DraftMessage, PipelineEvent } from "@/lib/types";
import { AccountView } from "./AccountView";
import { ApprovalsView } from "./ApprovalsView";
import { exportCsv, type BatchInfo, type BatchState, type Learning, type Mode, type RunSummary, type Settings, type View } from "./model";
import { ActivityView, LearningView, SettingsView, type FeedItem } from "./OtherViews";
import { deriveRun } from "./run";
import { AccountsTable, TodayView } from "./TodayView";
import { Button, EmptyState, Icon, Status } from "./ui";

const TITLES: Record<View, { title: string; sub: string }> = {
  today: { title: "Today", sub: "This weekend's engagement, turned into ready-to-approve pipeline" },
  approvals: { title: "Approvals", sub: "Nothing is sent until you approve it" },
  companies: { title: "Companies", sub: "Every company from this weekend, ranked" },
  account: { title: "Company", sub: "Every step the agent took on graph8" },
  activity: { title: "Activity", sub: "Live feed of everything the agent does" },
  learning: { title: "Learning", sub: "How your decisions change scoring and writing" },
  settings: { title: "Settings", sub: "graph8 connections and scoring" },
};

export default function RevenueDesk() {
  const [view, setView] = useState<View>("today");
  const [mode, setMode] = useState<Mode | null>(null);
  const [domain, setDomain] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [edits, setEdits] = useState<Record<string, DraftMessage[]>>({});
  const [learning, setLearning] = useState<Learning | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [feed, setFeed] = useState<(FeedItem & { runId?: string })[]>([]);
  const [tourOpen, setTourOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const feedSeq = useRef(0);

  // ---- boot: mode, signed-in user, settings, first-visit tour
  useEffect(() => {
    api<{ mode: Mode }>("/api/health").then((h) => setMode(h.mode)).catch(() => setMode("offline"));
    api<Settings>("/api/settings").then(setSettings).catch(() => {});
    fetch("/auth/session").then((r) => r.json()).then((s: { enabled?: boolean; user?: string }) => { if (s.enabled && s.user) setAccount(s.user); }).catch(() => {});
    let seen = true;
    try { seen = localStorage.getItem("ard-tour-seen") === "1"; } catch {}
    if (!seen) { const t = setTimeout(() => setTourOpen(true), 700); return () => clearTimeout(t); }
  }, []);

  // ---- one company's live events
  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`${API_URL}/api/events?runId=${runId}`);
    const openedAt = Date.now() - 1500;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as PipelineEvent;
      setEvents((prev) => [...prev, e]);
      if (Date.parse(e.timestamp) >= openedAt) { const t = toastFor(e); if (t) pushToast(t.kind, t.title, t.body); }
    };
    return () => es.close();
  }, [runId, pushToast]);

  // ---- global activity feed (all companies)
  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/events`);
    const openedAt = Date.now() - 1500;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as PipelineEvent;
      if (Date.parse(e.timestamp) < openedAt) return;
      const t = toastFor(e);
      if (t) setFeed((prev) => [{ id: ++feedSeq.current, at: e.timestamp, runId: e.runId, ...t }, ...prev].slice(0, 300));
    };
    return () => es.close();
  }, []);

  // ---- weekend summary polling + weekend-wide pop-ups
  useEffect(() => {
    if (!batchId) return;
    let alive = true;
    const seen = new Map<string, string>();
    let briefSeen = false, settledSeen = false;
    const tick = () => api<BatchState>(`/api/runs?batchId=${batchId}`).then((s) => {
      if (!alive) return;
      setBatch(s);
      for (const r of s.runs) {
        const prev = seen.get(r.runId);
        if (prev !== undefined && prev !== r.status) {
          const who = r.company ?? r.domain ?? "A company";
          if (r.status === "awaiting_approval") pushToast("warn", `Approval needed: ${who}`, `Score ${r.score ?? "?"} · ${r.drafts} email(s) drafted.`);
          else if (r.status === "failed") pushToast("error", `${who} failed`, "Open it and click Retry.");
          else if (r.status === "done") pushToast("success", `${who} is done`, r.deal ? `Deal: ${r.deal}` : undefined);
        }
        seen.set(r.runId, r.status);
      }
      if (s.brief?.status === "done" && !briefSeen) { briefSeen = true; pushToast("info", "Monday brief posted to graph8 Work", `#${s.brief.channel}`); }
      if (s.settledAt && !settledSeen) {
        settledSeen = true;
        const ready = s.runs.filter((r) => r.qualified && (r.status === "awaiting_approval" || r.status === "done")).length;
        pushToast("success", `${ready} ready to approve`, `${s.batch?.totalClicks ?? 0} clicks, ${s.runs.length} companies checked.`);
      }
    }).catch(() => {});
    tick();
    const t = setInterval(tick, 1200);
    return () => { alive = false; clearInterval(t); };
  }, [batchId, pushToast]);

  // ---- learning refresh whenever a decision may have happened
  const decisionCount = (batch?.runs.filter((r) => r.status !== "running" && r.status !== "awaiting_approval").length ?? 0)
    + events.filter((e) => e.step === "approval" && e.status !== "awaiting_approval" && e.status !== "running").length;
  useEffect(() => {
    let alive = true;
    api<Learning>("/api/learning").then((l) => alive && setLearning(l)).catch(() => {});
    return () => { alive = false; };
  }, [decisionCount]);

  const run = useMemo(() => (runId ? deriveRun(events) : null), [runId, events]);
  const shownDrafts = run?.awaiting ? edits[run.awaiting.approvalId] ?? run.awaiting.drafts : run?.drafts ?? [];

  const queue = useMemo(() => {
    const q = (batch?.runs ?? []).filter((r) => r.status === "awaiting_approval");
    if (run?.awaiting && runId && !q.some((r) => r.runId === runId) && run.qualify) {
      q.unshift({ runId, company: run.qualify.company.name, domain: run.qualify.company.domain, score: run.qualify.score, qualified: true, people: run.committee?.members.length ?? 0, drafts: run.drafts.length, sent: 0, status: "awaiting_approval", approvalId: run.awaiting.approvalId });
    }
    return q.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [batch, run, runId]);

  const companyOf = useMemo(() => new Map((batch?.runs ?? []).map((r) => [r.runId, r.company ?? r.domain ?? ""])), [batch]);

  // ---- actions
  const openRun = useCallback((id: string, next: View = "account") => {
    setView(next);
    if (id !== runId) { setEvents([]); setDecided(null); setRunId(id); }
  }, [runId]);

  async function runOne() {
    setBusy(true); setDecided(null); setError(null); setBatchId(null); setBatch(null); setEvents([]);
    try {
      const { runId: id } = await api<{ runId: string }>("/api/run", { method: "POST", body: JSON.stringify({ domain }) });
      setRunId(id); setView("account");
    } catch (e) { setError(`Backend unreachable: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function runWeekend() {
    setBusy(true); setDecided(null); setError(null); setRunId(null); setBatch(null); setEvents([]); setView("today");
    try {
      const b = await api<BatchInfo>("/api/batch", { method: "POST", body: "{}" });
      pushToast("info", `Checking ${b.domains.length} companies from ${b.totalClicks} clicks`, `${b.freemail + (b.nonBuyer ?? 0)} personal or student clicks skipped before any lookup.`);
      setBatchId(b.batchId);
      if (b.runIds[0]) setRunId(b.runIds[0]);
    } catch (e) { setError(`Backend unreachable: ${(e as Error).message}`); }
    setBusy(false);
  }

  const decide = useCallback(async (decision: "approve" | "reject") => {
    if (!run?.awaiting) return;
    const approvalId = run.awaiting.approvalId;
    setDecided(decision);
    const drafts = edits[approvalId];
    pushToast("info", decision === "approve" ? "Approved" : "Rejected", decision === "approve" ? (drafts ? "Sending your edited drafts…" : "Sending…") : "Nothing will be sent.");
    await api(`/api/approvals/${approvalId}`, { method: "POST", body: JSON.stringify({ decision, drafts }) })
      .catch((e) => { setError((e as Error).message); pushToast("error", "Couldn't record your decision", (e as Error).message); });
    // Inbox flow: move on to the next company waiting.
    const next = queue.find((r) => r.runId !== runId);
    if (view === "approvals" && next) setTimeout(() => openRun(next.runId, "approvals"), 700);
  }, [run, edits, pushToast, queue, runId, view, openRun]);

  const editDraft = useCallback((i: number, patch: Partial<DraftMessage>) => {
    if (!run?.awaiting) return;
    const id = run.awaiting.approvalId; const base = run.awaiting.drafts;
    setEdits((prev) => ({ ...prev, [id]: (prev[id] ?? base).map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  }, [run]);

  async function approveAll(list: RunSummary[]) {
    if (!list.length) return;
    if (!window.confirm(`Approve ${list.length} compan${list.length === 1 ? "y" : "ies"}?\n\nEach sends its approved emails to your inbox, places the AI test call and creates a deal in graph8. Prospects are never contacted.`)) return;
    pushToast("info", `Approving ${list.length} companies…`);
    const results = await Promise.allSettled(list.map((r) => api(`/api/approvals/${r.approvalId}`, { method: "POST", body: JSON.stringify({ decision: "approve" }) })));
    const failed = results.filter((x) => x.status === "rejected").length;
    if (failed) pushToast("error", `${failed} approval(s) didn't go through`, "They may already have been decided.");
    else pushToast("success", `Approved ${list.length} companies`);
  }

  async function retry(id: string) {
    setError(null); setDecided(null);
    try {
      const { runId: next } = await api<{ runId: string }>(`/api/runs/${id}/retry`, { method: "POST", body: "{}" });
      setEvents([]); setRunId(next);
      pushToast("info", "Retrying with the same click");
    } catch (e) { setError(`Retry failed: ${(e as Error).message}`); }
  }

  async function reset() {
    setBusy(true); setError(null);
    await api("/api/demo/reset", { method: "POST" }).then(() => pushToast("info", "Reset", "Ready for a fresh run. Records in graph8 are kept.")).catch((e) => setError((e as Error).message));
    setRunId(null); setEvents([]); setDecided(null); setBatchId(null); setBatch(null); setEdits({}); setFeed([]); setView("today"); setBusy(false);
  }

  function go(v: View) {
    if (v === "approvals" && queue.length && !queue.some((r) => r.runId === runId)) { openRun(queue[0].runId, "approvals"); return; }
    setView(v);
  }

  async function signOut() {
    await fetch("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  function closeTour() { setTourOpen(false); try { localStorage.setItem("ard-tour-seen", "1"); } catch {} }

  const nav: { id: View; label: string; icon: (p: { className?: string }) => React.ReactNode; count?: number }[] = [
    { id: "today", label: "Today", icon: Icon.today },
    { id: "approvals", label: "Approvals", icon: Icon.approvals, count: queue.length },
    { id: "companies", label: "Companies", icon: Icon.account, count: batch?.runs.length || undefined },
    { id: "activity", label: "Activity", icon: Icon.activity },
    { id: "learning", label: "Learning", icon: Icon.learning },
    { id: "settings", label: "Settings", icon: Icon.settings },
  ];
  const modeLabel = { mock: "Demo data", sandbox: "graph8 sandbox", live: "Live · prospects protected", offline: "Backend offline" };
  const head = view === "account" && run?.qualify ? { title: run.qualify.company.name, sub: run.qualify.company.domain } : TITLES[view];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-white">A</span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">Revenue Desk</div>
            <div className="text-[11px] text-muted-soft">on graph8</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" data-tour="nav">
          {nav.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)} data-tour={`nav-${n.id}`}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] ${active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}>
                <n.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{n.label}</span>
                {n.count ? <span className={`rounded px-1.5 text-[11px] tabular-nums ${n.id === "approvals" ? "bg-accent text-white" : "text-muted-soft"}`}>{n.count}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border-subtle px-3 py-3" data-tour="mode">
          {mode && <Status tone={mode === "offline" ? "bad" : mode === "mock" ? "warn" : "good"}>{modeLabel[mode]}</Status>}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={() => setTourOpen(true)} title="Tour" aria-label="Tour" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"><Icon.help /></button>
            {account && <button onClick={signOut} title={`Sign out ${account}`} aria-label="Sign out" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-surface-muted hover:text-foreground"><Icon.logout className="h-3.5 w-3.5" />{account}</button>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
          {nav.map((n) => <button key={n.id} onClick={() => go(n.id)} className={`shrink-0 rounded-md px-2.5 py-1 text-xs ${view === n.id ? "bg-surface-muted font-medium" : "text-muted"}`}>{n.label}{n.count ? ` ${n.count}` : ""}</button>)}
        </div>

        <header className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4">
          <div className="min-w-0 flex-1">
            {view === "account" && <button onClick={() => setView(batch ? "companies" : "today")} className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"><Icon.back className="h-3.5 w-3.5" />{batch ? "Companies" : "Today"}</button>}
            <h1 className="text-xl font-semibold tracking-tight">{head.title}</h1>
            <p className="text-[13px] text-muted">{head.sub}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy}><Icon.reset className="h-3.5 w-3.5" />Reset</Button>
        </header>

        <main className="px-6 py-6">
          {error && <div className="mb-5 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">{error}</div>}
          {view === "today" && <TodayView mode={mode} batch={batch} busy={busy} domain={domain} setDomain={setDomain} onRunOne={runOne} onRunWeekend={runWeekend} onOpen={(id) => openRun(id)} onApproveAll={approveAll} />}
          {view === "approvals" && <ApprovalsView queue={queue} selectedRunId={runId} run={run} drafts={shownDrafts} decided={decided} onSelect={(id) => openRun(id, "approvals")} onDecide={decide} onEdit={editDraft} />}
          {view === "account" && <AccountView run={run} runId={runId} mode={mode} onRetry={retry} onReview={() => setView("approvals")} />}
          {view === "companies" && (batch?.runs.length
            ? <AccountsTable runs={batch.runs} onOpen={(id) => openRun(id)} toolbar={<Button size="sm" onClick={() => exportCsv(batch.runs)}><Icon.download className="h-3.5 w-3.5" />Export CSV</Button>} />
            : <div className="mc-card"><EmptyState title="No companies yet" body="Run the weekend from Today." /></div>)}
          {view === "activity" && <ActivityView feed={feed.map((f) => ({ ...f, company: f.runId ? companyOf.get(f.runId) : undefined }))} />}
          {view === "learning" && <LearningView learning={learning} />}
          {view === "settings" && <SettingsView settings={settings} />}
        </main>
      </div>

      <Tour open={tourOpen} onClose={closeTour} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
