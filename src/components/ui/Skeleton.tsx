import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("patch-skeleton rounded-md", className)} aria-hidden />;
}

export function ResourceCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <Skeleton className="mb-3 h-28 w-full" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-2 h-3 w-1/2" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}
