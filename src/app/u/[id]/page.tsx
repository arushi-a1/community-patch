"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Award,
  HandHeart,
  Package,
  Users,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/components/lib/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { Button } from "@/components/ui/Button";
import { relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

const BADGE_ICONS: Record<string, LucideIcon> = { HandHeart, Package, Users, Sparkles, Award };

type ProfileData = Awaited<ReturnType<typeof api.userProfile>>;

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .userProfile(id)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (notFound || !data) {
    return <p className="text-[var(--color-ink-soft)]">This member couldn&apos;t be found.</p>;
  }

  const { profile, points, resources } = data;
  const earnedBadges = points.badges.filter((b) => b.earned);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/community" className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Community
      </Link>

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-start gap-5 bg-[var(--color-brand-weak)] p-6 sm:flex-row sm:items-center">
          <Avatar name={profile.displayName} seed={profile.id} size="lg" />
          <div className="flex-1">
            <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">{profile.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-ink-soft)]">
              {profile.homeZone && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden /> {profile.homeZone}
                </span>
              )}
              <span>Member since {relativeTime(profile.memberSince)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-semibold text-[var(--color-accent)]">{points.balance}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">PATCH Points</div>
          </div>
        </div>
      </Card>

      {/* Earned badges */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-[var(--color-ink)]">
          Badges earned ({earnedBadges.length})
        </h2>
        {earnedBadges.length === 0 ? (
          <Card className="p-6 text-sm text-[var(--color-ink-soft)]">
            No badges yet — but every neighbor starts somewhere.
          </Card>
        ) : (
          <div className="flex flex-wrap gap-3">
            {earnedBadges.map(({ badge }) => {
              const Icon = BADGE_ICONS[badge.icon] ?? Award;
              return (
                <div key={badge.id} className="flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] py-1.5 pl-2 pr-4 shadow-[var(--shadow-soft)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-weak)] text-[var(--color-accent)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-[var(--color-ink)]">{badge.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shared resources */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Sharing with the community ({resources.length})
          </h2>
        </div>
        {resources.length === 0 ? (
          <Card className="p-6 text-sm text-[var(--color-ink-soft)]">
            {profile.displayName} isn&apos;t sharing any resources right now.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                footer={
                  <Link href={`/resources/${r.id}`}>
                    <Button variant="secondary" size="sm" className={cn("w-full")}>
                      View details <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

      <Card className="flex items-center gap-3 bg-[#ece4d8] p-4 text-sm text-[var(--color-ink-soft)]">
        <Award className="h-5 w-5 text-[var(--color-brand)]" aria-hidden />
        PATCH Points reflect completed contributions, not identity verification or safety. They&apos;re a
        celebration of helpfulness — not a guarantee.
      </Card>
    </div>
  );
}
