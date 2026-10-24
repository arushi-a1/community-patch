"use client";
import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { PublicResource, ResourceType } from "@/domain/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  AVAILABILITY_LABELS,
  availabilityTone,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  categoryColor,
  HELP_ICON,
} from "@/components/lib/labels";

export function ResourceCard({
  resource,
  walkMinutes,
  footer,
}: {
  resource: PublicResource;
  walkMinutes?: number;
  footer?: React.ReactNode;
}) {
  const Icon =
    resource.resourceType === ResourceType.ASSISTANCE ? HELP_ICON : CATEGORY_ICONS[resource.category];
  const compatChip =
    resource.compatibility.sourcePorts.length || resource.compatibility.sinkPorts.length
      ? `${resource.compatibility.sourcePorts.join("/") || "—"} → ${resource.compatibility.sinkPorts.join("/") || "—"}`
      : null;

  return (
    <Card interactive className="flex flex-col overflow-hidden">
      <div
        className="relative flex h-28 items-center justify-center"
        style={{ background: categoryColor(resource.category) }}
      >
        <Icon className="h-9 w-9 text-[var(--color-brand)]" aria-hidden />
        <div className="absolute left-3 top-3">
          <Badge tone={availabilityTone(resource.availabilityStatus)}>
            {AVAILABILITY_LABELS[resource.availabilityStatus]}
          </Badge>
        </div>
        {resource.resourceType === ResourceType.ASSISTANCE && (
          <div className="absolute right-3 top-3">
            <Badge tone="amber">Assistance</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/resources/${resource.id}`} className="font-semibold text-[var(--color-ink)] hover:underline">
            {resource.title}
          </Link>
        </div>
        <p className="line-clamp-2 text-sm text-[var(--color-ink-soft)]">{resource.description}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-soft)]">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {resource.location.zone}
          </span>
          {typeof walkMinutes === "number" && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />~{walkMinutes} min walk
            </span>
          )}
          <span>{CATEGORY_LABELS[resource.category]}</span>
        </div>

        {compatChip && (
          <div className="mt-1">
            <Badge tone="neutral" className="font-mono text-[11px]">
              {compatChip}
            </Badge>
          </div>
        )}
        {resource.compatibility.notes && (
          <p className="text-xs text-[var(--color-amber)]">{resource.compatibility.notes}</p>
        )}

        <div className="mt-auto pt-3">{footer}</div>
      </div>
    </Card>
  );
}
