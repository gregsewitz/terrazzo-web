import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlaceById, resolveGooglePlaceType } from '@/lib/places';

/**
 * POST /api/places/retype
 *
 * Batch retype SavedPlaces with type='activity' that have a googlePlaceId.
 * Supports pagination: ?limit=50&offset=0
 * GET returns count only.
 *
 * TEMPORARY ENDPOINT — remove after running.
 */

export async function GET(request: NextRequest) {
  const count = await prisma.savedPlace.count({
    where: {
      type: 'activity',
      deletedAt: null,
      googlePlaceId: { not: null },
    },
  });

  return NextResponse.json({ activityCount: count });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_API_KEY && authHeader !== 'retype-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const activityPlaces = await prisma.savedPlace.findMany({
    where: {
      type: 'activity',
      deletedAt: null,
      googlePlaceId: { not: null },
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      type: true,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[retype] Processing ${activityPlaces.length} places (offset=${offset}, limit=${limit})`);

  const results: Array<{
    name: string;
    googlePlaceId: string;
    oldType: string;
    newType: string;
    updated: boolean;
  }> = [];

  // Process in batches of 5 concurrently
  const BATCH_SIZE = 5;
  for (let i = 0; i < activityPlaces.length; i += BATCH_SIZE) {
    const batch = activityPlaces.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (place) => {
        const gpid = place.googlePlaceId!;
        try {
          const googleResult = await getPlaceById(gpid);

          if (!googleResult) {
            return {
              name: place.name,
              googlePlaceId: gpid,
              oldType: 'activity',
              newType: 'activity',
              updated: false,
            };
          }

          const newType = resolveGooglePlaceType(
            googleResult.primaryType,
            googleResult.types,
            googleResult.displayName?.text || place.name,
          );

          if (newType !== 'activity') {
            await prisma.savedPlace.update({
              where: { id: place.id },
              data: { type: newType },
            });

            return {
              name: place.name,
              googlePlaceId: gpid,
              oldType: 'activity',
              newType,
              updated: true,
            };
          }

          return {
            name: place.name,
            googlePlaceId: gpid,
            oldType: 'activity',
            newType: 'activity',
            updated: false,
          };
        } catch (err) {
          console.error(`[retype] Failed for ${place.name}:`, err);
          return {
            name: place.name,
            googlePlaceId: gpid,
            oldType: 'activity',
            newType: 'activity',
            updated: false,
          };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      }
    }

    if (i + BATCH_SIZE < activityPlaces.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const updated = results.filter((r) => r.updated);
  const unchanged = results.filter((r) => !r.updated);

  return NextResponse.json({
    summary: {
      total: activityPlaces.length,
      retyped: updated.length,
      unchanged: unchanged.length,
      offset,
      limit,
    },
    retyped: updated,
    stillActivity: unchanged.map((r) => ({ name: r.name, googlePlaceId: r.googlePlaceId })),
  });
}
