import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { computeAndSetIdfWeightsV3, backfillUserV3 } from '@/lib/taste-intelligence/backfill-v3';

/**
 * POST /api/onboarding/compute-vectors
 *
 * Computes V3 taste vectors (400-dim semantic clusters) for the authenticated user.
 * Called fire-and-forget from the client after onboarding finishes.
 *
 * This ensures the user's taste vector includes:
 *   - All accumulated signals (from conversation phases + mosaic)
 *   - Property anchor blending (from resolved place mentions)
 *   - Anti-signal integration (from rejection signals)
 *
 * Runs IDF weight computation first (required for accurate vector computation),
 * then computes the V3 vector.
 *
 * Note: v2.1 vector computation removed — v4 architecture uses V3 vectors exclusively.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    // Set IDF weights (required for accurate vector computation)
    await computeAndSetIdfWeightsV3();

    // Compute V3 vector (400-dim semantic clusters)
    const v3Result = await backfillUserV3(user.id);

    console.log(
      `[compute-vectors] User ${user.id}: v3=${v3Result.vectorComputed} (${v3Result.anchorsBlended} anchors blended)`,
    );

    return NextResponse.json({
      ok: true,
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
