import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { backfillUser } from '@/lib/taste-intelligence';
import { computeAndSetIdfWeights } from '@/lib/taste-intelligence/backfill';
import { computeAndSetIdfWeightsV3, backfillUserV3 } from '@/lib/taste-intelligence/backfill-v3';

/**
 * POST /api/onboarding/compute-vectors
 *
 * Computes taste vectors (v2.1 + v3) for the authenticated user.
 * Called fire-and-forget from the client after onboarding finishes.
 *
 * This ensures the user's taste vector includes:
 *   - All accumulated signals (from conversation phases + mosaic)
 *   - Property anchor blending (v3 only — from resolved place mentions)
 *   - Anti-signal integration (v3 only — from rejection signals)
 *
 * Runs IDF weight computation first (required for accurate vector computation),
 * then computes both v2.1 and v3 vectors in parallel.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    // Set IDF weights (both versions need this)
    await Promise.all([
      computeAndSetIdfWeights(),
      computeAndSetIdfWeightsV3(),
    ]);

    // Compute both vector versions in parallel
    const [v21Result, v3Result] = await Promise.all([
      backfillUser(user.id),
      backfillUserV3(user.id),
    ]);

    console.log(
      `[compute-vectors] User ${user.id}: v2.1=${v21Result.vectorComputed}, v3=${v3Result.vectorComputed} (${v3Result.anchorsBlended} anchors blended)`,
    );

    return NextResponse.json({
      ok: true,
      v21: { vectorComputed: v21Result.vectorComputed },
      v3: { vectorComputed: v3Result.vectorComputed, anchorsBlended: v3Result.anchorsBlended },
    });
  } catch (error) {
    console.error('[compute-vectors] Error:', error);
    return NextResponse.json(
      { error: 'Vector computation failed', details: String(error) },
      { status: 500 },
    );
  }
}
