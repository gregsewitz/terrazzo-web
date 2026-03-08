import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { searchPlace, getPhotoUrl, resolveGooglePlaceType, priceLevelToString } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User } from '@prisma/client';

/**
 * POST /api/places/backfill-resolve
 *
 * One-off backfill for places saved during preview (before enrichment).
 * Finds all places with googlePlaceId = null, resolves each via
 * Google Places text search (name + lat/lng), updates the DB record,
 * and triggers the enrichment pipeline.
 *
 * Processes in batches with rate-limiting to stay within API quotas.
 * Returns { resolved, failed, skipped } counts.
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batchSize || 20, 50);
  const offset = body.offset || 0;

  // Find places without googlePlaceId
  const places = await prisma.savedPlace.findMany({
    where: {
      userId: user.id,
      googlePlaceId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      location: true,
      googleData: true,
      type: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: batchSize,
  });

  if (places.length === 0) {
    return Response.json({ resolved: 0, failed: 0, skipped: 0, done: true });
  }

  let resolved = 0;
  let failed = 0;
  let skipped = 0;

  for (const place of places) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gd = place.googleData as any;
      const lat = gd?.lat;
      const lng = gd?.lng;

      if (!place.name) {
        skipped++;
        continue;
      }

      // Search Google Places using name + location bias
      const locationBias = lat && lng
        ? { lat, lng, radiusMeters: 500 }
        : undefined;

      const result = await searchPlace(place.name, locationBias, place.name);

      if (!result || !result.id) {
        failed++;
        continue;
      }

      // Check for duplicate — another saved place may already have this googlePlaceId
      const existingWithGpid = await prisma.savedPlace.findUnique({
        where: {
          userId_googlePlaceId: { userId: user.id, googlePlaceId: result.id },
        },
        select: { id: true },
      });

      if (existingWithGpid && existingWithGpid.id !== place.id) {
        // Duplicate — delete this preview-quality record
        await prisma.savedPlace.update({
          where: { id: place.id },
          data: { deletedAt: new Date() },
        });
        skipped++;
        continue;
      }

      // Resolve type from Google's type data
      const resolvedType = resolveGooglePlaceType(
        result.primaryType,
        result.types || [],
      );

      const photoUrl = result.photos?.[0]?.name
        ? getPhotoUrl(result.photos[0].name, 400)
        : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toJson = (v: unknown) => v as any;

      // Update the DB record
      await prisma.savedPlace.update({
        where: { id: place.id },
        data: {
          googlePlaceId: result.id,
          type: resolvedType,
          location: result.formattedAddress || place.location || undefined,
          googleData: toJson({
            placeId: result.id,
            rating: result.rating,
            reviewCount: result.userRatingCount,
            category: result.primaryTypeDisplayName?.text || result.primaryType,
            priceLevel: priceLevelToString(result.priceLevel),
            hours: result.regularOpeningHours?.weekdayDescriptions,
            photoUrl,
            address: result.formattedAddress,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            website: (result as any).websiteUri,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            phone: (result as any).nationalPhoneNumber,
            lat: result.location?.latitude,
            lng: result.location?.longitude,
          }),
        },
      });

      // Trigger the enrichment pipeline (taste match, intelligence, etc.)
      ensureEnrichment(result.id, place.name, user.id, 'backfill', resolvedType).catch(() => {});

      resolved++;

      // Small delay to avoid hammering the Google API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`[backfill-resolve] Failed for ${place.name}:`, err);
      failed++;
    }
  }

  const remaining = await prisma.savedPlace.count({
    where: {
      userId: user.id,
      googlePlaceId: null,
      deletedAt: null,
    },
  });

  return Response.json({
    resolved,
    failed,
    skipped,
    remaining,
    done: remaining === 0,
  });
});
