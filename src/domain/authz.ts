/**
 * Authorization decisions (SR §1). Pure functions of (actor, target, action).
 * Enforced server-side on every consequential action. The frontend may hide
 * controls for UX but never relies on that for security.
 */
import { Request, RequestStatus, Resource } from "./types";
import { RequestAction } from "./lifecycle";

export interface Actor {
  userId: string;
  communityId: string;
  /** Dev/admin affordances (e.g. reset) — only true in local/dev mode. */
  isDevAdmin?: boolean;
}

export interface AuthzResult {
  allowed: boolean;
  reason?: string;
}

const deny = (reason: string): AuthzResult => ({ allowed: false, reason });
const allow: AuthzResult = { allowed: true };

/** Only the owner may modify a resource. */
export function canModifyResource(actor: Actor, resource: Resource): AuthzResult {
  if (actor.communityId !== resource.communityId) return deny("Different community.");
  if (actor.userId !== resource.ownerId) return deny("Only the owner can modify this resource.");
  return allow;
}

/** Owners cannot borrow their own exclusive item via the public request flow. */
export function canCreateRequest(actor: Actor, resource: Resource): AuthzResult {
  if (actor.communityId !== resource.communityId) return deny("Different community.");
  if (resource.exclusive && actor.userId === resource.ownerId) {
    return deny("You already own this resource.");
  }
  return allow;
}

/** Only participants (requester or resource owner) can view a request. */
export function canViewRequest(actor: Actor, request: Request): AuthzResult {
  if (actor.userId === request.requesterId || actor.userId === request.resourceOwnerId) {
    return allow;
  }
  return deny("Not a participant in this request.");
}

/** Authorization for each request action (lifecycle validity checked separately). */
export function canActOnRequest(
  actor: Actor,
  request: Request,
  action: RequestAction,
): AuthzResult {
  const isOwner = actor.userId === request.resourceOwnerId;
  const isRequester = actor.userId === request.requesterId;

  switch (action) {
    case "ACCEPT":
    case "DECLINE":
      return isOwner ? allow : deny("Only the resource owner can accept or decline.");
    case "CANCEL":
      return isOwner || isRequester
        ? allow
        : deny("Only a participant can cancel.");
    case "COMPLETE":
      return isOwner || isRequester
        ? allow
        : deny("Only a participant can complete.");
    default:
      return deny("Unknown action.");
  }
}

/** Pickup instructions are disclosed only to participants once ACCEPTED (SR §2/§3). */
export function canSeePickupInstructions(actor: Actor, request: Request): boolean {
  const isParticipant =
    actor.userId === request.requesterId || actor.userId === request.resourceOwnerId;
  return isParticipant && request.status === RequestStatus.ACCEPTED;
}
