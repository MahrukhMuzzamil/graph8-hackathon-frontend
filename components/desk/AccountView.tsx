"use client";

import { STEP_NAMES, type DraftMessage } from "@/lib/types";
import { priorityOf, reasonOf, STEP_LABEL, STEP_TONE, type Mode, type WorkPost } from "./model";
import type { RunData } from "./run";
import { Button, EmptyState, Icon, Muted, Panel, Status, Tag } from "./ui";

/** One company: where it is in the 10 steps, why it scored, who, what we wrote, what happened. */
export function AccountView({ run, runId, mode, onRetry, onReview }: {
  run: RunData | null; runId: string | null; mode: Mode | null; onRetry: (runId: string) => void; onReview: () => void;
}) {
  if (!run || !runId) return <div className="mc-card"><EmptyState title="No company selected" body="Open one from Today, or run a company." /></div>;
  const q = run.qualify;
  const p = q ? priorityOf(q) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{q?.company.name ?? "Working…"}</h2>
            {p && <Tag tone={p.tone}>{p.label}</Tag>}
            {q?.competitor && <Tag tone="warn">Compared with {q.competitor.name}</Tag>}
          </div>
          {q && <div className="mt-0.5 text-[13px] text-muted">{q.company.domain} · {q.company.industry ?? "Industry unknown"} · {q.company.employeeCount ?? "?"} employees</div>}
        </div>
        {q && (
          <div className="text-right">
            <div className={`text-3xl font-semibold tabular-nums tracking-tight ${q.qualified ? "text-foreground" : "text-muted-soft"}`}>{q.score}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-soft">fit score</div>
          </div>
        )}
      </div>

      <Stepper run={run} />

      {run.runError && <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">{run.runError}</div>}
      {run.finished && run.failed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px]">
          <span className="text-muted">A step failed, likely a slow graph8 call. Retrying reuses the same click and doesn&apos;t duplicate records.</span>
          <Button size="sm" onClick={() => onRetry(runId)}><Icon.retry className="h-3.5 w-3.5" />Retry</Button>
        </div>
      )}
      {run.awaiting && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-[13px]">
          <span className="text-foreground">Waiting for your approval. {run.awaiting.code && <>Or reply <code className="font-mono">approve {run.awaiting.code}</code> in graph8 Work.</>}</span>
          <Button variant="primary" size="sm" onClick={onReview}>Review drafts</Button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-5">
          <WhyScore run={run} />
          <Committee run={run} />
        </div>
        <div className="space-y-5">
          <Panel title="Emails" tour="drafts" action={<DraftSource drafts={run.drafts} />}>
            {run.drafts.length ? <div className="space-y-3">{run.drafts.map((d, i) => <DraftCard key={i} d={d} />)}</div> : <Muted>{run.finished ? "No drafts for this company." : "graph8 AI writes these after the buying committee is saved."}</Muted>}
          </Panel>
          <Outcome run={run} mode={mode} />
        </div>
      </div>
    </div>
  );
}

function Stepper({ run }: { run: RunData }) {
  return (
    <ol className="mc-card grid grid-cols-5 gap-px overflow-hidden bg-border-subtle lg:grid-cols-10" data-tour="pipeline">
      {STEP_NAMES.map((s, i) => {
        const st = run.steps[s]; const tone = STEP_TONE[st.status];
        const why = st.error ?? reasonOf(st.data);
        return (
          <li key={s} className="bg-surface px-2.5 py-2" title={why ?? st.status.replace(/_/g, " ")}>
            <div className="text-[10px] tabular-nums text-muted-soft">{String(i + 1).padStart(2, "0")}</div>
            <div className={`truncate text-[12px] font-medium ${st.status === "pending" ? "text-muted-soft" : "text-foreground"}`}>{STEP_LABEL[s]}</div>
            <div className="mt-1"><Status tone={tone} pulse={st.status === "running" || st.status === "awaiting_approval"}>{st.status === "awaiting_approval" ? "waiting" : st.status}</Status></div>
          </li>
        );
      })}
    </ol>
  );
}

