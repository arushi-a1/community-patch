/**
 * DynamoDB repository adapter (single-table design — see product/architecture.md §6).
 *
 * This adapter is DESIGNED and implemented against the AWS SDK v3 Document
 * Client, but it is only loaded when PATCH_PERSISTENCE=dynamo. It is NOT
 * exercised in the local demo because no AWS credentials are configured here;
 * the local adapter provides identical business guarantees for the demo.
 *
 * Key schema (table name from PATCH_DDB_TABLE):
 *   PK, SK                         primary
 *   GSI1 (GSI1PK, GSI1SK)          by owner
 *   GSI2 (GSI2PK, GSI2SK)          by community+category
 *   GSI4 (GSI4PK, GSI4SK)          requests by resource
 *
 * The accept operation uses TransactWriteItems with a ConditionExpression on
 * the resource's availabilityStatus so an exclusive item can't be double-booked.
 */
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

// Keys -----------------------------------------------------------------------

const K = {
  user: (id: string) => ({ PK: `USER#${id}`, SK: "PROFILE" }),
  resource: (communityId: string, id: string) => ({
    PK: `COMMUNITY#${communityId}`,
    SK: `RESOURCE#${id}`,
  }),
  request: (requesterId: string, id: string) => ({
    PK: `USER#${requesterId}`,
    SK: `REQ#${id}`,
  }),
};

interface DynamoDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any;
  table: string;
}

export class DynamoRepository implements Repository {
  private depsPromise: Promise<DynamoDeps> | null = null;

  private deps(): Promise<DynamoDeps> {
    if (this.depsPromise) return this.depsPromise;
    this.depsPromise = (async () => {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
      const region = process.env.AWS_REGION ?? process.env.PATCH_AWS_REGION ?? "us-east-1";
      const table = process.env.PATCH_DDB_TABLE;
      if (!table) throw new Error("PATCH_DDB_TABLE is required for the DynamoDB adapter.");
      const client = new DynamoDBClient({ region });
      const doc = DynamoDBDocumentClient.from(client, {
        marshallOptions: { removeUndefinedValues: true },
      });
      return { doc, table };
    })();
    return this.depsPromise;
  }

  // Users ---------------------------------------------------------------------

  async getUser(id: string): Promise<User | null> {
    const { doc, table } = await this.deps();
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(new GetCommand({ TableName: table, Key: K.user(id) }));
    return (out.Item as User) ?? null;
  }

