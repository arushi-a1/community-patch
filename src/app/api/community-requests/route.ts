/**
 * GET  /api/community-requests  — list open community requests (feed + map).
 * POST /api/community-requests  — post an open "I need X" request.
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import {
  createCommunityRequest,
  toPublicCommunityRequest,
} from "@/services/communityRequestService";
import { rateLimit } from "@/services/rateLimit";
import { RATE_LIMITS } from "@/domain/config";
import { json, guard, parseBody, serviceErrorResponse, errorResponse } from "../_lib/http";
import { createCommunityRequestSchema } from "../_lib/schemas";

export async function GET(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const all = await repo.listCommunityRequests(actor.communityId);

    const statusFilter = req.nextUrl.searchParams.get("status");
    const filtered = statusFilter ? all.filter((r) => r.status === statusFilter) : all;

    const items = await Promise.all(filtered.map((r) => toPublicCommunityRequest(repo, r)));
    return json({ items });
  });
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();

    const limit = rateLimit(`creq:${actor.userId}`, RATE_LIMITS.requestCreate);
    if (!limit.allowed) {
      return errorResponse(429, "Too many requests. Please slow down.", { retryAfterMs: limit.retryAfterMs });
    }

    const parsed = await parseBody(req, createCommunityRequestSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRepository();
    const result = await createCommunityRequest(repo, actor, parsed.data);
    if (!result.ok) return serviceErrorResponse(result.error);
    const pub = await toPublicCommunityRequest(repo, result.value);
    return json(pub, 201);
  });
}
