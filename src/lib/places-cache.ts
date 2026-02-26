/**
 * Google Places API Cache Layer
 *
 * Persistent cache for Google Places responses to reduce API costs.
 * Uses @upstash/redis when available, falls back to in-memory LRU cache.
 *
 * At 1,000 users with 60% cache hit rate, this saves ~$1,560/month ($18,720/year).
 */

const CACHE_TTL_SECONDS = 300; // 5 minutes — balances freshness vs. cost savings
const MEMORY_CACHE_MAX_SIZE = 500; // Max entries in fallback in-memory cache

// ─── In-memory LRU fallback ──────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Evict oldest entries if over max size
    if (this.cache.size >= MEMORY_CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get size(): number {
    return this.cache.size;
  }
}

// ─── Cache backend abstraction ───────────────────────────────────────────────

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

let _backend: CacheBackend | null = null;
let _stats = { hits: 0, misses: 0 };

/**
 * Lazily initialize the cache backend.
 * Tries @vercel/kv first, falls back to in-memory.
 */
async function getBackend(): Promise<CacheBackend> {
  if (_backend) return _backend;

  // Try to use @upstash/redis if available (requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = Redis.fromEnv();
      _backend = {
        async get<T>(key: string): Promise<T | null> {
          return redis.get<T>(key);
        },
        async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
          await redis.set(key, value, { ex: ttlSeconds });
        },
      };
      console.log('[places-cache] Using @upstash/redis backend');
      return _backend;
    } catch {
      console.warn('[places-cache] @upstash/redis not available, falling back to in-memory cache');
    }
  }

  // Fallback: in-memory cache (works locally, resets per deployment)
  const memCache = new MemoryCache();
  _backend = memCache;
  console.log('[places-cache] Using in-memory cache (local dev / no Redis configured)');
  return _backend;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a cache key from query + optional parameters.
 * Normalizes query to lowercase/trimmed for better hit rates.
 */
function buildKey(prefix: string, query: string, extras?: Record<string, unknown>): string {
  const normalizedQuery = query.toLowerCase().trim();
  const extrasStr = extras ? JSON.stringify(extras) : '';
  return `places:${prefix}:${normalizedQuery}${extrasStr ? ':' + extrasStr : ''}`;
}

/**
 * Get a cached value or execute the fetcher and cache the result.
 */
export async function cachedPlacesCall<T>(
  prefix: string,
  query: string,
  fetcher: () => Promise<T>,
  extras?: Record<string, unknown>,
  ttlSeconds: number = CACHE_TTL_SECONDS,
): Promise<T> {
  const key = buildKey(prefix, query, extras);
  const backend = await getBackend();

  // Try cache first
  try {
    const cached = await backend.get<T>(key);
    if (cached !== null && cached !== undefined) {
      _stats.hits++;
      return cached;
    }
  } catch {
    // Cache read failed — proceed to fetcher
  }

  // Cache miss — fetch from API
  _stats.misses++;
  const result = await fetcher();

  // Cache the result (don't block on cache write)
  try {
    await backend.set(key, result, ttlSeconds);
  } catch {
    // Cache write failed — non-fatal
  }

  return result;
}

/**
 * Get cache hit/miss stats for monitoring.
 */
export function getCacheStats() {
  const total = _stats.hits + _stats.misses;
  return {
    hits: _stats.hits,
    misses: _stats.misses,
    hitRate: total > 0 ? (_stats.hits / total * 100).toFixed(1) + '%' : 'N/A',
  };
}
