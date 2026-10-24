/**
 * Lifecycle + authorization for open community requests and offers.
 *
 * CommunityRequest:  OPEN → MATCHED → RESOLVED, plus CANCELLED / EXPIRED.
 * Offer:             PENDING → ACCEPTED/DECLINED, plus WITHDRAWN.
 *
 * Accepting an offer is the concurrency-sensitive operation (only one offer may
 * be ACCEPTED for a request). The repository provides an atomic accept that
 * mirrors the resource-reservation guarantee.
 */
import {
  CommunityRequest,
  CommunityRequestStatus,
  Offer,
  OfferStatus,
} from "./types";
import { Actor } from "./authz";

export type CommunityRequestAction = "CANCEL" | "RESOLVE";

const CR_TRANSITIONS: Record<
  CommunityRequestStatus,
  Partial<Record<CommunityRequestAction | "MATCH", CommunityRequestStatus>>
> = {
  [CommunityRequestStatus.OPEN]: {
    MATCH: CommunityRequestStatus.MATCHED,
    CANCEL: CommunityRequestStatus.CANCELLED,
    RESOLVE: CommunityRequestStatus.RESOLVED,
  },
  [CommunityRequestStatus.MATCHED]: {
    RESOLVE: CommunityRequestStatus.RESOLVED,
    CANCEL: CommunityRequestStatus.CANCELLED,
  },
  [CommunityRequestStatus.RESOLVED]: {},
  [CommunityRequestStatus.CANCELLED]: {},
  [CommunityRequestStatus.EXPIRED]: {},
};

export function canTransitionCommunityRequest(
  from: CommunityRequestStatus,
  action: CommunityRequestAction | "MATCH",
): boolean {
  return CR_TRANSITIONS[from]?.[action] != null;
}

export function nextCommunityRequestStatus(
  from: CommunityRequestStatus,
  action: CommunityRequestAction | "MATCH",
): CommunityRequestStatus {
  const to = CR_TRANSITIONS[from]?.[action];
  if (!to) throw new Error(`Illegal community-request transition: ${from} -(${action})-> ?`);
  return to;
}

// --- Authorization ----------------------------------------------------------

/** Anyone in the community who is NOT the requester may offer help. */
export function canOffer(actor: Actor, request: CommunityRequest): { allowed: boolean; reason?: string } {
  if (actor.communityId !== request.communityId) return { allowed: false, reason: "Different community." };
  if (actor.userId === request.requesterId) {
    return { allowed: false, reason: "You can't offer help on your own request." };
  }
  if (request.status !== CommunityRequestStatus.OPEN && request.status !== CommunityRequestStatus.MATCHED) {
    return { allowed: false, reason: "This request is no longer open." };
  }
  return { allowed: true };
}

/** Only the requester accepts/declines offers and resolves/cancels the request. */
export function canManageRequest(actor: Actor, request: CommunityRequest): { allowed: boolean; reason?: string } {
  if (actor.userId !== request.requesterId) {
    return { allowed: false, reason: "Only the requester can manage this request." };
  }
  return { allowed: true };
}

/** A helper may withdraw their own pending offer. */
export function canWithdrawOffer(actor: Actor, offer: Offer): boolean {
  return actor.userId === offer.helperId && offer.status === OfferStatus.PENDING;
}

/** Resolve may be done by the requester or the accepted helper. */
export function canResolve(
  actor: Actor,
  request: CommunityRequest,
  acceptedOffer: Offer | null,
): boolean {
  if (actor.userId === request.requesterId) return true;
  if (acceptedOffer && actor.userId === acceptedOffer.helperId) return true;
  return false;
}