  async listUsers(communityId: string): Promise<User[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: { ":pk": `COMMUNITY#${communityId}#USER` },
      }),
    );
    return (out.Items as User[]) ?? [];
  }

  async putUser(user: User): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          ...K.user(user.id),
          GSI2PK: `COMMUNITY#${user.communityId}#USER`,
          GSI2SK: `USER#${user.id}`,
          ...user,
        },
      }),
    );
  }

  // Resources -----------------------------------------------------------------

  async getResource(id: string): Promise<Resource | null> {
    // Secondary lookup by id via GSI (resource id embedded in SK). For brevity
    // we scan the GSI by resource id key; in production store a direct GSI.
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: { ":pk": `RESOURCE#${id}` },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0] as Resource | undefined;
    return item ?? null;
  }

  async queryResources(query: ResourceQuery): Promise<Page<Resource>> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const useCategory = Boolean(query.category);
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: useCategory ? "GSI2" : undefined,
        KeyConditionExpression: useCategory
          ? "GSI2PK = :pk"
          : "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: useCategory
          ? { ":pk": `CAT#${query.communityId}#${query.category}` }
          : { ":pk": `COMMUNITY#${query.communityId}`, ":sk": "RESOURCE#" },
        Limit: query.limit ?? 24,
        ExclusiveStartKey: query.cursor ? JSON.parse(query.cursor) : undefined,
      }),
    );
    let items = (out.Items as Resource[]) ?? [];
    if (!query.includeArchived) {
      items = items.filter((r) => r.availabilityStatus !== AvailabilityStatus.ARCHIVED);
    }
    if (query.availabilityStatus) {
      items = items.filter((r) => r.availabilityStatus === query.availabilityStatus);
    }
    if (query.keyword) {
      const k = query.keyword.toLowerCase();
      items = items.filter((r) =>
        [r.title, r.description, ...r.tags].join(" ").toLowerCase().includes(k),
      );
    }
    return {
      items,
      total: items.length,
      nextCursor: out.LastEvaluatedKey ? JSON.stringify(out.LastEvaluatedKey) : undefined,
    };
  }

  async putResource(resource: Resource): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          ...K.resource(resource.communityId, resource.id),
          GSI1PK: `OWNER#${resource.ownerId}`,
          GSI1SK: `RESOURCE#${resource.id}`,
          GSI2PK: `CAT#${resource.communityId}#${resource.category}`,
          GSI2SK: `RESOURCE#${resource.id}`,
          GSI4PK: `RESOURCE#${resource.id}`,
          GSI4SK: `RESOURCE#${resource.id}`,
          ...resource,
        },
      }),
    );
  }

  async updateResource(id: string, patch: Partial<Resource>): Promise<Resource> {
    const existing = await this.getResource(id);
    if (!existing) throw new Error(`Resource not found: ${id}`);
    const updated: Resource = { ...existing, ...patch, updatedAt: nowIso() };
    await this.putResource(updated);
    return updated;
  }

  // Requests ------------------------------------------------------------------

  async getRequest(id: string): Promise<Request | null> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk AND begins_with(GSI4SK, :sk)",
        ExpressionAttributeValues: { ":pk": `REQ#${id}`, ":sk": "REQ#" },
        Limit: 1,
      }),
    );
    return ((out.Items?.[0] as Request) ?? null) || null;
  }

  async listRequestsByRequester(requesterId: string): Promise<Request[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `USER#${requesterId}`, ":sk": "REQ#" },
      }),
    );
    return (out.Items as Request[]) ?? [];
  }

  async listRequestsByOwner(ownerId: string): Promise<Request[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :pk",
        ExpressionAttributeValues: { ":pk": `OWNER#${ownerId}` },
      }),
    );
    return (out.Items as Request[]) ?? [];
  }

  async listRequestsByResource(resourceId: string): Promise<Request[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk AND begins_with(GSI4SK, :sk)",
        ExpressionAttributeValues: { ":pk": `RESOURCE#${resourceId}`, ":sk": "REQ#" },
      }),
    );
    return (out.Items as Request[]) ?? [];
  }

  async listAllRequests(communityId: string): Promise<Request[]> {
    // Requests carry GSI2PK = COMMUNITY#<cid>#REQ for single-pass community reads.
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: { ":pk": `COMMUNITY#${communityId}#REQ` },
      }),
    );
    return (out.Items as Request[]) ?? [];
  }

  async putRequest(request: Request): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          ...K.request(request.requesterId, request.id),
          GSI2PK: `COMMUNITY#${request.communityId}#REQ`,
          GSI2SK: `REQ#${request.id}`,
          GSI3PK: `OWNER#${request.resourceOwnerId}`,
          GSI3SK: `REQ#${request.id}`,
          GSI4PK: `RESOURCE#${request.resourceId}`,
          GSI4SK: `REQ#${request.id}`,
          ...request,
        },
      }),
    );
  }

  async updateRequestStatus(id: string, status: RequestStatus): Promise<Request> {
    const existing = await this.getRequest(id);
    if (!existing) throw new Error(`Request not found: ${id}`);
    const updated: Request = { ...existing, status, updatedAt: nowIso() };
    await this.putRequest(updated);
    return updated;
  }

  /**
   * Atomic accept via TransactWriteItems. The resource update is guarded by a
   * ConditionExpression requiring availabilityStatus = AVAILABLE, so two
   * concurrent accepts cannot both succeed (AC-5).
   */
  async acceptRequestAtomic(args: {
    requestId: string;
    reserveResource: boolean;
  }): Promise<AcceptResult> {
    const request = await this.getRequest(args.requestId);
    if (!request) return { ok: false, reason: "Request not found." };
    const resource = await this.getResource(request.resourceId);
    if (!resource) return { ok: false, reason: "Resource not found." };
    if (request.status !== RequestStatus.PENDING) {
      return { ok: false, reason: `Request is ${request.status}, not PENDING.` };
    }

    const { doc, table } = await this.deps();
    const { TransactWriteCommand } = await import("@aws-sdk/lib-dynamodb");
    const ts = nowIso();

    const transactItems: unknown[] = [
      {
        Update: {
          TableName: table,
          Key: K.request(request.requesterId, request.id),
          UpdateExpression: "SET #s = :accepted, updatedAt = :ts",
          ConditionExpression: "#s = :pending",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":accepted": RequestStatus.ACCEPTED,
            ":pending": RequestStatus.PENDING,
            ":ts": ts,
          },
        },
      },
    ];

    if (args.reserveResource) {
      transactItems.push({
        Update: {
          TableName: table,
          Key: K.resource(resource.communityId, resource.id),
          UpdateExpression: "SET availabilityStatus = :reserved, updatedAt = :ts",
          ConditionExpression: "availabilityStatus = :available",
          ExpressionAttributeValues: {
            ":reserved": AvailabilityStatus.RESERVED,
            ":available": AvailabilityStatus.AVAILABLE,
            ":ts": ts,
          },
        },
      });
    }

    try {
      await doc.send(new TransactWriteCommand({ TransactItems: transactItems as never }));
      return {
        ok: true,
        request: { ...request, status: RequestStatus.ACCEPTED, updatedAt: ts },
        resource: args.reserveResource
          ? { ...resource, availabilityStatus: AvailabilityStatus.RESERVED, updatedAt: ts }
          : resource,
      };
    } catch {
      // A cancelled transaction means the condition failed (already taken).
      return { ok: false, conflict: true, reason: "Resource is no longer available." };
    }
  }

  // --- community requests / offers / notifications -------------------------
  // Keys (single-table):
  //   CR:    PK COMMUNITY#<cid>  SK CREQ#<id>     ; GSI1 OWNER#<uid> / CREQ#<id>
  //   Offer: PK CREQ#<crid>      SK OFFER#<id>    ; GSI1 HELPER#<uid> / OFFER#<id>
  //   Notif: PK USER#<uid>       SK NOTIF#<id>

  async getCommunityRequest(id: string): Promise<CommunityRequest | null> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: { ":pk": `CREQ#${id}` },
        Limit: 1,
      }),
    );
    return (out.Items?.[0] as CommunityRequest) ?? null;
  }

  async listCommunityRequests(communityId: string): Promise<CommunityRequest[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `COMMUNITY#${communityId}`, ":sk": "CREQ#" },
      }),
    );
    return (out.Items as CommunityRequest[]) ?? [];
  }

  async listCommunityRequestsByRequester(requesterId: string): Promise<CommunityRequest[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
        ExpressionAttributeValues: { ":pk": `OWNER#${requesterId}`, ":sk": "CREQ#" },
      }),
    );
    return (out.Items as CommunityRequest[]) ?? [];
  }

  async putCommunityRequest(request: CommunityRequest): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `COMMUNITY#${request.communityId}`,
          SK: `CREQ#${request.id}`,
          GSI1PK: `OWNER#${request.requesterId}`,
          GSI1SK: `CREQ#${request.id}`,
          GSI4PK: `CREQ#${request.id}`,
          GSI4SK: `CREQ#${request.id}`,
          ...request,
        },
      }),
    );
  }

  async updateCommunityRequest(
    id: string,
    patch: Partial<CommunityRequest>,
  ): Promise<CommunityRequest> {
    const existing = await this.getCommunityRequest(id);
    if (!existing) throw new Error(`Community request not found: ${id}`);
    const updated: CommunityRequest = { ...existing, ...patch, updatedAt: nowIso() };
    await this.putCommunityRequest(updated);
    return updated;
  }

  async getOffer(id: string): Promise<Offer | null> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: { ":pk": `OFFER#${id}` },
        Limit: 1,
      }),
    );
    return (out.Items?.[0] as Offer) ?? null;
  }

  async listOffersByRequest(communityRequestId: string): Promise<Offer[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `CREQ#${communityRequestId}`, ":sk": "OFFER#" },
      }),
    );
    return (out.Items as Offer[]) ?? [];
  }

  async listOffersByHelper(helperId: string): Promise<Offer[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
        ExpressionAttributeValues: { ":pk": `HELPER#${helperId}`, ":sk": "OFFER#" },
      }),
    );
    return (out.Items as Offer[]) ?? [];
  }

  async putOffer(offer: Offer): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `CREQ#${offer.communityRequestId}`,
          SK: `OFFER#${offer.id}`,
          GSI1PK: `HELPER#${offer.helperId}`,
          GSI1SK: `OFFER#${offer.id}`,
          GSI4PK: `OFFER#${offer.id}`,
          GSI4SK: `OFFER#${offer.id}`,
          ...offer,
        },
      }),
    );
  }

  async acceptOfferAtomic(args: { offerId: string }): Promise<AcceptOfferResult> {
    const offer = await this.getOffer(args.offerId);
    if (!offer) return { ok: false, reason: "Offer not found." };
    const cr = await this.getCommunityRequest(offer.communityRequestId);
    if (!cr) return { ok: false, reason: "Request not found." };
    if (offer.status !== OfferStatus.PENDING) {
      return { ok: false, reason: `Offer is ${offer.status}, not pending.` };
    }

    const { doc, table } = await this.deps();
    const { TransactWriteCommand } = await import("@aws-sdk/lib-dynamodb");
    const ts = nowIso();
    try {
      await doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: table,
                Key: { PK: `COMMUNITY#${cr.communityId}`, SK: `CREQ#${cr.id}` },
                UpdateExpression: "SET #s = :matched, acceptedOfferId = :oid, updatedAt = :ts",
                ConditionExpression: "#s = :open",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":matched": CommunityRequestStatus.MATCHED,
                  ":open": CommunityRequestStatus.OPEN,
                  ":oid": offer.id,
                  ":ts": ts,
                },
              },
            },
            {
              Update: {
                TableName: table,
                Key: { PK: `CREQ#${offer.communityRequestId}`, SK: `OFFER#${offer.id}` },
                UpdateExpression: "SET #s = :accepted, updatedAt = :ts",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: { ":accepted": OfferStatus.ACCEPTED, ":ts": ts },
              },
            },
          ] as never,
        }),
      );
      return {
        ok: true,
        offer: { ...offer, status: OfferStatus.ACCEPTED, updatedAt: ts },
        request: { ...cr, status: CommunityRequestStatus.MATCHED, acceptedOfferId: offer.id, updatedAt: ts },
      };
    } catch {
      return { ok: false, conflict: true, reason: "This request was already matched." };
    }
  }

  async putNotification(notification: Notification): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `USER#${notification.userId}`,
          SK: `NOTIF#${notification.id}`,
          ...notification,
        },
      }),
    );
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": "NOTIF#" },
      }),
    );
    return (out.Items as Notification[]) ?? [];
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    const list = await this.listNotifications(userId);
    const target = ids ? list.filter((n) => ids.includes(n.id)) : list;
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    for (const n of target) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: { PK: `USER#${userId}`, SK: `NOTIF#${n.id}`, ...n, read: true },
        }),
      );
    }
  }

  // --- messaging -----------------------------------------------------------
  // Conversation: PK CONV#<id> SK META ; plus a per-user pointer
  //   PK USER#<uid> SK CONV#<id> (for listConversationsForUser).
  // Message: PK CONV#<cid> SK MSG#<createdAt>#<id>.

  async getConversation(id: string): Promise<Conversation | null> {
    const { doc, table } = await this.deps();
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new GetCommand({ TableName: table, Key: { PK: `CONV#${id}`, SK: "META" } }),
    );
    return (out.Item as Conversation) ?? null;
  }

  async findConversationByContext(
    contextId: string,
    participantIds: string[],
  ): Promise<Conversation | null> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: { ":pk": `CTX#${contextId}` },
      }),
    );
    const key = [...participantIds].sort().join("|");
    return (
      ((out.Items as Conversation[]) ?? []).find(
        (c) => [...c.participantIds].sort().join("|") === key,
      ) ?? null
    );
  }

  async listConversationsForUser(userId: string): Promise<Conversation[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": "CONV#" },
      }),
    );
    return (out.Items as Conversation[]) ?? [];
  }

  async putConversation(conversation: Conversation): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    // Canonical record + a pointer row per participant.
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `CONV#${conversation.id}`,
          SK: "META",
          GSI4PK: `CTX#${conversation.contextId}`,
          GSI4SK: `CONV#${conversation.id}`,
          ...conversation,
        },
      }),
    );
    for (const uid of conversation.participantIds) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: { PK: `USER#${uid}`, SK: `CONV#${conversation.id}`, ...conversation },
        }),
      );
    }
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `CONV#${conversationId}`, ":sk": "MSG#" },
      }),
    );
    return (out.Items as Message[]) ?? [];
  }

  async putMessage(message: Message): Promise<void> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `CONV#${message.conversationId}`,
          SK: `MSG#${message.createdAt}#${message.id}`,
          ...message,
        },
      }),
    );
  }

  // --- points --------------------------------------------------------------
  // PointTransaction: PK PTX#<id> SK META ; GSI3 OWNER#<uid> for per-user list;
  // GSI2 COMMUNITY#<cid>#PTX for community totals. Idempotent via conditional put.

  async awardPointsOnce(
    tx: PointTransaction,
  ): Promise<{ created: boolean; transaction: PointTransaction }> {
    const { doc, table } = await this.deps();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    try {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: {
            PK: `PTX#${tx.id}`,
            SK: "META",
            GSI3PK: `OWNER#${tx.userId}`,
            GSI3SK: `PTX#${tx.createdAt}`,
            GSI2PK: `COMMUNITY#${tx.communityId}#PTX`,
            GSI2SK: `PTX#${tx.id}`,
            ...tx,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return { created: true, transaction: tx };
    } catch {
      // Condition failed → already awarded. Read it back.
      const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
      const out = await doc.send(new GetCommand({ TableName: table, Key: { PK: `PTX#${tx.id}`, SK: "META" } }));
      return { created: false, transaction: (out.Item as PointTransaction) ?? tx };
    }
  }

  async listPointTransactionsForUser(userId: string): Promise<PointTransaction[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :pk AND begins_with(GSI3SK, :sk)",
        ExpressionAttributeValues: { ":pk": `OWNER#${userId}`, ":sk": "PTX#" },
      }),
    );
    return (out.Items as PointTransaction[]) ?? [];
  }

  async listAllPointTransactions(communityId: string): Promise<PointTransaction[]> {
    const { doc, table } = await this.deps();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const out = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: { ":pk": `COMMUNITY#${communityId}#PTX` },
      }),
    );
    return (out.Items as PointTransaction[]) ?? [];
  }
}
