/**
 * POST /api/intelligence/taste-backfill
 *
 * Runs the Taste Intelligence vector backfill pipeline:
 * - Phase 1: Extract signals → TasteNode, compute user taste vectors
 * - Phase 2: Compute property embeddings from PlaceIntelligence signals
 *
 * Modes:
 *   { mode: "full" }                     — run both phases (default)
 *   { mode: "full-rescore" }             — full backfill + rescore all users' saved places + refresh population stats
 *   { mode: "user", userId: "..." }      — backfill a single user
 *   { mode: "properties" }               — backfill property embeddings only
 *   { mode: "batch", offset: 0, limit: 100 } — batched property backfill (for large sets)
 *   { mode: "idf" }                      — compute IDF weights only
 *   { mode: "users" }                    — backfill all user vectors only
 *   { mode: "rescore" }                  — rescore all saved places for all active users
 *
 * Protected by CRON_SECRET bearer token when set.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runFullBackfillV3,
  backfillUserV3,
  backfillAllUsersV3,
  backfillAllPropertyEmbeddingsV3,
  backfillPropertyEmbeddingsBatchV3,
  computeAndSetIdfWeightsV3,
} from '@/lib/taste-intelligence';
import { rescoreAllSavedPlacesV3 } from '@/lib/taste-match-vectors';
import { refreshPopulationStats } from '@/lib/match-tier-server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 300; // 5 min — backfill may process hundreds of records

/**
 * Rescore all saved places for every onboarding-complete user (excluding test accounts).
 * Returns per-user results for debugging.
 */
async function rescoreAllUsers(): Promise<{
  total: number;
  rescored: number;
  results: Array<{ userId: string; email: string; scored: number; total: number }>;
}> {
  const users = await prisma.user.findMany({
    where: {
      isOnboardingComplete: true,
      email: { not: { startsWith: 'test-' } },
    },
    select: { id: true, email: true },
  });

  console.log(`[rescore-all] Rescoring saved places for ${users.length} active users`);

  const results: Array<{ userId: string; email: string; scored: number; total: number }> = [];
  let rescored = 0;

  for (const user of users) {
    try {
      const result = await rescoreAllSavedPlacesV3(user.id);
      results.push({
        userId: user.id,
        email: user.email,
        scored: result.scored,
        total: result.total,
      });
      if (result.scored > 0) rescored++;
      console.log(`[rescore-all] ${user.email}: ${result.scored}/${result.total} places rescored`);
    } catch (err) {
      console.error(`[rescore-all] Failed for ${user.email}:`, err);
      results.push({ userId: user.id, email: user.email, scored: 0, total: 0 });
    }
  }

  return { total: users.length, rescored, results };
}

export async function POST(req: NextRequest) {
  // Simple auth check — skip if CRON_SECRET isn't configured
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { mode = 'full', userId, offset = 0, limit = 100 } = body as {
      mode?: string;
      userId?: string;
      offset?: number;
      limit?: number;
    };

    if (mode === 'user' && userId) {
      const result = await backfillUserV3(userId);
      return NextResponse.json({ ok: true, mode: 'user', result });
    }

    if (mode === 'idf') {
      const result = await computeAndSetIdfWeightsV3();
      return NextResponse.json({ ok: true, mode: 'idf', result });
    }

    if (mode === 'users') {
      await computeAndSetIdfWeightsV3();
      const result = await backfillAllUsersV3();
      return NextResponse.json({ ok: true, mode: 'users', result });
    }

    if (mode === 'batch') {
      await computeAndSetIdfWeightsV3();
      const result = await backfillPropertyEmbeddingsBatchV3(offset, limit);
      return NextResponse.json({ ok: true, mode: 'batch', result });
    }

    if (mode === 'properties') {
      const result = await backfillAllPropertyEmbeddingsV3();
      return NextResponse.json({ ok: true, mode: 'properties', result });
    }

    if (mode === 'rescore') {
      const result = await rescoreAllUsers();
      return NextResponse.json({ ok: true, mode: 'rescore', ...result });
    }

    // Full backfill + rescore + population stats refresh
    // Use this after changing vector constants (BLEED_ONLY_DAMPEN, bleed scales, etc.)
    if (mode === 'full-rescore') {
      console.log('[taste-backfill] Starting full-rescore pipeline');

      // Step 1: Recompute all vectors (users + properties)
      const backfill = await runFullBackfillV3();
      console.log(`[taste-backfill] Vectors done: ${backfill.users.computed} users, ${backfill.props.computed} properties`);

      // Step 2: Rescore all saved places with new vectors
      const rescore = await rescoreAllUsers();
      console.log(`[taste-backfill] Rescore done: ${rescore.rescored} users with scored places`);

      // Step 3: Refresh population stats (mean/stddev will shift with new score distribution)
      const popStats = await refreshPopulationStats();
      console.log(`[taste-backfill] Population stats: mean=${popStats.mean.toFixed(1)}, stddev=${popStats.stddev.toFixed(1)} (${popStats.pairs} pairs)`);

      return NextResponse.json({
        ok: true,
        mode: 'full-rescore',
        backfill: {
          idf: backfill.idf,
          users: backfill.users,
          properties: backfill.props,
        },
        rescore: {
          total: rescore.total,
          rescored: rescore.rescored,
          results: rescore.results,
        },
        populationStats: {
          mean: popStats.mean,
          stddev: popStats.stddev,
          pairs: popStats.pairs,
        },
      });
    }

    // Default: full V3 backfill (Phase 1 + Phase 2)
    const result = await runFullBackfillV3();
    return NextResponse.json({
      ok: true,
      mode: 'full',
      idf: result.idf,
      users: result.users,
      properties: result.props,
    });
  } catch (err) {
    console.error('[taste-backfill] Error:', err);
    return NextResponse.json(
      { error: 'Taste backfill failed', details: String(err) },
      { status: 500 },
    );
  }
}
