"use client";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:brightness-[0.93] active:brightness-90 shadow-[var(--shadow-soft)]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[var(--color-accent-weak)]",
  ghost: "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-accent-weak)]",
  danger: "bg-[var(--color-danger)] text-white hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium",
        "transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
        "focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
