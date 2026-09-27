"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Pop-up notifications for what the desk is doing right now. Newest on top, at most 4,
// auto-dismiss (errors stay longer), announced to screen readers.
export type ToastKind = "info" | "success" | "warn" | "error";
export interface Toast { id: number; kind: ToastKind; title: string; body?: string }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++seq.current;
    setToasts((prev) => [{ id, kind, title, body }, ...prev].slice(0, 4));
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

const STYLE: Record<ToastKind, { bar: string; icon: string }> = {
  info: { bar: "bg-accent", icon: "●" },
  success: { bar: "bg-score", icon: "✓" },
  warn: { bar: "bg-warn", icon: "!" },
  error: { bar: "bg-danger", icon: "×" },
};

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-40 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const ms = toast.kind === "error" ? 9000 : toast.kind === "warn" ? 7000 : 4500;
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  const s = STYLE[toast.kind];
  return (
    <div role={toast.kind === "error" ? "alert" : "status"} className="pointer-events-auto flex overflow-hidden rounded-[12px] border border-border bg-surface shadow-warm">
      <div className={`w-1 shrink-0 ${s.bar}`} />
      <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${s.bar}`} aria-hidden>{s.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{toast.title}</div>
          {toast.body && <div className="mt-0.5 break-words text-xs text-muted">{toast.body}</div>}
        </div>
        <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="shrink-0 rounded px-1 text-muted hover:text-foreground">×</button>
      </div>
    </div>
  );
}
