/**
 * GET  /api/conversations  — the current user's conversations.
 * POST /api/conversations  — open (or fetch) a conversation for a context.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { listConversations, openConversation } from "@/services/messagingService";
import { ConversationContextType } from "@/domain/types";
import { json, guard, parseBody, serviceErrorResponse } from "../_lib/http";

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const items = await listConversations(repo, actor);
    return json({ items });
  });
}

const openSchema = z.object({
  contextType: z.nativeEnum(ConversationContextType),
  contextId: z.string().min(1),
  /** Required when the requester opens a conversation with a specific helper. */
  counterpartId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const parsed = await parseBody(req, openSchema);
    if (!parsed.ok) return parsed.response;
    const repo = getRepository();
    const result = await openConversation(
      repo,
      actor,
      parsed.data.contextType,
      parsed.data.contextId,
      parsed.data.counterpartId,
    );
    if (!result.ok) return serviceErrorResponse(result.error);
    return json(result.value, 201);
  });
}
