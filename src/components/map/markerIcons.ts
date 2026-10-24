/**
 * Branded PATCH map markers built as Leaflet divIcons with inline SVG.
 * Three visual kinds: a resource (leaf/box), assistance (helping hands), and a
 * help request (question spark). Colors come from the design system.
 */
import L from "leaflet";
import type { MarkerKind } from "@/app/api/map/route";

const COLORS: Record<MarkerKind, { fill: string; glyph: string }> = {
  RESOURCE: { fill: "#5c6f4b", glyph: "#eef2e2" }, // sage green
  ASSISTANCE: { fill: "#b08433", glyph: "#f6ecd3" }, // honey
  REQUEST: { fill: "#b14a6b", glyph: "#f6dee6" }, // berry rose
};

function glyphPath(kind: MarkerKind): string {
  switch (kind) {
    case "RESOURCE":
      // simple box/parcel
      return `<path d="M9 9.5h8v7H9z" fill="none" stroke="{g}" stroke-width="1.6"/><path d="M9 12h8" stroke="{g}" stroke-width="1.6"/>`;
    case "ASSISTANCE":
      // helping hand / heart
      return `<path d="M13 16.5s-3.2-2-3.2-4.1a1.7 1.7 0 0 1 3.2-.7 1.7 1.7 0 0 1 3.2.7c0 2.1-3.2 4.1-3.2 4.1Z" fill="{g}"/>`;
    case "REQUEST":
      // question spark
      return `<path d="M11.4 11.2a1.7 1.7 0 1 1 2.4 1.7c-.7.4-.9.8-.9 1.4M12.9 16.3h.01" fill="none" stroke="{g}" stroke-width="1.7" stroke-linecap="round"/>`;
  }
}

function svg(kind: MarkerKind): string {
  const { fill, glyph } = COLORS[kind];
  const g = glyphPath(kind).replaceAll("{g}", glyph);
  return `
    <svg width="34" height="44" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="rgba(28,43,36,0.35)"/>
      </filter></defs>
      <path filter="url(#s)" d="M13 1C6.9 1 2 5.7 2 11.6 2 19 13 33 13 33s11-14 11-21.4C24 5.7 19.1 1 13 1Z" fill="${fill}"/>
      <circle cx="13" cy="11.5" r="7.5" fill="${fill}"/>
      ${g}
    </svg>`;
}

const cache = new Map<MarkerKind, L.DivIcon>();

export function markerIcon(kind: MarkerKind): L.DivIcon {
  const existing = cache.get(kind);
  if (existing) return existing;
  const icon = L.divIcon({
    className: "patch-marker",
    html: svg(kind),
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
  cache.set(kind, icon);
  return icon;
}
