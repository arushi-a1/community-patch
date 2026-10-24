/**
 * Repository interface (persistence abstraction). The local JSON adapter and
 * the DynamoDB adapter both implement this. Business rules live in the domain
 * layer and API handlers — NOT in the adapter — so the two implementations are
 * behaviorally identical (NFR-4).
 */
import {
  CommunityRequest,
  Conversation,
  Message,
  Notification,
  Offer,
  PointTransaction,
  Request,
  RequestStatus,
  Resource,
  User,
} from "@/domain/types";

export interface ResourceQuery {
  communityId: string;
  category?: string;
  availabilityStatus?: string;
  /** Case-insensitive keyword match over title/description/tags. */
  keyword?: string;
  ownerId?: string;
  /** Exclude ARCHIVED by default. */
  includeArchived?: boolean;
  limit?: number;
  /** Opaque pagination cursor (adapter-defined). */
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  total: number;
}

/**
 * A conditional, atomic accept operation. Implementations MUST guarantee that
 * for an exclusive resource, only one PENDING request can transition to
 * ACCEPTED while the resource is AVAILABLE — concurrent accepts cannot both
 * succeed (SR §6, AC-5).
 */
export interface AcceptResult {
  ok: boolean;
  /** Populated on success. */
  request?: Request;
  resource?: Resource;
  /** Set when the accept failed because the resource was no longer available. */
  conflict?: boolean;
  reason?: string;
}

export interface Repository {
  // Users
  getUser(id: string): Promise<User | null>;
  listUsers(communityId: string): Promise<User[]>;
  putUser(user: User): Promise<void>;

  // Resources
  getResource(id: string): Promise<Resource | null>;
  queryResources(query: ResourceQuery): Promise<Page<Resource>>;
  putResource(resource: Resource): Promise<void>;
  /** Partial update of an existing resource (owner-authorized by the caller). */
  updateResource(id: string, patch: Partial<Resource>): Promise<Resource>;

  // Requests
  getRequest(id: string): Promise<Request | null>;
  listRequestsByRequester(requesterId: string): Promise<Request[]>;
  listRequestsByOwner(ownerId: string): Promise<Request[]>;
  listRequestsByResource(resourceId: string): Promise<Request[]>;
  /** All requests in a community (single pass — avoids per-user N+1). */
  listAllRequests(communityId: string): Promise<Request[]>;
  putRequest(request: Request): Promise<void>;
  updateRequestStatus(id: string, status: RequestStatus): Promise<Request>;

  /**
   * Atomically accept a request for an exclusive resource. Conditional on the
   * resource still being AVAILABLE. Returns conflict=true if it was taken.
   */
  acceptRequestAtomic(args: {
    requestId: string;
    /** New resource status to set if the resource is exclusive (e.g. RESERVED). */
    reserveResource: boolean;
  }): Promise<AcceptResult>;

  // Community requests (open "I need X" posts) -------------------------------
  getCommunityRequest(id: string): Promise<CommunityRequest | null>;
  listCommunityRequests(communityId: string): Promise<CommunityRequest[]>;
  listCommunityRequestsByRequester(requesterId: string): Promise<CommunityRequest[]>;
  putCommunityRequest(request: CommunityRequest): Promise<void>;
  updateCommunityRequest(id: string, patch: Partial<CommunityRequest>): Promise<CommunityRequest>;

  // Offers -------------------------------------------------------------------
  getOffer(id: string): Promise<Offer | null>;
  listOffersByRequest(communityRequestId: string): Promise<Offer[]>;
  listOffersByHelper(helperId: string): Promise<Offer[]>;
  putOffer(offer: Offer): Promise<void>;
  /**
   * Atomically accept an offer: conditional on the community request still
   * being OPEN (not already matched). Exactly one offer can be accepted.
   */
  acceptOfferAtomic(args: {
    offerId: string;
  }): Promise<AcceptOfferResult>;

  // Notifications ------------------------------------------------------------
  putNotification(notification: Notification): Promise<void>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationsRead(userId: string, ids?: string[]): Promise<void>;

  // Messaging ----------------------------------------------------------------
  getConversation(id: string): Promise<Conversation | null>;
  /** Find an existing conversation for a context + participant pair. */
  findConversationByContext(contextId: string, participantIds: string[]): Promise<Conversation | null>;
  listConversationsForUser(userId: string): Promise<Conversation[]>;
  putConversation(conversation: Conversation): Promise<void>;
  listMessages(conversationId: string): Promise<Message[]>;
  putMessage(message: Message): Promise<void>;

  // Points -------------------------------------------------------------------
  /**
   * Idempotently award points. Inserts the transaction ONLY if one with the
   * same deterministic id doesn't already exist. Returns the transaction that
   * exists afterward and whether this call created it. Concurrency-safe.
   */
  awardPointsOnce(tx: PointTransaction): Promise<{ created: boolean; transaction: PointTransaction }>;
  listPointTransactionsForUser(userId: string): Promise<PointTransaction[]>;
  listAllPointTransactions(communityId: string): Promise<PointTransaction[]>;

  // Dev-only
  reset?(): Promise<void>;
}

export interface AcceptOfferResult {
  ok: boolean;
  offer?: Offer;
  request?: CommunityRequest;
  conflict?: boolean;
  reason?: string;
}
