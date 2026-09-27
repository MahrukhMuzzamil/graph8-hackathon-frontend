"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// A short guided tour: dims the page, rings one element at a time ([data-tour="…"]) and explains
// it. Opens by itself on the first visit; the "Tour" button reopens it.
export interface TourStep { target: string; title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  { target: "nav", title: "Welcome to Revenue Desk", body: "It turns weekend newsletter clicks and site visits into ready-to-approve sales opportunities on graph8. Today, Approvals and Companies are where the work happens." },
  { target: "run-weekend", title: "1 · Run the weekend", body: "One click checks every company that engaged. Personal emails and students are dropped before any paid lookup. Or type one domain and press Run one." },
  { target: "kpis", title: "2 · The Monday brief", body: "Clicks → companies → decision-makers → drafted emails → pipeline, with the time it took. The same brief is posted to your graph8 Work channel." },
  { target: "nav-approvals", title: "3 · Approve like an inbox", body: "Everything waiting for a human, one at a time. Edit the drafts, then Approve or Reject. Keyboard: J/K to move, A to approve, R to reject. Or reply 'approve CODE' in graph8 Work from your phone." },
  { target: "nav-companies", title: "4 · Every company, explained", body: "Open any company for its fit score and the reasons, the buying committee from graph8's 700M contacts, graph8 Radar competitor signals, the AI emails, and the deal." },
  { target: "nav-activity", title: "5 · Watch the agent work", body: "A live feed of every step on graph8: scoring, CRM writes, AI drafts, approvals, emails sent, calls placed, deals created." },
  { target: "nav-learning", title: "6 · It learns from you", body: "Industries you keep rejecting score lower next weekend; drafts you keep shortening get shorter." },
  { target: "nav-settings", title: "7 · Connected to graph8", body: "API and SDK, CRM deals, your mailbox, the voice agent, graph8 Work and Radar. Prospects are never contacted: emails go to your own inbox and calls to your own phone." },
];

const PAD = 8;

export default function Tour({ open, onClose, steps = TOUR_STEPS }: { open: boolean; onClose: () => void; steps?: TourStep[] }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = step ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(measure, 350);
    return () => clearTimeout(t);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); window.removeEventListener("keydown", onKey); };
  }, [open, measure, onClose, steps.length]);

  if (!open || !step) return null;

  const last = i === steps.length - 1;
  const finish = () => { setI(0); onClose(); };
  // Tooltip below the target when there's room, otherwise above; centred when the target is missing.
  const below = rect ? rect.bottom + 220 < window.innerHeight : true;
  const style: React.CSSProperties = rect
    ? { top: below ? rect.bottom + PAD + 8 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + PAD + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - 360)) }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div className="pointer-events-none fixed rounded-[12px] ring-2 ring-cta transition-all duration-300"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(43,38,32,0.55)" }} />
      ) : <div className="fixed inset-0 bg-[#2B2620]/60" />}
      <div className="mc-card fixed w-[min(340px,calc(100vw-32px))] p-4" style={style}>
        <div className="mb-1 text-xs text-muted-soft">{i + 1} / {steps.length}</div>
        <div className="mb-1 font-semibold text-foreground">{step.title}</div>
        <p className="mb-4 text-sm text-muted">{step.body}</p>
        <div className="flex items-center gap-2">
          <button onClick={finish} className="text-sm text-muted hover:text-foreground">Skip</button>
          <div className="ml-auto flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">Back</button>}
            <button onClick={() => (last ? finish() : setI(i + 1))} className="rounded-lg bg-cta px-3 py-1.5 text-sm font-medium text-white hover:bg-cta-hover">{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
