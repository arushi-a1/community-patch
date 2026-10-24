"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapMarker } from "@/app/api/map/route";
import { markerIcon } from "./markerIcons";

interface MapCanvasProps {
  markers: MapMarker[];
  selectedId?: string;
  onSelect: (marker: MapMarker) => void;
  /** Requester position when geolocation is granted. */
  userPosition?: { lat: number; lng: number } | null;
  /** When false, the map is a non-interactive backdrop (hero/preview use). */
  interactive?: boolean;
  /** Optional warm sepia tint on the tiles for a cohesive golden-hour look. */
  tint?: "none" | "warm";
}

// UW Seattle campus center (matches the seed location cluster).
const DEFAULT_CENTER: [number, number] = [47.6553, -122.3069];
const DEFAULT_ZOOM = 15;

function FlyToSelected({ markers, selectedId }: { markers: MapMarker[]; selectedId?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const m = markers.find((x) => x.id === selectedId);
    if (m?.point) {
      map.flyTo([m.point.lat, m.point.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }, [selectedId, markers, map]);
  return null;
}

function TileFailureWatcher({ onFail }: { onFail: () => void }) {
  const map = useMap();
  useEffect(() => {
    let errors = 0;
    const handler = () => {
      errors += 1;
      // Several tile errors in a row => tiles are unreachable.
      if (errors >= 4) onFail();
    };
    map.on("tileerror", handler);
    return () => void map.off("tileerror", handler);
  }, [map, onFail]);
  return null;
}

export default function MapCanvas({
  markers,
  selectedId,
  onSelect,
  userPosition,
  interactive = true,
  tint = "none",
}: MapCanvasProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  const positioned = useMemo(() => markers.filter((m) => m.point), [markers]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)]">
      {tilesFailed && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[var(--color-accent-weak)] p-6 text-center">
          <p className="max-w-xs text-sm text-[var(--color-ink-soft)]">
            Map tiles couldn&apos;t load right now. You can still use the list view on the right —
            everything works without the map.
          </p>
        </div>
      )}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl={interactive}
        className="h-full w-full"
        ref={mapRef as never}
        style={{ background: "#dfe6dd" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className={tint === "warm" ? "patch-tiles-warm" : undefined}
        />
        <TileFailureWatcher onFail={() => setTilesFailed(true)} />
        <FlyToSelected markers={markers} selectedId={selectedId} />

        {positioned.map((m) => (
          <Marker
            key={m.id}
            position={[m.point!.lat, m.point!.lng]}
            icon={markerIcon(m.kind)}
            eventHandlers={{ click: () => onSelect(m) }}
          />
        ))}

        {userPosition && (
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={markerIcon("REQUEST")}
            opacity={0.9}
          />
        )}
      </MapContainer>
    </div>
  );
}
