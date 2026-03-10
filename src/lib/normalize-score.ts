/**
 * Pure, client-safe score normalization.
 *
 * Converts a raw cosine×100 matchScore (typical range 0-30, mean ~7)
 * into a user-friendly display range (35-93) via z-score + tanh curve.
 *
 * No DB or server dependencies — safe to import from stores and components.
 *
 * Population stats are updated periodically; current values are from the
 * v3.6 backfill (Mar 2026). Regenerate via:
 *   SELECT AVG((1-(u."tasteVectorV3" <=> pi."embeddingV3"))*100),
 *          STDDEV((1-(u."tasteVectorV3" <=> pi."embeddingV3"))*100)
 *   FROM "User" u, "PlaceIntelligence" pi
 *   WHERE u."tasteVectorV3" IS NOT NULL AND pi."embeddingV3" IS NOT NULL;
 */
export function normalizeMatchScoreForDisplay(
  rawScore: number,
  ceiling = 93,
  floor = 35,
): number {
  const POPULATION_MEAN = 7;
  const POPULATION_STDDEV = 8.5;

  if (POPULATION_STDDEV < 0.1) return Math.round((ceiling + floor) / 2 + 10);

  const displayRange = ceiling - floor;
  const medianDisplay = floor + displayRange * 0.50;
  const z = (rawScore - POPULATION_MEAN) / POPULATION_STDDEV;
  const curved = Math.tanh(z * 0.8);
  const displayScore = Math.round(medianDisplay + curved * (displayRange * 0.50));
  return Math.max(floor, Math.min(ceiling, displayScore));
}
