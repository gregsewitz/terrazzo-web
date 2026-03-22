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

// ── Enrichment quality ──────────────────────────────────────────────────────

/**
 * Minimum signal count for a "complete" PlaceIntelligence record to be
 * considered fully enriched. Records below this threshold are flagged for
 * re-enrichment by the orphan-sweep cron (Pass 6).
 *
 * Based on signal count distribution (March 2026):
 *   - Under 50: 21 properties (clearly broken — avg 37 signals)
 *   - 50-99: 91 properties (likely incomplete — avg 76 signals)
 *   - 100-119: 68 properties (borderline)
 *   - 120+: 1,009 properties (normal — avg 179 signals)
 *
 * Set to 80 to catch clearly under-enriched records without being too
 * aggressive on place types that naturally have fewer signals (galleries,
 * small shops).
 */
export const MIN_ENRICHMENT_SIGNAL_COUNT = 80;

// ── Taste vector scoring ────────────────────────────────────────────────────

/** Anti-signal activations contribute at this fraction of their confidence (negative) */
export const ANTI_SIGNAL_SCALE = 0.5;

/**
 * Bleed-only clusters (no direct hit) retain this fraction of their energy.
 *
 * History: 0.3 → 0.08 → 0.25
 * 0.3 caused saturation (290/400 dims lit, 5-point IQR).
 * 0.08 overcorrected — hotels spread signals across many domains
 * (Design, Wellness, Setting, Service), but user vectors only have
 * direct hits in a few. At 0.08, hotel dimensions that activate
 * only via bleed are crushed by 92%, making hotels score 2-3x lower
 * than restaurants (which concentrate in 2-3 direct-hit domains).
 * 0.25 restores meaningful cross-domain bleed while log1p + L2-norm
 * still prevent saturation.
 *
 * Effect: bleed-only cluster with raw energy 0.3 → log1p(0.3)=0.26 → ×0.25 = 0.065
 * (above the 0.03 activation threshold — contributes to cosine sim)
 */
export const BLEED_ONLY_DAMPEN = 0.25;

/** Cluster is "activated" if |value| exceeds this threshold */
export const CLUSTER_ACTIVATION_THRESHOLD = 0.03;

/**
 * Asymmetric similarity exponent: controls how much low-activation user
 * dimensions are down-weighted in the cosine similarity computation.
 * Each dimension is weighted by |user[i]|^exponent.
 *
 * Set to 0 to disable (equivalent to standard cosine similarity).
 *
 * Tuning guide:
 *   - 0.0: standard cosine (no asymmetry)
 *   - 0.3: mild asymmetry — slightly favors dimensions with strong user signal
 *   - 0.5: moderate asymmetry (sqrt weighting) — recommended starting point
 *   - 1.0: strong asymmetry — dimensions scale linearly with user activation
 *   - >1.0: very aggressive — mostly ignores low-activation dimensions
 */
export const ASYMMETRIC_SIMILARITY_EXPONENT = 0.5;

/** Blend weight: fraction of signal vector vs. property anchor vector */
export const USER_SIGNAL_WEIGHT = 0.6;

// ── Display score normalization (REMOVED) ───────────────────────────────────
// SCORE_DISPLAY_CEILING, SCORE_DISPLAY_FLOOR, and SCORE_SPREAD_FACTOR have
// been removed. Raw cosine similarity scores are now used directly. Tier classification
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
  { domain: 'Setting', start: 337, end: 379 },
  { domain: 'Sustainability', start: 380, end: 386 },
  { domain: 'Wellness', start: 387, end: 399 },
] as const;
