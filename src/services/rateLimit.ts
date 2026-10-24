/**
 * In-memory token-bucket rate limiter (SR §5). Sufficient for a single-node
 * local/dev deployment. In AWS mode, API Gateway
 * throttling + per-identity usage plans provide the production equivalent.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface LimitConfig {
  tokens: number;
  windowMs: number;
}

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, cfg: LimitConfig, now = Date.now()): LimitResult {
  const refillPerMs = cfg.tokens / cfg.windowMs;
  const existing = buckets.get(key);
  let tokens = cfg.tokens;

  if (existing) {
    const elapsed = now - existing.updatedAt;
    tokens = Math.min(cfg.tokens, existing.tokens + elapsed * refillPerMs);
  }

  if (tokens < 1) {
    const deficit = 1 - tokens;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.ceil(deficit / refillPerMs),
    };
  }

  tokens -= 1;
  buckets.set(key, { tokens, updatedAt: now });
  return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
}

/** Test/dev helper. */
export function __resetRateLimits() {
  buckets.clear();
}
