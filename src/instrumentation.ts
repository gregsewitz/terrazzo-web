/**
 * Next.js Instrumentation Hook
 *
 * Runs once per process startup (both dev and production). Used here to
 * pre-warm the signal-clusters cache so the first API request doesn't pay
 * the 17MB JSON parse cost — and to eliminate a cold-start race where two
 * concurrent requests could each parse the file independently.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Server-only: pre-warm the signal cluster cache on process startup.
  // Dynamic import avoids bundling fs into edge/browser runtimes.
  if (typeof window === 'undefined') {
    try {
      const { getSignalClusterMap } = await import(
        '@/lib/taste-intelligence/signal-clusters-loader'
      );
      getSignalClusterMap();
      console.log('[instrumentation] Signal cluster cache pre-warmed');
    } catch (err) {
      // Non-fatal: lazy loading will still work on first API call.
      console.warn('[instrumentation] Failed to pre-warm signal cluster cache:', err);
    }
  }
}
