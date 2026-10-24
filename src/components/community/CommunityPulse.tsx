import Link from "next/link";
import { HandHeart, MapPin, Clock, ArrowRight } from "lucide-react";
import { PublicCommunityRequest } from "@/domain/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, relativeTime } from "@/components/lib/labels";

/**
 * "Happening around your community" — a live strip of real open requests from
 * the data store. Server-rendered from actual seed/app state.
 */
export function CommunityPulse({
  requests,
  resolvedCount,
}: {
  requests: PublicCommunityRequest[];
  resolvedCount: number;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
            Happening around your community
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Neighbors asking for a hand right now
            {resolvedCount > 0 && ` · ${resolvedCount} already resolved`}.
          </p>
        </div>
        <Link href="/community" className="text-sm font-medium text-[var(--color-brand)] hover:underline">
          See all
        </Link>
      </div>

      {requests.length === 0 ? (
        <Card className="flex flex-col items-start gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-ink-soft)]">
            No open requests right now. Need something? Ask — a neighbor can help.
          </p>
          <Link href="/community/requests/new">
            <Button size="sm">
              <HandHeart className="h-4 w-4" aria-hidden />
              Ask the community
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id} interactive className="flex flex-col p-5">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={r.status === "MATCHED" ? "accent" : "amber"}>
                  {r.status === "MATCHED" ? "Matched" : "Needs help"}
                </Badge>
                {r.urgency === "CRITICAL" && <Badge tone="danger">Urgent</Badge>}
                <Badge tone="muted">{CATEGORY_LABELS[r.category]}</Badge>
              </div>
              <Link
                href={`/community/requests/${r.id}`}
                className="font-display text-lg font-semibold text-[var(--color-ink)] hover:underline"
              >
                {r.quantity > 1 ? `${r.quantity} × ` : ""}
                {r.title}
              </Link>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)]">
                <span>{r.requesterDisplayName}</span>
                {r.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {r.location.zone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> {relativeTime(r.createdAt)}
                </span>
              </div>
              <div className="mt-auto pt-4">
                <Link href={`/community/requests/${r.id}`}>
                  <Button size="sm" className="w-full">
                    <HandHeart className="h-4 w-4" aria-hidden />
                    Offer to help
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
