/**
 * Request lifecycle service (FR-9..FR-12). Enforces authorization + state
 * machine + atomic accept. API handlers call these; the frontend never gates
 * security. Each function returns a discriminated result the handler maps to
 * an HTTP status.
 */
import { randomUUID } from "node:crypto";
import {
  Actor,
  canActOnRequest,
  canCreateRequest,
  canViewRequest,
  canSeePickupInstructions,
} from "@/domain/authz";
import {
  canTransitionRequest,
  nextRequestStatus,
  RequestAction,
  resourceStatusForRequestAction,
} from "@/domain/lifecycle";
import {
  AvailabilityStatus,
  NotificationType,
  Request,
  RequestStatus,
  Resource,
} from "@/domain/types";
import { nowIso } from "@/domain/time";
import { Repository } from "./repository";
import { logger } from "./logger";
import { awardPoints } from "./pointsService";
import { openConversation } from "./messagingService";
import { PointEventType } from "@/domain/points";

// Re-export shared result types for existing importers.
export type { ServiceError, ServiceResult } from "./serviceResult";
import { ServiceResult, ok, err } from "./serviceResult";

export interface CreateRequestInput {
  resourceId: string;
  requestedTime?: string;
  pickupContext?: string;
  message?: string;
}

export async function createRequest(
  repo: Repository,
  actor: Actor,
  input: CreateRequestInput,
): Promise<ServiceResult<Request>> {
  const resource = await repo.getResource(input.resourceId);
  if (!resource) return err({ kind: "NOT_FOUND", message: "Resource not found." });

  const authz = canCreateRequest(actor, resource);
  if (!authz.allowed) return err({ kind: "FORBIDDEN", message: authz.reason ?? "Not allowed." });

  if (resource.availabilityStatus === AvailabilityStatus.ARCHIVED) {
    return err({ kind: "CONFLICT", message: "This resource is no longer listed." });
  }

  // Duplicate-submission guard (idempotency, SR §5): same requester+resource
  // with an open (PENDING/ACCEPTED) request is de-duplicated.
  const existing = await repo.listRequestsByRequester(actor.userId);
  const dup = existing.find(
    (r) =>
      r.resourceId === input.resourceId &&
      (r.status === RequestStatus.PENDING || r.status === RequestStatus.ACCEPTED),
  );
  if (dup) return ok(dup);

  const ts = nowIso();
  const request: Request = {
    id: `req-${randomUUID()}`,
    communityId: resource.communityId,
    resourceId: resource.id,
    resourceOwnerId: resource.ownerId,
    requesterId: actor.userId,
    status: RequestStatus.PENDING,
    requestedTime: input.requestedTime,
    pickupContext: (input.pickupContext ?? "").slice(0, 400),
    message: (input.message ?? "").slice(0, 600),
    createdAt: ts,
    updatedAt: ts,
  };
  await repo.putRequest(request);
  logger.info("request created", { requestId: request.id, resourceId: resource.id });

  // Open a conversation with the owner immediately so the borrower can chat
  // (a "message request"), seeded with their note + pickup context.
  const seed = [request.message, request.pickupContext].filter(Boolean).join(" — ") ||
    `Hi! I'd love to borrow "${resource.title}".`;
  const convo = await openConversation(repo, actor, "RESOURCE_REQUEST", request.id, undefined, seed);

  // Notify the owner of the incoming request, deep-linking to the conversation.
  await repo.putNotification({
    id: `ntf-${randomUUID()}`,
    communityId: resource.communityId,
    userId: resource.ownerId,
    type: NotificationType.RESOURCE_REQUEST,
    title: `New request for "${resource.title}"`,
    body: "Someone wants to borrow this. Tap to respond.",
    href: convo.ok ? `/messages/${convo.value.id}` : `/activity`,
    read: false,
    createdAt: nowIso(),
  });

  return ok(request);
}

async function loadRequestForAction(
  repo: Repository,
  id: string,
): Promise<ServiceResult<{ request: Request; resource: Resource | null }>> {
  const request = await repo.getRequest(id);
  if (!request) return err({ kind: "NOT_FOUND", message: "Request not found." });
  const resource = await repo.getResource(request.resourceId);
  return ok({ request, resource });
}

export async function actOnRequest(
  repo: Repository,
  actor: Actor,
  id: string,
  action: RequestAction,
): Promise<ServiceResult<{ request: Request; resource?: Resource }>> {
  const loaded = await loadRequestForAction(repo, id);
  if (!loaded.ok) return loaded;
  const { request, resource } = loaded.value;

  const authz = canActOnRequest(actor, request, action);
  if (!authz.allowed) return err({ kind: "FORBIDDEN", message: authz.reason ?? "Not allowed." });

  if (!canTransitionRequest(request.status, action)) {
    return err({
      kind: "CONFLICT",
      message: `Cannot ${action.toLowerCase()} a request that is ${request.status}.`,
    });
  }

  const exclusive = resource?.exclusive ?? false;

  // ACCEPT uses the atomic, availability-conditioned path.
  if (action === "ACCEPT") {
    const result = await repo.acceptRequestAtomic({
      requestId: id,
      reserveResource: exclusive,
    });
    if (!result.ok) {
      if (result.conflict) {
        return err({ kind: "CONFLICT", message: result.reason ?? "Resource is no longer available." });
      }
      return err({ kind: "CONFLICT", message: result.reason ?? "Could not accept." });
    }
    return ok({ request: result.request!, resource: result.resource });
  }

  // Other transitions: update status, then reconcile resource state.
  const priorStatus = request.status;
  const updated = await repo.updateRequestStatus(id, nextRequestStatus(request.status, action));

  let updatedResource: Resource | undefined;
  if (resource) {
    const target = resourceStatusForRequestAction(action, exclusive, priorStatus);
    if (target && resource.availabilityStatus !== target) {
      updatedResource = await repo.updateResource(resource.id, { availabilityStatus: target });
    }
  }

  // Award PATCH Points to the LENDER on a genuine loan completion (verified:
  // the request was ACCEPTED and is now COMPLETED). Idempotent — a repeat
  // COMPLETE on an already-completed request won't double-award.
  if (action === "COMPLETE" && priorStatus === RequestStatus.ACCEPTED) {
    await awardPoints(repo, {
      communityId: request.communityId,
      userId: request.resourceOwnerId,
      eventType: PointEventType.RESOURCE_LOAN_COMPLETED,
      eventId: request.id,
    });
  }

  logger.info("request transition", { requestId: id, action, from: priorStatus, to: updated.status });
  return ok({ request: updated, resource: updatedResource });
}

export async function getRequestForActor(
  repo: Repository,
  actor: Actor,
  id: string,
): Promise<ServiceResult<{ request: Request; resource: Resource | null; pickupVisible: boolean }>> {
  const request = await repo.getRequest(id);
  if (!request) return err({ kind: "NOT_FOUND", message: "Request not found." });
  const authz = canViewRequest(actor, request);
  if (!authz.allowed) return err({ kind: "FORBIDDEN", message: authz.reason ?? "Not allowed." });
  const resource = await repo.getResource(request.resourceId);
  const pickupVisible = canSeePickupInstructions(actor, request);
  return ok({ request, resource, pickupVisible });
}
