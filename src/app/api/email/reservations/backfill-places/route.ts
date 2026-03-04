import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/email/reservations/backfill-places
 *
 * One-off utility with two modes:
 *
 * 1. Default (no body or mode=resolve): Re-resolve Google Place IDs for
 *    email reservations missing them, then trigger enrichment.
 *
 * 2. mode=enrich: Trigger enrichment for SavedPlaces that have a
 *    googlePlaceId but are missing placeIntelligenceId.
 *
 * Body (optional): { mode: "resolve" | "enrich" }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const mode = (body as { mode?: string }).mode || 'resolve';

    if (mode === 'enrich') {
      return handleEnrichBackfill(user);
    }

    // Find all non-flight reservations missing googlePlaceId
    const reservations = await prisma.emailReservation.findMany({
      where: {
        userId: user.id,
        googlePlaceId: null,
        placeType: { not: 'flight' },
        placeName: { not: '' },
      },
      select: {
        id: true,
        placeName: true,
        location: true,
        placeType: true,
        savedPlaceId: true,
      },
    });

    let resolved = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{ name: string; status: string; googlePlaceId?: string }> = [];

    for (const res of reservations) {
      if (!res.location) {
        skipped++;
        results.push({ name: res.placeName, status: 'skipped (no location)' });
        continue;
      }

      try {
        const searchQuery = `${res.placeName} ${res.location}`.trim();
        const placeResult = await searchPlace(searchQuery, undefined, res.placeName);

        if (placeResult) {
          // Update the EmailReservation
          await prisma.emailReservation.update({
            where: { id: res.id },
            data: { googlePlaceId: placeResult.id },
          });

          // Also backfill the linked SavedPlace and trigger enrichment
          if (res.savedPlaceId) {
            const intelligenceId = await ensureEnrichment(
              placeResult.id, res.placeName, user.id, 'backfill', res.placeType || undefined
            ).catch((err: unknown) => {
              console.error(`[backfill] ensureEnrichment failed for "${res.placeName}":`, err);
              return null;
            });

            await prisma.savedPlace.update({
              where: { id: res.savedPlaceId },
              data: {
                googlePlaceId: placeResult.id,
                googleData: placeResult as unknown as Prisma.InputJsonValue,
                ...(intelligenceId ? { placeIntelligenceId: intelligenceId } : {}),
              },
            }).catch((err: unknown) => {
              console.error(`[backfill] Failed to update SavedPlace ${res.savedPlaceId}:`, err);
            });
          }

          resolved++;
          results.push({ name: res.placeName, status: 'resolved', googlePlaceId: placeResult.id });
          console.log(`[backfill] Resolved "${res.placeName}" → ${placeResult.id}`);
        } else {
          failed++;
          results.push({ name: res.placeName, status: 'no match' });
          console.warn(`[backfill] No match for "${res.placeName}" (location: "${res.location}")`);
        }
      } catch (err) {
        failed++;
        results.push({ name: res.placeName, status: `error: ${(err as Error).message}` });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({
      total: reservations.length,
      resolved,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}

// ─── mode=enrich ────────────────────────────────────────────────────────────
// Trigger enrichment for SavedPlaces that have a googlePlaceId but no
// placeIntelligenceId yet (e.g. places resolved by the backfill above that
// didn't get enrichment triggered, or old places that predate the pipeline).

async function handleEnrichBackfill(user: { id: string }) {
  const places = await prisma.savedPlace.findMany({
    where: {
      userId: user.id,
      googlePlaceId: { not: null },
      placeIntelligenceId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      type: true,
    },
  });

  let enriched = 0;
  let failed = 0;
  const results: Array<{ name: string; status: string; intelligenceId?: string }> = [];

  for (const place of places) {
    try {
      const intelligenceId = await ensureEnrichment(
        place.googlePlaceId!,
        place.name,
        user.id,
        'backfill_enrich',
        place.type || undefined,
      );

      if (intelligenceId) {
        await prisma.savedPlace.update({
          where: { id: place.id },
          data: { placeIntelligenceId: intelligenceId },
        });
        enriched++;
        results.push({ name: place.name, status: 'enriched', intelligenceId });
        console.log(`[backfill-enrich] Triggered enrichment for "${place.name}" → ${intelligenceId}`);
      } else {
        failed++;
        results.push({ name: place.name, status: 'no intelligence returned' });
      }
    } catch (err) {
      failed++;
      results.push({ name: place.name, status: `error: ${(err as Error).message}` });
      console.error(`[backfill-enrich] Failed for "${place.name}":`, err);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({
    total: places.length,
    enriched,
    failed,
    results,
  });
}
