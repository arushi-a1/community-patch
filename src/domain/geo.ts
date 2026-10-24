/**
 * Geo helpers for the map (privacy-aware).
 *
 * Private individuals' exact coordinates are never exposed. For map display we
 * apply a small DETERMINISTIC jitter derived from the resource id, so a marker
 * sits in roughly the right neighborhood but not on an exact spot, and the
 * position is stable across reloads (no "jumping" markers). Precise pickup
 * details remain withheld until a request is accepted (SR §3).
 */
import { Location } from "./types";

/** ~120m jitter radius in degrees (latitude). Longitude scaled by latitude. */
const JITTER_DEG = 0.0011;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ApproxPoint {
  lat: number;
  lng: number;
  /** True when coordinates are a disclosed approximation (jittered). */
  approximate: true;
  zone: string;
  label: string;
}

/**
 * Produce a privacy-safe, approximate map point for a resource location.
 * Returns null when the location has no coordinates (caller omits the marker
 * and shows a zone-only listing instead — we never invent coordinates).
 */
export function approxPoint(seed: string, location: Location): ApproxPoint | null {
  if (location.lat == null || location.lng == null) return null;

  const h = hashString(seed);
  // Map hash to two offsets in [-1, 1].
  const ox = ((h & 0xffff) / 0xffff) * 2 - 1;
  const oy = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;

  const latOffset = ox * JITTER_DEG;
  const lngScale = Math.max(0.2, Math.cos((location.lat * Math.PI) / 180));
  const lngOffset = (oy * JITTER_DEG) / lngScale;

  return {
    lat: Number((location.lat + latOffset).toFixed(6)),
    lng: Number((location.lng + lngOffset).toFixed(6)),
    approximate: true,
    zone: location.zone,
    label: location.label,
  };
}
