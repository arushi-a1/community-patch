import { CommunityMap } from "@/components/map/CommunityMap";

export const metadata = { title: "Community map — PATCH" };

export default function MapPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          What&apos;s available around you
        </h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Real resources and open requests from your community, on the map. Locations are
          approximate — exact pickup details are shared only after a request is accepted.
        </p>
      </div>
      <CommunityMap />
    </div>
  );
}
