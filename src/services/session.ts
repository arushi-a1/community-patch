/**
 * Session resolution. In local/dev mode the "current user" is chosen via a
 * cookie set by the dev user switcher (clearly a development affordance). In
 * AWS mode this is replaced by a Cognito-verified JWT — the authorization
 * LOGIC downstream is identical either way.
 */
import { cookies } from "next/headers";
import { Actor } from "@/domain/authz";
import { getRepository } from "./container";
import { DEMO_COMMUNITY_ID, SEED_USERS } from "@/seed/data";

export const DEV_USER_COOKIE = "patch_dev_user";

/** The default actor used when no dev-user cookie is present. */
export const DEFAULT_DEV_USER_ID = SEED_USERS[0]?.id ?? "user-maya";

export async function getCurrentActor(): Promise<Actor> {
  const store = await cookies();
  const userId = store.get(DEV_USER_COOKIE)?.value ?? DEFAULT_DEV_USER_ID;

  const repo = getRepository();
  const user = await repo.getUser(userId);
  const resolvedId = user?.id ?? DEFAULT_DEV_USER_ID;
  const communityId = user?.communityId ?? DEMO_COMMUNITY_ID;

  return {
    userId: resolvedId,
    communityId,
    isDevAdmin: process.env.NODE_ENV !== "production",
  };
}
