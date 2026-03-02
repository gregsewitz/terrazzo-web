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
import { backfillAllUsers, backfillAllPropertyEmbeddings } from '@/lib/taste-intelligence';

export const maxDuration = 300; // 5 min — may need to process many users/properties

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Phase 1: Refresh user taste vectors
    const userResults = await backfillAllUsers();
    const usersSuccessful = userResults.filter(r => r.vectorComputed).length;
    const usersFailed = userResults.filter(r => !r.vectorComputed).length;

    console.log(`[cron/vector-refresh] Users: ${usersSuccessful} success, ${usersFailed} failed out of ${userResults.length}`);

    // Phase 2: Refresh property embeddings
    const propResults = await backfillAllPropertyEmbeddings();

    console.log(`[cron/vector-refresh] Properties: ${propResults.computed} computed, ${propResults.skipped} skipped out of ${propResults.total}`);

    return NextResponse.json({
      success: true,
      users: {
        total: userResults.length,
        successful: usersSuccessful,
        failed: usersFailed,
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
