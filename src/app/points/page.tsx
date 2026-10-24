"use client";
import { useEffect, useState } from "react";
import {
  Award,
  HandHeart,
  Package,
  Users,
  Sparkles,
  Trophy,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

const BADGE_ICONS: Record<string, LucideIcon> = {
  HandHeart,
  Package,
  Users,
  Sparkles,
  Award,
};

type PointsData = Awaited<ReturnType<typeof api.points>>;

export default function PointsPage() {
  const { actorId } = useSession();
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .points()
      .then(setData)
      .finally(() => setLoading(false));
  }, [actorId]);

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { me, impact } = data;
  const next = me.next;
  const progressPct = next
    ? Math.round((me.contributionCount / next.badge.threshold) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          PATCH Points
        </h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Earned for real, completed help — never for posting or clicking. It&apos;s a measure of
          contribution, not a trust score.
        </p>
      </div>

      {/* Balance + progress hero */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col justify-center gap-1 bg-[var(--color-brand-deep)] p-7 text-[var(--color-cream)]">
            <span className="text-sm font-medium text-[var(--color-cream-soft)]">Your balance</span>
            <span className="font-display text-5xl font-semibold">{me.balance}</span>
            <span className="text-sm text-[var(--color-cream-soft)]">
              from {me.contributionCount} completed contribution{me.contributionCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-3 p-7">
            {next ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--color-ink)]">
                    Next badge: {next.badge.name}
                  </span>
                  <span className="text-[var(--color-ink-soft)]">
                    {me.contributionCount}/{next.badge.threshold}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--color-ink-soft)]">{next.badge.description}</p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[var(--color-brand)]">
                <Trophy className="h-5 w-5" aria-hidden />
                <span className="font-medium">You&apos;ve earned every badge. Legend.</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Badges */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-[var(--color-ink)]">Your badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {me.badges.map(({ badge, earned }) => {
            const Icon = BADGE_ICONS[badge.icon] ?? Award;
            return (
              <Card
                key={badge.id}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 text-center transition-opacity",
                  !earned && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    earned ? "bg-[var(--color-accent-weak)] text-[var(--color-accent)]" : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]",
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-[var(--color-ink)]">{badge.name}</span>
                <span className="text-xs text-[var(--color-ink-soft)]">{badge.description}</span>
                {earned && <Badge tone="accent">Earned</Badge>}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Community impact */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-[var(--color-ink)]">
          Community impact
        </h2>
        <Card className="p-6">
          <div className="grid gap-6 sm:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="font-display text-4xl font-semibold text-[var(--color-brand)]">
                    {impact.totalContributions}
                  </span>
                  <p className="text-sm text-[var(--color-ink-soft)]">neighbors helped</p>
                </div>
                <div>
                  <span className="font-display text-4xl font-semibold text-[var(--color-accent)]">
                    {impact.totalPointsAwarded}
                  </span>
                  <p className="text-sm text-[var(--color-ink-soft)]">points earned together</p>
                </div>
              </div>
              {impact.nextMilestone && (
                <div className="mt-5">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                      <TrendingUp className="h-4 w-4" aria-hidden />
                      Next: {impact.nextMilestone.label}
                    </span>
                    <span className="text-[var(--color-ink-soft)]">
                      {impact.totalContributions}/{impact.nextMilestone.target}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-500"
                      style={{ width: `${impact.progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Celebratory contributor highlight (display names only) */}
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Top contributors this season</p>
              {impact.topContributors.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-soft)]">Be the first to help!</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {impact.topContributors.map((c, i) => (
                    <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-weak)] text-xs font-semibold text-[var(--color-brand)]">
                          {i + 1}
                        </span>
                        <span className="text-[var(--color-ink)]">{c.name}</span>
                      </span>
                      <span className="text-[var(--color-ink-soft)]">
                        {c.points} pts · {c.contributions} helped
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Transaction history */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-[var(--color-ink)]">
          Your contribution history
        </h2>
        {me.transactions.length === 0 ? (
          <Card className="p-8 text-center">
            <HandHeart className="mx-auto h-8 w-8 text-[var(--color-brand)]" aria-hidden />
            <p className="mt-2 font-medium text-[var(--color-ink)]">No points yet</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Complete a loan or fulfill a community request to earn your first points.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--color-line)]">
            {me.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{t.reason}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{relativeTime(t.createdAt)}</p>
                </div>
                <span className="font-display text-lg font-semibold text-[var(--color-accent)]">
                  +{t.amount}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
