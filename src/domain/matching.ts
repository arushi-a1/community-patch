/**
 * Deterministic matching engine (FR-6). Pure functions, fully unit-testable,
 * independent of AI. Pipeline: hard eligibility checks -> weighted scoring.
 *
 * A resource that is unavailable, incompatible, inaccessible, or too far to be
 * useful must NOT rank highly just because its text matches. Critical
 * compatibility failures DISQUALIFY rather than merely reduce the score.
 */
import {
  AvailabilityStatus,
  PublicResource,
  RankedMatch,
  ResourceType,
  ScoreBreakdown,
  type Location,
} from "./types";
import { getWeights, MATCH_CONFIG, MatchWeights } from "./config";
import { Interpretation, RequestType } from "./interpretation";

// ---------------------------------------------------------------------------
// Geography helpers
// ---------------------------------------------------------------------------

const EARTH_KM = 6371;

export function haversineKm(a: Location, b: Location): number | undefined {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return undefined;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkMinutes(distanceKm: number): number {
  return Math.round((distanceKm / MATCH_CONFIG.walkingSpeedKmh) * 60);
}

// ---------------------------------------------------------------------------
// Hard eligibility
// ---------------------------------------------------------------------------

export interface EligibilityContext {
  interpretation: Interpretation;
  /** Where the requester is (for distance/radius checks). */
  requesterLocation?: Location;
  requesterId?: string;
  /** Preferred radius (km); defaults to config. */
  radiusKm?: number;
  now?: Date;
}

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable disqualification reason (for honest "why not" messaging). */
  reason?: string;
}

/**
 * Compatibility check. For adapters/cables the resource bridges a source port
 * to a sink port. The user needs source S and sink T; the resource is
 * compatible iff it accepts S on its source side and emits T on its sink side
 * (order-independent for symmetric needs). A pure HDMI cable (sink HDMI, no
 * USB-C source) must FAIL for a USB-C source requirement.
 */
export function checkCompatibility(
  resource: PublicResource,
  interp: Interpretation,
): { ok: boolean; reason?: string } {
  const need = interp.compatibility_constraints;
  const needSource = need.sourcePorts ?? [];
  const needSink = need.sinkPorts ?? [];
  const rc = resource.compatibility;

  // Exam-permission guard runs regardless of port constraints: a resource
  // explicitly flagged not-permitted is disqualified in an exam context.
  if (
    need.attributes.includes("exam-context") &&
    rc.attributes.some((a) => /exam-permitted\s*:\s*false/i.test(a))
  ) {
    return { ok: false, reason: "Not permitted in exams per its attributes." };
  }

  if (needSource.length === 0 && needSink.length === 0) {
    return { ok: true };
  }

  const resSource = new Set(rc.sourcePorts);
  const resSink = new Set(rc.sinkPorts);
  // Many bridging devices are bidirectional in practice; treat the union as the
  // set of ports the device can interface with, but require BOTH the source and
  // sink the user needs to be covered by the device's capabilities.
  const resAll = new Set([...rc.sourcePorts, ...rc.sinkPorts]);

  const coversSource = needSource.every((p) => resSource.has(p) || resAll.has(p));
  const coversSink = needSink.every((p) => resSink.has(p) || resAll.has(p));

  if (!coversSource) {
    return { ok: false, reason: `Does not accept ${needSource.join("/")} input.` };
  }
  if (!coversSink) {
    return { ok: false, reason: `Does not provide ${needSink.join("/")} output.` };
  }

  return { ok: true };
}

/** Time feasibility: can the requester plausibly obtain it before the deadline? */
export function checkTimeFeasibility(
  resource: PublicResource,
  ctx: EligibilityContext,
): { ok: boolean; reason?: string } {
  const { interpretation, now = new Date() } = ctx;
  if (!interpretation.deadline) return { ok: true };
  const deadline = new Date(interpretation.deadline).getTime();

  // If we can compute a walk time, require obtaining it before the deadline.
  if (ctx.requesterLocation) {
    const dist = haversineKm(ctx.requesterLocation, resource.location);
    if (dist != null) {
      const etaMs = walkMinutes(dist) * 60_000;
      if (now.getTime() + etaMs > deadline) {
        return { ok: false, reason: "Can't be reached before the deadline on foot." };
      }
    }
  }

  // Availability windows (assistance / time-boxed) must overlap the deadline.
  if (resource.availabilityWindows.length > 0) {
    const overlaps = resource.availabilityWindows.some((w) => {
      const start = new Date(w.start).getTime();
      const end = new Date(w.end).getTime();
      return start <= deadline && end >= now.getTime();
    });
    if (!overlaps) {
      return { ok: false, reason: "Not available within the needed time window." };
    }
  }

  return { ok: true };
}

/** Location feasibility: within the preferred radius when coordinates exist. */
export function checkLocationFeasibility(
  resource: PublicResource,
  ctx: EligibilityContext,
): { ok: boolean; reason?: string } {
  if (!ctx.requesterLocation) return { ok: true }; // no coords -> no hard radius cut
  const dist = haversineKm(ctx.requesterLocation, resource.location);
  if (dist == null) return { ok: true };
  const radius = ctx.radiusKm ?? MATCH_CONFIG.defaultRadiusKm;
  if (dist > radius) {
    return { ok: false, reason: `About ${dist.toFixed(1)} km away, beyond the ${radius} km radius.` };
  }
  return { ok: true };
}

