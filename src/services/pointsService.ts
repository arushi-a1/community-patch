/**
 * PATCH Points service. Awards are idempotent, server-side, and only fire on
 * VERIFIED completions. Balances/badges/milestones are DERIVED from the ledger
 * (no stored balance a user could tamper with).
 */
import {
  BADGES,
  computeBadges,
  COMMUNITY_MILESTONES,
  currentMilestone,
  nextBadge,
  PointEventType,
  POINT_REASONS,
  POINT_VALUES,
} from "@/domain/points";
import { NotificationType, PointTransaction } from "@/domain/types";
import { nowIso } from "@/domain/time";
import { Repository } from "./repository";
import { USER_DISPLAY } from "@/seed/data";

/** Deterministic idempotency id for an award. */
function txId(eventType: PointEventType, eventId: string, userId: string): string {
  return `${eventType}:${eventId}:${userId}`;
}

/**
 * Award points for a completed contribution, exactly once. Safe to call
 * multiple times for the same event — only the first call inserts + notifies.
 */
export async function awardPoints(
  repo: Repository,
  args: {
    communityId: string;
    userId: string;
    eventType: PointEventType;
    eventId: string;
  },
): Promise<{ created: boolean; amount: number }> {
  const amount = POINT_VALUES[args.eventType];
  const tx: PointTransaction = {
    id: txId(args.eventType, args.eventId, args.userId),
    communityId: args.communityId,
    userId: args.userId,
    amount,
    eventType: args.eventType,
    eventId: args.eventId,
    reason: POINT_REASONS[args.eventType],
    createdAt: nowIso(),
  };

  const result = await repo.awardPointsOnce(tx);
  if (result.created) {
    // Notify the earner (first time only).
    await repo.putNotification({
      id: `ntf-pts-${tx.id}`,
      communityId: args.communityId,
      userId: args.userId,
      type: NotificationType.POINTS_AWARDED,
      title: `+${amount} PATCH Points`,
      body: POINT_REASONS[args.eventType],
      href: "/points",
      read: false,
      createdAt: tx.createdAt,
    });
  }
  return { created: result.created, amount };
}

export interface PointsSummary {
  balance: number;
  contributionCount: number;
  transactions: PointTransaction[];
  badges: ReturnType<typeof computeBadges>;
  next: ReturnType<typeof nextBadge>;
}

export async function getUserPoints(repo: Repository, userId: string): Promise<PointsSummary> {
  const transactions = await repo.listPointTransactionsForUser(userId);
  const positive = transactions.filter((t) => t.amount > 0);
  const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
  const contributionCount = positive.length;
  return {
    balance,
    contributionCount,
    transactions,
    badges: computeBadges(contributionCount),
    next: nextBadge(contributionCount),
  };
}

export interface CommunityImpact {
  totalContributions: number;
  totalPointsAwarded: number;
  reachedMilestones: typeof COMMUNITY_MILESTONES;
  nextMilestone: (typeof COMMUNITY_MILESTONES)[number] | null;
  progressPct: number;
  /** Celebratory leaderboard (display names + ids for linking to profiles). */
  topContributors: Array<{ userId: string; name: string; contributions: number; points: number }>;
}

export async function getCommunityImpact(repo: Repository, communityId: string): Promise<CommunityImpact> {
  const all = await repo.listAllPointTransactions(communityId);
  const positive = all.filter((t) => t.amount > 0);
  const totalContributions = positive.length;
  const totalPointsAwarded = positive.reduce((s, t) => s + t.amount, 0);

  const byUser = new Map<string, { contributions: number; points: number }>();
  for (const t of positive) {
    const cur = byUser.get(t.userId) ?? { contributions: 0, points: 0 };
    cur.contributions += 1;
    cur.points += t.amount;
    byUser.set(t.userId, cur);
  }
  const topContributors = [...byUser.entries()]
    .map(([userId, v]) => ({ userId, name: USER_DISPLAY[userId] ?? "A member", ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const m = currentMilestone(totalContributions);
  return {
    totalContributions,
    totalPointsAwarded,
    reachedMilestones: m.reached,
    nextMilestone: m.next,
    progressPct: m.progressPct,
    topContributors,
  };
}

export { BADGES };
