/**
 * GET /api/map — map markers for the community.
 *
 * Returns resources (available/reserved) and OPEN help requests that have an
 * associated resource location, each with a privacy-safe APPROXIMATE point.
 * Never exposes exact coordinates or pickup details. Resources without
 * coordinates are returned with `point: null` so the UI can list them without
 * inventing a position.
 */
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { toPublicResource } from "@/domain/projection";
import { approxPoint } from "@/domain/geo";
import {
  AvailabilityStatus,
  Category,
  CommunityRequestStatus,
  PublicResource,
  ResourceType,
} from "@/domain/types";
import { USER_DISPLAY } from "@/seed/data";
import { json, guard } from "../_lib/http";

export type MarkerKind = "RESOURCE" | "ASSISTANCE" | "REQUEST";

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  title: string;
  category: Category;
  availabilityStatus?: AvailabilityStatus;
  point: { lat: number; lng: number; approximate: true; zone: string; label: string } | null;
  resource?: PublicResource;
  /** For REQUEST markers: the community request id (so the UI can deep-link). */
  communityRequestId?: string;
}

const MAP_VISIBLE_STATUSES = new Set<AvailabilityStatus>([
  AvailabilityStatus.AVAILABLE,
  AvailabilityStatus.RESERVED,
]);

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();

    // Single-pass reads (no per-user N+1).
    const [page, users, communityRequests] = await Promise.all([
      repo.queryResources({ communityId: actor.communityId, limit: 500 }),
      repo.listUsers(actor.communityId),
      repo.listCommunityRequests(actor.communityId),
    ]);
    const nameOf = new Map(users.map((u) => [u.id, u.displayName]));
    const displayName = (id: string) => USER_DISPLAY[id] ?? nameOf.get(id) ?? "A member";

    const markers: MapMarker[] = [];

    for (const r of page.items) {
      if (!MAP_VISIBLE_STATUSES.has(r.availabilityStatus)) continue;
      markers.push({
        id: r.id,
        kind: r.resourceType === ResourceType.ASSISTANCE ? "ASSISTANCE" : "RESOURCE",
        title: r.title,
        category: r.category,
        availabilityStatus: r.availabilityStatus,
        point: approxPoint(r.id, r.location),
        resource: toPublicResource(r, displayName(r.ownerId)),
      });
    }

    // Open community help requests (the "needs help" pins) — anonymized.
    for (const cr of communityRequests) {
      if (cr.status !== CommunityRequestStatus.OPEN && cr.status !== CommunityRequestStatus.MATCHED) continue;
      if (!cr.location) continue;
      markers.push({
        id: `creq-marker-${cr.id}`,
        kind: "REQUEST",
        title: `Needs: ${cr.title}`,
        category: cr.category,
        point: approxPoint(cr.id, cr.location),
        communityRequestId: cr.id,
      });
    }

    return json({ markers });
  });
}
