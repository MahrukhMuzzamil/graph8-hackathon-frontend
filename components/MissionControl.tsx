"use client";

import { useEffect, useMemo, useState } from "react";
import Tour from "@/components/Tour";
import ThemeToggle from "@/components/ThemeToggle";
import { API_URL, api } from "@/lib/api";
import {
  STEP_NAMES, type CallOutput, type CommitteeOutput, type CompetitorIntel, type DealOutput, type DraftMessage,
  type EngagementOutput, type OutreachOutput, type PipelineEvent, type QualifyOutput, type ReplyOutput,
  type SendOutput, type StepName, type StepStatus,
} from "@/lib/types";

const LABELS: Record<StepName, string> = {
  engagement: "Engagement in", qualify: "Qualify company", committee: "Buying committee", crm: "Save to CRM",
  outreach: "Draft outreach", approval: "Human approval", send: "Send", reply: "Reply handling",
  call: "AI voice call", deal: "Deal + next step",
};

const STATUS_STYLE: Record<StepStatus, string> = {
  pending: "bg-pending-dot",
  running: "bg-accent animate-pulse ring-2 ring-accent/30",
  done: "bg-score",
  failed: "bg-rose-500",
  skipped: "bg-pending-dot/70",
  awaiting_approval: "bg-warn animate-pulse ring-2 ring-warn/40",
};

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "text-muted-soft",
  running: "text-accent font-medium",
  done: "text-score",
  failed: "text-rose-600 dark:text-rose-400",
  skipped: "text-muted-soft",
  awaiting_approval: "text-warn font-medium",
};

const STEP_ICON: Record<StepName, string> = {
  engagement: "◎",
  qualify: "★",
  committee: "♟",
  crm: "▤",
  outreach: "✉",
  approval: "✓",
  send: "→",
  reply: "↩",
  call: "☎",
  deal: "♦",
};

type Mode = "mock" | "sandbox" | "live" | "offline";

interface ApprovalRequest { approvalId: string; code?: string; summary: string; drafts: DraftMessage[] }
/** A graph8 Work post (Monday brief or approval request). */
interface WorkPost { kind: "brief" | "approval"; status: StepStatus; text: string; channel?: string; code?: string; reason?: string; error?: string }
interface Learning { decisions: number; approved: number; rejected: number; edited: number; lessons: string[] }

interface BatchInfo { batchId: string; totalClicks: number; freemail: number; nonBuyer?: number; domains: string[]; runIds: string[]; demo?: boolean }
interface BatchState { batch?: BatchInfo; runs: RunSummary[]; brief?: WorkPost }
interface RunSummary {
  runId: string; domain?: string; company?: string; score?: number; qualified?: boolean;
  people: number; drafts: number; sent: number; deal?: string; status: string; approvalId?: string; currentStep?: string;
}

const RUN_STATUS: Record<string, string> = {
  running: "text-accent", awaiting_approval: "text-warn", done: "text-score",
  filtered: "text-muted-soft", rejected: "text-rose-500", failed: "text-rose-500", stopped: "text-muted",
};

