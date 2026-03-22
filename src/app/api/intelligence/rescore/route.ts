import { NextRequest, NextResponse } from 'next/server';
import { rescoreAllSavedPlacesV3, vectorDrift } from '@/lib/taste-match-vectors';
import { computeAndSetIdfWeightsV3, backfillUserV3 } from '@/lib/taste-intelligence';
import { prisma } from '@/lib/prisma';

export const maxDuration = 300;

/**
 * POST /api/intelligence/rescore
 *
 * Batch rescore all saved places for a user using V3 vector matching.
 * Protected by CRON_SECRET — not a user-facing endpoint.
 *
 * Body: { userId: string, recompute?: boolean }
 *
 * When recompute=true, recomputes the user's taste vector from TasteNode
 * signals using current signal-clusters.json before rescoring.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const userId = body.userId;
    const recompute = body.recompute === true;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    let drift: number | null = null;
    let v3Result = null;

    if (recompute) {
      // Snapshot old vector for drift detection
      const oldVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
        `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
        userId,
      );
      const oldVecRaw = oldVecRow[0]?.vec;
      const oldVector = oldVecRaw
        ? oldVecRaw.replace(/[\[\]]/g, '').split(',').map(Number)
        : null;

      // Recompute IDF + user vector
      await computeAndSetIdfWeightsV3();
      v3Result = await backfillUserV3(userId);
      console.log(`[rescore] Recomputed vector: ${JSON.stringify(v3Result)}`);

      // Measure drift
      if (oldVector && v3Result.vectorComputed) {
        const newVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
          `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
          userId,
        );
        const newVecRaw = newVecRow[0]?.vec;
        const newVector = newVecRaw
          ? newVecRaw.replace(/[\[\]]/g, '').split(',').map(Number)
          : null;
        if (newVector) {
          drift = vectorDrift(oldVector, newVector);
          console.log(`[rescore] Vector drift: ${drift.toFixed(6)}`);
        }
      }
    }

    const result = await rescoreAllSavedPlacesV3(userId);

    return NextResponse.json({
      ok: true,
      ...result,
      ...(recompute ? { recomputed: true, drift, v3: v3Result } : {}),
    });
  } catch (error) {
    console.error('[rescore] Error:', error);
    return NextResponse.json(
      { error: 'Rescore failed', details: String(error) },
      { status: 500 },
    );
  }
}
