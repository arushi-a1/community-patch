/**
 * POST /api/community-requests/:id/offers — offer to fulfill an open request.
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { createOffer } from "@/services/communityRequestService";
import { rateLimit } from "@/services/rateLimit";
import { RATE_LIMITS } from "@/domain/config";
import { json, guard, parseBody, serviceErrorResponse, errorResponse } from "../../../_lib/http";
import { createOfferSchema } from "../../../_lib/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();

    const limit = rateLimit(`offer:${actor.userId}`, RATE_LIMITS.requestCreate);
    if (!limit.allowed) {
      return errorResponse(429, "Too many offers. Please slow down.", { retryAfterMs: limit.retryAfterMs });
    }

    const parsed = await parseBody(req, createOfferSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRepository();
    const result = await createOffer(repo, actor, id, parsed.data);
    if (!result.ok) return serviceErrorResponse(result.error);
    return json(result.value, 201);
  });
}
