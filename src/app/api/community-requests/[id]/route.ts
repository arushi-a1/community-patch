/**
 * GET /api/community-requests/:id — detail with offers (requester sees helper
 * names; others see a privacy-conscious view).
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { toPublicCommunityRequest } from "@/services/communityRequestService";
import { OfferStatus } from "@/domain/types";
import { USER_DISPLAY } from "@/seed/data";
import { json, guard, errorResponse } from "../../_lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();
    const repo = getRepository();

    const cr = await repo.getCommunityRequest(id);
    if (!cr) return errorResponse(404, "Request not found.");

    const pub = await toPublicCommunityRequest(repo, cr);
    const offers = await repo.listOffersByRequest(id);
    const isRequester = actor.userId === cr.requesterId;

    // Requester sees all offers with helper names; others see only their own
    // offer (so they can tell they've offered) plus anonymized counts.
    const visibleOffers = offers
      .filter((o) => o.status !== OfferStatus.WITHDRAWN)
      .filter((o) => isRequester || o.helperId === actor.userId)
      .map((o) => ({
        id: o.id,
        helperId: o.helperId,
        helperName: USER_DISPLAY[o.helperId] ?? "A member",
        message: o.message,
        status: o.status,
        resourceId: o.resourceId,
        createdAt: o.createdAt,
        mine: o.helperId === actor.userId,
      }));

    return json({ request: pub, offers: visibleOffers, isRequester });
  });
}
