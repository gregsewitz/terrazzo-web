import { NextRequest, NextResponse } from 'next/server';
import { rescoreAllSavedPlacesV3 } from '@/lib/taste-match-vectors';

export const maxDuration = 300;

/**
 * POST /api/intelligence/rescore
 *
 * Batch rescore all saved places for a user using V3 vector matching.
 * Protected by CRON_SECRET — not a user-facing endpoint.
 *
 * Body: { userId: string }
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

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const result = await rescoreAllSavedPlacesV3(userId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[rescore] Error:', error);
    return NextResponse.json(
      { error: 'Rescore failed', details: String(error) },
      { status: 500 },
    );
  }
}
