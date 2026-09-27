"use client";

import { useMemo, useState } from "react";
import { DEAL_VALUE, exportCsv, priorityOf, runStatus, type BatchState, type Mode, type RunSummary } from "./model";
import { Button, EmptyState, Icon, Status, Tag, formatElapsed, money } from "./ui";

/** Today: the Monday brief. One button runs the weekend; the list ranks every company. */
export function TodayView({ mode, batch, busy, domain, setDomain, onRunOne, onRunWeekend, onOpen, onApproveAll }: {
  mode: Mode | null; batch: BatchState | null; busy: boolean; domain: string; setDomain: (v: string) => void;
  onRunOne: () => void; onRunWeekend: () => void; onOpen: (runId: string) => void; onApproveAll: (runs: RunSummary[]) => void;
}) {
  const offline = mode === "offline";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onRunWeekend} disabled={busy || offline} data-tour="run-weekend"><Icon.play className="h-3.5 w-3.5" />Run weekend</Button>
        <div className="flex items-center gap-1.5">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && domain.trim()) onRunOne(); }}
            placeholder="or one company: retool.com" aria-label="Company domain"
            className="h-8 w-56 rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-soft focus:border-accent" />
          <Button onClick={onRunOne} disabled={busy || offline}>Run one</Button>
        </div>
      </div>

      {batch ? <Brief batch={batch} onOpen={onOpen} onApproveAll={onApproveAll} /> : (
        <div className="mc-card" data-tour="kpis">
          <EmptyState
            title="Turn this weekend's clicks into approved pipeline"
            body="Run weekend checks every company that read your newsletter or visited your site, scores them on graph8, finds the decision-makers, and drafts the emails. You approve; it sends."
            action={<Button variant="primary" onClick={onRunWeekend} disabled={busy || offline}><Icon.play className="h-3.5 w-3.5" />Run weekend</Button>}
          />
        </div>
      )}
    </div>
  );
}

function Brief({ batch, onOpen, onApproveAll }: { batch: BatchState; onOpen: (runId: string) => void; onApproveAll: (runs: RunSummary[]) => void }) {
  const { runs, settledAt, serverNow } = batch;
  const info = batch.batch;
  const fits = runs.filter((r) => r.qualified);
  const ready = fits.filter((r) => r.status === "awaiting_approval" || r.status === "done");
  const waiting = runs.filter((r) => r.status === "awaiting_approval" && r.approvalId);
  const deals = runs.filter((r) => r.deal).length;
  const ms = info?.startedAt && serverNow ? Math.max(0, Date.parse(settledAt ?? serverNow) - Date.parse(info.startedAt)) : 0;
  const stats = [
    { label: "Weekend clicks", value: info?.totalClicks ?? "—", sub: `${(info?.freemail ?? 0) + (info?.nonBuyer ?? 0)} skipped before lookup` },
    { label: "Companies checked", value: info?.domains.length ?? runs.length, sub: `${fits.length} good fit${fits.length === 1 ? "" : "s"}` },
    { label: "Decision-makers", value: runs.reduce((n, r) => n + r.people, 0), sub: "from graph8's 700M" },
    { label: "Emails drafted", value: runs.reduce((n, r) => n + r.drafts, 0), sub: "by graph8 AI" },
    { label: "Pipeline", value: money(ready.length * DEAL_VALUE), sub: deals ? `${money(deals * DEAL_VALUE)} in CRM` : `at ${money(DEAL_VALUE)} / deal` },
    { label: "Time", value: formatElapsed(ms), sub: settledAt ? "vs ~2 days by hand" : "working…" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        {settledAt
          ? <span className="text-foreground"><b>{ready.length}</b> {ready.length === 1 ? "opportunity" : "opportunities"} ready to approve, found in <b>{formatElapsed(ms)}</b>.</span>
          : <Status tone="accent" pulse>Checking {runs.length} companies on graph8…</Status>}
        {info?.demo && <Tag>demo clicks · real graph8 data</Tag>}
        {batch.brief?.status === "done" && <Tag tone="accent">Brief posted to graph8 Work</Tag>}
      </div>

      <div className="mc-card grid grid-cols-2 divide-border-subtle sm:grid-cols-3 lg:grid-cols-6 lg:divide-x" data-tour="kpis">
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">{s.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</div>
            <div className="mt-0.5 text-[11px] text-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      <AccountsTable runs={runs} onOpen={onOpen} toolbar={
        <>
          {waiting.length > 0 && <Button variant="primary" size="sm" onClick={() => onApproveAll(waiting)}><Icon.check className="h-3.5 w-3.5" />Approve all {waiting.length}</Button>}
          <Button size="sm" onClick={() => exportCsv(runs)}><Icon.download className="h-3.5 w-3.5" />Export CSV</Button>
        </>
      } />
    </>
  );
}

/** Ranked companies with search and a status filter. Shared by Today and Accounts. */
export function AccountsTable({ runs, onOpen, toolbar, title = "Companies" }: { runs: RunSummary[]; onOpen: (runId: string) => void; toolbar?: React.ReactNode; title?: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "fit" | "approval" | "done">("all");
  const rows = useMemo(() => [...runs]
    .filter((r) => !q || `${r.company ?? ""} ${r.domain ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => filter === "all" || (filter === "fit" && r.qualified) || (filter === "approval" && r.status === "awaiting_approval") || (filter === "done" && r.status === "done"))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [runs, q, filter]);

  return (
    <section className="mc-card overflow-hidden" data-tour="accounts">
      <header className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2.5">
        <h2 className="mr-2 text-[13px] font-semibold">{title}</h2>
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(["all", "fit", "approval", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-0.5 ${filter === f ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:text-foreground"}`}>
              {{ all: "All", fit: "Good fits", approval: "Needs approval", done: "Done" }[f]}
            </button>
          ))}
        </div>
        <label className="relative">
          <Icon.search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search companies"
            className="h-7 w-40 rounded-md border border-border bg-surface pl-7 pr-2 text-xs outline-none placeholder:text-muted-soft focus:border-accent" />
        </label>
        <div className="ml-auto flex gap-2">{toolbar}</div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[11px] font-medium uppercase tracking-wide text-muted-soft">
              <th className="px-4 py-2 font-medium">Company</th><th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">People</th><th className="px-3 py-2 font-medium">Emails</th>
              <th className="px-3 py-2 font-medium">Status</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = runStatus(r.status); const p = priorityOf(r);
              return (
                <tr key={r.runId} onClick={() => onOpen(r.runId)} className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.company ?? r.domain}</div>
                    <div className="text-xs text-muted-soft">{r.domain}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`tabular-nums ${r.qualified ? "font-medium text-foreground" : "text-muted-soft"}`}>{r.score ?? "…"}</span>
                    {p && <span className="ml-2"><Tag tone={p.tone}>{p.label}</Tag></span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{r.people || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{r.drafts || "—"}</td>
                  <td className="px-3 py-2.5"><Status tone={s.tone} pulse={s.pulse}>{r.status === "running" && r.currentStep ? `${s.label} · ${r.currentStep}` : s.label}</Status></td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-accent">{r.status === "awaiting_approval" ? "Review →" : "Open →"}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-muted-soft">No companies match.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
