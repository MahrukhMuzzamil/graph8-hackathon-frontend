"use client";

import { useEffect, useMemo, useState } from "react";
import Tour from "@/components/Tour";
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
  pending: "bg-zinc-300 dark:bg-zinc-700",
  running: "bg-sky-500 animate-pulse",
  done: "bg-emerald-500",
  failed: "bg-rose-500",
  skipped: "bg-zinc-400 dark:bg-zinc-600",
  awaiting_approval: "bg-amber-500 animate-pulse",
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
  running: "text-sky-600 dark:text-sky-400", awaiting_approval: "text-amber-600 dark:text-amber-400", done: "text-emerald-600 dark:text-emerald-400",
  filtered: "text-zinc-400", rejected: "text-rose-500", failed: "text-rose-500", stopped: "text-zinc-500",
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
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Autopilot Revenue Desk</h1>
        <span className="text-sm text-zinc-500">Mission control</span>
        {mode && <span data-tour="mode"><ModeBadge mode={mode} /></span>}
        <button onClick={() => setTourOpen(true)} className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Tour</button>
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company domain (optional)"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900 sm:w-64" />
          <button onClick={start} disabled={busy || mode === "offline"} className="rounded-lg border border-sky-600 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-950">Run one</button>
          <button data-tour="run-weekend" onClick={startWeekend} disabled={busy || mode === "offline"} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">Run weekend</button>
          <button onClick={reset} disabled={busy} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Reset demo</button>
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
          <ol className="space-y-1">
            {STEP_NAMES.map((s, i) => {
              const st = state.steps[s];
              return (
                <li key={s} className="flex items-start gap-3 rounded-md px-2 py-1.5">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[st.status]}`} />
                  <div className="min-w-0">
                    <div className="text-sm"><span className="text-zinc-400">{i + 1}.</span> {LABELS[s]}</div>
                    <div className="text-xs text-zinc-500">{st.status.replace("_", " ")}{reasonOf(st.data)}{s === "approval" && viaOf(st.data)}</div>
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
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="mb-1 text-sm font-medium">Approval needed: {state.approval.summary}</div>
              <div className="mb-3 text-xs text-zinc-500">Edit the drafts below if you like. Nothing is sent until you approve, and what you approve is what gets sent.</div>
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
                      <div className="text-xs text-zinc-500">{qualify.company.domain} · {qualify.company.industry ?? "—"} · {qualify.company.employeeCount ?? "?"} employees</div>
                    </div>
                    <div className={`text-2xl font-semibold tabular-nums ${qualify.qualified ? "text-emerald-500" : "text-rose-500"}`}>{qualify.score}</div>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">{qualify.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
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
                    <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
                      <div className="mb-1 text-xs font-medium text-zinc-500">What they engaged with</div>
                      <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">{engagement.signals.map((s, i) => <li key={i}><span className="text-zinc-400">{s.source}</span> · {s.description}</li>)}</ul>
                    </div>
                  )}
                </div>
              ) : <Empty />}
            </Card>

            <Card tour="committee" title="Buying committee">
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

          <Card tour="drafts" title="AI-drafted messages">
            {competitors && <CompetitorIntelPanel competitors={competitors} />}
            {shownDrafts.length ? (
              <div className={`grid gap-3 md:grid-cols-2 ${competitors ? "mt-3" : ""}`}>
                {shownDrafts.map((d, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${awaiting && !decided ? "border-amber-500/40" : "border-zinc-200 dark:border-zinc-800"}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="truncate">{d.channel.replace("_", " ")} → {d.contactEmail}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {competitors?.[0] && (
                          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 dark:text-orange-300">vs {competitors[0].name}</span>
                        )}
                        {d.source && <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{d.source === "graph8" ? "graph8 AI" : "template"}</span>}
                      </span>
                    </div>
                    {awaiting && !decided ? (
                      <>
                        {d.subject !== undefined && (
                          <input value={d.subject} onChange={(e) => editDraft(i, { subject: e.target.value })} aria-label="Subject"
                            className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900" />
                        )}
                        <textarea value={d.body} onChange={(e) => editDraft(i, { body: e.target.value })} rows={8} aria-label="Message body"
                          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" />
                      </>
                    ) : (
                      <>
                        {d.subject && <div className="mb-1 text-sm font-medium">{d.subject}</div>}
                        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">{d.body}</pre>
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

          <Card tour="deal" title="Deal + next step">
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
      <Tour open={tourOpen} onClose={closeTour} />
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

/** "This weekend: 40 clicks → 5 companies → 3 good fits → 12 decision-makers → 6 emails ready". */
function MondayPanel({ data, selected, onSelect }: { data: BatchState; selected: string | null; onSelect: (id: string) => void }) {
  const { batch, runs, brief } = data;
  const fits = runs.filter((r) => r.qualified);
  const sum = (k: "people" | "drafts" | "sent") => runs.reduce((n, r) => n + r[k], 0);
  const waiting = runs.filter((r) => r.status === "awaiting_approval").length;
  const funnel = [
    ["Clicks", batch?.totalClicks ?? "—"], ["Companies", batch?.domains.length ?? runs.length], ["Good fits", fits.length],
    ["Decision-makers", sum("people")], ["Emails ready", sum("drafts")], ["Sent (sandbox)", sum("sent")], ["Deals", runs.filter((r) => r.deal).length],
  ] as const;
  const sorted = [...runs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          This weekend
          {batch?.demo && <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 normal-case tracking-normal text-sky-700 dark:text-sky-300" title="Your graph8 org has no click history yet, so these clicks are demo data. Everything after them runs on real graph8 data.">demo clicks · real graph8 data</span>}
        </h2>
        <span className="text-xs text-zinc-500">
          {batch?.freemail ? `${batch.freemail} personal-email clicks skipped · ` : ""}
          {batch?.nonBuyer ? `${batch.nonBuyer} student/government skipped · ` : ""}
          {waiting ? <span className="font-medium text-amber-600 dark:text-amber-400">{waiting} waiting for your approval</span> : "no approvals pending"}
        </span>
      </div>
      <ol className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-2">
        {funnel.map(([label, value], i) => (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <span className="px-1 text-zinc-300 dark:text-zinc-600" aria-hidden>→</span>}
            <div className="rounded-lg bg-zinc-50 px-3 py-1.5 dark:bg-zinc-800/60">
              <div className="text-lg font-semibold leading-tight tabular-nums">{value}</div>
              <div className="text-[11px] text-zinc-500">{label}</div>
            </div>
          </li>
        ))}
      </ol>
      {brief && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${brief.status === "done" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : brief.status === "failed" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400"}`}>
          {brief.status === "done" ? <>Monday brief posted to graph8 Work <span className="font-mono">#{brief.channel}</span> ✓</>
            : brief.status === "failed" ? <>Couldn&apos;t post the brief to graph8 Work: {brief.error}</>
            : <>Monday brief ready ({brief.reason}). On the live system it&apos;s posted to graph8 Work.</>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="py-1 pr-3 font-medium">Company</th><th className="py-1 pr-3 text-right font-medium">Score</th>
              <th className="py-1 pr-3 text-right font-medium">People</th><th className="py-1 pr-3 text-right font-medium">Emails</th>
              <th className="py-1 pr-3 font-medium">Status</th><th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((r) => (
              <tr key={r.runId} className={r.runId === selected ? "bg-sky-500/5" : ""}>
                <td className="py-1.5 pr-3"><div className="font-medium">{r.company ?? r.domain}</div><div className="text-xs text-zinc-500">{r.domain}</div></td>
                <td className={`py-1.5 pr-3 text-right tabular-nums ${r.qualified ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>{r.score ?? "…"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.people || "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.drafts || "—"}</td>
                <td className={`py-1.5 pr-3 text-xs ${RUN_STATUS[r.status] ?? "text-zinc-500"}`}>
                  {r.status === "running" ? `running · ${r.currentStep ?? "…"}` : r.status === "awaiting_approval" ? "needs approval" : r.status}
                </td>
                <td className="py-1.5 text-right">
                  <button onClick={() => onSelect(r.runId)} className={`rounded-md px-2 py-1 text-xs ${r.status === "awaiting_approval" ? "bg-amber-500 text-white hover:bg-amber-400" : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}>
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
            {c.domain && <span className="text-xs text-zinc-500">{c.domain}</span>}
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {c.confidence} confidence
            </span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {c.source === "radar" ? "Radar" : "mock"}
            </span>
          </div>
          <p className="mb-2 text-xs text-zinc-500">{c.matchedOn}</p>
          {c.talkingPoints.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
              {c.talkingPoints.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const style = { mock: "bg-violet-500/15 text-violet-600 dark:text-violet-300", sandbox: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", live: "bg-amber-500/15 text-amber-700 dark:text-amber-300", offline: "bg-rose-500/15 text-rose-600 dark:text-rose-300" }[mode];
  const label = { mock: "MOCK MODE", sandbox: "SANDBOX", live: "LIVE · SENDS HELD", offline: "BACKEND OFFLINE" }[mode];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

/** Approval request mirrored into graph8 Work: reply "approve CODE" there (web or mobile). */
function WorkNote({ work, code }: { work?: WorkPost; code?: string }) {
  if (!code) return null;
  if (work?.status === "done") {
    return (
      <div className="mb-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Also posted to graph8 Work <span className="font-mono">#{work.channel}</span>. Reply <span className="rounded bg-zinc-200 px-1 font-mono dark:bg-zinc-800">approve {code}</span> or <span className="rounded bg-zinc-200 px-1 font-mono dark:bg-zinc-800">reject {code}</span> from the Work app, even on your phone.
      </div>
    );
  }
  if (work?.status === "failed") return <div className="mb-3 text-xs text-rose-500">Couldn&apos;t post to graph8 Work: {work.error}. Approve here instead.</div>;
  return <div className="mb-3 text-xs text-zinc-500">On the live system this request is also posted to graph8 Work, where replying <span className="font-mono">approve {code}</span> decides it.</div>;
}

/** What the desk has learned from your approve / reject / edit decisions. */
function LearningCard({ learning }: { learning: Learning | null }) {
  return (
    <Card tour="learning" title="Learning from you">
      {learning?.decisions ? (
        <div className="space-y-2 text-sm">
          <div className="flex gap-3 text-xs text-zinc-500">
            <span><b className="text-emerald-600 dark:text-emerald-400">{learning.approved}</b> approved</span>
            <span><b className="text-rose-500">{learning.rejected}</b> rejected</span>
            <span><b className="text-zinc-700 dark:text-zinc-300">{learning.edited}</b> edited</span>
          </div>
          {learning.lessons.length ? (
            <ul className="space-y-1">{learning.lessons.map((l) => <li key={l} className="rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-700 dark:text-violet-300">{l}</li>)}</ul>
          ) : <p className="text-xs text-zinc-500">A lesson needs 2 similar decisions. Keep approving and rejecting.</p>}
        </div>
      ) : <p className="text-sm text-zinc-400">Approve or reject a few companies and the desk will adjust its scoring and writing.</p>}
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
    <section data-tour={tour} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <h2 className="mb-3 truncate text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text?: string }) => <p className="text-sm text-zinc-400">{text ?? "Nothing yet. Press Run."}</p>;