export default function MissionControl() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [domain, setDomain] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [edits, setEdits] = useState<Record<string, DraftMessage[]>>({}); // approvalId -> edited drafts
  const [learning, setLearning] = useState<Learning | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    api<{ mode: Mode }>("/api/health").then((h) => setMode(h.mode)).catch(() => setMode("offline"));
    // First visit: open the tour once.
    let seen = true;
    try { seen = localStorage.getItem("ard-tour-seen") === "1"; } catch {}
    if (!seen) { const t = setTimeout(() => setTourOpen(true), 600); return () => clearTimeout(t); }
  }, []);

  function closeTour() {
    setTourOpen(false);
    try { localStorage.setItem("ard-tour-seen", "1"); } catch {}
  }

  // Refresh what the desk has learned whenever a decision could have happened.
  const decisionCount = events.filter((e) => e.step === "approval" && e.status !== "awaiting_approval" && e.status !== "running").length
    + (batch?.runs.filter((r) => r.status !== "running" && r.status !== "awaiting_approval").length ?? 0);
  useEffect(() => {
    let alive = true;
    api<Learning>("/api/learning").then((l) => alive && setLearning(l)).catch(() => {});
    return () => { alive = false; };
  }, [decisionCount]);

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`${API_URL}/api/events?runId=${runId}`);
    es.onmessage = (m) => setEvents((prev) => [...prev, JSON.parse(m.data) as PipelineEvent]);
    return () => es.close();
  }, [runId]);

  // Poll the per-run summary while a batch is active.
  useEffect(() => {
    if (!batchId) return;
    let alive = true;
    const tick = () => api<BatchState>(`/api/runs?batchId=${batchId}`).then((s) => alive && setBatch(s)).catch(() => {});
    tick();
    const t = setInterval(tick, 1200);
    return () => { alive = false; clearInterval(t); };
  }, [batchId]);

  const state = useMemo(() => {
    const steps = Object.fromEntries(STEP_NAMES.map((s) => [s, { status: "pending" as StepStatus, data: undefined as unknown, error: undefined as string | undefined }]));
    let approval: ApprovalRequest | undefined;
    let work: WorkPost | undefined;
    for (const e of events) {
      if (e.step === "run") { if (e.error) steps.engagement.error = e.error; continue; }
      if (e.step === "work") { work = { ...(e.data as WorkPost), status: e.status, error: e.error }; continue; }
      if (e.step === "webhook" || e.step === "batch") continue;
      steps[e.step] = { status: e.status, data: e.data ?? steps[e.step].data, error: e.error };
      if (e.status === "awaiting_approval") approval = e.data as ApprovalRequest;
    }
    return { steps: steps as Record<StepName, { status: StepStatus; data: unknown; error?: string }>, approval, work };
  }, [events]);

  const out = <T,>(s: StepName) => (state.steps[s].status === "done" ? (state.steps[s].data as T) : undefined);
  const engagement = out<EngagementOutput>("engagement");
  const qualify = (state.steps.qualify.data as QualifyOutput | undefined)?.company ? (state.steps.qualify.data as QualifyOutput) : undefined;
  const committee = out<CommitteeOutput>("committee");
  const outreach = out<OutreachOutput>("outreach");
  const drafts = out<{ drafts?: DraftMessage[] }>("approval")?.drafts ?? outreach?.drafts ?? [];
  const competitors = outreach?.competitors?.length ? outreach.competitors : undefined;
  const send = out<SendOutput>("send");
  const reply = out<ReplyOutput>("reply");
  const call = out<CallOutput>("call");
  const deal = out<DealOutput>("deal");
  const runError = events.find((e) => e.step === "run" && e.error)?.error;
  const finished = events.some((e) => e.step === "run" && e.status !== "running");

  async function start() {
    setBusy(true); setDecided(null); setError(null); setBatchId(null); setBatch(null); setEvents([]);
    try {
      const { runId } = await api<{ runId: string }>("/api/run", { method: "POST", body: JSON.stringify({ domain }) });
      setRunId(runId);
    } catch (e) { setError(`Backend unreachable at ${API_URL}: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function startWeekend() {
    setBusy(true); setDecided(null); setError(null); setRunId(null); setBatch(null); setEvents([]);
    try {
      const b = await api<BatchInfo>("/api/batch", { method: "POST", body: "{}" });
      setBatchId(b.batchId);
      if (b.runIds[0]) setRunId(b.runIds[0]);
    } catch (e) { setError(`Backend unreachable at ${API_URL}: ${(e as Error).message}`); }
    setBusy(false);
  }

  function selectRun(id: string) {
    if (id === runId) return;
    setDecided(null); setEvents([]); setRunId(id);
  }

  async function decide(decision: "approve" | "reject") {
    if (!state.approval) return;
    setDecided(decision);
    const drafts = edits[state.approval.approvalId];
    await api(`/api/approvals/${state.approval.approvalId}`, { method: "POST", body: JSON.stringify({ decision, drafts }) }).catch((e) => setError((e as Error).message));
  }

  function editDraft(i: number, patch: Partial<DraftMessage>) {
    if (!state.approval) return;
    const id = state.approval.approvalId;
    setEdits((prev) => {
      const base = prev[id] ?? state.approval!.drafts;
      return { ...prev, [id]: base.map((d, j) => (j === i ? { ...d, ...patch } : d)) };
    });
  }

  async function reset() {
    setBusy(true); setError(null);
    await api("/api/demo/reset", { method: "POST" }).catch((e) => setError((e as Error).message));
    setRunId(null); setEvents([]); setDecided(null); setBatchId(null); setBatch(null); setEdits({}); setBusy(false);
  }

  const awaiting = state.approval && state.steps.approval.status === "awaiting_approval" ? state.approval : undefined;
  const shownDrafts = awaiting ? edits[awaiting.approvalId] ?? awaiting.drafts : drafts;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 overflow-hidden rounded-[12px] border border-border bg-header-tint shadow-warm">
        <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Autopilot Revenue Desk
              </h1>
              {mode && (
                <span data-tour="mode" className="relative top-[-0.15em] shrink-0">
                  <ModeBadge mode={mode} />
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">Mission control · weekend engagement → ready-to-approve pipeline</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              aria-label="Start tour"
              title="Tour"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/70 text-muted hover:bg-surface hover:text-foreground sm:w-auto sm:gap-1.5 sm:px-2.5"
            >
              <TourIcon />
              <span className="hidden text-xs font-medium sm:inline">Tour</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/80 pt-4 sm:flex-row sm:items-center">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company domain (optional)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-cta" />
          <div className="flex flex-wrap gap-2">
            <button onClick={start} disabled={busy || mode === "offline"} className="rounded-lg bg-btn-run px-3 py-2 text-sm font-medium text-white shadow-warm hover:bg-btn-run-hover disabled:opacity-50">Run one</button>
            <button data-tour="run-weekend" onClick={startWeekend} disabled={busy || mode === "offline"} className="rounded-lg bg-btn-weekend px-4 py-2 text-sm font-medium text-white shadow-warm hover:bg-btn-weekend-hover disabled:opacity-50">Run weekend</button>
            <button onClick={reset} disabled={busy} className="rounded-lg border-2 border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50">Reset</button>
          </div>
        </div>
        </div>
      </header>

      {(error || runError) && <p className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">{error ?? runError}</p>}

      <div data-tour="weekend">
        {batch ? (
          <MondayPanel data={batch} selected={runId} onSelect={selectRun} />
        ) : (
          <Summary
            signals={engagement?.signals.length} company={qualify?.qualified ? qualify.company.name : undefined}
            people={committee?.members.length} drafts={drafts.length} sent={send?.sent.length} deal={deal?.name}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="grid min-w-0 content-start gap-6">
        <Card tour="pipeline" title={`Pipeline${runId ? ` · ${runId}` : ""}`}>
          <ol className="space-y-0.5">
            {STEP_NAMES.map((s, i) => {
              const st = state.steps[s];
              const active = st.status === "running" || st.status === "awaiting_approval";
              return (
                <li
                  key={s}
                  className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${active ? "bg-accent-soft/80" : st.status === "done" ? "bg-emerald-500/5" : ""}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[st.status]}`} />
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${
                      st.status === "done" ? "bg-score/15 text-score"
                        : active ? "bg-accent/15 text-accent"
                        : "bg-pending-dot/40 text-muted"
                    }`}
                    aria-hidden
                  >
                    {STEP_ICON[s]}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm ${st.status === "pending" ? "text-muted" : "text-foreground"}`}>
                      <span className="text-muted-soft">{i + 1}.</span> {LABELS[s]}
                    </div>
                    <div className={`text-xs ${STATUS_TEXT[st.status]}`}>
                      {st.status.replace(/_/g, " ")}{reasonOf(st.data)}{s === "approval" && viaOf(st.data)}
                    </div>
                    {st.error && <div className="break-words text-xs text-rose-500">{st.error}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
        <LearningCard learning={learning} />
        </div>

        <div className="grid min-w-0 gap-6">
          {awaiting && state.approval && (
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-4">
              <div className="mb-1 text-sm font-medium">Approval needed: {state.approval.summary}</div>
              <div className="mb-3 text-xs text-muted">Edit the drafts below if you like. Nothing is sent until you approve, and what you approve is what gets sent.</div>
              <WorkNote work={state.work} code={state.approval.code} />
              <div className="flex gap-2">
                <button onClick={() => decide("approve")} disabled={!!decided} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>
                <button onClick={() => decide("reject")} disabled={!!decided} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">Reject</button>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card tour="score" title="Company · why this score">
              {qualify ? (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{qualify.company.name}</div>
                      <div className="text-xs text-muted">{qualify.company.domain} · {qualify.company.industry ?? "—"} · {qualify.company.employeeCount ?? "?"} employees</div>
                    </div>
                    <div className={`text-2xl font-semibold tabular-nums ${qualify.qualified ? "text-score" : "text-rose-500"}`}>{qualify.score}</div>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">{qualify.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  {qualify.learned?.length ? (
                    <div className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
                      <div className="mb-0.5 font-medium">Learned from your decisions</div>
                      <ul className="space-y-0.5">{qualify.learned.map((l) => <li key={l}>{l}</li>)}</ul>
                    </div>
                  ) : null}
                  {qualify.competitor && (
                    <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-800 dark:text-orange-200">
                      <div className="mb-0.5 font-medium">Uses competitor: {qualify.competitor.name} <span className="font-normal opacity-75">· graph8 Radar</span></div>
                      <div className="opacity-80">{qualify.competitor.evidence}</div>
                      {qualify.competitor.talkingPoints.length > 0 && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">{qualify.competitor.talkingPoints.map((t) => <li key={t}>{t}</li>)}</ul>
                      )}
                    </div>
                  )}
                  {engagement && (
                    <div className="border-t border-border-subtle pt-2">
                      <div className="mb-1 text-xs font-medium text-muted">What they engaged with</div>
                      <ul className="space-y-0.5 text-xs text-muted">{engagement.signals.map((s, i) => <li key={i}><span className="text-muted-soft">{s.source}</span> · {s.description}</li>)}</ul>
                    </div>
                  )}
                </div>
              ) : <Empty />}
            </Card>

            <Card tour="committee" title="Buying committee">
              {committee?.members.length ? (
                <ul className="divide-y divide-border-subtle">
                  {committee.members.map((m) => (
                    <li key={`${m.firstName}${m.lastName}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{m.firstName} {m.lastName}</div>
                        <div className="truncate text-xs text-muted">{m.title} · {m.email}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{m.role.replace("_", " ")}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty />}
            </Card>
          </div>

          <Card tour="drafts" title="AI-drafted messages">
            {competitors && <CompetitorIntelPanel competitors={competitors} />}
            {shownDrafts.length ? (
              <div className={`grid gap-3 md:grid-cols-2 ${competitors ? "mt-3" : ""}`}>
                {shownDrafts.map((d, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${awaiting && !decided ? "border-warn/40 bg-warn/5" : "border-border-subtle bg-surface-muted/50"}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="truncate">{d.channel.replace("_", " ")} → {d.contactEmail}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {competitors?.[0] && (
                          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 dark:text-orange-300">vs {competitors[0].name}</span>
                        )}
                        {d.source && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-muted">{d.source === "graph8" ? "graph8 AI" : "template"}</span>}
                      </span>
                    </div>
                    {awaiting && !decided ? (
                      <>
                        {d.subject !== undefined && (
                          <input value={d.subject} onChange={(e) => editDraft(i, { subject: e.target.value })} aria-label="Subject"
                            className="mb-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-accent" />
                        )}
                        <textarea value={d.body} onChange={(e) => editDraft(i, { body: e.target.value })} rows={8} aria-label="Message body"
                          className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-accent" />
                      </>
                    ) : (
                      <>
                        {d.subject && <div className="mb-1 text-sm font-medium">{d.subject}</div>}
                        <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{d.body}</pre>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : competitors ? null : <Empty />}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Sandbox outbox">
              {send ? (
                <div className="space-y-2 text-sm">
                  {send.sequenceId && <div className="text-xs text-muted">Sequence {send.sequenceId}</div>}
                  <ul className="space-y-1">
                    {send.sent.map((s, i) => (
                      <li key={i} className="flex justify-between gap-2"><span className="truncate">{s.channel} → {s.contactEmail}</span><span className="shrink-0 text-xs text-score">{s.status}</span></li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted">{send.outbox.length} item(s) caught by the sandbox. Nothing reached real people.</div>
                </div>
              ) : <Empty text={finished ? "Not sent." : undefined} />}
            </Card>

            <Card title="Reply + call">
              {reply?.replies.length ? (
                <div className="space-y-3 text-sm">
                  {reply.replies.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-xs text-muted">{r.contactEmail} {r.intent && <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">{r.intent.replace(/_/g, " ")}</span>}</div>
                      {r.inbound && <p className="italic text-muted">“{r.inbound}”</p>}
                      <pre className="whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-muted p-2 font-sans text-foreground">{r.draft}</pre>
                    </div>
                  ))}
                  {call?.calls.map((c, i) => (
                    <div key={i} className="border-t border-border-subtle pt-2 text-xs text-muted">
                      Call: {c.outcome}{c.grade !== undefined && ` · grade ${c.grade}`}
                    </div>
                  ))}
                </div>
              ) : <Empty text={finished ? "No reply handled." : undefined} />}
            </Card>
          </div>

          <Card tour="deal" title="Deal + next step">
            {deal ? (
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{deal.name}</div>
                  <div className="text-xs text-muted">{deal.dealId}{deal.amount ? ` · $${deal.amount.toLocaleString()}` : ""}</div>
                </div>
                <div className="rounded-lg border border-cta/25 bg-cta/10 px-3 py-2 text-sm text-cta">Next: {deal.nextBestStep}</div>
              </div>
            ) : <Empty text={finished ? "No deal created." : undefined} />}
          </Card>

          <EventLogCard events={events} />
        </div>
      </div>
      <Tour open={tourOpen} onClose={closeTour} />
    </main>
  );
}

const STEP_LABELS: Record<string, string> = {
  ...LABELS,
  run: "Run",
  work: "graph8 Work",
  webhook: "Webhook",
  batch: "Weekend batch",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
  awaiting_approval: "Needs approval",
};

const STATUS_PILL: Record<StepStatus, string> = {
  pending: "bg-surface-muted text-muted",
  running: "bg-accent/15 text-accent",
  done: "bg-score/15 text-score",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  skipped: "bg-surface-muted text-muted-soft",
  awaiting_approval: "bg-warn/15 text-warn",
};

function EventLogCard({ events }: { events: PipelineEvent[] }) {
  const rows = events.filter((e) => e.step !== "webhook");
  const latest = rows[rows.length - 1];

  return (
    <Card title={`Activity${rows.length ? ` · ${rows.length}` : ""}`}>
      {!rows.length ? (
        <Empty text="Live updates will show up here when you run." />
      ) : (
        <div className="space-y-3">
          {latest && (
            <div className="rounded-lg border border-border-subtle bg-surface-muted/80 px-3 py-2 text-xs text-muted">
              Latest: <span className="font-medium text-foreground">{STEP_LABELS[latest.step] ?? latest.step}</span>
              {" · "}
              <span className={latest.status === "failed" ? "text-rose-600" : "text-foreground"}>
                {STATUS_LABEL[latest.status] ?? latest.status.replace(/_/g, " ")}
              </span>
              {latest.error ? <span className="text-rose-600"> — {latest.error}</span> : null}
            </div>
          )}
          <ol className="max-h-72 space-y-0 overflow-auto pr-1">
            {[...rows].reverse().map((e, i, arr) => {
              const label = STEP_LABELS[e.step] ?? e.step;
              const statusText = STATUS_LABEL[e.status] ?? e.status.replace(/_/g, " ");
              const pill = STATUS_PILL[e.status] ?? STATUS_PILL.pending;
              const time = e.timestamp.slice(11, 19);
              const isNewest = i === 0;
              return (
                <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < arr.length - 1 && (
                    <span className="absolute left-[5px] top-3 bottom-0 w-px bg-border-subtle" aria-hidden />
                  )}
                  <span className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[e.status] ?? "bg-pending-dot"}`} />
                  <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${isNewest ? "border-cta/35 bg-cta/5" : "border-border-subtle bg-surface"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pill}`}>{statusText}</span>
                      <span className="ml-auto font-mono text-[11px] text-muted-soft">{time}</span>
                    </div>
                    {e.error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{e.error}</p>}
                    {!e.error && typeof (e.data as { reason?: string } | undefined)?.reason === "string" && (
                      <p className="mt-1 text-xs text-muted">{(e.data as { reason: string }).reason}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}

/** Ordered blue → green stops via CSS vars (auto-brighten in dark mode). */
const SPECTRUM_VARS = [
  "var(--spectrum-0)",
  "var(--spectrum-1)",
  "var(--spectrum-2)",
  "var(--spectrum-3)",
  "var(--spectrum-4)",
  "var(--spectrum-5)",
  "var(--spectrum-6)",
] as const;

function spectrumColor(i: number, total: number) {
  if (total <= 1) return SPECTRUM_VARS[0];
  const t = i / (total - 1);
  const idx = Math.round(t * (SPECTRUM_VARS.length - 1));
  return SPECTRUM_VARS[idx];
}

function Summary(p: { signals?: number; company?: string; people?: number; drafts: number; sent?: number; deal?: string }) {
  const items = [
    { label: "Signals", value: p.signals ?? "—", hint: "Newsletter clicks & site visits found for this company", icon: "◎" },
    { label: "Qualified", value: p.company ?? "—", hint: "Company name if it passed the fit score", icon: "★" },
    { label: "Decision-makers", value: p.people ?? "—", hint: "Buying-committee contacts found (CTO, VP, champion…)", icon: "♟" },
    { label: "Messages drafted", value: p.drafts || "—", hint: "AI email / LinkedIn / call scripts waiting for you", icon: "✉" },
    { label: "Sent (sandbox)", value: p.sent ?? "—", hint: "Messages caught by the sandbox — nothing reached real people", icon: "→" },
    { label: "Deal", value: p.deal ? "created" : "—", hint: "CRM opportunity opened after approval", icon: "♦" },
  ] as const;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, i) => {
        const color = spectrumColor(i, items.length);
        return (
          <div
            key={item.label}
            title={item.hint}
            className="flex min-h-[7.5rem] min-w-0 flex-col rounded-[12px] border-2 bg-surface px-3 py-2.5 shadow-warm"
            style={{ borderColor: color }}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
              <span className="text-sm leading-none" aria-hidden>{item.icon}</span>
              {item.label}
            </div>
            <div className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{item.value}</div>
            <div className="mt-auto pt-1 line-clamp-2 text-[10px] leading-snug text-muted-soft">{item.hint}</div>
          </div>
        );
      })}
    </div>
  );
}

/** "This weekend: 40 clicks → 5 companies → 3 good fits → 12 decision-makers → 6 emails ready". */
function MondayPanel({ data, selected, onSelect }: { data: BatchState; selected: string | null; onSelect: (id: string) => void }) {
  const { batch, runs, brief } = data;
  const fits = runs.filter((r) => r.qualified);
  const sum = (k: "people" | "drafts" | "sent") => runs.reduce((n, r) => n + r[k], 0);
  const waiting = runs.filter((r) => r.status === "awaiting_approval").length;
  const funnel = [
    { label: "Clicks", value: batch?.totalClicks ?? "—" },
    { label: "Companies", value: batch?.domains.length ?? runs.length },
    { label: "Good fits", value: fits.length },
    { label: "Decision-makers", value: sum("people") },
    { label: "Emails ready", value: sum("drafts") },
    { label: "Sent (sandbox)", value: sum("sent") },
    { label: "Deals", value: runs.filter((r) => r.deal).length },
  ] as const;
  const sorted = [...runs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <section className="mc-card mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          This weekend
          {batch?.demo && <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 normal-case tracking-normal text-accent" title="Your graph8 org has no click history yet, so these clicks are demo data. Everything after them runs on real graph8 data.">demo clicks · real graph8 data</span>}
        </h2>
        <span className="text-xs text-muted">
          {batch?.freemail ? `${batch.freemail} personal-email clicks skipped · ` : ""}
          {batch?.nonBuyer ? `${batch.nonBuyer} student/government skipped · ` : ""}
          {waiting ? <span className="font-medium text-warn">{waiting} waiting for your approval</span> : "no approvals pending"}
        </span>
      </div>
      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {funnel.map((item, i) => {
          const color = spectrumColor(i, funnel.length);
          return (
            <li key={item.label} className="relative min-w-0">
              {i > 0 && (
                <span
                  className="pointer-events-none absolute -left-1.5 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 text-sm font-medium text-muted-soft lg:inline"
                  aria-hidden
                >
                  →
                </span>
              )}
              <div
                className="flex h-full min-h-[4.75rem] flex-col justify-center rounded-[12px] border-2 bg-surface px-2.5 py-2 text-center shadow-warm"
                style={{ borderColor: color }}
              >
                <div className="text-xl font-semibold leading-none tabular-nums text-foreground">{item.value}</div>
                <div className="mt-1.5 text-[11px] font-semibold leading-tight" style={{ color }}>{item.label}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {brief && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${brief.status === "done" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : brief.status === "failed" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-surface-muted text-muted"}`}>
          {brief.status === "done" ? <>Monday brief posted to graph8 Work <span className="font-mono">#{brief.channel}</span> ✓</>
            : brief.status === "failed" ? <>Couldn&apos;t post the brief to graph8 Work: {brief.error}</>
            : <>Monday brief ready ({brief.reason}). On the live system it&apos;s posted to graph8 Work.</>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-3 font-medium">Company</th><th className="py-1 pr-3 text-right font-medium">Score</th>
              <th className="py-1 pr-3 text-right font-medium">People</th><th className="py-1 pr-3 text-right font-medium">Emails</th>
              <th className="py-1 pr-3 font-medium">Status</th><th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sorted.map((r) => (
              <tr key={r.runId} className={r.runId === selected ? "bg-accent/5" : ""}>
                <td className="py-1.5 pr-3"><div className="font-medium text-foreground">{r.company ?? r.domain}</div><div className="text-xs text-muted">{r.domain}</div></td>
                <td className={`py-1.5 pr-3 text-right tabular-nums ${r.qualified ? "text-score" : "text-muted-soft"}`}>{r.score ?? "…"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.people || "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.drafts || "—"}</td>
                <td className={`py-1.5 pr-3 text-xs ${RUN_STATUS[r.status] ?? "text-muted"}`}>
                  {r.status === "running" ? `running · ${r.currentStep ?? "…"}` : r.status === "awaiting_approval" ? "needs approval" : r.status}
                </td>
                <td className="py-1.5 text-right">
                  <button onClick={() => onSelect(r.runId)} className={`rounded-md px-2 py-1 text-xs font-medium ${r.status === "awaiting_approval" ? "border border-warn/40 bg-warn/15 text-warn hover:bg-warn/25" : "border border-border hover:bg-surface-muted"}`}>
                    {r.status === "awaiting_approval" ? "Review" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Battle-card chrome from outreach SSE `data.competitors` — omit entirely when empty. */
function CompetitorIntelPanel({ competitors }: { competitors: CompetitorIntel[] }) {
  return (
    <div className="space-y-2">
      {competitors.map((c) => (
        <div key={c.competitorId} className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-sm font-medium text-orange-800 dark:text-orange-200">
              vs {c.name}
            </span>
            {c.domain && <span className="text-xs text-muted">{c.domain}</span>}
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
              {c.confidence} confidence
            </span>
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
              {c.source === "radar" ? "Radar" : "mock"}
            </span>
          </div>
          <p className="mb-2 text-xs text-muted">{c.matchedOn}</p>
          {c.talkingPoints.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground">
              {c.talkingPoints.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const style = {
    mock: "bg-warn/20 text-warn ring-1 ring-warn/35",
    sandbox: "bg-score/15 text-score ring-1 ring-score/30",
    live: "bg-cta/15 text-cta ring-1 ring-cta/30",
    offline: "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 dark:text-rose-300",
  }[mode];
  const label = { mock: "MOCK MODE", sandbox: "SANDBOX", live: "LIVE · SENDS HELD", offline: "BACKEND OFFLINE" }[mode];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${style}`}>{label}</span>;
}

function TourIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-1.5a2.5 2.5 0 1 0-1-4.8" />
      <circle cx="12" cy="18.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Approval request mirrored into graph8 Work: reply "approve CODE" there (web or mobile). */
function WorkNote({ work, code }: { work?: WorkPost; code?: string }) {
  if (!code) return null;
  if (work?.status === "done") {
    return (
      <div className="mb-3 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs text-muted">
        Also posted to graph8 Work <span className="font-mono">#{work.channel}</span>. Reply <span className="rounded bg-surface-muted px-1 font-mono text-foreground">approve {code}</span> or <span className="rounded bg-surface-muted px-1 font-mono text-foreground">reject {code}</span> from the Work app, even on your phone.
      </div>
    );
  }
  if (work?.status === "failed") return <div className="mb-3 text-xs text-rose-500">Couldn&apos;t post to graph8 Work: {work.error}. Approve here instead.</div>;
  return <div className="mb-3 text-xs text-muted">On the live system this request is also posted to graph8 Work, where replying <span className="font-mono">approve {code}</span> decides it.</div>;
}

/** What the desk has learned from your approve / reject / edit decisions. */
function LearningCard({ learning }: { learning: Learning | null }) {
  return (
    <Card tour="learning" title="Learning from you">
      {learning?.decisions ? (
        <div className="space-y-2 text-sm">
          <div className="flex gap-3 text-xs text-muted">
            <span><b className="text-score">{learning.approved}</b> approved</span>
            <span><b className="text-rose-500">{learning.rejected}</b> rejected</span>
            <span><b className="text-foreground">{learning.edited}</b> edited</span>
          </div>
          {learning.lessons.length ? (
            <ul className="space-y-1">{learning.lessons.map((l) => <li key={l} className="rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-700 dark:text-violet-300">{l}</li>)}</ul>
          ) : <p className="text-xs text-muted">A lesson needs 2 similar decisions. Keep approving and rejecting.</p>}
        </div>
      ) : <p className="text-sm text-muted-soft">Approve or reject a few companies and the desk will adjust its scoring and writing.</p>}
    </Card>
  );
}

function viaOf(data: unknown) {
  const via = (data as { via?: string } | undefined)?.via;
  return via === "graph8 Work" ? " · via graph8 Work" : "";
}

function reasonOf(data: unknown) {
  const r = (data as { reason?: string } | undefined)?.reason;
  return r ? ` · ${r}` : "";
}

function Card({ title, children, tour }: { title: string; children: React.ReactNode; tour?: string }) {
  return (
    <section data-tour={tour} className="mc-card min-w-0 p-4">
      <h2 className="mb-3 truncate text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text?: string }) => <p className="text-sm text-muted-soft">{text ?? "Nothing yet. Press Run."}</p>;
