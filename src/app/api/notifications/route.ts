/**
 * GET  /api/notifications       — the current user's in-app notifications.
 * POST /api/notifications/read  — mark notifications read (all, or specific ids).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { json, guard, parseBody } from "../_lib/http";

export async function GET() {
  return guard(async () => {
    const actor = await getCurrentActor();
    const repo = getRepository();
    const items = await repo.listNotifications(actor.userId);
    const unread = items.filter((n) => !n.read).length;
    return json({ items, unread });
  });
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getCurrentActor();
    const parsed = await parseBody(req, z.object({ ids: z.array(z.string()).optional() }));
    if (!parsed.ok) return parsed.response;
    const repo = getRepository();
    await repo.markNotificationsRead(actor.userId, parsed.data.ids);
    return json({ ok: true });
  });
}
