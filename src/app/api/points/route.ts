/**
 * GET /api/points — the current user's points summary + community impact.
 * Balances/badges/milestones are derived from the ledger (never client-settable).
 */
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { getUserPoints, getCommunityImpact } from "@/services/pointsService";
import { json, guard } from "../_lib/http";

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const [me, impact] = await Promise.all([
      getUserPoints(repo, actor.userId),
      getCommunityImpact(repo, actor.communityId),
    ]);
    return json({ me, impact });
  });
}
