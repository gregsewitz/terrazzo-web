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
