"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, ArrowRight, Loader2 } from "lucide-react";
import { MapMarker } from "@/app/api/map/route";
import { api } from "@/components/lib/api";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-accent-weak)]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand)]" aria-hidden />
    </div>
  ),
});

/**
 * Landing-page live map preview. Shows real markers; the whole surface links
 * into the full /map experience. Pointer events on the map itself are disabled
 * so the card reads as a preview (click anywhere → full map).
 */
export function MapPreview() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .map()
      .then((r) => setMarkers(r.markers))
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, []);

  const resourceCount = markers.filter((m) => m.kind === "RESOURCE").length;
  const requestCount = markers.filter((m) => m.kind === "REQUEST").length;
  const assistCount = markers.filter((m) => m.kind === "ASSISTANCE").length;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
            Help, mapped around campus
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Real resources and open requests near the UW. Locations are approximate for privacy.
          </p>
        </div>
        <Link href="/map" className="hidden text-sm font-medium text-[var(--color-brand)] hover:underline sm:block">
          Open the map
        </Link>
      </div>

      <Link
        href="/map"
        className="group relative block overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]"
        aria-label="Open the full community map"
      >
        {/* Map canvas (preview — not individually interactive) */}
        <div className="pointer-events-none h-[300px] sm:h-[360px]">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center bg-[var(--color-accent-weak)]">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand)]" aria-hidden />
            </div>
          ) : (
            <MapCanvas markers={markers} onSelect={() => {}} />
          )}
        </div>

        {/* Gradient + CTA overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[var(--color-brand-deep)]/85 via-[var(--color-brand-deep)]/30 to-transparent p-5">
          <div className="text-[var(--color-cream)]">
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
              <MapPinned className="h-5 w-5" aria-hidden />
              {markers.length} spots nearby
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-cream-soft)]">
              {resourceCount} resources · {assistCount} assistance · {requestCount} needs help
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-soft)]">
            Explore
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
}
