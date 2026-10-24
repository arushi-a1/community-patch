import { cn } from "./cn";

type Tone = "neutral" | "accent" | "leaf" | "coral" | "amber" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)]",
  // All in the warm family — honey for positive, clay for neutral-accent.
  accent: "bg-[var(--color-leaf-weak)] text-[var(--color-brand)]",
  leaf: "bg-[var(--color-leaf-weak)] text-[var(--color-brand)]",
  amber: "bg-[var(--color-leaf-weak)] text-[var(--color-brand)]",
  coral: "bg-[var(--color-accent-weak)] text-[var(--color-accent)]",
  danger: "bg-[var(--color-danger-weak)] text-[var(--color-danger)]",
  muted: "bg-[#ece0ce] text-[var(--color-ink-soft)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
