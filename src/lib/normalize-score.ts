/**
 * Score utilities — client-safe, no DB dependencies.
 *
 * Previously this module contained a tanh sigmoid that mapped raw
 * cosine×100 scores into a "human-readable" 35-96 display range.
 * That transform has been removed now that the UI shows match tiers
 * instead of percentages. All tier logic lives in match-tier.ts.
 *
 * This module re-exports rawToZ for any callsites that need the
 * z-score directly (e.g., custom sorting or analytics).
 */

export { rawToZ, POPULATION_MEAN, POPULATION_STDDEV } from './match-tier';

/**
 * @deprecated Use getMatchTier() from match-tier.ts instead.
 * This function is preserved temporarily so that any stale imports
 * produce a visible console warning rather than a build error.
 * It now returns the raw score unchanged (identity function).
 */
export function normalizeMatchScoreForDisplay(rawScore: number): number {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[normalizeMatchScoreForDisplay] DEPRECATED — raw scores are now used directly. ' +
      'Use getMatchTier() from match-tier.ts for tier classification.',
    );
  }
  return Math.round(rawScore);
}
