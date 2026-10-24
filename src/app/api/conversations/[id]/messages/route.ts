/**
 * POST /api/conversations/:id/messages — send a message (participant-only).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { sendMessage } from "@/services/messagingService";
import { rateLimit } from "@/services/rateLimit";
import { json, guard, parseBody, serviceErrorResponse, errorResponse } from "../../../_lib/http";

const sendSchema = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();

    const limit = rateLimit(`msg:${actor.userId}`, { tokens: 30, windowMs: 60_000 });
    if (!limit.allowed) {
      return errorResponse(429, "Slow down a moment.", { retryAfterMs: limit.retryAfterMs });
    }

    const parsed = await parseBody(req, sendSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRepository();
    const result = await sendMessage(repo, actor, id, parsed.data.body);
    if (!result.ok) return serviceErrorResponse(result.error);
    return json(result.value, 201);
  });
}
