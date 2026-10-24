/**
 * GET /api/requests/:id — participant-only detail. Pickup instructions are
 * included only when the viewer may see them (accepted + participant).
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { getRequestForActor } from "@/services/requestService";
import { toPublicResource } from "@/domain/projection";
import { USER_DISPLAY } from "@/seed/data";
import { json, guard, serviceErrorResponse } from "../../_lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();
    const repo = getRepository();

    const result = await getRequestForActor(repo, actor, id);
    if (!result.ok) return serviceErrorResponse(result.error);
    const { request, resource, pickupVisible } = result.value;

    let resourcePublic = null;
    let pickupInstructions: string | undefined;
    if (resource) {
      const name = USER_DISPLAY[resource.ownerId] ?? (await repo.getUser(resource.ownerId))?.displayName ?? "A member";
      resourcePublic = toPublicResource(resource, name);
      if (pickupVisible) pickupInstructions = resource.pickupInstructions;
    }

    return json({ request, resource: resourcePublic, pickupInstructions });
  });
}
