/**
 * GET /api/cron/vector-refresh
 *
 * Weekly cron job: recompute taste vectors for all users and property embeddings
 * for all enriched places. Catches drift from signal decay and new enrichments.
 *
 * Configured in vercel.json as a Vercel Cron running Sundays at 2am UTC.
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { backfillAllUsersV3, backfillAllPropertyEmbeddingsV3 } from '@/lib/taste-intelligence';

export const maxDuration = 300; // 5 min — may need to process many users/properties

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Phase 1: Refresh user V3 taste vectors (400-dim semantic clusters)
    const userResults = await backfillAllUsersV3();

    console.log(`[cron/vector-refresh] Users: ${userResults.computed} computed out of ${userResults.total}`);

    // Phase 2: Refresh V3 property embeddings
    const propResults = await backfillAllPropertyEmbeddingsV3();

    console.log(`[cron/vector-refresh] Properties: ${propResults.computed} computed, ${propResults.skipped} skipped out of ${propResults.total}`);

    return NextResponse.json({
      success: true,
      users: {
        total: userResults.total,
        computed: userResults.computed,
      },
      properties: {
        total: propResults.total,
        computed: propResults.computed,
        skipped: propResults.skipped,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/vector-refresh] Failed:', error);
    return NextResponse.json(
      { error: 'Vector refresh failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
