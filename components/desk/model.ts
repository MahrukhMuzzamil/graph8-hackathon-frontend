import type { DraftMessage, StepName, StepStatus } from "@/lib/types";
import type { Tone } from "./ui";

export type Mode = "mock" | "sandbox" | "live" | "offline";
export type View = "today" | "approvals" | "companies" | "account" | "activity" | "learning" | "settings";

export interface ApprovalRequest { approvalId: string; code?: string; summary: string; drafts: DraftMessage[] }
/** A graph8 Work post (Monday brief or approval request). */
export interface WorkPost { kind: "brief" | "approval"; status: StepStatus; text: string; channel?: string; code?: string; reason?: string; error?: string }
export interface Learning { decisions: number; approved: number; rejected: number; edited: number; lessons: string[] }
export interface BatchInfo { batchId: string; totalClicks: number; freemail: number; nonBuyer?: number; domains: string[]; runIds: string[]; demo?: boolean; startedAt?: string }
export interface RunSummary {
  runId: string; domain?: string; company?: string; score?: number; qualified?: boolean;
  people: number; drafts: number; sent: number; deal?: string; status: string; approvalId?: string; currentStep?: string;
}
export interface BatchState { batch?: BatchInfo; runs: RunSummary[]; brief?: WorkPost; settledAt?: string; serverNow?: string }
export interface Settings {
  mode: string; apiKeySet: boolean; baseUrl: string; qualifyThreshold: number; dealOwnerSet: boolean; dealAmount?: number;
  voiceAgentSet: boolean; callFrom: string; callTo: string; inbox: string; workChannel: string; sellerDomain: string; hiringKeywords: string[];
}

export const STEP_LABEL: Record<StepName, string> = {
  engagement: "Engagement", qualify: "Qualify", committee: "Buying committee", crm: "Save to CRM", outreach: "Draft outreach",
  approval: "Approval", send: "Send", reply: "Reply", call: "Voice call", deal: "Deal",
};

export const STEP_TONE: Record<StepStatus, Tone> = {
  pending: "neutral", running: "accent", done: "good", failed: "bad", skipped: "neutral", awaiting_approval: "warn",
};

export function runStatus(status: string): { label: string; tone: Tone; pulse?: boolean } {
  switch (status) {
    case "running": return { label: "Working", tone: "accent", pulse: true };
    case "awaiting_approval": return { label: "Needs approval", tone: "warn" };
    case "done": return { label: "Done", tone: "good" };
    case "filtered": return { label: "Not a fit", tone: "neutral" };
    case "rejected": return { label: "Rejected", tone: "neutral" };
    case "failed": return { label: "Failed", tone: "bad" };
    default: return { label: "Stopped", tone: "neutral" };
  }
}

/** Deal value used for pipeline estimates; matches the backend's DEAL_AMOUNT default. */
export const DEAL_VALUE = 25_000;

/** Who sales should call first. Only good fits get a label. */
export function priorityOf(r: { qualified?: boolean; score?: number }): { label: "Hot" | "Warm" | "Cool"; tone: Tone } | null {
  if (!r.qualified || r.score === undefined) return null;
  if (r.score >= 70) return { label: "Hot", tone: "bad" };
  if (r.score >= 45) return { label: "Warm", tone: "warn" };
  return { label: "Cool", tone: "neutral" };
}

/** The Monday list as a spreadsheet: the one sales will actually use. */
export function exportCsv(runs: RunSummary[]) {
  const rows = [...runs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const head = ["Company", "Domain", "Score", "Priority", "Decision-makers", "Emails drafted", "Status", "Deal"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head, ...rows.map((r) => [r.company ?? r.domain, r.domain, r.score ?? "", priorityOf(r)?.label ?? (r.qualified === false ? "Not a fit" : ""), r.people, r.drafts, runStatus(r.status).label, r.deal ?? ""])]
    .map((line) => line.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `monday-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export const reasonOf = (data: unknown) => (data as { reason?: string } | undefined)?.reason;
