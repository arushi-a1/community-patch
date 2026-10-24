/**
 * Local JSON-file repository adapter. Persists to `.data/db.json`. Provides the
 * SAME business guarantees as the DynamoDB adapter:
 *   - atomic file writes (write temp + rename),
 *   - a per-resource async mutex to serialize the accept operation, and
 *   - a conditional check inside the mutex so concurrent accepts of an
 *     exclusive, AVAILABLE resource cannot both succeed (AC-5).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AvailabilityStatus,
  CommunityRequest,
  CommunityRequestStatus,
  Conversation,
  Message,
  Notification,
  Offer,
  OfferStatus,
  PointTransaction,
  Request,
  RequestStatus,
  Resource,
  User,
} from "@/domain/types";
import { nowIso } from "@/domain/time";
import {
  AcceptOfferResult,
  AcceptResult,
  Page,
  Repository,
  ResourceQuery,
} from "./repository";
import { logger } from "./logger";

interface DbShape {
  users: Record<string, User>;
  resources: Record<string, Resource>;
  requests: Record<string, Request>;
  communityRequests: Record<string, CommunityRequest>;
  offers: Record<string, Offer>;
  notifications: Record<string, Notification>;
  conversations: Record<string, Conversation>;
  messages: Record<string, Message>;
  pointTransactions: Record<string, PointTransaction>;
}

const emptyDb = (): DbShape => ({
  users: {},
  resources: {},
  requests: {},
  communityRequests: {},
  offers: {},
  notifications: {},
  conversations: {},
  messages: {},
  pointTransactions: {},
});

export class LocalRepository implements Repository {
  private readonly file: string;
  private cache: DbShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly resourceLocks = new Map<string, Promise<void>>();
  private readonly crLocks = new Map<string, Promise<void>>();

  constructor(dataDir = path.join(process.cwd(), ".data")) {
    this.file = path.join(dataDir, "db.json");
  }

  // --- persistence primitives ---------------------------------------------

  private async load(): Promise<DbShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      // Merge with the empty shape so older db files (missing newer collections)
      // load without crashing.
      this.cache = { ...emptyDb(), ...(JSON.parse(raw) as Partial<DbShape>) };
    } catch {
      this.cache = emptyDb();
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    // Serialize writes to avoid interleaving; atomic via temp + rename.
    const db = this.cache ?? emptyDb();
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await fs.rename(tmp, this.file);
    });
    return this.writeChain;
  }

  /** Acquire a per-resource mutex, run fn, release. Serializes accepts. */
  private async withResourceLock<T>(resourceId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.resourceLocks.get(resourceId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => (release = res));
    this.resourceLocks.set(resourceId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      // Clean up if we're the tail of the chain.
      if (this.resourceLocks.get(resourceId) === next) {
        this.resourceLocks.delete(resourceId);
      }
    }
  }

  // --- users ---------------------------------------------------------------

  async getUser(id: string): Promise<User | null> {
    const db = await this.load();
    return db.users[id] ?? null;
  }

  async listUsers(communityId: string): Promise<User[]> {
    const db = await this.load();
    return Object.values(db.users).filter((u) => u.communityId === communityId);
  }

  async putUser(user: User): Promise<void> {
    const db = await this.load();
    db.users[user.id] = user;
    await this.persist();
  }

  // --- resources -----------------------------------------------------------

  async getResource(id: string): Promise<Resource | null> {
    const db = await this.load();
    return db.resources[id] ?? null;
  }

  async queryResources(query: ResourceQuery): Promise<Page<Resource>> {
    const db = await this.load();
    let items = Object.values(db.resources).filter((r) => r.communityId === query.communityId);

    if (!query.includeArchived) {
      items = items.filter((r) => r.availabilityStatus !== AvailabilityStatus.ARCHIVED);
    }
    if (query.category) items = items.filter((r) => r.category === query.category);
    if (query.availabilityStatus) {
      items = items.filter((r) => r.availabilityStatus === query.availabilityStatus);
    }
    if (query.ownerId) items = items.filter((r) => r.ownerId === query.ownerId);
    if (query.keyword) {
      const k = query.keyword.toLowerCase();
      items = items.filter((r) =>
        [r.title, r.description, ...r.tags].join(" ").toLowerCase().includes(k),
      );
    }

    items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const total = items.length;

    const limit = query.limit ?? 24;
    const start = query.cursor ? parseInt(query.cursor, 10) || 0 : 0;
    const pageItems = items.slice(start, start + limit);
    const nextCursor = start + limit < total ? String(start + limit) : undefined;

    return { items: pageItems, nextCursor, total };
  }

  async putResource(resource: Resource): Promise<void> {
    const db = await this.load();
    db.resources[resource.id] = resource;
    await this.persist();
  }

  async updateResource(id: string, patch: Partial<Resource>): Promise<Resource> {
    const db = await this.load();
    const existing = db.resources[id];
    if (!existing) throw new Error(`Resource not found: ${id}`);
    const updated: Resource = { ...existing, ...patch, updatedAt: nowIso() };
    db.resources[id] = updated;
    await this.persist();
    return updated;
  }

  // --- requests ------------------------------------------------------------

  async getRequest(id: string): Promise<Request | null> {
    const db = await this.load();
    return db.requests[id] ?? null;
  }

  async listRequestsByRequester(requesterId: string): Promise<Request[]> {
    const db = await this.load();
    return Object.values(db.requests)
      .filter((r) => r.requesterId === requesterId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listRequestsByOwner(ownerId: string): Promise<Request[]> {
    const db = await this.load();
    return Object.values(db.requests)
      .filter((r) => r.resourceOwnerId === ownerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listRequestsByResource(resourceId: string): Promise<Request[]> {
    const db = await this.load();
    return Object.values(db.requests).filter((r) => r.resourceId === resourceId);
  }

  async listAllRequests(communityId: string): Promise<Request[]> {
    const db = await this.load();
    return Object.values(db.requests)
      .filter((r) => r.communityId === communityId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async putRequest(request: Request): Promise<void> {
    const db = await this.load();
    db.requests[request.id] = request;
    await this.persist();
  }

  async updateRequestStatus(id: string, status: RequestStatus): Promise<Request> {
    const db = await this.load();
    const existing = db.requests[id];
    if (!existing) throw new Error(`Request not found: ${id}`);
    const updated: Request = { ...existing, status, updatedAt: nowIso() };
    db.requests[id] = updated;
    await this.persist();
    return updated;
  }

  async acceptRequestAtomic(args: {
    requestId: string;
    reserveResource: boolean;
  }): Promise<AcceptResult> {
    const db = await this.load();
    const request = db.requests[args.requestId];
    if (!request) return { ok: false, reason: "Request not found." };

    // Serialize all accepts for this resource.
    return this.withResourceLock(request.resourceId, async () => {
      // Re-read under the lock (the conditional check).
      const freshDb = await this.load();
      const req = freshDb.requests[args.requestId];
      const resource = freshDb.resources[req?.resourceId ?? ""];
      if (!req || !resource) return { ok: false, reason: "Request or resource not found." };

      if (req.status !== RequestStatus.PENDING) {
        return { ok: false, reason: `Request is ${req.status}, not PENDING.` };
      }

      // Conditional availability check for exclusive resources.
      if (args.reserveResource && resource.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
        logger.warn("accept conflict: resource not available", {
          requestId: req.id,
          resourceId: resource.id,
          status: resource.availabilityStatus,
        });
        return {
          ok: false,
          conflict: true,
          reason: "Resource is no longer available.",
        };
      }

      const ts = nowIso();
      const updatedReq: Request = { ...req, status: RequestStatus.ACCEPTED, updatedAt: ts };
      freshDb.requests[req.id] = updatedReq;

      let updatedResource = resource;
      if (args.reserveResource) {
        updatedResource = {
          ...resource,
          availabilityStatus: AvailabilityStatus.RESERVED,
          updatedAt: ts,
        };
        freshDb.resources[resource.id] = updatedResource;
      }

      await this.persist();
      return { ok: true, request: updatedReq, resource: updatedResource };
    });
  }

  // --- community requests --------------------------------------------------

  private async withCrLock<T>(crId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.crLocks.get(crId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => (release = res));
    this.crLocks.set(crId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.crLocks.get(crId) === next) this.crLocks.delete(crId);
    }
  }

  async getCommunityRequest(id: string): Promise<CommunityRequest | null> {
    const db = await this.load();
    return db.communityRequests[id] ?? null;
  }

  async listCommunityRequests(communityId: string): Promise<CommunityRequest[]> {
    const db = await this.load();
    return Object.values(db.communityRequests)
      .filter((r) => r.communityId === communityId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listCommunityRequestsByRequester(requesterId: string): Promise<CommunityRequest[]> {
    const db = await this.load();
    return Object.values(db.communityRequests)
      .filter((r) => r.requesterId === requesterId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async putCommunityRequest(request: CommunityRequest): Promise<void> {
    const db = await this.load();
    db.communityRequests[request.id] = request;
    await this.persist();
  }

  async updateCommunityRequest(
    id: string,
    patch: Partial<CommunityRequest>,
  ): Promise<CommunityRequest> {
    const db = await this.load();
    const existing = db.communityRequests[id];
    if (!existing) throw new Error(`Community request not found: ${id}`);
    const updated: CommunityRequest = { ...existing, ...patch, updatedAt: nowIso() };
    db.communityRequests[id] = updated;
    await this.persist();
    return updated;
  }

  // --- offers --------------------------------------------------------------

  async getOffer(id: string): Promise<Offer | null> {
    const db = await this.load();
    return db.offers[id] ?? null;
  }

  async listOffersByRequest(communityRequestId: string): Promise<Offer[]> {
    const db = await this.load();
    return Object.values(db.offers)
      .filter((o) => o.communityRequestId === communityRequestId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listOffersByHelper(helperId: string): Promise<Offer[]> {
    const db = await this.load();
    return Object.values(db.offers)
      .filter((o) => o.helperId === helperId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async putOffer(offer: Offer): Promise<void> {
    const db = await this.load();
    db.offers[offer.id] = offer;
    await this.persist();
  }

  async acceptOfferAtomic(args: { offerId: string }): Promise<AcceptOfferResult> {
    const db = await this.load();
    const offer = db.offers[args.offerId];
    if (!offer) return { ok: false, reason: "Offer not found." };

    return this.withCrLock(offer.communityRequestId, async () => {
      const fresh = await this.load();
      const o = fresh.offers[args.offerId];
      const cr = o ? fresh.communityRequests[o.communityRequestId] : undefined;
      if (!o || !cr) return { ok: false, reason: "Offer or request not found." };

      if (o.status !== OfferStatus.PENDING) {
        return { ok: false, reason: `Offer is ${o.status}, not pending.` };
      }
      // Conditional: the request must still be OPEN (not already matched).
      if (cr.status !== CommunityRequestStatus.OPEN) {
        logger.warn("offer accept conflict: request not open", {
          offerId: o.id,
          requestId: cr.id,
          status: cr.status,
        });
        return { ok: false, conflict: true, reason: "This request was already matched." };
      }

      const ts = nowIso();
      const acceptedOffer: Offer = { ...o, status: OfferStatus.ACCEPTED, updatedAt: ts };
      const matchedRequest: CommunityRequest = {
        ...cr,
        status: CommunityRequestStatus.MATCHED,
        acceptedOfferId: o.id,
        updatedAt: ts,
      };
      fresh.offers[o.id] = acceptedOffer;
      fresh.communityRequests[cr.id] = matchedRequest;
      await this.persist();
      return { ok: true, offer: acceptedOffer, request: matchedRequest };
    });
  }

  // --- notifications -------------------------------------------------------

  async putNotification(notification: Notification): Promise<void> {
    const db = await this.load();
    db.notifications[notification.id] = notification;
    await this.persist();
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    const db = await this.load();
    return Object.values(db.notifications)
      .filter((n) => n.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    const db = await this.load();
    const idSet = ids ? new Set(ids) : null;
    for (const n of Object.values(db.notifications)) {
      if (n.userId !== userId) continue;
      if (idSet && !idSet.has(n.id)) continue;
      n.read = true;
    }
    await this.persist();
  }

  // --- messaging -----------------------------------------------------------

  async getConversation(id: string): Promise<Conversation | null> {
    const db = await this.load();
    return db.conversations[id] ?? null;
  }

  async findConversationByContext(
    contextId: string,
    participantIds: string[],
  ): Promise<Conversation | null> {
    const db = await this.load();
    const key = [...participantIds].sort().join("|");
    return (
      Object.values(db.conversations).find(
        (c) => c.contextId === contextId && [...c.participantIds].sort().join("|") === key,
      ) ?? null
    );
  }

  async listConversationsForUser(userId: string): Promise<Conversation[]> {
    const db = await this.load();
    return Object.values(db.conversations)
      .filter((c) => c.participantIds.includes(userId))
      .sort((a, b) => ((a.lastMessageAt ?? a.createdAt) < (b.lastMessageAt ?? b.createdAt) ? 1 : -1));
  }

  async putConversation(conversation: Conversation): Promise<void> {
    const db = await this.load();
    db.conversations[conversation.id] = conversation;
    await this.persist();
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const db = await this.load();
    return Object.values(db.messages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async putMessage(message: Message): Promise<void> {
    const db = await this.load();
    db.messages[message.id] = message;
    await this.persist();
  }

  // --- points --------------------------------------------------------------

  private pointsChain: Promise<unknown> = Promise.resolve();

  async awardPointsOnce(
    tx: PointTransaction,
  ): Promise<{ created: boolean; transaction: PointTransaction }> {
    // Serialize all point writes so concurrent completes can't double-insert
    // the same deterministic id (idempotency guarantee).
    const run = this.pointsChain.then(async () => {
      const db = await this.load();
      const existing = db.pointTransactions[tx.id];
      if (existing) return { created: false, transaction: existing };
      db.pointTransactions[tx.id] = tx;
      await this.persist();
      return { created: true, transaction: tx };
    });
    this.pointsChain = run.catch(() => undefined);
    return run;
  }

  async listPointTransactionsForUser(userId: string): Promise<PointTransaction[]> {
    const db = await this.load();
    return Object.values(db.pointTransactions)
      .filter((t) => t.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listAllPointTransactions(communityId: string): Promise<PointTransaction[]> {
    const db = await this.load();
    return Object.values(db.pointTransactions).filter((t) => t.communityId === communityId);
  }

  // --- dev -----------------------------------------------------------------

  async reset(): Promise<void> {
    this.cache = emptyDb();
    await this.persist();
  }

  /** Bulk-load (used by the seed script). Missing collections default to empty. */
  async loadSeed(data: Partial<DbShape>): Promise<void> {
    this.cache = { ...emptyDb(), ...data };
    await this.persist();
  }
}
