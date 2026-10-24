/**
 * Service layer for open community requests, offers, and notification fan-out.
 * Holds authorization + lifecycle enforcement; API handlers call these.
 *
 * Notifications are persisted in-app records (no push infra). "Nearby" means
 * the same or an adjacent zone as the request's approximate location.
 */
import { randomUUID } from "node:crypto";
import {
  canManageRequest,
  canOffer,
  canResolve,
  canWithdrawOffer,
  nextCommunityRequestStatus,
} from "@/domain/communityRequests";
import { Actor } from "@/domain/authz";
import {
  CommunityRequest,
  CommunityRequestStatus,
  Notification,
  NotificationType,
  Offer,
  OfferStatus,
  PublicCommunityRequest,
} from "@/domain/types";
import { nowIso } from "@/domain/time";
import { Repository } from "./repository";
import { logger } from "./logger";
import { ServiceResult, ok, err } from "./serviceResult";
import { awardPoints } from "./pointsService";
import { openConversation } from "./messagingService";
import { PointEventType } from "@/domain/points";
import { USER_DISPLAY } from "@/seed/data";

// Adjacency of UW/Seattle zones (for "nearby" notification targeting).
const ZONE_ADJACENCY: Record<string, string[]> = {
  "Central Campus": ["Central Campus", "North Campus", "South Campus", "West Campus", "East Campus", "U-District"],
  "North Campus": ["North Campus", "Central Campus", "U-District"],
  "South Campus": ["South Campus", "Central Campus", "East Campus", "Montlake"],
  "East Campus": ["East Campus", "Central Campus", "South Campus", "Montlake"],
  "West Campus": ["West Campus", "Central Campus", "U-District"],
  "U-District": ["U-District", "North Campus", "West Campus", "Central Campus"],
  Montlake: ["Montlake", "South Campus", "East Campus"],
};

function zonesNear(zone?: string): Set<string> {
  if (!zone) return new Set();
  return new Set(ZONE_ADJACENCY[zone] ?? [zone]);
}

async function displayName(repo: Repository, userId: string): Promise<string> {
  return USER_DISPLAY[userId] ?? (await repo.getUser(userId))?.displayName ?? "A member";
}

async function notify(
  repo: Repository,
  n: Omit<Notification, "id" | "createdAt" | "read">,
): Promise<void> {
  const notification: Notification = {
    ...n,
    id: `ntf-${randomUUID()}`,
    read: false,
    createdAt: nowIso(),
  };
  await repo.putNotification(notification);
}

export async function toPublicCommunityRequest(
  repo: Repository,
  cr: CommunityRequest,
): Promise<PublicCommunityRequest> {
  const offers = await repo.listOffersByRequest(cr.id);
  return {
    ...cr,
    requesterDisplayName: await displayName(repo, cr.requesterId),
    offerCount: offers.filter((o) => o.status === OfferStatus.PENDING || o.status === OfferStatus.ACCEPTED).length,
  };
}

// --- Create ----------------------------------------------------------------

export interface CreateCommunityRequestInput {
  title: string;
  description?: string;
  category: CommunityRequest["category"];
  quantity?: number;
  urgency?: CommunityRequest["urgency"];
  deadline?: string;
  location?: CommunityRequest["location"];
}

export async function createCommunityRequest(
  repo: Repository,
  actor: Actor,
  input: CreateCommunityRequestInput,
): Promise<ServiceResult<CommunityRequest>> {
  const ts = nowIso();
  const cr: CommunityRequest = {
    id: `creq-${randomUUID()}`,
    communityId: actor.communityId,
    requesterId: actor.userId,
    title: input.title.trim().slice(0, 120),
    description: (input.description ?? "").slice(0, 1000),
    category: input.category,
    quantity: input.quantity ?? 1,
    urgency: input.urgency ?? "FLEXIBLE",
    deadline: input.deadline,
    location: input.location,
    status: CommunityRequestStatus.OPEN,
    createdAt: ts,
    updatedAt: ts,
  };
  await repo.putCommunityRequest(cr);
  logger.info("community request created", { id: cr.id, category: cr.category });

  // Fan out "nearby request" notifications to members in the same/adjacent zone.
  const near = zonesNear(cr.location?.zone);
  const users = await repo.listUsers(actor.communityId);
  const requesterName = await displayName(repo, actor.userId);
  for (const u of users) {
    if (u.id === actor.userId) continue;
    // If the request has a zone, target nearby members; otherwise notify all.
    if (near.size > 0 && u.homeZone && !near.has(u.homeZone)) continue;
    await notify(repo, {
      communityId: actor.communityId,
      userId: u.id,
      type: NotificationType.NEARBY_REQUEST,
      title: `${requesterName} needs ${cr.quantity > 1 ? cr.quantity + " " : ""}${cr.title}`,
      body: cr.location?.zone ? `Near ${cr.location.zone}. You could help.` : "You could help.",
      href: `/community/requests/${cr.id}`,
    });
  }

  return ok(cr);
}

