/**
 * Shared handler factory for request action endpoints (accept/decline/cancel/complete).
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { actOnRequest } from "@/services/requestService";
import { RequestAction } from "@/domain/lifecycle";
import { json, guard, serviceErrorResponse } from "../../_lib/http";

export function makeActionHandler(action: RequestAction) {
  return (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    guard(async () => {
      const { id } = await params;
      const actor = await getCurrentActor();
      const repo = getRepository();
      const result = await actOnRequest(repo, actor, id, action);
      if (!result.ok) return serviceErrorResponse(result.error);
      return json(result.value);
    });
}
