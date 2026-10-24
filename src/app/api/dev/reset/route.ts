/**
 * POST /api/dev/reset — re-seed the local demo community. DEV MODE ONLY.
 * Returns 404 in production so ordinary production users cannot reach it (FR-14).
 */
import { getRepository, isDevMode } from "@/services/container";
import { buildSeed } from "@/seed/data";
import { json, guard, errorResponse } from "../../_lib/http";
import { LocalRepository } from "@/services/repository.local";

export async function POST() {
  return guard(async () => {
    if (!isDevMode()) return errorResponse(404, "Not found.");

    const repo = getRepository();
    if (!(repo instanceof LocalRepository)) {
      return errorResponse(400, "Reset is only supported for the local repository.");
    }

    const s = buildSeed(new Date());
    const { users, resources, requests, communityRequests, offers, notifications, conversations, messages } = s;
    await repo.loadSeed({
      users: Object.fromEntries(users.map((u) => [u.id, u])),
      resources: Object.fromEntries(resources.map((r) => [r.id, r])),
      requests: Object.fromEntries(requests.map((r) => [r.id, r])),
      communityRequests: Object.fromEntries(communityRequests.map((r) => [r.id, r])),
      offers: Object.fromEntries(offers.map((o) => [o.id, o])),
      notifications: Object.fromEntries(notifications.map((n) => [n.id, n])),
      conversations: Object.fromEntries(conversations.map((c) => [c.id, c])),
      messages: Object.fromEntries(messages.map((m) => [m.id, m])),
      pointTransactions: Object.fromEntries(s.pointTransactions.map((t) => [t.id, t])),
    });

    return json({
      ok: true,
      users: users.length,
      resources: resources.length,
      requests: requests.length,
      communityRequests: communityRequests.length,
    });
  });
}