export function WhyScore({ run }: { run: RunData }) {
  const q = run.qualify;
  return (
    <Panel title="Why this score" tour="score">
      {!q ? <Muted>Scored after enrichment.</Muted> : (
        <div className="space-y-4 text-[13px]">
          <ul className="space-y-1.5">
            {q.reasons.map((r) => <li key={r} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-soft" /><span className="text-foreground">{r}</span></li>)}
          </ul>
          {q.learned?.length ? (
            <div className="border-t border-border-subtle pt-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-soft">Learned from your decisions</div>
              {q.learned.map((l) => <div key={l} className="text-accent">{l}</div>)}
            </div>
          ) : null}
          {q.competitor && (
            <div className="border-t border-border-subtle pt-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-soft">graph8 Radar</div>
              <div className="text-foreground">Compared with <b>{q.competitor.name}</b>: {q.competitor.evidence}.</div>
              {q.competitor.talkingPoints.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{q.competitor.talkingPoints.map((t) => <li key={t}>{t}</li>)}</ul>}
            </div>
          )}
          {run.engagement && run.engagement.signals.length > 0 && (
            <div className="border-t border-border-subtle pt-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-soft">What their team engaged with</div>
              {run.engagement.signals.map((s, i) => <div key={i} className="text-muted"><span className="text-muted-soft">{s.source}</span> · {s.description}</div>)}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export function Committee({ run }: { run: RunData }) {
  const members = run.committee?.members ?? [];
  return (
    <Panel title="Buying committee" tour="committee" action={members.length ? <span className="text-xs text-muted-soft">{members.length} people</span> : undefined}>
      {!members.length ? <Muted>Found in graph8&apos;s 700M contacts after scoring.</Muted> : (
        <ul className="-my-1 divide-y divide-border-subtle">
          {members.map((m) => (
            <li key={`${m.firstName}${m.lastName}`} className="flex items-center gap-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-muted">{m.firstName[0]}{m.lastName[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{m.firstName} {m.lastName}</div>
                <div className="truncate text-xs text-muted">{m.title ?? "—"}</div>
              </div>
              <span className="shrink-0 text-xs text-muted">{m.role.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DraftSource({ drafts }: { drafts: DraftMessage[] }) {
  if (!drafts.length) return null;
  const ai = drafts.filter((d) => d.source === "graph8").length;
  return <span className="text-xs text-muted-soft">{ai ? `${ai} by graph8 AI` : "template"}</span>;
}

export function DraftCard({ d }: { d: DraftMessage }) {
  return (
    <article className="rounded-md border border-border-subtle">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs text-muted">
        {d.channel === "email" ? <Icon.mail className="h-3.5 w-3.5" /> : <span className="font-semibold">in</span>}
        <span className="truncate">To {d.contactEmail}</span>
      </div>
      <div className="px-3 py-2">
        {d.subject && <div className="mb-1 text-[13px] font-medium">{d.subject}</div>}
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{d.body}</p>
      </div>
    </article>
  );
}

function Outcome({ run, mode }: { run: RunData; mode: Mode | null }) {
  const delivered = run.send?.outbox.filter((o) => (o as { delivered?: boolean }).delivered) ?? [];
  return (
    <Panel title="After approval" tour="deal">
      {!run.send && !run.deal ? <Muted>{run.finished ? "Nothing sent for this company." : "Sending, reply handling, the AI call and the deal happen after you approve."}</Muted> : (
        <dl className="space-y-3 text-[13px]">
          {run.send && (
            <Row icon={<Icon.mail className="h-4 w-4" />} label="Sent">
              {delivered.length
                ? <>{delivered.length} email(s) sent through graph8 to your inbox ({String((delivered[0] as { to?: string }).to ?? "")}). Prospects not contacted.</>
                : mode === "live" ? <>{run.send.outbox.length} message(s) held on the live system; prospects not contacted.</> : <>{run.send.outbox.length} caught by the sandbox.</>}
            </Row>
          )}
          {run.reply?.replies[0] && (
            <Row icon={<span className="text-xs">↩</span>} label="Reply">
              <span className="text-foreground">Classified <b>{run.reply.replies[0].intent?.replace(/_/g, " ")}</b></span>
              {run.reply.replies[0].inbound && <span className="block text-muted">“{run.reply.replies[0].inbound.replace(/^\[simulated sandbox reply\]\s*/, "")}”</span>}
            </Row>
          )}
          {run.call?.calls[0] && (
            <Row icon={<Icon.phone className="h-4 w-4" />} label="Voice">
              {run.call.calls[0].outcome}
              {run.call.calls[0].rehearsal && <span className="block text-muted">{run.call.calls[0].rehearsal.summary}</span>}
            </Row>
          )}
          {run.deal && (
            <Row icon={<span className="text-xs font-semibold">$</span>} label="Deal">
              <b className="text-foreground">{run.deal.name}</b>{run.deal.amount ? ` · $${run.deal.amount.toLocaleString()}` : ""}
              <span className="block text-accent">Next: {run.deal.nextBestStep}</span>
            </Row>
          )}
        </dl>
      )}
    </Panel>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">{icon}</span>
      <div className="min-w-0"><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">{label}</dt><dd className="text-muted">{children}</dd></div>
    </div>
  );
}

export type { WorkPost };
