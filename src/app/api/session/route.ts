/**
 * GET  /api/session       — the current actor + the community member list (dev switcher).
 * POST /api/session       — switch the active dev user (DEV MODE ONLY).
 *
 * The dev user switcher is clearly a development affordance. In AWS mode this
 * is replaced by Cognito; the downstream authorization logic is unchanged.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository, isDevMode } from "@/services/container";
import { getCurrentActor, DEV_USER_COOKIE } from "@/services/session";
import { json, guard, parseBody, errorResponse } from "../_lib/http";

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const users = await repo.listUsers(actor.communityId);
    return json({
      actor,
      devMode: isDevMode(),
      users: users.map((u) => ({ id: u.id, displayName: u.displayName })),
    });
  });
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    if (!isDevMode()) return errorResponse(404, "Not found.");
    const parsed = await parseBody(req, z.object({ userId: z.string().min(1) }));
    if (!parsed.ok) return parsed.response;

    const repo = getRepository();
    const user = await repo.getUser(parsed.data.userId);
    if (!user) return errorResponse(404, "User not found.");

    const res = json({ ok: true, userId: user.id, displayName: user.displayName });
    res.cookies.set(DEV_USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  });
}
