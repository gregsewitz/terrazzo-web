import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { computeAndSetIdfWeightsV3, backfillUserV3 } from '@/lib/taste-intelligence/backfill-v3';
import { rescoreAllSavedPlacesV3, vectorDrift } from '@/lib/taste-match-vectors';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/onboarding/compute-vectors
 *
 * Computes V3 taste vectors (400-dim semantic clusters) for the authenticated user.
 * Called fire-and-forget from the client after onboarding or "expand your mosaic".
 *
 * Flow:
 *   1. Snapshot the user's current vector (if any) for drift detection
 *   2. Recompute IDF weights + V3 vector from latest signals
 *   3. If the vector changed meaningfully (drift > threshold), rescore all saved places
 *
 * Drift threshold: 0.02 cosine distance (~2% shift). Below this, the change
 * is negligible and rescoring would produce identical results.
 */

export const maxDuration = 300;

const DRIFT_THRESHOLD = 0.02; // Minimum cosine distance to trigger rescore

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    // 1. Snapshot current vector for drift detection
    const oldVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
      `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
      user.id,
    );
    const oldVecRaw = oldVecRow[0]?.vec;
    const oldVector = oldVecRaw
      ? oldVecRaw.replace(/[\[\]]/g, '').split(',').map(Number)
      : null;

    // 2. Recompute IDF weights + V3 vector
    await computeAndSetIdfWeightsV3();
    const v3Result = await backfillUserV3(user.id);

    console.log(
      `[compute-vectors] User ${user.id}: v3=${v3Result.vectorComputed} (${v3Result.anchorsBlended} anchors blended)`,
    );

    // 3. Measure drift and rescore if meaningful
    let drift: number | null = null;
    let rescoreResult = null;

    if (v3Result.vectorComputed) {
      // Fetch new vector
      const newVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
        `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
        user.id,
      );
      const newVecRaw = newVecRow[0]?.vec;
      const newVector = newVecRaw
        ? newVecRaw.replace(/[\[\]]/g, '').split(',').map(Number)
        : null;

      if (oldVector && newVector) {
        drift = vectorDrift(oldVector, newVector);
        console.log(`[compute-vectors] Vector drift: ${drift.toFixed(4)} (threshold: ${DRIFT_THRESHOLD})`);
      }

      // Rescore if: first vector ever (oldVector null), or drift exceeds threshold
      const shouldRescore = !oldVector || drift === null || drift > DRIFT_THRESHOLD;

      if (shouldRescore) {
        console.log(`[compute-vectors] Triggering rescore for user ${user.id}`);
        rescoreResult = await rescoreAllSavedPlacesV3(user.id);
        console.log(
          `[compute-vectors] Rescore complete: ${rescoreResult.scored}/${rescoreResult.total} places scored`,
        );
      } else {
        console.log(`[compute-vectors] Drift below threshold — skipping rescore`);
      }
    }

    return NextResponse.json({
      ok: true,
      v3: { vectorComputed: v3Result.vectorComputed, anchorsBlended: v3Result.anchorsBlended },
      drift: drift !== null ? Number(drift.toFixed(4)) : null,
      rescore: rescoreResult
        ? { scored: rescoreResult.scored, total: rescoreResult.total }
        : null,
    });
  } catch (error) {
    console.error('[compute-vectors] Error:', error);
    return NextResponse.json(
      { error: 'Vector computation failed', details: String(error) },
      { status: 500 },
    );
  }
}