// --- Offer -----------------------------------------------------------------

export async function createOffer(
  repo: Repository,
  actor: Actor,
  communityRequestId: string,
  input: { message?: string; resourceId?: string },
): Promise<ServiceResult<Offer>> {
  const cr = await repo.getCommunityRequest(communityRequestId);
  if (!cr) return err({ kind: "NOT_FOUND", message: "Request not found." });

  const permit = canOffer(actor, cr);
  if (!permit.allowed) return err({ kind: "FORBIDDEN", message: permit.reason ?? "Not allowed." });

  // Idempotency: one open offer per helper per request.
  const existing = await repo.listOffersByRequest(communityRequestId);
  const dup = existing.find((o) => o.helperId === actor.userId && o.status === OfferStatus.PENDING);
  if (dup) return ok(dup);

  const ts = nowIso();
  const offer: Offer = {
    id: `offer-${randomUUID()}`,
    communityRequestId,
    helperId: actor.userId,
    resourceId: input.resourceId,
    message: (input.message ?? "").slice(0, 600),
    status: OfferStatus.PENDING,
    createdAt: ts,
    updatedAt: ts,
  };
  await repo.putOffer(offer);

  // Open a conversation immediately (requester ↔ this helper), seeded with the
  // offer note as the first message, so it shows up in Messages for both.
  const convo = await openConversation(
    repo,
    actor,
    "COMMUNITY_REQUEST",
    communityRequestId,
    undefined, // helper is the actor; counterpart inferred
    offer.message || `I can help with "${cr.title}".`,
  );

  // Notify the requester of the new offer, deep-linking to the conversation.
  const helperName = await displayName(repo, actor.userId);
  await notify(repo, {
    communityId: cr.communityId,
    userId: cr.requesterId,
    type: NotificationType.NEW_OFFER,
    title: `${helperName} offered to help`,
    body: `For "${cr.title}". Tap to reply.`,
    href: convo.ok ? `/messages/${convo.value.id}` : `/community/requests/${cr.id}`,
  });

  return ok(offer);
}

export async function withdrawOffer(
  repo: Repository,
  actor: Actor,
  offerId: string,
): Promise<ServiceResult<Offer>> {
  const offer = await repo.getOffer(offerId);
  if (!offer) return err({ kind: "NOT_FOUND", message: "Offer not found." });
  if (!canWithdrawOffer(actor, offer)) {
    return err({ kind: "FORBIDDEN", message: "You can only withdraw your own pending offer." });
  }
  await repo.putOffer({ ...offer, status: OfferStatus.WITHDRAWN, updatedAt: nowIso() });
  return ok({ ...offer, status: OfferStatus.WITHDRAWN });
}

// --- Accept / decline offers ------------------------------------------------

export async function acceptOffer(
  repo: Repository,
  actor: Actor,
  offerId: string,
): Promise<ServiceResult<{ offer: Offer; request: CommunityRequest }>> {
  const offer = await repo.getOffer(offerId);
  if (!offer) return err({ kind: "NOT_FOUND", message: "Offer not found." });
  const cr = await repo.getCommunityRequest(offer.communityRequestId);
  if (!cr) return err({ kind: "NOT_FOUND", message: "Request not found." });

  const permit = canManageRequest(actor, cr);
  if (!permit.allowed) return err({ kind: "FORBIDDEN", message: permit.reason ?? "Not allowed." });

  const result = await repo.acceptOfferAtomic({ offerId });
  if (!result.ok) {
    return err({ kind: "CONFLICT", message: result.reason ?? "Could not accept offer." });
  }

  // Notify the accepted helper.
  const requesterName = await displayName(repo, cr.requesterId);
  await notify(repo, {
    communityId: cr.communityId,
    userId: offer.helperId,
    type: NotificationType.OFFER_ACCEPTED,
    title: `${requesterName} accepted your offer`,
    body: `For "${cr.title}". Coordinate the handoff in Messages.`,
    href: `/community/requests/${cr.id}`,
  });

  return ok({ offer: result.offer!, request: result.request! });
}

