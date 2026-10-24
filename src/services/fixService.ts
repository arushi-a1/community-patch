/**
 * The "I need a fix" pipeline orchestration (FR-4..FR-8). Ties together:
 *   interpret -> retrieve -> hard-eligibility + rank -> alternatives.
 * Pure orchestration over the repository + AI service + domain functions.
 * No privileged action is driven by model output.
 */
import { Interpretation, sanitizeProblemText } from "@/domain/interpretation";
import { checkSafety, SafetyVerdict } from "@/domain/safety";
import { rankResources, RankResult } from "@/domain/matching";
import { deriveAlternatives } from "@/domain/alternatives";
import { toPublicResource } from "@/domain/projection";
import {
  Alternative,
  AvailabilityStatus,
  Location,
  PublicResource,
  RankedMatch,
} from "@/domain/types";
import { Repository } from "./repository";
import { AIService } from "./ai";
import { USER_DISPLAY } from "@/seed/data";

export interface FixRequestInput {
  text: string;
  communityId: string;
  requesterId?: string;
  requesterLocation?: Location;
  radiusKm?: number;
  locationHint?: string;
  now?: Date;
}

export interface FixResult {
  interpretation: Interpretation;
  matches: RankedMatch[];
  alternatives: Alternative[];
  /** Honest "why not" when there are no feasible primary matches. */
  rejected: Array<{ title: string; reason: string }>;
  /** True when no feasible primary match AND no alternative was found. */
  noViableMatch: boolean;
  /** Set when the request was blocked by the safety guard (no matches returned). */
  safety?: { blocked: true; message: string; guidance?: string };
}

async function ownerName(repo: Repository, ownerId: string): Promise<string> {
  const cached = USER_DISPLAY[ownerId];
  if (cached) return cached;
  const u = await repo.getUser(ownerId);
  return u?.displayName ?? "A community member";
}

/** Retrieve candidate resources deterministically from the interpretation. */
export async function retrieveCandidates(
  repo: Repository,
  interp: Interpretation,
  communityId: string,
): Promise<PublicResource[]> {
  // Gather by search terms (deterministic keyword query over the repo), union
  // the results, then de-duplicate. We intentionally retrieve a broad candidate
  // set and let the matching engine apply hard constraints + scoring.
  const terms = [
    ...interp.suggested_search_terms,
    ...interp.required_capabilities,
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1);

  const seen = new Map<string, PublicResource>();

  const addAll = async (items: Awaited<ReturnType<Repository["queryResources"]>>["items"]) => {
    for (const r of items) {
      if (r.availabilityStatus === AvailabilityStatus.ARCHIVED) continue;
      if (!seen.has(r.id)) {
        seen.set(r.id, toPublicResource(r, await ownerName(repo, r.ownerId)));
      }
    }
  };

  // Keyword passes.
  for (const term of terms.slice(0, 8)) {
    const page = await repo.queryResources({ communityId, keyword: term, limit: 50 });
    await addAll(page.items);
  }

  // If keyword retrieval was thin, also pull the full (non-archived) set so the
  // matcher can still find the right answer. Bounded for the MVP dataset.
  if (seen.size < 5) {
    const all = await repo.queryResources({ communityId, limit: 200 });
    await addAll(all.items);
  }

  return [...seen.values()];
}

export async function runFix(
  repo: Repository,
  ai: AIService,
  input: FixRequestInput,
): Promise<FixResult> {
  // Safety gate runs first, deterministically, before any retrieval or AI call.
  const verdict: SafetyVerdict = checkSafety(sanitizeProblemText(input.text));
  if (!verdict.allowed) {
    const interpretation = await ai.interpret({
      text: input.text,
      locationHint: input.locationHint,
      now: input.now,
    });
    return {
      interpretation,
      matches: [],
      alternatives: [],
      rejected: [],
      noViableMatch: true,
      safety: { blocked: true, message: verdict.message!, guidance: verdict.guidance },
    };
  }

  const interpretation = await ai.interpret({
    text: input.text,
    locationHint: input.locationHint,
    now: input.now,
  });

  return matchFromInterpretation(repo, interpretation, input);
}

/** Run retrieval + ranking from a known interpretation (used by /match + tests). */
export async function matchFromInterpretation(
  repo: Repository,
  interpretation: Interpretation,
  input: Omit<FixRequestInput, "text">,
): Promise<FixResult> {
  const candidates = await retrieveCandidates(repo, interpretation, input.communityId);

  const ranked: RankResult = rankResources(candidates, {
    interpretation,
    requesterLocation: input.requesterLocation,
    requesterId: input.requesterId,
    radiusKm: input.radiusKm,
    now: input.now,
  });

  const primaryIds = new Set(ranked.matches.map((m) => m.resource.id));
  const alternatives = deriveAlternatives(candidates, primaryIds, interpretation);

  const rejected = ranked.rejected
    .slice(0, 6)
    .map((r) => ({ title: r.resource.title, reason: r.reason }));

  return {
    interpretation,
    matches: ranked.matches,
    alternatives,
    rejected,
    noViableMatch: ranked.matches.length === 0 && alternatives.length === 0,
  };
}
