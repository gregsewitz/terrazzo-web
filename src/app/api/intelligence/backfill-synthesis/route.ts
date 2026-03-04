/**
 * POST /api/intelligence/backfill-synthesis
 *
 * Re-triggers the pipeline for completed PlaceIntelligence records that are
 * missing synthesis fields (description, whatToOrder, tips). This allows
 * existing enriched places to get the new synthesis output without waiting
 * for a full re-enrichment.
 *
 * Also backfills googleData onto PlaceIntelligence from linked SavedPlace
 * records (for places enriched before PI stored googleData).
 *
 * Query params:
 *   ?dryRun=true  — report what would be triggered without acting
 *   ?limit=50     — max records to process (default 50)
 *   ?googleDataOnly=true — only backfill googleData, skip pipeline re-trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

export async function POST(req: NextRequest) {
  // Auth: require PIPELINE_WEBHOOK_SECRET (reuse the same secret)
  const webhookSecret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const googleDataOnly = req.nextUrl.searchParams.get('googleDataOnly') === 'true';

    // ── 1. Backfill googleData from SavedPlace → PlaceIntelligence ────────
    const piMissingGoogleData = await prisma.placeIntelligence.findMany({
      where: {
        googleData: { equals: Prisma.JsonNull },
      },
      select: { id: true, googlePlaceId: true, propertyName: true },
      take: limit,
    });

    let googleDataBackfilled = 0;
    if (!dryRun) {
      for (const pi of piMissingGoogleData) {
        // Find any SavedPlace with googleData for this place
        const sp = await prisma.savedPlace.findFirst({
          where: {
            googlePlaceId: pi.googlePlaceId,
            googleData: { not: Prisma.JsonNull },
          },
          select: { googleData: true },
        });

        if (sp?.googleData) {
          await prisma.placeIntelligence.update({
            where: { id: pi.id },
            data: { googleData: sp.googleData as any },
          });
          googleDataBackfilled++;
        }
      }
    }

    if (googleDataOnly) {
      return NextResponse.json({
        success: true,
        dryRun,
        googleDataMissing: piMissingGoogleData.length,
        googleDataBackfilled,
      });
    }

    // ── 2. Find PI records needing synthesis ─────────────────────────────
    const needsSynthesis = await prisma.placeIntelligence.findMany({
      where: {
        status: 'complete',
        description: null,
        signalCount: { gt: 0 },
      },
      select: {
        id: true,
        googlePlaceId: true,
        propertyName: true,
      },
      take: limit,
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        googleDataMissing: piMissingGoogleData.length,
        needsSynthesis: needsSynthesis.length,
        places: needsSynthesis.map(p => ({
          id: p.id,
          googlePlaceId: p.googlePlaceId,
          name: p.propertyName,
        })),
      });
    }

    // ── 3. Re-trigger pipeline for each (it will re-run synthesis) ───────
    const triggered: { googlePlaceId: string; name: string; jobId?: string }[] = [];
    const errors: { googlePlaceId: string; name: string; error: string }[] = [];

    for (const pi of needsSynthesis) {
      try {
        // Reset status so the pipeline can re-run
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: { status: 'pending' },
        });

        const res = await fetch(`${PIPELINE_WORKER_URL}/enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googlePlaceId: pi.googlePlaceId,
            propertyName: pi.propertyName,
            placeIntelligenceId: pi.id,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push({ googlePlaceId: pi.googlePlaceId, name: pi.propertyName, error: `Railway ${res.status}: ${errText}` });
          continue;
        }

        const { jobId } = await res.json() as { jobId: string };
        triggered.push({ googlePlaceId: pi.googlePlaceId, name: pi.propertyName, jobId });
      } catch (err) {
        errors.push({
          googlePlaceId: pi.googlePlaceId,
          name: pi.propertyName,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      googleDataMissing: piMissingGoogleData.length,
      googleDataBackfilled,
      synthesisNeeded: needsSynthesis.length,
      triggered: triggered.length,
      places: triggered,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('[backfill-synthesis] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed', details: (error as Error).message },
      { status: 500 },
    );
  }
}
