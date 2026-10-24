/**
 * PATCH domain types — framework-free, shared by UI, API, and services.
 * See product/requirements.md (FR-1..FR-15) and product/architecture.md.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ResourceType = {
  ITEM: "ITEM",
  ASSISTANCE: "ASSISTANCE",
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const Category = {
  ELECTRONICS_ADAPTERS: "ELECTRONICS_ADAPTERS",
  CHARGERS_BATTERIES: "CHARGERS_BATTERIES",
  SCHOOL_SUPPLIES: "SCHOOL_SUPPLIES",
  TOOLS_REPAIR: "TOOLS_REPAIR",
  KITCHEN_HOUSEHOLD: "KITCHEN_HOUSEHOLD",
  EVENT_EQUIPMENT: "EVENT_EQUIPMENT",
  OUTDOOR_WEATHER: "OUTDOOR_WEATHER",
  MOVING_PHYSICAL: "MOVING_PHYSICAL",
  OTHER_HELP: "OTHER_HELP",
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const ResourceCondition = {
  NEW: "NEW",
  GOOD: "GOOD",
  FAIR: "FAIR",
  WORN: "WORN",
  NA: "NA", // assistance offers have no physical condition
} as const;
export type ResourceCondition =
  (typeof ResourceCondition)[keyof typeof ResourceCondition];

export const AvailabilityStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  BORROWED: "BORROWED",
  UNAVAILABLE: "UNAVAILABLE",
  ARCHIVED: "ARCHIVED",
} as const;
export type AvailabilityStatus =
  (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const RequestStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type RequestStatus =
  (typeof RequestStatus)[keyof typeof RequestStatus];

export const Urgency = {
  CRITICAL: "CRITICAL", // minutes
  SOON: "SOON", // hours
  FLEXIBLE: "FLEXIBLE", // days
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

// ---------------------------------------------------------------------------
// Location — a named place with a coarse zone and optional coordinates.
// Walking time is only derived when BOTH endpoints have coordinates.
// ---------------------------------------------------------------------------

export const LocationSchema = z.object({
  /** Human-readable place, e.g. "Student Union". Never an exact home address on public cards. */
  label: z.string().min(1).max(120),
  /** Coarse neighborhood/zone used for approximation when coordinates are absent. */
  zone: z.string().min(1).max(60),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Location = z.infer<typeof LocationSchema>;

// ---------------------------------------------------------------------------
// Compatibility — structured so matching can reason about it, not keyword-match.
// Example: a USB-C→HDMI adapter has sourcePorts:["USB_C"], sinkPorts:["HDMI"].
// ---------------------------------------------------------------------------

export const Port = {
  USB_C: "USB_C",
  USB_A: "USB_A",
  HDMI: "HDMI",
  VGA: "VGA",
  DISPLAYPORT: "DISPLAYPORT",
  THUNDERBOLT: "THUNDERBOLT",
  LIGHTNING: "LIGHTNING",
  MICRO_USB: "MICRO_USB",
  ETHERNET: "ETHERNET",
  AUX_3_5MM: "AUX_3_5MM",
} as const;
export type Port = (typeof Port)[keyof typeof Port];

export const CompatibilitySchema = z.object({
  /** Ports this resource accepts as input (the "from" side). */
  sourcePorts: z.array(z.string()).default([]),
  /** Ports this resource outputs to (the "to" side). */
  sinkPorts: z.array(z.string()).default([]),
  /** Free-form compatibility tags, e.g. "exam-permitted:false", "60W-PD". */
  attributes: z.array(z.string()).default([]),
  /** Explicit notes shown to the user, e.g. "Not permitted in some exams". */
  notes: z.string().max(400).optional(),
});
export type Compatibility = z.infer<typeof CompatibilitySchema>;

// ---------------------------------------------------------------------------
// Availability windows (optional) — for assistance and time-boxed items.
// ---------------------------------------------------------------------------

