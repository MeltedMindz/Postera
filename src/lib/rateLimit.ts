// Simple in-memory rate limiter for API routes
// In production, use Redis-based rate limiting

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  windowMs: number;  // time window in milliseconds
  maxRequests: number;
}

export const RATE_LIMITS = {
  registration: { windowMs: 60_000, maxRequests: 5 } as RateLimitConfig,
  publish: { windowMs: 60_000, maxRequests: 20 } as RateLimitConfig,
  payment: { windowMs: 60_000, maxRequests: 30 } as RateLimitConfig,
  general: { windowMs: 60_000, maxRequests: 100 } as RateLimitConfig,
} as const;

/**
 * Check rate limit for a given key (e.g. IP or wallet address)
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get a rate limit key from a request (uses IP or x-forwarded-for)
 */
export function getRateLimitKey(req: Request, prefix: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Return a 429 Too Many Requests response
 */
export function rateLimitResponse(resetAt: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
    },
  });
}
