import Link from "next/link";
import { ArrowRight, PlusCircle } from "lucide-react";
import { getRepository } from "@/services/container";
import { getCurrentActor } from "@/services/session";
import { toPublicResource } from "@/domain/projection";
import { AvailabilityStatus, CommunityRequestStatus } from "@/domain/types";
import { USER_DISPLAY } from "@/seed/data";
import { toPublicCommunityRequest } from "@/services/communityRequestService";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { CommunityPulse } from "@/components/community/CommunityPulse";
import { Leaderboard } from "@/components/community/Leaderboard";
import { MapHero } from "@/components/map/MapHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getCurrentActor();
  const repo = getRepository();

  const page = await repo.queryResources({
    communityId: actor.communityId,
    availabilityStatus: AvailabilityStatus.AVAILABLE,
    limit: 6,
  });
  const nearby = page.items.map((r) =>
    toPublicResource(r, USER_DISPLAY[r.ownerId] ?? "A member"),
  );

  // Live community pulse: a few open requests neighbors could help with.
  const crs = await repo.listCommunityRequests(actor.communityId);
  const openCrs = crs.filter(
    (r) => r.status === CommunityRequestStatus.OPEN || r.status === CommunityRequestStatus.MATCHED,
  );
  const pulse = await Promise.all(openCrs.slice(0, 4).map((r) => toPublicCommunityRequest(repo, r)));
  const resolvedCount = crs.filter((r) => r.status === CommunityRequestStatus.RESOLVED).length;

  return (
    <div className="flex flex-col gap-12">
      {/* Map-first hero with the composer floating over the live community map */}
      <div className="patch-rise">
        <MapHero />
      </div>

      {/* Live community pulse */}
      <CommunityPulse requests={pulse} resolvedCount={resolvedCount} />

      {/* Community leaderboard */}
      <Leaderboard />

      {/* Nearby resources */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Nearby &amp; available</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">A few things ready to borrow right now.</p>
          </div>
          <Link href="/discover" className="text-sm font-medium text-[var(--color-brand)] hover:underline">
            See all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              footer={
                <Link href={`/resources/${r.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    View details
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              }
            />
          ))}
        </div>
      </section>

      {/* How PATCH works */}
      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold text-[var(--color-ink)]">How PATCH works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Describe the problem",
              body: "Tell PATCH what's going wrong in plain language. No forms, no browsing.",
            },
            {
              step: "2",
              title: "See feasible fixes",
              body: "PATCH finds real, available resources nearby and rules out what won't work.",
            },
            {
              step: "3",
              title: "Connect & solve it",
              body: "Request what you need. The owner accepts, and you're set.",
            },
          ].map((s) => (
            <Card key={s.step} className="p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-weak)] font-semibold text-[var(--color-brand)]">
                {s.step}
              </span>
              <h3 className="mt-3 font-semibold text-[var(--color-ink)]">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Publish CTA */}
      <section>
        <Card className="flex flex-col items-start gap-3 bg-[var(--color-brand-weak)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Have something others could use?</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Share an item or offer a hand. It takes a minute.
            </p>
          </div>
          <Link href="/resources/new">
            <Button>
              <PlusCircle className="h-4 w-4" aria-hidden />
              List a resource
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
