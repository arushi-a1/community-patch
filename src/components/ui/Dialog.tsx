"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the panel for keyboard users.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-[var(--color-ink)]/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-lift)] focus:outline-none"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export { Button as DialogButton };
