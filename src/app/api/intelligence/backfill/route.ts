/**
 * POST /api/intelligence/backfill
 *
 * Triggers the intelligence pipeline for all saved places that don't yet have
 * a PlaceIntelligence record (or whose record failed).
 *
 * Optional query params:
 *   ?email=...     — limit to a specific user's places
 *   ?dryRun=true   — just report what would be triggered, don't actually send events
 *   ?force=true    — re-run even for "complete" records with empty signals
 *
 * Enrichment is triggered directly via the Railway pipeline worker's /enrich endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

export async function POST(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const force = req.nextUrl.searchParams.get('force') === 'true';

    // 1. Find all saved places with a googlePlaceId
    const whereClause: Record<string, unknown> = {
      googlePlaceId: { not: null },
    };
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
      }
      whereClause.userId = user.id;
    }

    const savedPlaces = await prisma.savedPlace.findMany({
      where: whereClause,
      select: {
        id: true,
        googlePlaceId: true,
        name: true,
        type: true,
        userId: true,
      },
    });

    // 2. Get existing PlaceIntelligence records to skip places already enriched
    const existingGoogleIds = savedPlaces
      .map(p => p.googlePlaceId)
      .filter((id): id is string => id !== null);

    const existingIntel = await prisma.placeIntelligence.findMany({
      where: {
        googlePlaceId: { in: existingGoogleIds },
      },
      select: {
        id: true,
        googlePlaceId: true,
        status: true,
        signals: true,
        signalCount: true,
      },
    });

    const intelByGoogleId = new Map(
      existingIntel.map(i => [i.googlePlaceId, i])
    );

    // 3. Determine which places need pipeline runs
    const toEnrich: { googlePlaceId: string; name: string; type: string; userId: string; existingIntelId?: string }[] = [];
    const skipped: { googlePlaceId: string; name: string; status: string }[] = [];

    for (const place of savedPlaces) {
      if (!place.googlePlaceId) continue;

      const existing = intelByGoogleId.get(place.googlePlaceId);

      if (existing?.status === 'complete') {
        // Always ensure the SavedPlace is linked, even when skipping re-enrichment
        await prisma.savedPlace.updateMany({
          where: {
            googlePlaceId: place.googlePlaceId,
            placeIntelligenceId: null,
          },
          data: { placeIntelligenceId: existing.id },
        });

        // In force mode, re-run places whose signals array is empty despite having a signalCount
        const signalsEmpty = !existing.signals || (Array.isArray(existing.signals) && existing.signals.length === 0);
        if (force && signalsEmpty && existing.signalCount > 0) {
          toEnrich.push({
            googlePlaceId: place.googlePlaceId,
            name: place.name,
            type: place.type,
            userId: place.userId,
            existingIntelId: existing.id,
          });
          continue;
        }
        skipped.push({ googlePlaceId: place.googlePlaceId, name: place.name, status: 'complete' });
        continue;
      }

      if (existing?.status === 'enriching') {
        await prisma.savedPlace.updateMany({
          where: {
            googlePlaceId: place.googlePlaceId,
            placeIntelligenceId: null,
          },
          data: { placeIntelligenceId: existing.id },
        });
        skipped.push({ googlePlaceId: place.googlePlaceId, name: place.name, status: 'enriching' });
        continue;
      }

      // Needs enrichment: no record, pending, or failed
      toEnrich.push({
        googlePlaceId: place.googlePlaceId,
        name: place.name,
        type: place.type,
        userId: place.userId,
        existingIntelId: existing?.id,
      });
    }

    // Dedupe by googlePlaceId (multiple users may have saved the same place)
    const uniqueToEnrich = [...new Map(toEnrich.map(p => [p.googlePlaceId, p])).values()];

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalSavedPlaces: savedPlaces.length,
        alreadyEnriched: skipped.filter(s => s.status === 'complete').length,
        currentlyEnriching: skipped.filter(s => s.status === 'enriching').length,
        wouldTrigger: uniqueToEnrich.length,
        places: uniqueToEnrich.map(p => ({ googlePlaceId: p.googlePlaceId, name: p.name, type: p.type })),
      });
    }

    // 4. Create PlaceIntelligence records and trigger pipeline for each
    //    Railway worker runs each job in a background thread — the /enrich call returns immediately.
    //    We fire sequentially (each await takes ~100ms) so Railway gets a steady stream, not a burst.
    const triggered: { googlePlaceId: string; name: string; intelligenceId: string; jobId?: string }[] = [];
    const errors: { googlePlaceId: string; name: string; error: string }[] = [];

    for (const place of uniqueToEnrich) {
      const intel = place.existingIntelId
        ? await prisma.placeIntelligence.update({
            where: { id: place.existingIntelId },
            data: { status: 'pending', propertyName: place.name },
          })
        : await prisma.placeIntelligence.create({
            data: {
              googlePlaceId: place.googlePlaceId,
              propertyName: place.name,
              status: 'pending',
              signals: '[]',
            },
          });

      await prisma.savedPlace.updateMany({
        where: {
          googlePlaceId: place.googlePlaceId,
          placeIntelligenceId: null,
        },
        data: { placeIntelligenceId: intel.id },
      });

      try {
        const res = await fetch(`${PIPELINE_WORKER_URL}/enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googlePlaceId: place.googlePlaceId,
            propertyName: place.name,
            placeIntelligenceId: intel.id,
            placeType: place.type,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push({ googlePlaceId: place.googlePlaceId, name: place.name, error: `Railway ${res.status}: ${errText}` });
          continue;
        }

        const { jobId } = await res.json() as { jobId: string };
        triggered.push({
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          intelligenceId: intel.id,
          jobId,
        });
      } catch (err) {
        errors.push({
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalSavedPlaces: savedPlaces.length,
      alreadyEnriched: skipped.filter(s => s.status === 'complete').length,
      currentlyEnriching: skipped.filter(s => s.status === 'enriching').length,
      triggered: triggered.length,
      places: triggered.map(p => ({ name: p.name, googlePlaceId: p.googlePlaceId, jobId: p.jobId })),
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: 'Backfill failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
