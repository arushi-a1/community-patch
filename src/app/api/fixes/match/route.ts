/**
 * POST /api/fixes/match — run retrieval + ranking from a KNOWN interpretation
 * (e.g. the "refine" action), avoiding another model call. The interpretation
 * is re-validated against the schema before use.
 */
import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { matchFromInterpretation } from "@/services/fixService";
import { validateInterpretation } from "@/domain/interpretation";
import { Location } from "@/domain/types";
import { json, guard, parseBody, errorResponse } from "../../_lib/http";
import { matchSchema } from "../../_lib/schemas";

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const parsed = await parseBody(req, matchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const interpretation = validateInterpretation(body.interpretation);
    if (!interpretation) return errorResponse(400, "Invalid interpretation.");

    let requesterLocation: Location | undefined;
    if (body.requesterLat != null && body.requesterLng != null) {
      requesterLocation = {
        label: "Your location",
        zone: body.requesterZone ?? "Central",
        lat: body.requesterLat,
        lng: body.requesterLng,
      };
    } else if (body.requesterZone) {
      requesterLocation = { label: "Your location", zone: body.requesterZone };
    }

    const repo = getRepository();
    const result = await matchFromInterpretation(repo, interpretation, {
      communityId: actor.communityId,
      requesterId: actor.userId,
      requesterLocation,
      radiusKm: body.radiusKm,
    });

    return json(result);
  });
}
