"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HandHeart, Sparkles, MapPin, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicCommunityRequest } from "@/domain/types";
import { api } from "@/components/lib/api";
import { UserLink } from "@/components/community/UserLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CATEGORY_LABELS, relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

type Filter = "ALL" | "OPEN" | "RESOLVED";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "All activity" },
  { id: "OPEN", label: "Needs help" },
  { id: "RESOLVED", label: "Recently resolved" },
];

export default function CommunityPage() {
  const [requests, setRequests] = useState<PublicCommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");

  const load = useCallback(async () => {
    try {
      const r = await api.listCommunityRequests();
      setRequests(r.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "OPEN") return requests.filter((r) => r.status === "OPEN" || r.status === "MATCHED");
    if (filter === "RESOLVED") return requests.filter((r) => r.status === "RESOLVED");
    return requests;
  }, [requests, filter]);

  const resolvedCount = requests.filter((r) => r.status === "RESOLVED").length;
  const openCount = requests.filter((r) => r.status === "OPEN" || r.status === "MATCHED").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Your community
          </h1>
          <p className="mt-1 text-[var(--color-ink-soft)]">
            Real neighbors asking for and offering help. Jump in where you can.
          </p>
        </div>
        <Link href="/community/requests/new">
          <Button>
            <HandHeart className="h-4 w-4" aria-hidden />
            Ask the community
          </Button>
        </Link>
      </div>

      {/* Impact strip (from real data) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ImpactStat label="Open needs right now" value={openCount} tone="amber" />
        <ImpactStat label="Resolved by neighbors" value={resolvedCount} tone="accent" />
        <ImpactStat label="Ways to help today" value={openCount} tone="sky" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 self-start rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]",
            )}
            aria-pressed={filter === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="h-8 w-8 text-[var(--color-brand)]" aria-hidden />
          <p className="font-medium text-[var(--color-ink)]">Nothing here yet</p>
          <p className="max-w-sm text-sm text-[var(--color-ink-soft)]">
            Be the first to ask for something — a neighbor nearby can help.
          </p>
          <Link href="/community/requests/new">
            <Button>Ask the community</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}

      <Card className="flex items-start gap-3 bg-[#f1efe8] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--color-brand)]" aria-hidden />
        <p className="text-sm text-[var(--color-ink-soft)]">
          This is a labeled demo community (<code>campus-demo</code>). Members and activity are sample
          data. Locations are approximate, and personal contact details are never shown publicly.
        </p>
      </Card>
    </div>
  );
}

function ImpactStat({ label, value, tone }: { label: string; value: number; tone: "accent" | "amber" | "sky" }) {
  // teal · deep teal · one warm coral spark
  const bg =
    tone === "accent" ? "var(--color-brand-weak)" : tone === "amber" ? "var(--color-accent-weak)" : "var(--color-brand-weak)";
  const fg =
    tone === "accent" ? "var(--color-brand)" : tone === "amber" ? "var(--color-accent)" : "var(--color-brand-deep)";
  return (
    <Card className="p-4" >
      <span className="font-display text-3xl font-semibold" style={{ color: fg }}>
        {value}
      </span>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{label}</p>
      <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: bg }} />
    </Card>
  );
}

function RequestCard({ request: r }: { request: PublicCommunityRequest }) {
  const resolved = r.status === "RESOLVED";
  return (
    <Card interactive className={cn("flex flex-col p-5", resolved && "opacity-80")}>
      <div className="mb-2 flex items-center gap-2">
        {resolved ? (
          <Badge tone="accent">Resolved 🎉</Badge>
        ) : r.status === "MATCHED" ? (
          <Badge tone="accent">Matched</Badge>
        ) : (
          <Badge tone="amber">Needs help</Badge>
        )}
        {r.urgency === "CRITICAL" && !resolved && <Badge tone="danger">Urgent</Badge>}
        <Badge tone="muted">{CATEGORY_LABELS[r.category]}</Badge>
      </div>

      <Link
        href={`/community/requests/${r.id}`}
        className="font-display text-lg font-semibold text-[var(--color-ink)] hover:underline"
      >
        {r.quantity > 1 ? `${r.quantity} × ` : ""}
        {r.title}
      </Link>
      {r.description && (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{r.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)]">
        <UserLink userId={r.requesterId} name={r.requesterDisplayName} withAvatar className="text-xs" />
        {r.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {r.location.zone}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {relativeTime(r.createdAt)}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-xs text-[var(--color-ink-soft)]">
          {r.offerCount > 0 ? `${r.offerCount} offer${r.offerCount === 1 ? "" : "s"}` : "No offers yet"}
        </span>
        <Link href={`/community/requests/${r.id}`}>
          <Button size="sm" variant={resolved ? "secondary" : "primary"}>
            {resolved ? "View" : "Offer help"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
