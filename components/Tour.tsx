"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// A short guided tour: dims the page, rings one element at a time ([data-tour="…"]) and explains
// it. Opens by itself on the first visit; the "Tour" button reopens it.
export interface TourStep { target: string; title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  { target: "mode", title: "Welcome to the Revenue Desk", body: "It turns weekend newsletter clicks and site visits into ready-to-approve sales opportunities. This badge shows where it runs: live graph8 data with sends held, or demo data." },
  { target: "run-weekend", title: "1 · Run the weekend", body: "One click processes every company that engaged. Personal emails and students are dropped before any paid lookup. \"Run one\" does a single domain." },
  { target: "weekend", title: "2 · The Monday brief", body: "The funnel from clicks to emails ready, and every company with its score. The same brief is posted to your graph8 Work channel." },
  { target: "pipeline", title: "3 · Watch the agent work", body: "Ten steps, each on graph8: engagement, scoring, buying committee, CRM, AI outreach, your approval, send, reply, call, deal." },
  { target: "score", title: "4 · Why this score", body: "Every score comes with its reasons: size, industry, hiring, intent, what their team read. If they use a Radar competitor, you'll see it here too." },
  { target: "committee", title: "5 · The real decision-makers", body: "The reader is often junior. The desk finds the CTO or VP from graph8's 700M-person database and tags who signs and who champions." },
  { target: "drafts", title: "6 · You approve, the desk sends", body: "graph8's AI writes each email around the topic their team read. Edit anything, then Approve or Reject, here or by replying in graph8 Work." },
  { target: "learning", title: "7 · It learns from you", body: "Every approve, reject and edit teaches the desk. Companies you keep rejecting score lower next weekend; drafts you keep shortening get shorter." },
  { target: "deal", title: "8 · A real opportunity", body: "After approval: the deal is created in the graph8 CRM with a suggested next step. That's the whole Monday, in two minutes." },
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
        <div className="pointer-events-none fixed rounded-xl ring-2 ring-sky-400 transition-all duration-300"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(9,9,11,0.6)" }} />
      ) : <div className="fixed inset-0 bg-zinc-950/60" />}
      <div className="fixed w-[min(340px,calc(100vw-32px))] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" style={style}>
        <div className="mb-1 text-xs text-zinc-400">{i + 1} / {steps.length}</div>
        <div className="mb-1 font-semibold">{step.title}</div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
        <div className="flex items-center gap-2">
          <button onClick={finish} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Skip</button>
          <div className="ml-auto flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Back</button>}
            <button onClick={() => (last ? finish() : setI(i + 1))} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
