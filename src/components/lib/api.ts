/** Typed client-side fetch helper for the PATCH API. */
import {
  Alternative,
  PublicResource,
  RankedMatch,
  Request,
} from "@/domain/types";
import { Interpretation } from "@/domain/interpretation";

export interface ApiError {
  message: string;
  issues?: Array<{ path: string; message: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (body?.error ?? { message: "Request failed." }) as ApiError;
    throw new Error(err.message);
  }
  return body as T;
}

export const api = {
  listResources: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    );
    return request<{ items: PublicResource[]; nextCursor?: string; total: number }>(
      `/api/resources?${qs.toString()}`,
    );
  },
  getResource: (id: string) => request<PublicResource>(`/api/resources/${id}`),
  createResource: (body: unknown) =>
    request<PublicResource>(`/api/resources`, { method: "POST", body: JSON.stringify(body) }),
  updateResource: (id: string, body: unknown) =>
    request<PublicResource>(`/api/resources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  analyze: (body: unknown) =>
    request<{
      interpretation: Interpretation;
      matches: RankedMatch[];
      alternatives: Alternative[];
      rejected: Array<{ title: string; reason: string }>;
      noViableMatch: boolean;
      safety?: { blocked: true; message: string; guidance?: string };
      provider: string;
    }>(`/api/fixes/analyze`, { method: "POST", body: JSON.stringify(body) }),

  createRequest: (body: unknown) =>
    request<Request>(`/api/requests`, { method: "POST", body: JSON.stringify(body) }),
  listRequests: () => request<{ outgoing: Request[]; incoming: Request[] }>(`/api/requests`),
  getRequest: (id: string) =>
    request<{ request: Request; resource: PublicResource | null; pickupInstructions?: string }>(
      `/api/requests/${id}`,
    ),
  requestAction: (id: string, action: "accept" | "decline" | "cancel" | "complete") =>
    request<{ request: Request; resource?: PublicResource }>(`/api/requests/${id}/${action}`, {
      method: "POST",
    }),

  map: () =>
    request<{ markers: import("@/app/api/map/route").MapMarker[] }>(`/api/map`),

  // Open community requests ("I need X")
  listCommunityRequests: (status?: string) =>
    request<{ items: import("@/domain/types").PublicCommunityRequest[] }>(
      `/api/community-requests${status ? `?status=${status}` : ""}`,
    ),
  createCommunityRequest: (body: unknown) =>
    request<import("@/domain/types").PublicCommunityRequest>(`/api/community-requests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getCommunityRequest: (id: string) =>
    request<{
      request: import("@/domain/types").PublicCommunityRequest;
      offers: Array<{
        id: string;
        helperId: string;
        helperName: string;
        message: string;
        status: string;
        resourceId?: string;
        createdAt: string;
        mine: boolean;
      }>;
      isRequester: boolean;
    }>(`/api/community-requests/${id}`),
  offerHelp: (id: string, body: { message?: string; resourceId?: string }) =>
    request<unknown>(`/api/community-requests/${id}/offers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  acceptOffer: (offerId: string) =>
    request<unknown>(`/api/offers/${offerId}/accept`, { method: "POST" }),
  declineOffer: (offerId: string) =>
    request<unknown>(`/api/offers/${offerId}/decline`, { method: "POST" }),
  resolveCommunityRequest: (id: string) =>
    request<unknown>(`/api/community-requests/${id}/resolve`, { method: "POST" }),
  cancelCommunityRequest: (id: string) =>
    request<unknown>(`/api/community-requests/${id}/cancel`, { method: "POST" }),

  // Notifications
  notifications: () =>
    request<{ items: import("@/domain/types").Notification[]; unread: number }>(`/api/notifications`),
  markNotificationsRead: (ids?: string[]) =>
    request<{ ok: boolean }>(`/api/notifications`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  // Points
  points: () =>
    request<{
      me: {
        balance: number;
        contributionCount: number;
        transactions: import("@/domain/types").PointTransaction[];
        badges: Array<{ badge: { id: string; name: string; description: string; threshold: number; icon: string }; earned: boolean; current: number }>;
        next: { badge: { id: string; name: string; description: string; threshold: number; icon: string }; earned: boolean; current: number } | null;
      };
      impact: {
        totalContributions: number;
        totalPointsAwarded: number;
        reachedMilestones: Array<{ id: string; label: string; target: number }>;
        nextMilestone: { id: string; label: string; target: number } | null;
        progressPct: number;
        topContributors: Array<{ userId: string; name: string; contributions: number; points: number }>;
      };
    }>(`/api/points`),

  userProfile: (id: string) =>
    request<{
      profile: { id: string; displayName: string; homeZone: string | null; memberSince: string };
      points: {
        balance: number;
        contributionCount: number;
        badges: Array<{ badge: { id: string; name: string; description: string; threshold: number; icon: string }; earned: boolean; current: number }>;
      };
      resources: import("@/domain/types").PublicResource[];
      isSelf: boolean;
    }>(`/api/users/${id}`),

  // Messaging
  listConversations: () =>
    request<{ items: import("@/domain/types").ConversationView[] }>(`/api/conversations`),
  openConversation: (
    contextType: "RESOURCE_REQUEST" | "COMMUNITY_REQUEST",
    contextId: string,
    counterpartId?: string,
  ) =>
    request<import("@/domain/types").Conversation>(`/api/conversations`, {
      method: "POST",
      body: JSON.stringify({ contextType, contextId, counterpartId }),
    }),
  getConversation: (id: string) =>
    request<{
      conversation: import("@/domain/types").ConversationView;
      messages: import("@/domain/types").Message[];
    }>(`/api/conversations/${id}`),
  sendMessage: (id: string, body: string) =>
    request<import("@/domain/types").Message>(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  session: () =>
    request<{ actor: { userId: string; communityId: string }; devMode: boolean; users: Array<{ id: string; displayName: string }> }>(
      `/api/session`,
    ),
  switchUser: (userId: string) =>
    request<{ ok: boolean; userId: string; displayName: string }>(`/api/session`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  reset: () => request<{ ok: boolean }>(`/api/dev/reset`, { method: "POST" }),
};
