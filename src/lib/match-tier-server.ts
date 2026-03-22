/**
 * Server-side population stats refresh for match tiers.
 *
 * This module queries the DB for live matchScore statistics
 * and updates the in-process cache used by getMatchTier().
 *
 * Stats are computed from actual matchScore values in SavedPlace,
 * which ensures the population distribution matches the scoring
 * function (asymmetric cosine similarity) rather than pgvector's
 * standard cosine distance operator.
 *
 * Import this ONLY in server-side code (API routes, cron jobs).
 * match-tier.ts is client-safe; this module is not (it imports Prisma).
 */

import { prisma } from '@/lib/prisma';
import { setPopulationStats, populationStatsStale } from './match-tier';

/**
 * Refresh population stats from the database.
 *
 * Computes mean and stddev from actual matchScore values across all
 * SavedPlace records for real (non-test) users. This ensures tier
 * boundaries stay consistent with the scoring function, even as
 * ASYMMETRIC_SIMILARITY_EXPONENT or other parameters change.
 *
 * Call this:
 *   - From the vector-refresh cron (weekly, after recomputing vectors)
 *   - From the rescore cron (after updating matchScore values)
 *   - From any API route that needs fresh stats (with staleness check)
 */
export async function refreshPopulationStats(): Promise<{ mean: number; stddev: number; pairs: number }> {
  const result = await prisma.$queryRaw<Array<{
    mean: number | null;
    stddev: number | null;
    pairs: number;
  }>>`
    SELECT
      AVG(sp."matchScore")::float as mean,
      STDDEV(sp."matchScore")::float as stddev,
      COUNT(*)::int as pairs
    FROM "SavedPlace" sp
    JOIN "User" u ON u.id = sp."userId"
    WHERE sp."matchScore" IS NOT NULL
      AND u.email NOT LIKE 'test-%'
  `;

  const { mean, stddev, pairs } = result[0] || {};

  if (mean != null && stddev != null && stddev > 0.001 && pairs > 10) {
    setPopulationStats(mean, stddev);
    return { mean, stddev, pairs };
  }

  console.warn(`[match-tier-server] Insufficient data for population stats (${pairs} pairs). Using defaults.`);
  return { mean: mean ?? 0, stddev: stddev ?? 0, pairs: pairs ?? 0 };
}

/**
 * Ensure population stats are fresh. Safe to call from any API route.
 * Only hits the DB if the cached stats are stale (>24h or never loaded).
 */
export async function ensurePopulationStats(): Promise<void> {
  if (!populationStatsStale()) return;
  try {
    await refreshPopulationStats();
  } catch (err) {
    console.error('[match-tier-server] Failed to refresh population stats:', err);
    // Fallback to hardcoded defaults — not ideal but not a crash
  }
}
