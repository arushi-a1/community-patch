import { cn } from "./cn";

export function Card({
  className,
  children,
  as: Tag = "div",
  interactive,
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)]",
        "shadow-[var(--shadow-soft)]",
        interactive &&
          "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand)]/30 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
