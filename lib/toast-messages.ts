import type { PipelineEvent } from "@/lib/types";
import type { ToastKind } from "@/components/Toasts";

// Plain-language pop-up for one pipeline event, or null for events that don't deserve one.
type D = Record<string, unknown> | undefined;
const n = (x: unknown) => (Array.isArray(x) ? x.length : 0);

export function toastFor(e: PipelineEvent): { kind: ToastKind; title: string; body?: string } | null {
  const d = e.data as D;
  const company = ((d?.company as D)?.name as string | undefined) ?? "";
  if (e.status === "failed") return { kind: "error", title: `${label(e.step)} failed`, body: shorten(e.error) };

  switch (`${e.step}:${e.status}`) {
    case "run:running": {
      const input = d?.input as { domain?: string; event?: { domain?: string } } | undefined;
      const dom = input?.domain ?? input?.event?.domain;
      return { kind: "info", title: dom ? `Working on ${dom}` : "Run started", body: "Finding this weekend's engagement…" };
    }
    case "engagement:done": return { kind: "info", title: `Found ${n(d?.signals)} weekend signal(s)`, body: "Scoring the company on graph8…" };
    case "qualify:done": return { kind: "success", title: `${company}: score ${d?.score}, good fit`, body: (d?.competitor as D)?.name ? `Uses competitor ${(d?.competitor as D)?.name} (graph8 Radar)` : "Finding the decision-makers…" };
    case "qualify:skipped": return company ? { kind: "warn", title: `${company}: skipped`, body: String(d?.reason ?? `score ${d?.score}, not a fit`) } : null;
    case "committee:done": return { kind: "info", title: `Found ${n(d?.members)} decision-maker(s)`, body: "Saving them to the graph8 CRM…" };
    case "crm:done": return { kind: "success", title: "Saved to the graph8 CRM", body: `${d?.created ?? 0} contact(s) added to a new list. graph8 AI is writing the emails…` };
    case "outreach:done": return { kind: "success", title: `graph8 AI drafted ${n(d?.drafts)} message(s)`, body: "Waiting for your approval next." };
    case "approval:awaiting_approval": return { kind: "warn", title: "Approval needed", body: d?.code ? `Review the drafts here, or reply "approve ${d.code}" in graph8 Work.` : "Review the drafts, then Approve or Reject." };
    case "approval:done": return { kind: "success", title: d?.via === "graph8 Work" ? "Approved in graph8 Work" : "Approved", body: n(d?.drafts) && d?.edited ? `${d.edited} edited draft(s) will be used.` : "Sending…" };
    case "approval:skipped": return { kind: "warn", title: "Rejected: nothing sent", body: String(d?.reason ?? "") || undefined };
    case "send:done": {
      const sent = (d?.sent as { status?: string }[] | undefined) ?? [];
      const held = sent.some((s) => /held|dry run/.test(s.status ?? ""));
      return { kind: "success", title: held ? "Emails held: prospects not contacted" : `Sent ${sent.length} message(s)`, body: held ? "A copy of each approved email is in graph8 Work." : undefined };
    }
    case "reply:done": {
      const r = (d?.replies as { intent?: string }[] | undefined)?.[0];
      return r ? { kind: "info", title: `Reply read: ${r.intent?.replace(/_/g, " ") ?? "classified"}`, body: "Response drafted by graph8 AI." } : null;
    }
    case "call:done": {
      const c = (d?.calls as { outcome?: string }[] | undefined)?.[0];
      return c ? { kind: "info", title: "Voice step done", body: c.outcome } : null;
    }
    case "call:skipped": return { kind: "info", title: "Voice call skipped", body: String(d?.reason ?? "") || undefined };
    case "deal:done": return { kind: "success", title: "Deal created in graph8", body: `${d?.name ?? ""}${d?.nextBestStep ? ` · Next: ${d.nextBestStep}` : ""}` };
    case "deal:skipped": return { kind: "info", title: "No deal created", body: String(d?.reason ?? "") || undefined };
    case "work:done": return { kind: "info", title: (d?.kind === "brief") ? "Monday brief posted to graph8 Work" : "Posted to graph8 Work", body: d?.channel ? `#${d.channel}` : undefined };
    case "run:done": return { kind: "success", title: "All 10 steps finished" };
    default: return null;
  }
}

const LABELS: Record<string, string> = {
  engagement: "Engagement", qualify: "Qualify", committee: "Buying committee", crm: "Save to CRM", outreach: "Draft outreach",
  approval: "Approval", send: "Send", reply: "Reply handling", call: "Voice call", deal: "Deal", run: "Run", work: "graph8 Work",
};
const label = (s: string) => LABELS[s] ?? s;
const shorten = (s?: string) => (s && s.length > 160 ? `${s.slice(0, 159)}…` : s);
