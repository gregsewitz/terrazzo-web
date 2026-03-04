import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/email/reservations/backfill-places
 *
 * One-off utility: re-resolve Google Place IDs for confirmed or pending
 * email reservations that are missing them. Uses the fixed scoring
 * algorithm (nameHint) so places that previously failed will now resolve.
 *
 * Returns { resolved, failed, skipped } counts.
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
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

          // Also backfill the linked SavedPlace if it exists
          if (res.savedPlaceId) {
            await prisma.savedPlace.update({
              where: { id: res.savedPlaceId },
              data: {
                googlePlaceId: placeResult.id,
                googleData: placeResult as unknown as Prisma.InputJsonValue,
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
