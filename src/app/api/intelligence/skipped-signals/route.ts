import { NextRequest, NextResponse } from 'next/server';
import { getSkippedSignals, clearSkippedSignals } from '@/lib/taste-intelligence/vectors-v3';

/**
 * GET  → Returns all signals that were skipped during vector computation
 *        (not in signalToCluster and OpenAI embedding failed or unavailable).
 *        Sorted by frequency, most-skipped first.
 *
 * POST → Clears the skipped signal cache (e.g. after a re-cluster).
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skipped = getSkippedSignals();
  return NextResponse.json({
    total: skipped.length,
    totalOccurrences: skipped.reduce((sum, s) => sum + s.count, 0),
    signals: skipped,
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  clearSkippedSignals();
  return NextResponse.json({ ok: true, message: 'Skipped signal cache cleared' });
}
