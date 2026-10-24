"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PlusCircle, Package, Pencil } from "lucide-react";
import { PublicResource, AvailabilityStatus } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { AVAILABILITY_LABELS } from "@/components/lib/labels";

const MANAGE_STATUSES: AvailabilityStatus[] = [
  AvailabilityStatus.AVAILABLE,
  AvailabilityStatus.UNAVAILABLE,
  AvailabilityStatus.ARCHIVED,
];

export default function MyResourcesPage() {
  const { actorId, loading: sessionLoading } = useSession();
  const toast = useToast();
  const [items, setItems] = useState<PublicResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!actorId) return;
    setLoading(true);
    try {
      const res = await api.listResources({ owner: actorId, includeArchived: "1", limit: "100" });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const changeAvailability = async (id: string, status: AvailabilityStatus) => {
    try {
      await api.updateResource(id, { availabilityStatus: status });
      toast.success("Availability updated.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">My Resources</h1>
          <p className="mt-1 text-[var(--color-ink-soft)]">Things you&apos;ve shared with the community.</p>
        </div>
        <Link href="/resources/new">
          <Button>
            <PlusCircle className="h-4 w-4" aria-hidden />
            List a resource
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-16 text-center">
          <Package className="h-10 w-10 text-[var(--color-ink-soft)]" aria-hidden />
          <h2 className="mt-3 font-semibold text-[var(--color-ink)]">You haven&apos;t listed anything yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">
            Share an item or offer a hand — someone nearby probably needs it today.
          </p>
          <Link href="/resources/new" className="mt-4">
            <Button>List your first resource</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              footer={
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Set availability for ${r.title}`}
                    value={MANAGE_STATUSES.includes(r.availabilityStatus) ? r.availabilityStatus : ""}
                    onChange={(e) => changeAvailability(r.id, e.target.value as AvailabilityStatus)}
                    className="h-9 flex-1 text-sm"
                  >
                    {!MANAGE_STATUSES.includes(r.availabilityStatus) && (
                      <option value="">{AVAILABILITY_LABELS[r.availabilityStatus]}</option>
                    )}
                    {MANAGE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {AVAILABILITY_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <Link href={`/resources/${r.id}/edit`} aria-label={`Edit ${r.title}`}>
                    <Button variant="secondary" size="sm">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </Link>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
