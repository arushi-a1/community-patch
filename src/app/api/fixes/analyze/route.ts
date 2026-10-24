/**
 * POST /api/fixes/analyze — interpret a natural-language problem and return
 * grounded, ranked matches + alternatives. AI-assisted when configured, with a
 * deterministic fallback. Rate-limited (SR §5).
 */
import { NextRequest } from "next/server";
import { getAIService, getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { runFix } from "@/services/fixService";
import { rateLimit } from "@/services/rateLimit";
import { RATE_LIMITS } from "@/domain/config";
import { Location } from "@/domain/types";
import { json, guard, parseBody, errorResponse } from "../../_lib/http";
import { analyzeSchema } from "../../_lib/schemas";

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();

    const limit = rateLimit(`analyze:${actor.userId}`, RATE_LIMITS.aiAnalyze);
    if (!limit.allowed) {
      return errorResponse(429, "Too many requests. Please slow down.", {
        retryAfterMs: limit.retryAfterMs,
      });
    }

    const parsed = await parseBody(req, analyzeSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

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
    const ai = getAIService();

    const result = await runFix(repo, ai, {
      text: body.text,
      communityId: actor.communityId,
      requesterId: actor.userId,
      requesterLocation,
      radiusKm: body.radiusKm,
      locationHint: body.locationHint,
    });

    return json({ ...result, provider: ai.provider });
  });
}
