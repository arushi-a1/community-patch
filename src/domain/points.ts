/**
 * PATCH Points — reward VERIFIED, completed acts of helpfulness only.
 *
 * Principles (see spec):
 *  - Points are awarded server-side, only when a contribution is verified as
 *    completed (a loan completed, a help request resolved).
 *  - Never for posting, requesting, messaging, or clicking.
 *  - Idempotent: each award is tied to a unique underlying event, so the same
 *    completion can never be rewarded twice.
 *  - Requesters are never penalized for asking/cancelling.
 *  - Points are NOT a trust/safety signal.
 *
 * This module holds the pure config + derivations (amounts, badge/milestone
 * rules). The service layer performs the idempotent, authorized writes.
 */

export const PointEventType = {
  COMMUNITY_REQUEST_FULFILLED: "COMMUNITY_REQUEST_FULFILLED", // helper resolved an open request
  RESOURCE_LOAN_COMPLETED: "RESOURCE_LOAN_COMPLETED", // owner completed a loan/share
  HELPFUL_ANSWER_CONFIRMED: "HELPFUL_ANSWER_CONFIRMED", // (reserved) confirmed useful answer
  CONNECTION_MADE: "CONNECTION_MADE", // (reserved) connected someone to a resolver
  OTHER_CONTRIBUTION: "OTHER_CONTRIBUTION", // (reserved) other approved contribution
} as const;
export type PointEventType = (typeof PointEventType)[keyof typeof PointEventType];

/** Configurable point values (initial). */
export const POINT_VALUES: Record<PointEventType, number> = {
  COMMUNITY_REQUEST_FULFILLED: 25,
  RESOURCE_LOAN_COMPLETED: 15,
  HELPFUL_ANSWER_CONFIRMED: 10,
  CONNECTION_MADE: 10,
  OTHER_CONTRIBUTION: 5,
};

export const POINT_REASONS: Record<PointEventType, string> = {
  COMMUNITY_REQUEST_FULFILLED: "Fulfilled a community help request",
  RESOURCE_LOAN_COMPLETED: "Completed a resource loan",
  HELPFUL_ANSWER_CONFIRMED: "Gave a confirmed-useful answer",
  CONNECTION_MADE: "Connected a neighbor to help",
  OTHER_CONTRIBUTION: "Community contribution",
};

// ---------------------------------------------------------------------------
// Badges — earned from REAL contribution counts.
// ---------------------------------------------------------------------------

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  /** Minimum number of verified completed contributions to earn it. */
  threshold: number;
  icon: string; // lucide icon name (resolved in the UI)
}

export const BADGES: BadgeDef[] = [
  { id: "first-helping-hand", name: "First Helping Hand", description: "Completed your first verified contribution.", threshold: 1, icon: "HandHeart" },
  { id: "resource-sharer", name: "Resource Sharer", description: "Completed 3 loans or shares.", threshold: 3, icon: "Package" },
  { id: "community-helper", name: "Community Helper", description: "Completed 5 helpful contributions.", threshold: 5, icon: "Users" },
  { id: "problem-solver", name: "Problem Solver", description: "Completed 10 contributions.", threshold: 10, icon: "Sparkles" },
  { id: "neighborhood-hero", name: "Neighborhood Hero", description: "Completed 20 contributions — a pillar of the community.", threshold: 20, icon: "Award" },
];

export interface BadgeProgress {
  badge: BadgeDef;
  earned: boolean;
  /** Contributions counted toward this badge. */
  current: number;
}

/** Compute badge states from a verified contribution count. */
export function computeBadges(contributionCount: number): BadgeProgress[] {
  return BADGES.map((badge) => ({
    badge,
    earned: contributionCount >= badge.threshold,
    current: Math.min(contributionCount, badge.threshold),
  }));
}

/** The next unearned badge (for "progress to next" UI), or null if all earned. */
export function nextBadge(contributionCount: number): BadgeProgress | null {
  const upcoming = BADGES.find((b) => contributionCount < b.threshold);
  if (!upcoming) return null;
  return { badge: upcoming, earned: false, current: contributionCount };
}

// ---------------------------------------------------------------------------
// Community milestones — collective, from ACTUAL completed contributions.
// ---------------------------------------------------------------------------

export interface MilestoneDef {
  id: string;
  label: string;
  target: number;
}

export const COMMUNITY_MILESTONES: MilestoneDef[] = [
  { id: "m-10", label: "10 neighbors helped", target: 10 },
  { id: "m-50", label: "50 problems solved together", target: 50 },
  { id: "m-100", label: "100 acts of help", target: 100 },
  { id: "m-250", label: "250 and growing", target: 250 },
];

export function currentMilestone(totalContributions: number): {
  reached: MilestoneDef[];
  next: MilestoneDef | null;
  progressPct: number;
} {
  const reached = COMMUNITY_MILESTONES.filter((m) => totalContributions >= m.target);
  const next = COMMUNITY_MILESTONES.find((m) => totalContributions < m.target) ?? null;
  const prevTarget = reached.length ? reached[reached.length - 1]!.target : 0;
  const progressPct = next
    ? Math.round(((totalContributions - prevTarget) / (next.target - prevTarget)) * 100)
    : 100;
  return { reached, next, progressPct: Math.max(0, Math.min(100, progressPct)) };
}
