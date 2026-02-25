/**
 * Simple in-memory token bucket rate limiter
 *
 * No external dependencies required. Suitable for single-instance deployments.
 * For distributed systems, consider using Redis instead.
 */

const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier (e.g., IP address, user ID)
 * @param options - Max requests and time window in milliseconds
 * @returns Result with success status and remaining requests
 */
export function rateLimit(
  key: string,
  { maxRequests = 10, windowMs = 60000 } = {} as RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const bucket = rateLimitMap.get(key);

  if (!bucket || now - bucket.lastRefill > windowMs) {
    rateLimitMap.set(key, { tokens: maxRequests - 1, lastRefill: now });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (bucket.tokens <= 0) {
    return { success: false, remaining: 0 };
  }

  bucket.tokens--;
  return { success: true, remaining: bucket.tokens };
}

/**
 * Generate a standard 429 Too Many Requests response
 */
export function rateLimitResponse() {
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  );
}

/**
 * Extract client IP from request headers
 * Handles X-Forwarded-For header (common in proxied environments)
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || 'anonymous';
}
