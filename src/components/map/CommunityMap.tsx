"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Compass, LocateFixed, List, Map as MapIcon, Loader2 } from "lucide-react";
import { MapMarker, MarkerKind } from "@/app/api/map/route";
import { api } from "@/components/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CATEGORY_LABELS } from "@/components/lib/labels";
import { MarkerDetailPanel } from "./MarkerDetailPanel";
import { cn } from "@/components/ui/cn";

// Leaflet touches the DOM/window; load it client-only.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-accent-weak)]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand)]" aria-hidden />
    </div>
  ),
});

type KindFilter = "ALL" | MarkerKind;

const KIND_FILTERS: Array<{ id: KindFilter; label: string }> = [
  { id: "ALL", label: "Everything" },
  { id: "RESOURCE", label: "Resources" },
  { id: "ASSISTANCE", label: "Assistance" },
  { id: "REQUEST", label: "Needs help" },
];

export function CommunityMap() {
  const toast = useToast();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [category, setCategory] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api
      .map()
      .then((r) => setMarkers(r.markers))
      .catch(() => toast.error("Couldn't load the community map."))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    return markers.filter((m) => {
      if (kind !== "ALL" && m.kind !== kind) return false;
      if (category && m.category !== category) return false;
      return true;
    });
  }, [markers, kind, category]);

  const selected = filtered.find((m) => m.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c = { RESOURCE: 0, ASSISTANCE: 0, REQUEST: 0 } as Record<MarkerKind, number>;
    for (const m of markers) c[m.kind] += 1;
    return c;
  }, [markers]);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.info("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Centered on your location.");
      },
      () => {
        setLocating(false);
        toast.info("We couldn't get your location. You can still browse the map.");
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setKind(f.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                kind === f.id
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]",
              )}
              aria-pressed={kind === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="h-10 w-auto"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>

        <Button variant="secondary" size="md" onClick={locate} loading={locating} className="ml-auto">
          <LocateFixed className="h-4 w-4" aria-hidden />
          Near me
        </Button>

        {/* Mobile map/list toggle */}
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1 md:hidden">
          <button
            onClick={() => setMobileView("map")}
            className={cn("rounded-full p-2", mobileView === "map" ? "bg-[var(--color-accent-weak)] text-[var(--color-brand)]" : "text-[var(--color-ink-soft)]")}
            aria-label="Map view"
            aria-pressed={mobileView === "map"}
          >
            <MapIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileView("list")}
            className={cn("rounded-full p-2", mobileView === "list" ? "bg-[var(--color-accent-weak)] text-[var(--color-brand)]" : "text-[var(--color-ink-soft)]")}
            aria-label="List view"
            aria-pressed={mobileView === "list"}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-soft)]">
        <Compass className="h-3.5 w-3.5" aria-hidden />
        Showing {filtered.filter((m) => m.point).length} pins ·
        <span className="inline-flex items-center gap-1"><Dot color="#6f8450" />{counts.RESOURCE} resources</span>
        <span className="inline-flex items-center gap-1"><Dot color="#b08433" />{counts.ASSISTANCE} assistance</span>
        <span className="inline-flex items-center gap-1"><Dot color="#b14a6b" />{counts.REQUEST} needs</span>
        · Locations are approximate for privacy.
      </p>

      {/* Map + panel grid */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className={cn("h-[460px] md:h-[560px]", mobileView === "list" && "hidden md:block")}>
          {loading ? (
            <Skeleton className="h-full w-full rounded-[var(--radius-card)]" />
          ) : (
            <MapCanvas
              markers={filtered}
              selectedId={selectedId}
              onSelect={(m) => {
                setSelectedId(m.id);
                setMobileView("map");
              }}
              userPosition={userPos}
            />
          )}
        </div>

        {/* Right rail: detail panel + synced list */}
        <div className={cn("flex flex-col gap-3", mobileView === "map" && "hidden md:flex")}>
          {selected && <MarkerDetailPanel marker={selected} onClose={() => setSelectedId(undefined)} />}

          <div className="flex-1 overflow-auto rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)]">
              Nearby activity
            </div>
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--color-ink-soft)]">
                Nothing matches these filters yet. Try &ldquo;Everything&rdquo; or a different category.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-accent-weak)]/50",
                        selectedId === m.id && "bg-[var(--color-accent-weak)]",
                      )}
                    >
                      <Dot color={m.kind === "RESOURCE" ? "#6f8450" : m.kind === "ASSISTANCE" ? "#b08433" : "#b14a6b"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-ink)]">{m.title}</span>
                        <span className="block truncate text-xs text-[var(--color-ink-soft)]">
                          {CATEGORY_LABELS[m.category]}
                          {m.point ? ` · near ${m.point.zone}` : " · location not shared"}
                        </span>
                      </span>
                      {m.kind === "REQUEST" && <Badge tone="neutral">Needs help</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}