export async function declineOffer(
  repo: Repository,
  actor: Actor,
  offerId: string,
): Promise<ServiceResult<Offer>> {
  const offer = await repo.getOffer(offerId);
  if (!offer) return err({ kind: "NOT_FOUND", message: "Offer not found." });
  const cr = await repo.getCommunityRequest(offer.communityRequestId);
  if (!cr) return err({ kind: "NOT_FOUND", message: "Request not found." });

  const permit = canManageRequest(actor, cr);
  if (!permit.allowed) return err({ kind: "FORBIDDEN", message: permit.reason ?? "Not allowed." });
  if (offer.status !== OfferStatus.PENDING) {
    return err({ kind: "CONFLICT", message: `Offer is ${offer.status}.` });
  }

  const updated = { ...offer, status: OfferStatus.DECLINED, updatedAt: nowIso() };
  await repo.putOffer(updated);
  await notify(repo, {
    communityId: cr.communityId,
    userId: offer.helperId,
    type: NotificationType.OFFER_DECLINED,
    title: "Offer not needed this time",
    body: `Your offer for "${cr.title}" wasn't selected. Thanks for stepping up!`,
    href: `/community/requests/${cr.id}`,
  });
  return ok(updated);
}

// --- Resolve / cancel -------------------------------------------------------

export async function resolveCommunityRequest(
  repo: Repository,
  actor: Actor,
  id: string,
): Promise<ServiceResult<CommunityRequest>> {
  const cr = await repo.getCommunityRequest(id);
  if (!cr) return err({ kind: "NOT_FOUND", message: "Request not found." });

  const acceptedOffer = cr.acceptedOfferId ? await repo.getOffer(cr.acceptedOfferId) : null;
  if (!canResolve(actor, cr, acceptedOffer)) {
    return err({ kind: "FORBIDDEN", message: "Only a participant can resolve this request." });
  }
  if (cr.status === CommunityRequestStatus.RESOLVED) return ok(cr); // idempotent
  if (cr.status !== CommunityRequestStatus.OPEN && cr.status !== CommunityRequestStatus.MATCHED) {
    return err({ kind: "CONFLICT", message: `Request is ${cr.status}.` });
  }

  const updated = await repo.updateCommunityRequest(id, {
    status: nextCommunityRequestStatus(cr.status, "RESOLVE"),
  });

  // Award PATCH Points to the accepted HELPER for fulfilling a community
  // request (verified: there was an accepted offer and it's now resolved).
  // Idempotent — re-resolving won't double-award.
  if (acceptedOffer) {
    await awardPoints(repo, {
      communityId: cr.communityId,
      userId: acceptedOffer.helperId,
      eventType: PointEventType.COMMUNITY_REQUEST_FULFILLED,
      eventId: cr.id,
    });
  }

  // Notify participants.
  const recipients = new Set<string>([cr.requesterId]);
  if (acceptedOffer) recipients.add(acceptedOffer.helperId);
  for (const uid of recipients) {
    await notify(repo, {
      communityId: cr.communityId,
      userId: uid,
      type: NotificationType.REQUEST_RESOLVED,
      title: "Request resolved 🎉",
      body: `"${cr.title}" was resolved. Thanks for making it happen.`,
      href: `/community/requests/${cr.id}`,
    });
  }

  return ok(updated);
}

export async function cancelCommunityRequest(
  repo: Repository,
  actor: Actor,
  id: string,
): Promise<ServiceResult<CommunityRequest>> {
  const cr = await repo.getCommunityRequest(id);
  if (!cr) return err({ kind: "NOT_FOUND", message: "Request not found." });
  const permit = canManageRequest(actor, cr);
  if (!permit.allowed) return err({ kind: "FORBIDDEN", message: permit.reason ?? "Not allowed." });
  if (cr.status === CommunityRequestStatus.CANCELLED) return ok(cr);
  if (cr.status === CommunityRequestStatus.RESOLVED) {
    return err({ kind: "CONFLICT", message: "Resolved requests can't be cancelled." });
  }
  const updated = await repo.updateCommunityRequest(id, {
    status: CommunityRequestStatus.CANCELLED,
  });
  return ok(updated);
}
