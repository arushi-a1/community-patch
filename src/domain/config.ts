/**
 * Tunable domain configuration. Weights are initial, documented parameters
 * (see product/requirements.md FR-6), not universal truths. Override via env.
 */

export interface MatchWeights {
  semantic: number;
  time: number;
  location: number;
  compatibility: number;
  condition: number;
}

/** Default weights sum to 1.0. */
export const DEFAULT_WEIGHTS: MatchWeights = {
  semantic: 0.3,
  time: 0.25,
  location: 0.2,
  compatibility: 0.15,
  condition: 0.1,
};

export const MATCH_CONFIG = {
  /** Default number of primary matches returned. */
  topN: 3,
  /** Default feasible travel radius (km) when the user gives no preference. */
  defaultRadiusKm: 2.5,
  /** Average walking speed for coarse ETA when coordinates exist (km/h). */
  walkingSpeedKmh: 4.8,
  /** Zone-adjacency penalty used when coordinates are absent (disclosed approx). */
  sameZoneScore: 1.0,
  adjacentZoneScore: 0.6,
  distantZoneScore: 0.25,
  /** Minimum total score for a candidate to be shown as a primary match. */
  minPrimaryScore: 0.2,
} as const;

export const INPUT_LIMITS = {
  /** Max characters accepted in a free-text problem (bounded input, SR §5). */
  problemText: 1200,
  message: 600,
  pickupContext: 400,
} as const;

export const AI_CONFIG = {
  /** Hard timeout for a single model call (ms). */
  timeoutMs: 8000,
  /** Bounded retries — never infinite (reliability, §9). */
  maxRetries: 1,
  /** Max tokens for interpretation output. */
  maxTokens: 700,
} as const;

export const RATE_LIMITS = {
  /** Request creation per actor. */
  requestCreate: { tokens: 10, windowMs: 60_000 },
  /** AI analyze per actor. */
  aiAnalyze: { tokens: 20, windowMs: 60_000 },
} as const;

function readWeightEnv(): MatchWeights {
  const raw = process.env.PATCH_MATCH_WEIGHTS;
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    const parsed = JSON.parse(raw) as Partial<MatchWeights>;
    return { ...DEFAULT_WEIGHTS, ...parsed };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function getWeights(): MatchWeights {
  return readWeightEnv();
}
