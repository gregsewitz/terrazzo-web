/**
 * GET /api/cron/signal-decay
 *
 * Daily cron job: recompute decayed confidence on all TasteNode records.
 * Uses the 180-day half-life formula: decayed = confidence * 0.5^(ageInDays/180)
 *
 * Configured in vercel.json as a Vercel Cron running daily at 2am UTC.
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Update ageInDays and decayedConfidence for all TasteNodes
    const updated = await prisma.$executeRaw`
      UPDATE "TasteNode"
      SET
        "ageInDays" = EXTRACT(DAY FROM NOW() - "extractedAt")::int,
        "decayedConfidence" = "confidence" * POWER(0.5, EXTRACT(DAY FROM NOW() - "extractedAt") / 180.0)
      WHERE "extractedAt" IS NOT NULL
    `;

    console.log(`[cron/signal-decay] Updated ${updated} TasteNode records`);

    return NextResponse.json({
      success: true,
      updatedNodes: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/signal-decay] Failed:', error);
    return NextResponse.json(
      { error: 'Signal decay computation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
