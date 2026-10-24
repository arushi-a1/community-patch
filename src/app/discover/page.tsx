"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, PackageOpen, ArrowRight } from "lucide-react";
import { PublicResource, AvailabilityStatus } from "@/domain/types";
import { api } from "@/components/lib/api";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { CATEGORY_LABELS } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

export default function DiscoverPage() {
  const [items, setItems] = useState<PublicResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [availability, setAvailability] = useState<string>("");
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listResources({
        q: q || undefined,
        category: category || undefined,
        availability: availability || undefined,
        limit: "24",
      });
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [q, category, availability]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const clear = () => {
    setQ("");
    setCategory("");
    setAvailability("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Discover</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Browse what the community has to share.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-soft)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for an adapter, calculator, umbrella…"
            className="pl-9"
            aria-label="Search resources"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={availability} onChange={(e) => setAvailability(e.target.value)} aria-label="Filter by availability">
          <option value="">Any availability</option>
          <option value={AvailabilityStatus.AVAILABLE}>Available now</option>
          <option value={AvailabilityStatus.RESERVED}>Reserved</option>
          <option value={AvailabilityStatus.BORROWED}>Borrowed</option>
        </Select>
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {loading ? "Loading…" : `${total} resource${total === 1 ? "" : "s"}`}
        </span>
        {(q || category || availability) && (
          <button onClick={clear} className="font-medium text-[var(--color-brand)] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Grid / states */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState onClear={clear} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              footer={
                <Link href={`/resources/${r.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    View details
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-16 text-center")}>
      <PackageOpen className="h-10 w-10 text-[var(--color-ink-soft)]" aria-hidden />
      <h2 className="mt-3 font-semibold text-[var(--color-ink)]">Nothing matches those filters</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">
        Try broadening your search, or describe the problem and let PATCH find a fix for you.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={onClear}>
          Clear filters
        </Button>
        <Link href="/fix">
          <Button>Request a fix</Button>
        </Link>
      </div>
    </div>
  );
}