export const AvailabilityWindowSchema = z.object({
  /** ISO start/end. For assistance these bound when the helper can act. */
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export type AvailabilityWindow = z.infer<typeof AvailabilityWindowSchema>;

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export const ResourceSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  ownerId: z.string(),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).default(""),
  resourceType: z.enum([ResourceType.ITEM, ResourceType.ASSISTANCE]),
  category: z.nativeEnum(Category),
  tags: z.array(z.string().max(40)).max(20).default([]),
  condition: z.nativeEnum(ResourceCondition).default(ResourceCondition.GOOD),
  location: LocationSchema,
  availabilityStatus: z
    .nativeEnum(AvailabilityStatus)
    .default(AvailabilityStatus.AVAILABLE),
  availabilityWindows: z.array(AvailabilityWindowSchema).default([]),
  /** Whether a single borrower exclusively holds this resource when accepted. */
  exclusive: z.boolean().default(true),
  lendingRules: z.string().max(500).default(""),
  /** Disclosed only after a request is ACCEPTED (SR-3). */
  pickupInstructions: z.string().max(500).default(""),
  imageRef: z.string().max(300).optional(),
  compatibility: CompatibilitySchema.default({
    sourcePorts: [],
    sinkPorts: [],
    attributes: [],
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Resource = z.infer<typeof ResourceSchema>;

/** Public projection — strips pickup instructions and owner-private data. */
export type PublicResource = Omit<Resource, "pickupInstructions"> & {
  ownerDisplayName: string;
};

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  displayName: z.string().min(1).max(80),
  /** Private — never returned by public endpoints (SR-2). */
  email: z.string().email().optional(),
  /** Home zone for coarse distance; never an exact address on public cards. */
  homeZone: z.string().max(60).optional(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export type PublicUser = Pick<User, "id" | "displayName" | "communityId">;

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export const RequestSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  resourceId: z.string(),
  /** Denormalized for fast owner-side queries + conflict checks. */
  resourceOwnerId: z.string(),
  requesterId: z.string(),
  status: z.nativeEnum(RequestStatus).default(RequestStatus.PENDING),
  /** ISO time the requester wants the resource. */
  requestedTime: z.string().datetime().optional(),
  pickupContext: z.string().max(400).default(""),
  message: z.string().max(600).default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Request = z.infer<typeof RequestSchema>;

// ---------------------------------------------------------------------------
// Matching result types (computed, never persisted)
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  semantic: number;
  time: number;
  location: number;
  compatibility: number;
  condition: number;
  /** Weighted, normalized 0..1 */
  total: number;
}

export interface MatchExplanation {
  /** Short grounded bullets referencing real fields/computed facts. */
  reasons: string[];
  /** Assumptions or uncertainty surfaced honestly to the user. */
  caveats: string[];
}

export interface RankedMatch {
  resource: PublicResource;
  score: ScoreBreakdown;
  explanation: MatchExplanation;
  /** Walk estimate only present when reliable coordinates exist. */
  walkMinutes?: number;
  distanceKm?: number;
}

export interface Alternative {
  resource: PublicResource;
  /** Why this achieves the same outcome a different way. */
  rationale: string;
  /** True when the alternative must be confirmed before relying on it. */
  needsConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Community requests — an open "I need X" post that is NOT tied to an existing
// resource. Anyone nearby can offer to fill it. This is distinct from a
// `Request` (which targets a specific listed resource).
// ---------------------------------------------------------------------------

export const CommunityRequestStatus = {
  OPEN: "OPEN", // posted, awaiting offers
  MATCHED: "MATCHED", // an offer was accepted; being coordinated
  RESOLVED: "RESOLVED", // the need was met
  CANCELLED: "CANCELLED", // withdrawn by requester
  EXPIRED: "EXPIRED", // deadline passed with no resolution (optional)
} as const;
export type CommunityRequestStatus =
  (typeof CommunityRequestStatus)[keyof typeof CommunityRequestStatus];

export const OfferStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const OfferSchema = z.object({
  id: z.string(),
  communityRequestId: z.string(),
  helperId: z.string(),
  /** Optional: a listed resource the helper is offering to fulfill the need. */
  resourceId: z.string().optional(),
  message: z.string().max(600).default(""),
  status: z.nativeEnum(OfferStatus).default(OfferStatus.PENDING),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const CommunityRequestSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  requesterId: z.string(),
  title: z.string().min(2).max(120),
  description: z.string().max(1000).default(""),
  category: z.nativeEnum(Category),
  quantity: z.number().int().min(1).max(100).default(1),
  urgency: z.enum(["CRITICAL", "SOON", "FLEXIBLE"]).default("FLEXIBLE"),
  deadline: z.string().datetime().optional(),
  /** Coarse location for proximity + map; never an exact address. */
  location: LocationSchema.optional(),
  status: z.nativeEnum(CommunityRequestStatus).default(CommunityRequestStatus.OPEN),
  /** The accepted offer id, when MATCHED/RESOLVED. */
  acceptedOfferId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommunityRequest = z.infer<typeof CommunityRequestSchema>;

/** Public projection of a community request (requester shown as display name). */
export type PublicCommunityRequest = CommunityRequest & {
  requesterDisplayName: string;
  offerCount: number;
};

// ---------------------------------------------------------------------------
// Notifications — persisted, in-app. Fetched on load / poll (no push infra).
// ---------------------------------------------------------------------------

export const NotificationType = {
  NEARBY_REQUEST: "NEARBY_REQUEST", // an open request was posted near you
  NEW_OFFER: "NEW_OFFER", // someone offered to help your request
  OFFER_ACCEPTED: "OFFER_ACCEPTED", // your offer was accepted
  OFFER_DECLINED: "OFFER_DECLINED", // your offer was declined
  REQUEST_RESOLVED: "REQUEST_RESOLVED", // a request you're part of resolved
  RESOURCE_REQUEST: "RESOURCE_REQUEST", // someone requested your listed resource
  REQUEST_ACCEPTED: "REQUEST_ACCEPTED", // your resource request was accepted
  POINTS_AWARDED: "POINTS_AWARDED", // you earned PATCH points
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  /** Recipient. */
  userId: z.string(),
  type: z.nativeEnum(NotificationType),
  title: z.string().max(160),
  body: z.string().max(400).default(""),
  /** Deep-link target within the app, e.g. "/community/requests/<id>". */
  href: z.string().max(200).optional(),
  read: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ---------------------------------------------------------------------------
// Messaging — persisted conversations tied to a request or community request.
// Polling-based (no realtime infra); structured so realtime can be added later.
// ---------------------------------------------------------------------------

export const ConversationContextType = {
  RESOURCE_REQUEST: "RESOURCE_REQUEST", // a Request against a listed resource
  COMMUNITY_REQUEST: "COMMUNITY_REQUEST", // an open community request
} as const;
export type ConversationContextType =
  (typeof ConversationContextType)[keyof typeof ConversationContextType];

export const ConversationSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  contextType: z.nativeEnum(ConversationContextType),
  /** Id of the Request or CommunityRequest this conversation is about. */
  contextId: z.string(),
  /** Short label for the conversation list, e.g. the resource/request title. */
  subject: z.string().max(160),
  /** Exactly two participant user ids. */
  participantIds: z.array(z.string()).length(2),
  lastMessageAt: z.string().datetime().optional(),
  lastMessagePreview: z.string().max(160).optional(),
  /** Per-participant last-read timestamp (ISO), keyed by userId. */
  lastReadBy: z.record(z.string(), z.string().datetime()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

// ---------------------------------------------------------------------------
// PATCH Points — ledger of verified, completed contributions. Balance is
// derived by summing transactions. Idempotency key prevents double-awards.
// ---------------------------------------------------------------------------

export const PointTransactionSchema = z.object({
  /** Deterministic idempotency id: `${eventType}:${eventId}:${userId}`. */
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  amount: z.number().int(),
  eventType: z.string(),
  /** The underlying contribution id (request/offer id) this reward is tied to. */
  eventId: z.string(),
  reason: z.string().max(160),
  createdAt: z.string().datetime(),
});
export type PointTransaction = z.infer<typeof PointTransactionSchema>;

/** Public conversation view with the other participant's display name. */
export type ConversationView = Conversation & {
  otherParticipantName: string;
  unreadForMe: boolean;
};
