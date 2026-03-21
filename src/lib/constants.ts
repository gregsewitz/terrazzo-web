/**
 * Centralized application constants
 *
 * Magic numbers extracted from across the codebase so thresholds,
 * timeouts, and domain definitions live in one discoverable place.
 */

// ── Email parsing ────────────────────────────────────────────────────────────

/** Minimum confidence to accept an AI-extracted reservation */
export const EMAIL_CONFIDENCE_THRESHOLD = 0.4;

// ── Google API ───────────────────────────────────────────────────────────────

/** Delay between sequential Google Places API calls (ms) */
export const GOOGLE_API_RATE_LIMIT_MS = 250;

// ── Orphan sweep backoff ─────────────────────────────────────────────────────

/** Backoff schedule for unresolved place retries (days) */
export function resolveBackoffDays(attempts: number): number {
  if (attempts < 3) return 1;
  if (attempts < 6) return 3;
  if (attempts < 10) return 7;
  return 30;
}

/** Backoff schedule for failed enrichment retries (hours) */
export function enrichmentBackoffHours(errorCount: number): number {
  if (errorCount < 3) return 1;
  if (errorCount < 6) return 24;
  if (errorCount < 10) return 72;
  return 168;
}

// ── Signal decay ────────────────────────────────────────────────────────────

/** Half-life (in days) for exponential confidence decay on taste signals */
export const SIGNAL_HALF_LIFE_DAYS = 180;

/** Signals with decayed confidence below this threshold are considered aged-out */
export const SIGNAL_AGED_OUT_THRESHOLD = 0.05;

// ── Taste vector scoring ────────────────────────────────────────────────────

/** Anti-signal activations contribute at this fraction of their confidence (negative) */
export const ANTI_SIGNAL_SCALE = 0.5;

/**
 * Bleed-only clusters (no direct hit) retain this fraction of their energy.
 *
 * Reduced from 0.3 → 0.08 (Mar 2026) to address vector saturation:
 * With 165 signals per property and 5 neighbors per cluster, bleed-only
 * activation was lighting up 290/400 dimensions, compressing cosine
 * similarity into a ~5-point IQR. At 0.08, bleed-only clusters contribute
 * minimally to the dot product, preserving sparsity and widening score spread.
 *
 * Effect: bleed-only cluster with raw energy 0.3 → log1p(0.3)=0.26 → ×0.08 = 0.021
 * (below the 0.03 activation threshold — effectively zeroed out)
 */
export const BLEED_ONLY_DAMPEN = 0.08;

/** Cluster is "activated" if |value| exceeds this threshold */
export const CLUSTER_ACTIVATION_THRESHOLD = 0.03;

/** Blend weight: fraction of signal vector vs. property anchor vector */
export const USER_SIGNAL_WEIGHT = 0.6;

// ── Display score normalization (REMOVED) ───────────────────────────────────
// SCORE_DISPLAY_CEILING, SCORE_DISPLAY_FLOOR, and SCORE_SPREAD_FACTOR have
// been removed. Raw cosine×100 scores are now used directly. Tier classification
// is handled by getMatchTier() in match-tier.ts using population z-scores.
// See match-tier.ts for POPULATION_MEAN and POPULATION_STDDEV constants.

// ── Behavioral pattern detection ────────────────────────────────────────────

/** Minimum mean cluster activation to consider a behavioral signal meaningful */
export const BEHAVIORAL_SIGNAL_THRESHOLD = 0.02;

/** Max clusters to surface per domain in behavioral analysis */
export const TOP_CLUSTERS_PER_DOMAIN = 3;

// ── Reprofiling triggers ────────────────────────────────────────────────────

/** Months since last synthesis before time-based reprofiling triggers */
export const REPROFILING_MONTHS_THRESHOLD = 6;

/** New bookings since last synthesis before behavioral reprofiling triggers */
export const REPROFILING_BOOKINGS_THRESHOLD = 3;

/** Domain confidence below this triggers a gap-fill reprofiling phase */
export const REPROFILING_CONFIDENCE_THRESHOLD = 0.5;

/** Contradiction ratio above this triggers contradiction-resolution reprofiling */
export const REPROFILING_CONTRADICTION_THRESHOLD = 0.3;

// ── Taste vector domain ranges ───────────────────────────────────────────────

export const TASTE_DOMAIN_RANGES = [
  { domain: 'Atmosphere', start: 0, end: 50 },
  { domain: 'Character', start: 51, end: 135 },
  { domain: 'Design', start: 136, end: 191 },
  { domain: 'FoodDrink', start: 192, end: 263 },
  { domain: 'Service', start: 264, end: 336 },
  { domain: 'Geography', start: 337, end: 379 },
  { domain: 'Sustainability', start: 380, end: 386 },
  { domain: 'Wellness', start: 387, end: 399 },
] as const;
