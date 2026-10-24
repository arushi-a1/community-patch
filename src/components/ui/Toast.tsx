"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "./cn";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const tones: Record<ToastTone, string> = {
  success: "border-[var(--color-accent)] text-[var(--color-brand)]",
  error: "border-[var(--color-danger)] text-[var(--color-danger)]",
  info: "border-[var(--color-line)] text-[var(--color-ink)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-control)] border-l-4 border bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-lift)]",
                tones[t.tone],
              )}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 text-sm text-[var(--color-ink)]">{t.message}</span>
              <button
                onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
