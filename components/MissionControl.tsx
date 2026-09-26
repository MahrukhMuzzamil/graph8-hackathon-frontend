"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, api } from "@/lib/api";
import {
  STEP_NAMES, type CallOutput, type CommitteeOutput, type DealOutput, type DraftMessage, type EngagementOutput,
  type PipelineEvent, type QualifyOutput, type ReplyOutput, type SendOutput, type StepName, type StepStatus,
} from "@/lib/types";

const LABELS: Record<StepName, string> = {
  engagement: "Engagement in", qualify: "Qualify company", committee: "Buying committee", crm: "Save to CRM",
  outreach: "Draft outreach", approval: "Human approval", send: "Send (sandbox)", reply: "Reply handling",
  call: "AI voice call", deal: "Deal + next step",
};

const STATUS_STYLE: Record<StepStatus, string> = {
  pending: "bg-zinc-300 dark:bg-zinc-700",
  running: "bg-sky-500 animate-pulse",
  done: "bg-emerald-500",
  failed: "bg-rose-500",
  skipped: "bg-zinc-400 dark:bg-zinc-600",
  awaiting_approval: "bg-amber-500 animate-pulse",
};

interface ApprovalRequest { approvalId: string; summary: string; drafts: DraftMessage[] }

export default function MissionControl() {
  const [mode, setMode] = useState<"mock" | "sandbox" | "offline" | null>(null);
  const [domain, setDomain] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ mode: "mock" | "sandbox" }>("/api/health").then((h) => setMode(h.mode)).catch(() => setMode("offline"));
  }, []);

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`${API_URL}/api/events?runId=${runId}`);
    es.onmessage = (m) => setEvents((prev) => [...prev, JSON.parse(m.data) as PipelineEvent]);
    return () => es.close();
  }, [runId]);

  const state = useMemo(() => {
    const steps = Object.fromEntries(STEP_NAMES.map((s) => [s, { status: "pending" as StepStatus, data: undefined as unknown, error: undefined as string | undefined }]));
    let approval: ApprovalRequest | undefined;
    for (const e of events) {
      if (e.step === "run") { if (e.error) steps.engagement.error = e.error; continue; }
      if (e.step === "webhook") continue;
      steps[e.step] = { status: e.status, data: e.data ?? steps[e.step].data, error: e.error };
      if (e.status === "awaiting_approval") approval = e.data as ApprovalRequest;
    }
    return { steps: steps as Record<StepName, { status: StepStatus; data: unknown; error?: string }>, approval };
  }, [events]);

  const out = <T,>(s: StepName) => (state.steps[s].status === "done" ? (state.steps[s].data as T) : undefined);
  const engagement = out<EngagementOutput>("engagement");
  const qualify = (state.steps.qualify.data as QualifyOutput | undefined)?.company ? (state.steps.qualify.data as QualifyOutput) : undefined;
  const committee = out<CommitteeOutput>("committee");
  const drafts = out<{ drafts: DraftMessage[] }>("outreach")?.drafts ?? [];
  const send = out<SendOutput>("send");
  const reply = out<ReplyOutput>("reply");
  const call = out<CallOutput>("call");
  const deal = out<DealOutput>("deal");
  const runError = events.find((e) => e.step === "run" && e.error)?.error;
  const finished = events.some((e) => e.step === "run" && e.status !== "running");

  async function start() {
    setBusy(true); setDecided(null); setEvents([]); setError(null);
    try {
      const { runId } = await api<{ runId: string }>("/api/run", { method: "POST", body: JSON.stringify({ domain }) });
      setRunId(runId);
    } catch (e) { setError(`Backend unreachable at ${API_URL}: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function decide(decision: "approve" | "reject") {
    if (!state.approval) return;
    setDecided(decision);
    await api(`/api/approvals/${state.approval.approvalId}`, { method: "POST", body: JSON.stringify({ decision }) }).catch((e) => setError((e as Error).message));
  }

  async function reset() {
    setBusy(true); setError(null);
    await api("/api/demo/reset", { method: "POST" }).catch((e) => setError((e as Error).message));
    setRunId(null); setEvents([]); setDecided(null); setBusy(false);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Autopilot Revenue Desk</h1>
        <span className="text-sm text-zinc-500">Mission control</span>
        {mode && <ModeBadge mode={mode} />}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company domain (optional)"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900 sm:w-64" />
          <button onClick={start} disabled={busy || mode === "offline"} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">Run</button>
          <button onClick={reset} disabled={busy} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Reset demo</button>
        </div>
      </header>

      {(error || runError) && <p className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">{error ?? runError}</p>}

      <Summary
        signals={engagement?.signals.length} company={qualify?.qualified ? qualify.company.name : undefined}
        people={committee?.members.length} drafts={drafts.length} sent={send?.sent.length} deal={deal?.name}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card title={`Pipeline${runId ? ` · ${runId}` : ""}`}>
          <ol className="space-y-1">
            {STEP_NAMES.map((s, i) => {
              const st = state.steps[s];
              return (
                <li key={s} className="flex items-start gap-3 rounded-md px-2 py-1.5">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[st.status]}`} />
                  <div className="min-w-0">
                    <div className="text-sm"><span className="text-zinc-400">{i + 1}.</span> {LABELS[s]}</div>
                    <div className="text-xs text-zinc-500">{st.status.replace("_", " ")}{reasonOf(st.data)}</div>
                    {st.error && <div className="break-words text-xs text-rose-500">{st.error}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="grid min-w-0 gap-6">
          {state.approval && state.steps.approval.status === "awaiting_approval" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="mb-1 text-sm font-medium">Approval needed: {state.approval.summary}</div>
              <div className="mb-3 text-xs text-zinc-500">Review the drafts below. Nothing is sent until you approve.</div>
              <div className="flex gap-2">
                <button onClick={() => decide("approve")} disabled={!!decided} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>
                <button onClick={() => decide("reject")} disabled={!!decided} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">Reject</button>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Company · why this score">
              {qualify ? (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{qualify.company.name}</div>
                      <div className="text-xs text-zinc-500">{qualify.company.domain} · {qualify.company.industry ?? "—"} · {qualify.company.employeeCount ?? "?"} employees</div>
                    </div>
                    <div className={`text-2xl font-semibold tabular-nums ${qualify.qualified ? "text-emerald-500" : "text-rose-500"}`}>{qualify.score}</div>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">{qualify.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  {engagement && (
                    <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
                      <div className="mb-1 text-xs font-medium text-zinc-500">What they engaged with</div>
                      <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">{engagement.signals.map((s, i) => <li key={i}><span className="text-zinc-400">{s.source}</span> · {s.description}</li>)}</ul>
                    </div>
                  )}
                </div>
              ) : <Empty />}
            </Card>

            <Card title="Buying committee">
              {committee?.members.length ? (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {committee.members.map((m) => (
                    <li key={`${m.firstName}${m.lastName}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{m.firstName} {m.lastName}</div>
                        <div className="truncate text-xs text-zinc-500">{m.title} · {m.email}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">{m.role.replace("_", " ")}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty />}
            </Card>
          </div>

          <Card title="AI-drafted messages">
            {drafts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {drafts.map((d, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="truncate">{d.channel.replace("_", " ")} → {d.contactEmail}</span>
                      {d.source && <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{d.source === "graph8" ? "graph8 AI" : "template"}</span>}
                    </div>
                    {d.subject && <div className="mb-1 text-sm font-medium">{d.subject}</div>}
                    <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">{d.body}</pre>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Sandbox outbox">
              {send ? (
                <div className="space-y-2 text-sm">
                  {send.sequenceId && <div className="text-xs text-zinc-500">Sequence {send.sequenceId}</div>}
                  <ul className="space-y-1">
                    {send.sent.map((s, i) => (
                      <li key={i} className="flex justify-between gap-2"><span className="truncate">{s.channel} → {s.contactEmail}</span><span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">{s.status}</span></li>
                    ))}
                  </ul>
                  <div className="text-xs text-zinc-500">{send.outbox.length} item(s) caught by the sandbox. Nothing reached real people.</div>
                </div>
              ) : <Empty text={finished ? "Not sent." : undefined} />}
            </Card>

            <Card title="Reply + call">
              {reply?.replies.length ? (
                <div className="space-y-3 text-sm">
                  {reply.replies.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-xs text-zinc-500">{r.contactEmail} {r.intent && <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">{r.intent.replace(/_/g, " ")}</span>}</div>
                      {r.inbound && <p className="italic text-zinc-500">“{r.inbound}”</p>}
                      <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-2 font-sans text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">{r.draft}</pre>
                    </div>
                  ))}
                  {call?.calls.map((c, i) => (
                    <div key={i} className="border-t border-zinc-200 pt-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                      Call: {c.outcome}{c.grade !== undefined && ` · grade ${c.grade}`}
                    </div>
                  ))}
                </div>
              ) : <Empty text={finished ? "No reply handled." : undefined} />}
            </Card>
          </div>

          <Card title="Deal + next step">
            {deal ? (
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{deal.name}</div>
                  <div className="text-xs text-zinc-500">{deal.dealId}{deal.amount ? ` · $${deal.amount.toLocaleString()}` : ""}</div>
                </div>
                <div className="rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-300">Next: {deal.nextBestStep}</div>
              </div>
            ) : <Empty text={finished ? "No deal created." : undefined} />}
          </Card>

          <Card title="Event log">
            <div className="max-h-64 overflow-auto font-mono text-xs">
              {events.length ? events.map((e) => (
                <div key={e.id} className="whitespace-nowrap text-zinc-500"><span className="text-zinc-400">{e.timestamp.slice(11, 19)}</span> {e.step} → <span className="text-zinc-800 dark:text-zinc-200">{e.status}</span></div>
              )) : <Empty />}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Summary(p: { signals?: number; company?: string; people?: number; drafts: number; sent?: number; deal?: string }) {
  const items = [
    ["Signals", p.signals ?? "—"], ["Qualified", p.company ?? "—"], ["Decision-makers", p.people ?? "—"],
    ["Messages drafted", p.drafts || "—"], ["Sent (sandbox)", p.sent ?? "—"], ["Deal", p.deal ? "created" : "—"],
  ] as const;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="text-xs text-zinc-500">{label}</div>
          <div className="truncate text-lg font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ModeBadge({ mode }: { mode: "mock" | "sandbox" | "offline" }) {
  const style = { mock: "bg-violet-500/15 text-violet-600 dark:text-violet-300", sandbox: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", offline: "bg-rose-500/15 text-rose-600 dark:text-rose-300" }[mode];
  const label = { mock: "MOCK MODE", sandbox: "SANDBOX", offline: "BACKEND OFFLINE" }[mode];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

function reasonOf(data: unknown) {
  const r = (data as { reason?: string } | undefined)?.reason;
  return r ? ` · ${r}` : "";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <h2 className="mb-3 truncate text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text?: string }) => <p className="text-sm text-zinc-400">{text ?? "Nothing yet. Press Run."}</p>;
