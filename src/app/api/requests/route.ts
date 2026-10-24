/**
 * GET  /api/requests   — the current actor's requests (outgoing + incoming).
 * POST /api/requests   — create a borrowing/assistance request (rate-limited).
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { createRequest } from "@/services/requestService";
import { rateLimit } from "@/services/rateLimit";
import { RATE_LIMITS } from "@/domain/config";
import { json, guard, parseBody, serviceErrorResponse, errorResponse } from "../_lib/http";
import { createRequestSchema } from "../_lib/schemas";

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const [outgoing, incoming] = await Promise.all([
      repo.listRequestsByRequester(actor.userId),
      repo.listRequestsByOwner(actor.userId),
    ]);
    return json({ outgoing, incoming });
  });
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();

    const limit = rateLimit(`request:${actor.userId}`, RATE_LIMITS.requestCreate);
    if (!limit.allowed) {
      return errorResponse(429, "Too many requests. Please slow down.", {
        retryAfterMs: limit.retryAfterMs,
      });
    }

    const parsed = await parseBody(req, createRequestSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRepository();
    const result = await createRequest(repo, actor, parsed.data);
    if (!result.ok) return serviceErrorResponse(result.error);
    return json(result.value, 201);
  });
}
