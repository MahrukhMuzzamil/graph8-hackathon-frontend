"use client";

import { useEffect } from "react";
import type { DraftMessage } from "@/lib/types";
import { priorityOf, type RunSummary } from "./model";
import type { RunData } from "./run";
import { Button, EmptyState, Icon, Tag } from "./ui";
import { Committee, WhyScore } from "./AccountView";

/**
 * The approval inbox. Everything waiting for a human, one at a time: read why, edit the drafts,
 * approve or reject. Keyboard: J/K move, A approves, R rejects (outside text fields).
 */
export function ApprovalsView({ queue, selectedRunId, run, drafts, decided, onSelect, onDecide, onEdit }: {
  queue: RunSummary[]; selectedRunId: string | null; run: RunData | null; drafts: DraftMessage[]; decided: string | null;
  onSelect: (runId: string) => void; onDecide: (d: "approve" | "reject") => void; onEdit: (i: number, patch: Partial<DraftMessage>) => void;
}) {
  const idx = queue.findIndex((r) => r.runId === selectedRunId);
  const canDecide = Boolean(run?.awaiting) && !decided;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j" && queue.length) onSelect(queue[Math.min(queue.length - 1, idx + 1)].runId);
      else if (k === "k" && queue.length) onSelect(queue[Math.max(0, idx - 1)].runId);
      else if (k === "a" && canDecide) onDecide("approve");
      else if (k === "r" && canDecide) onDecide("reject");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, idx, canDecide, onSelect, onDecide]);

  if (!queue.length && !run?.awaiting) {
    return <div className="mc-card"><EmptyState title="Nothing waiting for approval" body="When a company is scored and its emails are drafted, it lands here. Run the weekend from Today." /></div>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="mc-card h-fit overflow-hidden">
        <div className="border-b border-border-subtle px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-soft">{queue.length} waiting</div>
        <ul className="scroll-quiet max-h-[60vh] overflow-auto">
          {queue.map((r) => {
            const p = priorityOf(r); const active = r.runId === selectedRunId;
            return (
              <li key={r.runId}>
                <button onClick={() => onSelect(r.runId)} className={`flex w-full items-center gap-2 border-l-2 px-3 py-2.5 text-left ${active ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-muted"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{r.company ?? r.domain}</div>
                    <div className="truncate text-xs text-muted-soft">{r.drafts} email{r.drafts === 1 ? "" : "s"} · {r.people} people</div>
                  </div>
                  <span className="text-[13px] tabular-nums text-muted">{r.score}</span>
                  {p && <Tag tone={p.tone}>{p.label}</Tag>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border-subtle px-3 py-2 text-[11px] text-muted-soft"><kbd>J</kbd> <kbd>K</kbd> move · <kbd>A</kbd> approve · <kbd>R</kbd> reject</div>
      </aside>

      {!run ? <div className="mc-card"><EmptyState title="Pick a company" /></div> : (
        <div className="min-w-0 space-y-5">
          <div className="mc-card flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{run.qualify?.company.name ?? "…"}</div>
              <div className="text-xs text-muted">
                {run.awaiting ? "Nothing is sent until you approve. What you approve is what gets sent." : decided ? `You chose to ${decided}.` : "Already decided."}
                {run.awaiting?.code && <> Or reply <code className="font-mono">approve {run.awaiting.code}</code> in graph8 Work.</>}
              </div>
            </div>
            <Button variant="danger" onClick={() => onDecide("reject")} disabled={!canDecide}><Icon.x className="h-3.5 w-3.5" />Reject <kbd>R</kbd></Button>
            <Button variant="primary" onClick={() => onDecide("approve")} disabled={!canDecide}><Icon.check className="h-3.5 w-3.5" />Approve <kbd className="border-white/30 bg-white/10 text-white">A</kbd></Button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <section className="mc-card min-w-0" data-tour="drafts">
              <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                <h2 className="text-[13px] font-semibold">Drafts</h2>
                <span className="text-xs text-muted-soft">{canDecide ? "Editable" : "Read-only"}</span>
              </header>
              <div className="space-y-4 p-4">
                {drafts.map((d, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {d.channel === "email" ? <Icon.mail className="h-3.5 w-3.5" /> : <span className="font-semibold">in</span>}
                      To {d.contactEmail}
                      {d.source && <span className="ml-auto text-muted-soft">{d.source === "graph8" ? "graph8 AI" : "template"}</span>}
                    </div>
                    {d.subject !== undefined && (
                      <input value={d.subject} disabled={!canDecide} onChange={(e) => onEdit(i, { subject: e.target.value })} aria-label="Subject"
                        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] font-medium outline-none focus:border-accent disabled:bg-surface-muted/50" />
                    )}
                    <textarea value={d.body} disabled={!canDecide} onChange={(e) => onEdit(i, { body: e.target.value })} rows={7} aria-label="Message"
                      className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-accent disabled:bg-surface-muted/50" />
                  </div>
                ))}
                {!drafts.length && <p className="text-[13px] text-muted-soft">No drafts.</p>}
              </div>
            </section>
            <div className="space-y-5">
              <WhyScore run={run} />
              <Committee run={run} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
