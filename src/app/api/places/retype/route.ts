import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlaceById, resolveGooglePlaceType } from '@/lib/places';

/**
 * POST /api/places/retype
 *
 * Batch re-type: finds places typed as 'activity' that have a googlePlaceId,
 * fetches their actual type from Google Place Details, and updates the DB.
 *
 * No auth — temporary one-off endpoint. Delete after retype is complete.
 *
 * Body: { batchSize?: number } (default 30, max 50)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batchSize || 30, 50);

  // Find activity-typed places that have a googlePlaceId (candidates for retyping)
  const places = await prisma.savedPlace.findMany({
    where: {
      type: 'activity',
      googlePlaceId: { not: null },
      deletedAt: null,
      // Skip places already checked in a previous retype run
      NOT: {
        googleData: { path: ['_retypeChecked'], equals: true },
      },
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
    },
    take: batchSize,
    orderBy: { createdAt: 'desc' },
  });

  if (places.length === 0) {
    return Response.json({ retyped: 0, unchanged: 0, failed: 0, remaining: 0, done: true });
  }

  let retyped = 0;
  let unchanged = 0;
  let failed = 0;
  const details: Array<{ name: string; from: string; to: string; primaryType?: string }> = [];

  for (const place of places) {
    try {
      const result = await getPlaceById(place.googlePlaceId!);

      if (!result) {
        failed++;
        details.push({ name: place.name || '?', from: 'activity', to: 'FAILED (no result)' });
        continue;
      }

      const newType = resolveGooglePlaceType(result.primaryType, result.types || [], place.name || undefined);

      if (newType === 'activity') {
        // Google still says activity — leave it, but mark as checked so we don't keep retrying
        // We'll use the googleData.retypeChecked flag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingData = (await prisma.savedPlace.findUnique({
          where: { id: place.id },
          select: { googleData: true },
        }))?.googleData as any || {};

        await prisma.savedPlace.update({
          where: { id: place.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { googleData: { ...existingData, _retypeChecked: true } as any },
        });

        unchanged++;
        details.push({
          name: place.name || '?',
          from: 'activity',
          to: 'activity (confirmed)',
          primaryType: result.primaryType,
        });
        continue;
      }

      await prisma.savedPlace.update({
        where: { id: place.id },
        data: { type: newType },
      });

      retyped++;
      details.push({
        name: place.name || '?',
        from: 'activity',
        to: newType,
        primaryType: result.primaryType,
      });

      // Small delay to avoid hammering the Google API
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`[retype] Failed for ${place.name}:`, err);
      failed++;
    }
  }

  // Count remaining (activity places with googlePlaceId that haven't been checked yet)
  const remaining = await prisma.savedPlace.count({
    where: {
      type: 'activity',
      googlePlaceId: { not: null },
      deletedAt: null,
      NOT: {
        googleData: { path: ['_retypeChecked'], equals: true },
      },
    },
  });

  return Response.json({
    retyped,
    unchanged,
    failed,
    remaining,
    done: remaining === 0,
    details,
  });
}
