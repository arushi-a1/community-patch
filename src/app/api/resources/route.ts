/**
 * GET  /api/resources   — list resources (community-scoped) with filters + pagination.
 * POST /api/resources   — create a resource owned by the current actor.
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getAIService as _ai } from "@/services/container"; // kept for parity; unused here
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { toPublicResource } from "@/domain/projection";
import { Resource, ResourceCondition, ResourceType } from "@/domain/types";
import { nowIso } from "@/domain/time";
import { USER_DISPLAY } from "@/seed/data";
import { json, guard, parseBody } from "../_lib/http";
import { createResourceSchema } from "../_lib/schemas";

void _ai;

export async function GET(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const sp = req.nextUrl.searchParams;

    const page = await repo.queryResources({
      communityId: actor.communityId,
      category: sp.get("category") ?? undefined,
      availabilityStatus: sp.get("availability") ?? undefined,
      keyword: sp.get("q") ?? undefined,
      ownerId: sp.get("owner") ?? undefined,
      includeArchived: sp.get("includeArchived") === "1",
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      cursor: sp.get("cursor") ?? undefined,
    });

    const items = await Promise.all(
      page.items.map(async (r) => {
        const name = USER_DISPLAY[r.ownerId] ?? (await repo.getUser(r.ownerId))?.displayName ?? "A member";
        return toPublicResource(r, name);
      }),
    );

    return json({ items, nextCursor: page.nextCursor, total: page.total });
  });
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const parsed = await parseBody(req, createResourceSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const ts = nowIso();
    const resource: Resource = {
      id: `res-${randomUUID()}`,
      communityId: actor.communityId,
      ownerId: actor.userId,
      title: body.title,
      description: body.description,
      resourceType: body.resourceType,
      category: body.category,
      tags: body.tags,
      // Assistance offers have no physical condition.
      condition: body.resourceType === ResourceType.ASSISTANCE ? ResourceCondition.NA : body.condition,
      location: body.location,
      availabilityStatus: "AVAILABLE",
      availabilityWindows: body.availabilityWindows,
      exclusive: body.resourceType === ResourceType.ASSISTANCE ? false : body.exclusive,
      lendingRules: body.lendingRules,
      pickupInstructions: body.pickupInstructions,
      imageRef: body.imageRef,
      compatibility: body.compatibility,
      createdAt: ts,
      updatedAt: ts,
    };

    const repo = getRepository();
    await repo.putResource(resource);

    const name = USER_DISPLAY[actor.userId] ?? (await repo.getUser(actor.userId))?.displayName ?? "You";
    return json(toPublicResource(resource, name), 201);
  });
}
