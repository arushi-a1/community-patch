/**
 * GET /api/users/:id — a public community profile: display name, points,
 * badges, and resources they share. Privacy-conscious: no email/contact,
 * only public projections.
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { getUserPoints } from "@/services/pointsService";
import { toPublicResource } from "@/domain/projection";
import { AvailabilityStatus } from "@/domain/types";
import { json, guard, errorResponse } from "../../_lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();
    const repo = getRepository();

    const user = await repo.getUser(id);
    if (!user || user.communityId !== actor.communityId) {
      return errorResponse(404, "Member not found.");
    }

    const points = await getUserPoints(repo, id);

    // Their shared resources (non-archived), public projection.
    const page = await repo.queryResources({ communityId: actor.communityId, ownerId: id, limit: 100 });
    const resources = page.items
      .filter((r) => r.availabilityStatus !== AvailabilityStatus.ARCHIVED)
      .map((r) => toPublicResource(r, user.displayName));

    return json({
      profile: {
        id: user.id,
        displayName: user.displayName,
        homeZone: user.homeZone ?? null,
        memberSince: user.createdAt,
      },
      points: {
        balance: points.balance,
        contributionCount: points.contributionCount,
        badges: points.badges,
      },
      resources,
      isSelf: actor.userId === id,
    });
  });
}
