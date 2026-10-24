import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, ShieldCheck, Tag } from "lucide-react";
import { getRepository } from "@/services/container";
import { toPublicResource } from "@/domain/projection";
import { ResourceType } from "@/domain/types";
import { USER_DISPLAY } from "@/seed/data";
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
import { ResourceDetailActions } from "@/components/resources/ResourceDetailActions";
import { UserLink } from "@/components/community/UserLink";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = getRepository();
  const raw = await repo.getResource(id);
  if (!raw) notFound();

  const resource = toPublicResource(raw, USER_DISPLAY[raw.ownerId] ?? "A member");
  const Icon = resource.resourceType === ResourceType.ASSISTANCE ? HELP_ICON : CATEGORY_ICONS[resource.category];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/discover" className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Discover
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div
            className="flex h-48 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-line)]"
            style={{ background: categoryColor(resource.category) }}
          >
            <Icon className="h-16 w-16 text-[var(--color-brand)]" aria-hidden />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={availabilityTone(resource.availabilityStatus)}>
                {AVAILABILITY_LABELS[resource.availabilityStatus]}
              </Badge>
              <Badge tone="neutral">{CATEGORY_LABELS[resource.category]}</Badge>
              {resource.resourceType === ResourceType.ASSISTANCE && <Badge tone="amber">Assistance</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
              {resource.title}
            </h1>
            <p className="mt-2 text-[var(--color-ink-soft)]">{resource.description}</p>
          </div>

          {resource.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--color-ink-soft)]" aria-hidden />
              {resource.tags.map((t) => (
                <Badge key={t} tone="muted">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {resource.location.label}
                <span className="block text-xs">Zone: {resource.location.zone}</span>
              </span>
            </div>

            {(resource.compatibility.sourcePorts.length > 0 ||
              resource.compatibility.sinkPorts.length > 0) && (
              <div className="text-sm">
                <p className="font-medium text-[var(--color-ink)]">Compatibility</p>
                <p className="mt-1 font-mono text-xs text-[var(--color-ink-soft)]">
                  {resource.compatibility.sourcePorts.join("/") || "—"} →{" "}
                  {resource.compatibility.sinkPorts.join("/") || "—"}
                </p>
                {resource.compatibility.notes && (
                  <p className="mt-1 text-xs text-[var(--color-amber)]">{resource.compatibility.notes}</p>
                )}
              </div>
            )}

            {resource.lendingRules && (
              <div className="text-sm">
                <p className="font-medium text-[var(--color-ink)]">Lending rules</p>
                <p className="mt-1 text-[var(--color-ink-soft)]">{resource.lendingRules}</p>
              </div>
            )}

            <div className="text-sm">
              <p className="font-medium text-[var(--color-ink)]">Shared by</p>
              <div className="mt-1.5">
                <UserLink userId={resource.ownerId} name={resource.ownerDisplayName} withAvatar />
              </div>
            </div>

            <p className="inline-flex items-start gap-2 rounded-[var(--radius-control)] bg-[#f1efe8] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Pickup details are shared only after the owner accepts your request.
            </p>

            <ResourceDetailActions resource={resource} />
          </Card>
        </div>
      </div>
    </div>
  );
}