export function checkEligibility(
  resource: PublicResource,
  ctx: EligibilityContext,
): EligibilityResult {
  // Availability
  if (resource.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
    return { eligible: false, reason: `Currently ${resource.availabilityStatus.toLowerCase()}.` };
  }

  // Owner cannot borrow their own exclusive item via the public flow.
  if (resource.exclusive && ctx.requesterId && resource.ownerId === ctx.requesterId) {
    return { eligible: false, reason: "You already own this resource." };
  }

  // Assistance vs item must match the request type.
  const { request_type } = ctx.interpretation;
  if (request_type === RequestType.ASSISTANCE && resource.resourceType !== ResourceType.ASSISTANCE) {
    return { eligible: false, reason: "This is an item, not assistance." };
  }
  if (request_type === RequestType.ITEM && resource.resourceType !== ResourceType.ITEM) {
    return { eligible: false, reason: "This is assistance, not an item." };
  }

  // Compatibility (disqualifying on critical failure).
  const compat = checkCompatibility(resource, ctx.interpretation);
  if (!compat.ok) return { eligible: false, reason: compat.reason };

  // Time feasibility.
  const time = checkTimeFeasibility(resource, ctx);
  if (!time.ok) return { eligible: false, reason: time.reason };

  // Location feasibility.
  const loc = checkLocationFeasibility(resource, ctx);
  if (!loc.ok) return { eligible: false, reason: loc.reason };

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Scoring (only for eligible candidates)
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function semanticScore(resource: PublicResource, interp: Interpretation): number {
  const haystack = [
    resource.title,
    resource.description,
    ...resource.tags,
    resource.category,
  ]
    .join(" ")
    .toLowerCase();

  const terms = interp.suggested_search_terms.map((t) => t.toLowerCase()).filter((t) => t.length > 1);
  const caps = interp.required_capabilities.map((t) => t.toLowerCase()).filter((t) => t.length > 1);
  const all = [...new Set([...terms, ...caps])];
  // Only use a neutral score when the interpretation genuinely has no terms to
  // match on. If there ARE terms but the resource matches NONE of them, the
  // resource is simply not relevant and must score near zero — otherwise an
  // unrelated item could clear the minimum-relevance bar (e.g. "live alpaca").
  if (all.length === 0) return 0.5;

  let hits = 0;
  for (const term of all) {
    if (haystack.includes(term)) hits += 1;
  }
  if (hits === 0) return 0;
  // Reward title hits a little extra.
  const titleBoost = terms.some((t) => resource.title.toLowerCase().includes(t)) ? 0.15 : 0;
  return clamp01(hits / all.length + titleBoost);
}

export function timeScore(resource: PublicResource, ctx: EligibilityContext): number {
  const { interpretation, now = new Date() } = ctx;
  if (!interpretation.deadline) return 0.7; // no deadline -> neutral-positive
  const deadline = new Date(interpretation.deadline).getTime();
  const slackMs = deadline - now.getTime();

  // With coordinates, factor in travel time.
  let etaMs = 0;
  if (ctx.requesterLocation) {
    const dist = haversineKm(ctx.requesterLocation, resource.location);
    if (dist != null) etaMs = walkMinutes(dist) * 60_000;
  }
  const remaining = slackMs - etaMs;
  if (remaining <= 0) return 0;
  // More comfortable slack -> higher score; saturates around 2x needed time.
  const ratio = remaining / Math.max(etaMs, 10 * 60_000);
  return clamp01(0.4 + 0.6 * Math.min(1, ratio));
}

export function locationScore(resource: PublicResource, ctx: EligibilityContext): number {
  if (ctx.requesterLocation) {
    const dist = haversineKm(ctx.requesterLocation, resource.location);
    if (dist != null) {
      const radius = ctx.radiusKm ?? MATCH_CONFIG.defaultRadiusKm;
      return clamp01(1 - dist / (radius * 1.5));
    }
  }
  // No coordinates: disclosed zone-based approximation.
  const need = ctx.interpretation.location_context?.toLowerCase();
  const zone = resource.location.zone.toLowerCase();
  const label = resource.location.label.toLowerCase();
  if (!need) return MATCH_CONFIG.adjacentZoneScore;
  if (zone.includes(need) || need.includes(zone) || label.includes(need)) {
    return MATCH_CONFIG.sameZoneScore;
  }
  return MATCH_CONFIG.distantZoneScore;
}

export function compatibilityScore(resource: PublicResource, interp: Interpretation): number {
  const need = interp.compatibility_constraints;
  if ((need.sourcePorts?.length ?? 0) === 0 && (need.sinkPorts?.length ?? 0) === 0) {
    return 0.8; // nothing to satisfy -> strong but not perfect
  }
  // Eligible candidates already passed the hard check; reward exact directional
  // matches (source on source side, sink on sink side) over union coverage.
  const rc = resource.compatibility;
  const exactSource = (need.sourcePorts ?? []).every((p) => rc.sourcePorts.includes(p));
  const exactSink = (need.sinkPorts ?? []).every((p) => rc.sinkPorts.includes(p));
  if (exactSource && exactSink) return 1;
  if (exactSource || exactSink) return 0.8;
  return 0.6;
}

export function conditionScore(resource: PublicResource): number {
  switch (resource.condition) {
    case "NEW":
      return 1;
    case "GOOD":
      return 0.85;
    case "FAIR":
      return 0.6;
    case "WORN":
      return 0.4;
    case "NA":
    default:
      return 0.8; // assistance has no condition -> neutral-positive
  }
}

export function scoreResource(
  resource: PublicResource,
  ctx: EligibilityContext,
  weights: MatchWeights = getWeights(),
): ScoreBreakdown {
  const semantic = semanticScore(resource, ctx.interpretation);
  const time = timeScore(resource, ctx);
  const location = locationScore(resource, ctx);
  const compatibility = compatibilityScore(resource, ctx.interpretation);
  const condition = conditionScore(resource);

  const total =
    semantic * weights.semantic +
    time * weights.time +
    location * weights.location +
    compatibility * weights.compatibility +
    condition * weights.condition;

  return {
    semantic,
    time,
    location,
    compatibility,
    condition,
    total: clamp01(total),
  };
}

// ---------------------------------------------------------------------------
// Explanation (grounded in real fields + computed results)
// ---------------------------------------------------------------------------

function buildExplanation(
  resource: PublicResource,
  score: ScoreBreakdown,
  ctx: EligibilityContext,
  walk?: number,
): { reasons: string[]; caveats: string[] } {
  const reasons: string[] = [];
  const caveats: string[] = [];

  reasons.push(`Currently available: "${resource.title}" (${resource.category.replace(/_/g, " ").toLowerCase()}).`);

  const need = ctx.interpretation.compatibility_constraints;
  if ((need.sourcePorts?.length ?? 0) || (need.sinkPorts?.length ?? 0)) {
    const src = need.sourcePorts.join("/");
    const snk = need.sinkPorts.join("/");
    reasons.push(`Bridges ${src || "your device"} → ${snk || "the target"}, matching your compatibility need.`);
  }

  if (walk != null) {
    reasons.push(`About a ${walk}-minute walk from your location.`);
  } else {
    reasons.push(`Located in ${resource.location.zone}.`);
    caveats.push("Walking time is approximate — exact coordinates weren't available.");
  }

  if (ctx.interpretation.deadline && score.time > 0) {
    reasons.push("Feasible to obtain before your deadline.");
  }

  if (resource.compatibility.notes) {
    caveats.push(resource.compatibility.notes);
  }

  caveats.push("Availability is the last-known status and is reconfirmed when the owner accepts.");

  return { reasons, caveats };
}

// ---------------------------------------------------------------------------
// Top-level ranking
// ---------------------------------------------------------------------------

export interface RankResult {
  matches: RankedMatch[];
  /** Candidates that were disqualified, with reasons (for honest messaging). */
  rejected: Array<{ resource: PublicResource; reason: string }>;
}

export function rankResources(
  candidates: PublicResource[],
  ctx: EligibilityContext,
  opts: { topN?: number; weights?: MatchWeights } = {},
): RankResult {
  const weights = opts.weights ?? getWeights();
  const topN = opts.topN ?? MATCH_CONFIG.topN;

  const matches: RankedMatch[] = [];
  const rejected: Array<{ resource: PublicResource; reason: string }> = [];

  for (const resource of candidates) {
    const elig = checkEligibility(resource, ctx);
    if (!elig.eligible) {
      rejected.push({ resource, reason: elig.reason ?? "Not eligible." });
      continue;
    }
    const score = scoreResource(resource, ctx, weights);

    // Relevance gate: if the request carries search terms but this resource
    // matches none of them, it is not a real answer regardless of how feasible
    // it is logistically. This prevents superficially-eligible-but-irrelevant
    // items (e.g. an umbrella for "I need a live alpaca") from surfacing.
    const hasTerms =
      ctx.interpretation.suggested_search_terms.length > 0 ||
      ctx.interpretation.required_capabilities.length > 0;
    if (hasTerms && score.semantic === 0) {
      rejected.push({ resource, reason: "Doesn't match what you're looking for." });
      continue;
    }

    if (score.total < MATCH_CONFIG.minPrimaryScore) {
      rejected.push({ resource, reason: "Low relevance to the request." });
      continue;
    }

    let walk: number | undefined;
    let distanceKm: number | undefined;
    if (ctx.requesterLocation) {
      distanceKm = haversineKm(ctx.requesterLocation, resource.location);
      if (distanceKm != null) walk = walkMinutes(distanceKm);
    }

    const explanation = buildExplanation(resource, score, ctx, walk);
    matches.push({ resource, score, explanation, walkMinutes: walk, distanceKm });
  }

  matches.sort((a, b) => b.score.total - a.score.total);
  return { matches: matches.slice(0, topN), rejected };
}
