/**
 * GET   /api/resources/:id   — public detail (pickup instructions withheld).
 * PATCH /api/resources/:id   — owner-only update (incl. availability).
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { canModifyResource } from "@/domain/authz";
import { assertResourceTransition, LifecycleError } from "@/domain/lifecycle";
import { toPublicResource } from "@/domain/projection";
import { USER_DISPLAY } from "@/seed/data";
import { json, guard, parseBody, errorResponse } from "../../_lib/http";
import { updateResourceSchema } from "../../_lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const repo = getRepository();
    const resource = await repo.getResource(id);
    if (!resource) return errorResponse(404, "Resource not found.");

    const name =
      USER_DISPLAY[resource.ownerId] ?? (await repo.getUser(resource.ownerId))?.displayName ?? "A member";
    return json(toPublicResource(resource, name));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();
    const repo = getRepository();

    const resource = await repo.getResource(id);
    if (!resource) return errorResponse(404, "Resource not found.");

    const authz = canModifyResource(actor, resource);
    if (!authz.allowed) return errorResponse(403, authz.reason ?? "Not allowed.");

    const parsed = await parseBody(req, updateResourceSchema);
    if (!parsed.ok) return parsed.response;
    const patch = parsed.data;

    // Validate any availability transition against the state machine.
    if (patch.availabilityStatus && patch.availabilityStatus !== resource.availabilityStatus) {
      try {
        assertResourceTransition(resource.availabilityStatus, patch.availabilityStatus);
      } catch (e) {
        if (e instanceof LifecycleError) return errorResponse(409, e.message);
        throw e;
      }
    }

    const updated = await repo.updateResource(id, patch);
    const name = USER_DISPLAY[updated.ownerId] ?? (await repo.getUser(updated.ownerId))?.displayName ?? "A member";
    return json(toPublicResource(updated, name));
  });
}
