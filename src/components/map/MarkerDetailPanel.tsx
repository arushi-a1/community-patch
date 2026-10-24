"use client";
import { useState } from "react";
import Link from "next/link";
import { MapPin, X, Handshake, HelpingHand, ArrowRight } from "lucide-react";
import { MapMarker } from "@/app/api/map/route";
import { AvailabilityStatus } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RequestDialog } from "@/components/requests/RequestDialog";
import {
  AVAILABILITY_LABELS,
  availabilityTone,
  CATEGORY_LABELS,
} from "@/components/lib/labels";
import { useSession } from "@/components/providers/SessionProvider";

export function MarkerDetailPanel({
  marker,
  onClose,
}: {
  marker: MapMarker;
  onClose: () => void;
}) {
  const { actorId } = useSession();
  const [requesting, setRequesting] = useState(false);
  const resource = marker.resource;
  const isOwner = resource && actorId === resource.ownerId;
  const available = resource?.availabilityStatus === AvailabilityStatus.AVAILABLE;

  return (
    <div className="animate-[fadeIn_160ms_ease] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lift)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {marker.kind === "REQUEST" ? (
            <Badge tone="neutral">Needs help</Badge>
          ) : marker.kind === "ASSISTANCE" ? (
            <Badge tone="amber">Assistance offered</Badge>
          ) : (
            <Badge tone="accent">Resource</Badge>
          )}
          {marker.availabilityStatus && (
            <Badge tone={availabilityTone(marker.availabilityStatus)}>
              {AVAILABILITY_LABELS[marker.availabilityStatus]}
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{marker.title}</h3>
      <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{CATEGORY_LABELS[marker.category]}</p>

      {marker.point && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Near {marker.point.zone} · approximate location
        </p>
      )}

      {resource && (
        <>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)] line-clamp-3">{resource.description}</p>
          {(resource.compatibility.sourcePorts.length > 0 ||
            resource.compatibility.sinkPorts.length > 0) && (
            <p className="mt-2 font-mono text-[11px] text-[var(--color-ink-soft)]">
              {resource.compatibility.sourcePorts.join("/") || "—"} →{" "}
              {resource.compatibility.sinkPorts.join("/") || "—"}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/resources/${resource.id}`}>
              <Button variant="secondary" size="sm">
                View details <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            {!isOwner && (
              <Button size="sm" disabled={!available} onClick={() => setRequesting(true)}>
                <Handshake className="h-4 w-4" aria-hidden />
                {available ? "Request this" : "Unavailable"}
              </Button>
            )}
          </div>
        </>
      )}

      {marker.kind === "REQUEST" && (
        <div className="mt-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            A neighbor is looking for this. Open the request to offer help.
          </p>
          <Link
            href={marker.communityRequestId ? `/community/requests/${marker.communityRequestId}` : "/community"}
            className="mt-3 inline-block"
          >
            <Button size="sm" variant="secondary">
              <HelpingHand className="h-4 w-4" aria-hidden />
              Offer help
            </Button>
          </Link>
        </div>
      )}

      {resource && requesting && (
        <RequestDialog
          resource={resource}
          open={requesting}
          onClose={() => setRequesting(false)}
        />
      )}
    </div>
  );
}
