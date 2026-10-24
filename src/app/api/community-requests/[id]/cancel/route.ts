import { NextRequest } from "next/server";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { cancelCommunityRequest } from "@/services/communityRequestService";
import { json, guard, serviceErrorResponse } from "../../../_lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await params;
    const actor = await getCurrentActor();
    const repo = getRepository();
    const result = await cancelCommunityRequest(repo, actor, id);
    if (!result.ok) return serviceErrorResponse(result.error);
    return json(result.value);
  });
}
