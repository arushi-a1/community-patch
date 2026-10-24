/**
 * Messaging service — persisted conversations tied to a resource Request or a
 * CommunityRequest. Polling-based (the API just reads current state), but the
 * data model is realtime-ready (append-only messages + per-conversation
 * metadata), so a websocket/SSE layer can be added later without changes here.
 *
 * Authorization: only the two participants may read or post. Participants are
 * derived from the underlying context (requester + resource owner, or
 * requester + accepted helper) — a user can't message about something they
 * aren't part of.
 */
import { randomUUID } from "node:crypto";
import { Actor } from "@/domain/authz";
import {
  Conversation,
  ConversationContextType,
  ConversationView,
  Message,
  NotificationType,
} from "@/domain/types";
import { nowIso } from "@/domain/time";
import { Repository } from "./repository";
import { ServiceError, ServiceResult, ok, err } from "./serviceResult";
import { USER_DISPLAY } from "@/seed/data";

function displayName(userId: string, fallback = "A member"): string {
  return USER_DISPLAY[userId] ?? fallback;
}

/**
 * Resolve the two participants + subject for a messaging context, enforcing
 * that BOTH the actor and the chosen counterpart genuinely belong to it.
 *
 * A conversation is always between two specific people:
 *  - RESOURCE_REQUEST: the requester and the resource owner.
 *  - COMMUNITY_REQUEST: the requester and a specific helper (anyone who made an
 *    offer — messaging is allowed as soon as an offer exists, not only after
 *    acceptance). One conversation per (requester, helper) pair.
 */
async function resolveContext(
  repo: Repository,
  actor: Actor,
  contextType: ConversationContextType,
  contextId: string,
  counterpartId?: string,
): Promise<
  | { ok: true; participantIds: string[]; subject: string }
  | { ok: false; error: ServiceError }
> {
  if (contextType === ConversationContextType.RESOURCE_REQUEST) {
    const request = await repo.getRequest(contextId);
    if (!request) return { ok: false, error: { kind: "NOT_FOUND", message: "Request not found." } };
    const participants = [request.requesterId, request.resourceOwnerId];
    if (!participants.includes(actor.userId)) {
      return { ok: false, error: { kind: "FORBIDDEN", message: "You're not part of this request." } };
    }
    const resource = await repo.getResource(request.resourceId);
    return { ok: true, participantIds: participants, subject: resource?.title ?? "Borrow request" };
  }

  // COMMUNITY_REQUEST: requester ↔ a helper who has made an offer.
  const cr = await repo.getCommunityRequest(contextId);
  if (!cr) return { ok: false, error: { kind: "NOT_FOUND", message: "Request not found." } };

  const offers = await repo.listOffersByRequest(contextId);
  const helperIds = new Set(offers.map((o) => o.helperId));
  const actorIsRequester = actor.userId === cr.requesterId;
  const actorIsHelper = helperIds.has(actor.userId);

  if (!actorIsRequester && !actorIsHelper) {
    return { ok: false, error: { kind: "FORBIDDEN", message: "You're not part of this request." } };
  }

  // Determine the two participants.
  let requesterId = cr.requesterId;
  let helperId: string | undefined;
  if (actorIsRequester) {
    // Requester must say which helper they're messaging.
    helperId = counterpartId;
    if (!helperId || !helperIds.has(helperId)) {
      return { ok: false, error: { kind: "VALIDATION", message: "Pick a helper to message." } };
    }
  } else {
    // Helper is messaging the requester.
    helperId = actor.userId;
    requesterId = cr.requesterId;
  }

  return { ok: true, participantIds: [requesterId, helperId], subject: cr.title };
}

