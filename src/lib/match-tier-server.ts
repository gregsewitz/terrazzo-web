/**
 * Server-side population stats refresh for match tiers.
 *
 * This module queries the DB for live cosine similarity statistics
 * and updates the in-process cache used by getMatchTier().
 *
 * Import this ONLY in server-side code (API routes, cron jobs).
 * match-tier.ts is client-safe; this module is not (it imports Prisma).
 */

import { prisma } from '@/lib/prisma';
import { setPopulationStats, populationStatsStale } from './match-tier';

/**
 * Refresh population stats from the database.
 *
 * Computes mean and stddev of raw cosine similarity across all real onboarded
 * users and all enriched properties. Test users (email LIKE 'test-%') are excluded.
 *
 * Call this:
 *   - From the vector-refresh cron (weekly, after recomputing vectors)
 *   - From any API route that needs fresh stats (with staleness check)
 */
export async function refreshPopulationStats(): Promise<{ mean: number; stddev: number; pairs: number }> {
  const result = await prisma.$queryRaw<Array<{
    mean: number | null;
    stddev: number | null;
    pairs: number;
  }>>`
    SELECT
      AVG(1 - (u."tasteVectorV3" <=> pi."embeddingV3"))::float as mean,
      STDDEV(1 - (u."tasteVectorV3" <=> pi."embeddingV3"))::float as stddev,
      COUNT(*)::int as pairs
    FROM "User" u
    CROSS JOIN "PlaceIntelligence" pi
    WHERE u."tasteVectorV3" IS NOT NULL
      AND u.email NOT LIKE 'test-%'
      AND pi."embeddingV3" IS NOT NULL
      AND pi.status = 'complete'
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
