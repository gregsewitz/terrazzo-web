/**
 * Match tier system.
 *
 * Replaces percentage-based match scores with qualitative tiers.
 * Tier boundaries are defined directly on raw cosine×100 scores
 * (the unmodified output of computeVectorMatch), using population
 * z-scores to set thresholds that adapt as the place corpus grows.
 *
 * Raw scores vary significantly by user density. Previous versions applied
 * a tanh sigmoid to stretch scores into a "human-readable" 35-96 display
 * range — that transform has been removed because:
 *   1. The UI now shows tier labels, not percentages
 *   2. The tanh compressed extremes where differentiation matters most
 *   3. Batch vs population normalization caused tier instability
 *
 * Population stats are refreshed automatically by the weekly vector-refresh
 * cron job. The hardcoded defaults below are used as fallbacks when the
 * live stats haven't been loaded (client-side imports, cold starts).
 *
 * To refresh manually:
 *   SELECT AVG((1-(u."tasteVectorV3" <=> pi."embeddingV3"))*100),
 *          STDDEV((1-(u."tasteVectorV3" <=> pi."embeddingV3"))*100)
 *   FROM "User" u, "PlaceIntelligence" pi
 *   WHERE u."tasteVectorV3" IS NOT NULL
 *     AND u.email NOT LIKE 'test-%'
 *     AND pi."embeddingV3" IS NOT NULL
 *     AND pi.status = 'complete';
 */

// ── Population statistics ───────────────────────────────────────────────────
// Hardcoded fallback values (updated Mar 21 2026 after raw-cosine rescore).
// On the server, these are overridden by live stats from the DB via
// refreshPopulationStats() / setPopulationStats().

const DEFAULT_POPULATION_MEAN = 3.25;
const DEFAULT_POPULATION_STDDEV = 4.99;

let _liveMean: number | null = null;
let _liveStddev: number | null = null;
let _lastRefresh: number = 0;

/** TTL for cached live stats (24 hours) */
const STATS_TTL_MS = 24 * 60 * 60 * 1000;

/** Current population mean (live if available, otherwise fallback). */
export function getPopulationMean(): number {
  return _liveMean ?? DEFAULT_POPULATION_MEAN;
}

/** Current population stddev (live if available, otherwise fallback). */
export function getPopulationStddev(): number {
  return _liveStddev ?? DEFAULT_POPULATION_STDDEV;
}

/**
 * Set live population stats (called by vector-refresh cron or on-demand).
 * These override the hardcoded defaults for the lifetime of the process
 * or until the TTL expires.
 */
export function setPopulationStats(mean: number, stddev: number): void {
  _liveMean = mean;
  _liveStddev = stddev;
  _lastRefresh = Date.now();
  console.log(`[match-tier] Population stats updated: mean=${mean.toFixed(1)}, stddev=${stddev.toFixed(1)}`);
}

/** Whether the cached live stats have expired. */
export function populationStatsStale(): boolean {
  return !_liveMean || (Date.now() - _lastRefresh) > STATS_TTL_MS;
}

// Re-export for backward compat (some modules import these)
export const POPULATION_MEAN = DEFAULT_POPULATION_MEAN;
export const POPULATION_STDDEV = DEFAULT_POPULATION_STDDEV;

// ── Tier definitions ────────────────────────────────────────────────────────

export type MatchTierKey = 'strong' | 'good' | 'worth_a_look' | 'mixed' | 'not_for_you';

export interface MatchTier {
  key: MatchTierKey;
  label: string;
  /** Short label for tight UI (day board badges, rail pips) */
  shortLabel: string;
  /** CSS color for the tier label text */
  color: string;
  /** Light background tint for badges */
  bg: string;
}

const TIERS: readonly MatchTier[] = [
  { key: 'strong',       label: 'Strong match',  shortLabel: 'Strong',  color: 'var(--t-dark-teal)', bg: 'rgba(58,128,136,0.10)' },
  { key: 'good',         label: 'Good match',    shortLabel: 'Good',    color: '#6b7a3a',            bg: 'rgba(107,122,58,0.10)' },
  { key: 'worth_a_look', label: 'Worth a look',  shortLabel: 'Worth a look', color: '#8a6a2a',       bg: 'rgba(138,106,42,0.10)' },
  { key: 'mixed',        label: 'Mixed fit',     shortLabel: 'Mixed',   color: 'var(--t-navy-60)',   bg: 'rgba(0,42,85,0.06)' },
  { key: 'not_for_you',  label: 'Not for you',   shortLabel: 'Not for you',  color: 'var(--t-navy-40)',   bg: 'rgba(0,42,85,0.04)' },
] as const;

/**
 * Z-score thresholds for tier boundaries.
 *
 * These define how many standard deviations above the population mean
 * a raw score needs to be to reach each tier. Because they're relative
 * to the distribution, they stay correct as the corpus grows — the
 * population stats auto-refresh via the weekly cron.
 *
 *   Strong:       z ≥ 1.3   (top ~10%)
 *   Good:         z ≥ 0.3   (above average)
 *   Worth a look: z ≥ -0.5  (near average)
 *   Mixed:        z ≥ -1.2  (below average)
 *   Not for you:  z < -1.2  (bottom tail)
 */
const Z_THRESHOLDS: readonly number[] = [1.3, 0.3, -0.5, -1.2, -Infinity];

/** Convert a raw score to a z-score against the population distribution. */
export function rawToZ(
  rawScore: number,
  mean = getPopulationMean(),
  stddev = getPopulationStddev(),
): number {
  if (stddev < 0.1) return 0;
  return (rawScore - mean) / stddev;
}

/**
 * Convert a raw cosine×100 match score into a qualitative tier.
 *
 * Accepts the raw score directly — no normalization needed.
 * Internally computes the z-score against population stats
 * to determine the tier.
 */
export function getMatchTier(score: number | null | undefined): MatchTier {
  if (score == null) return TIERS[3]; // default to 'mixed' when no score
  const z = rawToZ(score);
  for (let i = 0; i < Z_THRESHOLDS.length; i++) {
    if (z >= Z_THRESHOLDS[i]) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Whether a score is high enough to warrant showing a tier badge.
 * Used in compact UI (day board, rail) where we only show positive tiers.
 */
export function shouldShowTierBadge(score: number | null | undefined): boolean {
  if (score == null) return false;
  return rawToZ(score) >= -0.5; // 'worth a look' or above
}

/**
 * Whether a score represents a strong enough match to feature prominently.
 * Used for pip indicators, sorting highlights, etc.
 */
export function isStrongMatch(score: number | null | undefined): boolean {
  if (score == null) return false;
  return rawToZ(score) >= 1.3;
}