/** Get or create the conversation for a context + a specific counterpart. */
export async function openConversation(
  repo: Repository,
  actor: Actor,
  contextType: ConversationContextType,
  contextId: string,
  counterpartId?: string,
  firstMessage?: string,
): Promise<ServiceResult<Conversation>> {
  const ctx = await resolveContext(repo, actor, contextType, contextId, counterpartId);
  if (!ctx.ok) return err(ctx.error);

  const existing = await repo.findConversationByContext(contextId, ctx.participantIds);
  if (existing) return ok(existing);

  const ts = nowIso();
  const conversation: Conversation = {
    id: `conv-${randomUUID()}`,
    communityId: actor.communityId,
    contextType,
    contextId,
    subject: ctx.subject,
    participantIds: ctx.participantIds,
    lastReadBy: {},
    createdAt: ts,
    updatedAt: ts,
  };
  await repo.putConversation(conversation);

  // Optionally seed the thread with a first message (e.g. the offer note),
  // sent by the actor.
  const seed = firstMessage?.trim();
  if (seed) {
    await sendMessage(repo, actor, conversation.id, seed);
    const refreshed = await repo.getConversation(conversation.id);
    if (refreshed) return ok(refreshed);
  }

  return ok(conversation);
}

export async function listConversations(
  repo: Repository,
  actor: Actor,
): Promise<ConversationView[]> {
  const convos = await repo.listConversationsForUser(actor.userId);
  return convos.map((c) => {
    const otherId = c.participantIds.find((p) => p !== actor.userId) ?? "";
    const myRead = c.lastReadBy?.[actor.userId];
    const unreadForMe = Boolean(
      c.lastMessageAt && (!myRead || myRead < c.lastMessageAt) && c.lastMessagePreview,
    );
    return { ...c, otherParticipantName: displayName(otherId), unreadForMe };
  });
}

export async function getConversationThread(
  repo: Repository,
  actor: Actor,
  conversationId: string,
): Promise<ServiceResult<{ conversation: ConversationView; messages: Message[] }>> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return err({ kind: "NOT_FOUND", message: "Conversation not found." });
  if (!conversation.participantIds.includes(actor.userId)) {
    return err({ kind: "FORBIDDEN", message: "You're not a participant in this conversation." });
  }

  const messages = await repo.listMessages(conversationId);

  // Mark read up to now for this actor.
  const updated: Conversation = {
    ...conversation,
    lastReadBy: { ...conversation.lastReadBy, [actor.userId]: nowIso() },
  };
  await repo.putConversation(updated);

  const otherId = conversation.participantIds.find((p) => p !== actor.userId) ?? "";
  const view: ConversationView = {
    ...updated,
    otherParticipantName: displayName(otherId),
    unreadForMe: false,
  };
  return ok({ conversation: view, messages });
}

export async function sendMessage(
  repo: Repository,
  actor: Actor,
  conversationId: string,
  body: string,
): Promise<ServiceResult<Message>> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return err({ kind: "NOT_FOUND", message: "Conversation not found." });
  if (!conversation.participantIds.includes(actor.userId)) {
    return err({ kind: "FORBIDDEN", message: "You're not a participant in this conversation." });
  }
  const trimmed = body.trim();
  if (!trimmed) return err({ kind: "VALIDATION", message: "Message can't be empty." });

  const ts = nowIso();
  const message: Message = {
    id: `msg-${randomUUID()}`,
    conversationId,
    senderId: actor.userId,
    body: trimmed.slice(0, 2000),
    createdAt: ts,
  };
  await repo.putMessage(message);

  await repo.putConversation({
    ...conversation,
    lastMessageAt: ts,
    lastMessagePreview: message.body.slice(0, 160),
    lastReadBy: { ...conversation.lastReadBy, [actor.userId]: ts },
    updatedAt: ts,
  });

  // Notify the recipient.
  const recipientId = conversation.participantIds.find((p) => p !== actor.userId);
  if (recipientId) {
    await repo.putNotification({
      id: `ntf-${randomUUID()}`,
      communityId: conversation.communityId,
      userId: recipientId,
      type: NotificationType.NEW_OFFER, // reuse a message-ish icon
      title: `New message from ${displayName(actor.userId)}`,
      body: message.body.slice(0, 120),
      href: `/messages/${conversationId}`,
      read: false,
      createdAt: ts,
    });
  }

  return ok(message);
}
