"use client";
import { forwardRef } from "react";
import { cn } from "./cn";

const base =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/70 focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-1";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(base, "h-10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[88px] resize-y", className)} {...rest} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(base, "h-10 pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--color-ink-soft)]">{hint}</p>}
    </div>
  );
}
