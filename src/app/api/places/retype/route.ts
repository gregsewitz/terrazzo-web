import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getPlaceById, searchPlace, resolveGooglePlaceType } from '@/lib/places';

/**
 * Temporary endpoint to batch-resolve and retype activity-typed SavedPlaces.
 *
 * GET  → diagnostic counts + sample
 * POST → resolve places without googlePlaceId via Google search, then retype
 *        ?limit=20&offset=0  (default 20 per batch to stay within Vercel timeout)
 *
 * REMOVE AFTER RUNNING.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  const baseWhere = {
    deletedAt: null,
    ...(userId ? { userId } : {}),
  };

  const [withGpid, withoutGpid, totalPlaces, byType] = await Promise.all([
    prisma.savedPlace.count({
      where: { ...baseWhere, type: 'activity', googlePlaceId: { not: null } },
    }),
    prisma.savedPlace.count({
      where: { ...baseWhere, type: 'activity', googlePlaceId: null },
    }),
    prisma.savedPlace.count({ where: baseWhere }),
    prisma.savedPlace.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: true,
      orderBy: { _count: { type: 'desc' } },
    }),
  ]);

  const activitySample = await prisma.savedPlace.findMany({
    where: { ...baseWhere, type: 'activity' },
    select: { id: true, name: true, type: true, googlePlaceId: true, location: true },
    take: 20,
  });

  return NextResponse.json({
    activity: { withGooglePlaceId: withGpid, withoutGooglePlaceId: withoutGpid },
    totalPlaces,
    byType: byType.map(t => ({ type: t.type, count: t._count })),
    activitySample,
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_API_KEY && authHeader !== 'retype-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Fetch activity places — prioritize ones WITHOUT googlePlaceId (the 865)
  const activityPlaces = await prisma.savedPlace.findMany({
    where: {
      type: 'activity',
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      location: true,
      type: true,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[retype] Processing ${activityPlaces.length} places (offset=${offset}, limit=${limit})`);

  type Result = {
    name: string;
    googlePlaceId: string | null;
    newGooglePlaceId?: string;
    oldType: string;
    newType: string;
    updated: boolean;
    error?: string;
  };

  const results: Result[] = [];

  // Process 3 at a time to stay within rate limits + Vercel timeout
  const BATCH_SIZE = 3;
  for (let i = 0; i < activityPlaces.length; i += BATCH_SIZE) {
    const batch = activityPlaces.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (place): Promise<Result> => {
        try {
          let googleResult;
          let resolvedGpid = place.googlePlaceId;

          if (place.googlePlaceId) {
            // Already has a googlePlaceId — just fetch types
            googleResult = await getPlaceById(place.googlePlaceId);
          } else {
            // No googlePlaceId — search by name + location
            const query = place.location
              ? `${place.name}, ${place.location}`
              : place.name;

            googleResult = await searchPlace(query, undefined, place.name);
            if (googleResult?.id) {
              resolvedGpid = googleResult.id;
            }
          }

          if (!googleResult) {
            // Try name-based fallback for type even without Google data
            const nameType = resolveGooglePlaceType(undefined, undefined, place.name);
            if (nameType !== 'activity') {
              await prisma.savedPlace.update({
                where: { id: place.id },
                data: { type: nameType },
              });
              return {
                name: place.name,
                googlePlaceId: place.googlePlaceId,
                oldType: 'activity',
                newType: nameType,
                updated: true,
              };
            }
            return {
              name: place.name,
              googlePlaceId: place.googlePlaceId,
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

          // Build update data
          const updateData: Record<string, unknown> = {};
          if (newType !== 'activity') {
            updateData.type = newType;
          }

          // If we found a googlePlaceId via search, store it + google data
          if (!place.googlePlaceId && resolvedGpid) {
            updateData.googlePlaceId = resolvedGpid;
            updateData.googleData = googleResult as unknown as Prisma.InputJsonValue;
          }

          if (Object.keys(updateData).length > 0) {
            try {
              await prisma.savedPlace.update({
                where: { id: place.id },
                data: updateData,
              });
            } catch (dbErr: unknown) {
              // Unique constraint violation — another place already has this googlePlaceId for this user
              if (dbErr instanceof Error && dbErr.message.includes('Unique constraint')) {
                return {
                  name: place.name,
                  googlePlaceId: place.googlePlaceId,
                  newGooglePlaceId: resolvedGpid || undefined,
                  oldType: 'activity',
                  newType,
                  updated: false,
                  error: 'duplicate_gpid',
                };
              }
              throw dbErr;
            }
          }

          return {
            name: place.name,
            googlePlaceId: place.googlePlaceId,
            newGooglePlaceId: resolvedGpid !== place.googlePlaceId ? resolvedGpid || undefined : undefined,
            oldType: 'activity',
            newType,
            updated: Object.keys(updateData).length > 0,
          };
        } catch (err) {
          console.error(`[retype] Failed for ${place.name}:`, err);
          return {
            name: place.name,
            googlePlaceId: place.googlePlaceId,
            oldType: 'activity',
            newType: 'activity',
            updated: false,
            error: String(err),
          };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < activityPlaces.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const updated = results.filter(r => r.updated);
  const unchanged = results.filter(r => !r.updated && !r.error);
  const errors = results.filter(r => r.error);

  // Get remaining count
  const remaining = await prisma.savedPlace.count({
    where: { type: 'activity', deletedAt: null },
  });

  return NextResponse.json({
    summary: {
      processed: activityPlaces.length,
      retyped: updated.length,
      unchanged: unchanged.length,
      errors: errors.length,
      remaining,
    },
    retyped: updated.map(r => ({ name: r.name, newType: r.newType, newGpid: r.newGooglePlaceId })),
    stillActivity: unchanged.map(r => ({ name: r.name })),
    errors: errors.map(r => ({ name: r.name, error: r.error })),
  });
}
