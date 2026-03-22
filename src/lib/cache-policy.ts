/**
 * Centralized cache policy for API routes.
 *
 * Use these helpers instead of hand-writing Cache-Control headers
 * so the entire app follows a consistent caching strategy.
 */

/** Public content that changes infrequently (autocomplete, search results) */
export const CACHE_PUBLIC_SHORT = 'public, max-age=60, s-maxage=60';

/** Public content safe to cache longer (shared links, TTS audio) */
export const CACHE_PUBLIC_LONG = 'public, max-age=300, s-maxage=600';

/** Static public assets (audio, generated images) */
export const CACHE_PUBLIC_IMMUTABLE = 'public, max-age=86400, s-maxage=86400';

/** User-specific data that should revalidate on every request */
export const CACHE_PRIVATE_REVALIDATE = 'private, no-cache';

/** User-specific data safe to cache briefly (collections, places) */
export const CACHE_PRIVATE_SHORT = 'private, max-age=30';

/** Streaming / SSE responses */
export const CACHE_NO_STORE = 'no-cache, no-store';

/** Helper to add cache headers to a NextResponse */
export function withCache(headers: Record<string, string>, policy: string): Record<string, string> {
  return { ...headers, 'Cache-Control': policy };
}
