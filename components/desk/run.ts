import {
  STEP_NAMES, type CallOutput, type CommitteeOutput, type CompetitorIntel, type DealOutput, type DraftMessage, type EngagementOutput,
  type OutreachOutput, type PipelineEvent, type QualifyOutput, type ReplyOutput, type SendOutput, type StepName, type StepStatus,
} from "@/lib/types";
import type { ApprovalRequest, WorkPost } from "./model";

export interface StepState { status: StepStatus; data: unknown; error?: string }

/** Everything the pages need about one company's run, folded from its event stream. */
export interface RunData {
  steps: Record<StepName, StepState>;
  approval?: ApprovalRequest; awaiting?: ApprovalRequest; work?: WorkPost;
  engagement?: EngagementOutput; qualify?: QualifyOutput; committee?: CommitteeOutput; outreach?: OutreachOutput;
  drafts: DraftMessage[]; competitors?: CompetitorIntel[];
  send?: SendOutput; reply?: ReplyOutput; call?: CallOutput; deal?: DealOutput;
  runError?: string; finished: boolean; failed: boolean; events: PipelineEvent[];
}

export function deriveRun(events: PipelineEvent[]): RunData {
  const steps = Object.fromEntries(STEP_NAMES.map((s) => [s, { status: "pending" as StepStatus, data: undefined as unknown }])) as Record<StepName, StepState>;
  let approval: ApprovalRequest | undefined;
  let work: WorkPost | undefined;
  for (const e of events) {
    if (e.step === "run") { if (e.error) steps.engagement.error = e.error; continue; }
    if (e.step === "work") { work = { ...(e.data as WorkPost), status: e.status, error: e.error }; continue; }
    if (e.step === "webhook" || e.step === "batch") continue;
    steps[e.step] = { status: e.status, data: e.data ?? steps[e.step].data, error: e.error };
    if (e.status === "awaiting_approval") approval = e.data as ApprovalRequest;
  }
  const out = <T,>(s: StepName) => (steps[s].status === "done" ? (steps[s].data as T) : undefined);
  const outreach = out<OutreachOutput>("outreach");
  const qualifyData = steps.qualify.data as QualifyOutput | undefined;
  return {
    steps, approval, work,
    awaiting: approval && steps.approval.status === "awaiting_approval" ? approval : undefined,
    engagement: out<EngagementOutput>("engagement"),
    qualify: qualifyData?.company ? qualifyData : undefined,
    committee: out<CommitteeOutput>("committee"),
    outreach,
    drafts: out<{ drafts?: DraftMessage[] }>("approval")?.drafts ?? outreach?.drafts ?? [],
    competitors: outreach?.competitors?.length ? outreach.competitors : undefined,
    send: out<SendOutput>("send"), reply: out<ReplyOutput>("reply"), call: out<CallOutput>("call"), deal: out<DealOutput>("deal"),
    runError: events.find((e) => e.step === "run" && e.error)?.error,
    finished: events.some((e) => e.step === "run" && e.status !== "running"),
    failed: STEP_NAMES.some((s) => steps[s].status === "failed"),
    events,
  };
}
