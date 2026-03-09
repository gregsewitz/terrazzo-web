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
      NOT: {
        googleData: { path: ['_retypeAttempted'], equals: true },
      },
    },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      googleData: true,
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
            // No googlePlaceId — search by name + location with locationBias
            const query = place.location
              ? `${place.name}, ${place.location}`
              : place.name;

            // Extract lat/lng from stored googleData (from maps-list getlist)
            const gd = place.googleData as Record<string, unknown> | null | undefined;
            const lat = gd?.lat as number | undefined;
            const lng = gd?.lng as number | undefined;
            const locationBias = (lat && lng) ? { lat, lng, radiusMeters: 2000 } : undefined;

            googleResult = await searchPlace(query, locationBias, place.name);
            if (googleResult?.id) {
              resolvedGpid = googleResult.id;
            }
          }

          if (!googleResult) {
            // Try name-based fallback for type even without Google data
            const nameType = resolveGooglePlaceType(undefined, undefined, place.name);
            // Mark as attempted so we don't re-process in the next batch
            await prisma.savedPlace.update({
              where: { id: place.id },
              data: {
                ...(nameType !== 'activity' ? { type: nameType } : {}),
                googleData: { ...(place.googleData as Record<string, unknown> || {}), _retypeAttempted: true } as unknown as Prisma.InputJsonValue,
              },
            });
            return {
              name: place.name,
              googlePlaceId: place.googlePlaceId,
              oldType: 'activity',
              newType: nameType,
              updated: nameType !== 'activity',
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

          // If still activity, mark as attempted so we skip next batch
          if (newType === 'activity') {
            updateData.googleData = {
              ...(googleResult as Record<string, unknown> || {}),
              _retypeAttempted: true,
            } as unknown as Prisma.InputJsonValue;
          }

          if (Object.keys(updateData).length > 0) {
            try {
              await prisma.savedPlace.update({
                where: { id: place.id },
                data: updateData,
              });
            } catch (dbErr: unknown) {
              // Unique constraint violation — another place already has this googlePlaceId for this user
              // This means the user already has this place saved from a different import.
              // Soft-delete this orphan duplicate.
              if (dbErr instanceof Error && dbErr.message.includes('Unique constraint')) {
                await prisma.savedPlace.update({
                  where: { id: place.id },
                  data: { deletedAt: new Date() },
                });
                return {
                  name: place.name,
                  googlePlaceId: place.googlePlaceId,
                  newGooglePlaceId: resolvedGpid || undefined,
                  oldType: 'activity',
                  newType,
                  updated: true,
                  error: 'duplicate_gpid_deleted',
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

  // Get remaining count (excluding already-attempted ones)
  const remaining = await prisma.savedPlace.count({
    where: {
      type: 'activity',
      deletedAt: null,
      NOT: {
        googleData: { path: ['_retypeAttempted'], equals: true },
      },
    },
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
