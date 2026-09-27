"use client";

import type { ToastKind } from "@/components/Toasts";
import type { Learning, Settings } from "./model";
import { EmptyState, Panel, Status, Tag, type Tone } from "./ui";

export interface FeedItem { id: number; at: string; kind: ToastKind; title: string; body?: string; company?: string }
const KIND_TONE: Record<ToastKind, Tone> = { info: "accent", success: "good", warn: "warn", error: "bad" };

/** Everything the agent did, across all companies, newest first. */
export function ActivityView({ feed }: { feed: FeedItem[] }) {
  if (!feed.length) return <div className="mc-card"><EmptyState title="No activity yet" body="Every step the agent takes on graph8 shows up here live: scoring, CRM writes, AI drafts, approvals, sends, calls and deals." /></div>;
  return (
    <div className="mc-card overflow-hidden">
      <ol className="divide-y divide-border-subtle">
        {feed.map((f) => (
          <li key={f.id} className="flex gap-3 px-4 py-2.5">
            <span className="w-16 shrink-0 pt-0.5 font-mono text-[11px] text-muted-soft">{f.at.slice(11, 19)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Status tone={KIND_TONE[f.kind]}>{f.title}</Status>
                {f.company && <span className="text-xs text-muted-soft">{f.company}</span>}
              </div>
              {f.body && <p className="mt-0.5 text-[13px] text-muted">{f.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LearningView({ learning }: { learning: Learning | null }) {
  const l = learning;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Panel title="What the desk has learned" tour="learning">
        {!l?.decisions ? <EmptyState title="Nothing learned yet" body="Approve and reject a few companies. After two similar decisions, the desk adjusts how it scores and writes." /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[["Approved", l.approved, "text-score"], ["Rejected", l.rejected, "text-danger"], ["Edited", l.edited, "text-foreground"]].map(([k, v, c]) => (
                <div key={k as string} className="rounded-md border border-border-subtle px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-soft">{k}</div>
                  <div className={`text-xl font-semibold tabular-nums ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            {l.lessons.length ? (
              <ul className="space-y-2">{l.lessons.map((x) => <li key={x} className="rounded-md border border-accent/25 bg-accent-soft px-3 py-2 text-[13px] text-foreground">{x}</li>)}</ul>
            ) : <p className="text-[13px] text-muted">A lesson needs two similar decisions. Keep going.</p>}
          </div>
        )}
      </Panel>
      <Panel title="How it learns">
        <ul className="space-y-2 text-[13px] text-muted">
          <li><b className="text-foreground">Industries and company sizes</b> you keep rejecting score 15 lower; ones you keep approving score 10 higher.</li>
          <li><b className="text-foreground">Your edits</b> teach the writer: if you keep shortening drafts, emails get shorter.</li>
          <li>Needs two matching decisions, so one click never swings the model. Reset doesn&apos;t count as a decision.</li>
        </ul>
      </Panel>
    </div>
  );
}

export function SettingsView({ settings }: { settings: Settings | null }) {
  const s = settings;
  const rows: { name: string; ok: boolean; detail: string; note?: string }[] = s ? [
    { name: "graph8 API", ok: s.apiKeySet, detail: s.apiKeySet ? `Connected · ${s.baseUrl}` : "No API key", note: `Mode: ${s.mode}` },
    { name: "graph8 SDK", ok: s.apiKeySet, detail: "@graph8/sdk for Radar and the voice agent check" },
    { name: "CRM deals", ok: s.dealOwnerSet, detail: s.dealOwnerSet ? `Owner set · ${s.dealAmount ? `$${Number(s.dealAmount).toLocaleString()} per deal` : ""}` : "Set DEAL_OWNER_ID" },
    { name: "Email (connected mailbox)", ok: Boolean(s.inbox), detail: s.inbox ? `Approved emails go to ${s.inbox}` : "Held (no test inbox set)", note: "Prospects are never contacted" },
    { name: "Voice agent", ok: s.voiceAgentSet && Boolean(s.callFrom), detail: s.callFrom ? `Calls from ${s.callFrom} to ${s.callTo}` : s.voiceAgentSet ? "Agent set, no number" : "Not set" },
    { name: "graph8 Work", ok: Boolean(s.workChannel), detail: s.workChannel ? `#${s.workChannel}: Monday brief + approve by reply` : "Off" },
    { name: "graph8 Radar", ok: true, detail: `Competitor detection · never prospects ${s.sellerDomain}` },
  ] : [];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Panel title="Integrations" tour="settings">
        {!s ? <p className="text-[13px] text-muted-soft">Loading…</p> : (
          <ul className="-my-1 divide-y divide-border-subtle">
            {rows.map((r) => (
              <li key={r.name} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{r.name}</div>
                  <div className="text-xs text-muted">{r.detail}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
                <Status tone={r.ok ? "good" : "neutral"}>{r.ok ? "Active" : "Off"}</Status>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Scoring">
        {!s ? null : (
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between"><span className="text-muted">Qualify threshold</span><b className="tabular-nums">{s.qualifyThreshold}</b></div>
            <div>
              <div className="mb-1 text-muted">Hiring signals that count</div>
              <div className="flex flex-wrap gap-1.5">{s.hiringKeywords.map((k) => <Tag key={k}>{k}</Tag>)}</div>
            </div>
            <p className="text-xs text-muted-soft">Personal-email readers and .edu/.gov domains are dropped before any paid lookup.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
