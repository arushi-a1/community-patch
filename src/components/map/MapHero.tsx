"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, MapPinned, HandHeart, ArrowRight, Loader2 } from "lucide-react";
import { MapMarker } from "@/app/api/map/route";
import { api } from "@/components/lib/api";
import { Button } from "@/components/ui/Button";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-brand-deep)]">
      <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden />
    </div>
  ),
});

const CHIPS = [
  { emoji: "🔌", label: "USB-C → projector", text: "My presentation starts in 15 minutes — my laptop only has USB-C and the projector uses HDMI." },
  { emoji: "🩹", label: "Band-Aid, I'm bleeding", text: "I cut my finger and I'm bleeding — I need a Band-Aid." },
  { emoji: "🧮", label: "Calculator for an exam", text: "I need a calculator for my exam this afternoon." },
  { emoji: "✏️", label: "A pencil, right now", text: "I forgot my pencil and my quiz starts soon — anyone have one near Suzzallo?" },
];

/**
 * A framed community-map band with the AI composer overlaid on it. The map has
 * an explicit height (so Leaflet renders), the dark vignette sits above the map
 * but below the content, and the composer floats as a frosted-glass panel.
 */
export function MapHero() {
  const router = useRouter();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.map().then((r) => setMarkers(r.markers)).catch(() => void 0);
  }, []);

  const submit = (q: string) => {
    const value = q.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/fix?q=${encodeURIComponent(value)}`);
  };

  const counts = {
    r: markers.filter((m) => m.kind === "RESOURCE").length,
    a: markers.filter((m) => m.kind === "ASSISTANCE").length,
    q: markers.filter((m) => m.kind === "REQUEST").length,
  };

  return (
    <section className="relative h-[520px] w-full overflow-hidden rounded-[28px] border border-[var(--color-line)] shadow-[var(--shadow-lift)] sm:h-[560px]">
      {/* Map layer — fills the section with an explicit height via the parent */}
      <div className="absolute inset-0 z-0">
        <MapCanvas markers={markers} onSelect={() => {}} interactive={false} tint="warm" />
      </div>

      {/* Light, directional sage wash — keeps the MAP visible. Darkening is
          concentrated on the left (behind the text); the right stays clear so
          you can see the city + pins. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[var(--color-brand-deep)]/88 via-[var(--color-brand-deep)]/38 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[var(--color-brand-deep)]/45 via-transparent to-transparent" />

      {/* Content (above everything) */}
      <div className="relative z-20 flex h-full flex-col justify-center px-5 py-8 sm:px-10">
        <div className="max-w-xl">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur">
            <MapPinned className="h-3.5 w-3.5" aria-hidden />
            Live near the UW
          </span>
          <h1 className="font-display text-4xl font-semibold leading-[1.03] tracking-tight text-white drop-shadow-sm sm:text-6xl">
            Big or small,
            <br />
            we&apos;ve got you.
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/90">
            Tell PATCH what you need. We&apos;ll find the people, things, and help nearby — right on
            the map.
          </p>

          {/* Frosted-glass composer overlaid on the map */}
          <div className="mt-6 rounded-[20px] border border-white/30 bg-white/20 p-2 shadow-[var(--shadow-lift)] backdrop-blur-md">
            <div className="flex items-center gap-2 rounded-[14px] bg-[var(--color-surface)] p-2 pl-4">
              <Sparkles className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit(text)}
                placeholder="e.g. I need a USB-C to HDMI adapter near the HUB"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]/70"
                aria-label="Describe what you need"
              />
              <Button onClick={() => submit(text)} className="shrink-0">
                Find a fix
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1.5 pb-1 pt-2">
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => submit(c.text)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] text-white ring-1 ring-white/25 transition-colors hover:bg-white/30"
                >
                  <span aria-hidden>{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/community/requests/new">
              <Button variant="secondary">
                <HandHeart className="h-4 w-4" aria-hidden />
                Ask the community
              </Button>
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/20"
            >
              <MapPinned className="h-4 w-4" aria-hidden />
              Explore the full map
            </Link>
          </div>
        </div>
      </div>

      {/* Live counts chip, bottom-right */}
      {markers.length > 0 && (
        <div className="absolute bottom-5 right-5 z-20 hidden items-center gap-3 rounded-full bg-[var(--color-brand-deep)]/70 px-4 py-2 text-sm text-white ring-1 ring-white/20 backdrop-blur sm:inline-flex">
          <Dot c="#6f8450" /> {counts.r} resources
          <Dot c="#b08433" /> {counts.a} assistance
          <Dot c="#b14a6b" /> {counts.q} needs help
        </div>
      )}
    </section>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} aria-hidden />;
}
