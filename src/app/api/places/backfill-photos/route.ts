/**
 * POST /api/places/backfill-photos
 * GET  /api/places/backfill-photos
 *
 * One-shot backfill: fetch photo URLs from Google Places API for places
 * that have a googlePlaceId but no photoUrl in their googleData.
 *
 * GET  → diagnostic count of places needing photos
 * POST → process a batch (default 20), updating both PlaceIntelligence and SavedPlace
 *
 * Temporary endpoint — remove after backfill is complete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getPlaceById, getPhotoUrl } from '@/lib/places';

export const maxDuration = 60;

// Raw SQL to find places needing photos (avoids Prisma JSON null quirks)
const NEEDS_PHOTO_WHERE = `
  "deletedAt" IS NULL
  AND "googlePlaceId" IS NOT NULL
  AND (
    "googleData" IS NULL
    OR "googleData"->>'photoUrl' IS NULL
    OR "googleData"->>'photoUrl' = 'null'
  )
  AND NOT COALESCE(("googleData"->>'_photoBackfillAttempted')::boolean, false)
`;

export async function GET() {
  const [{ count: needsPhoto }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "SavedPlace" WHERE ${NEEDS_PHOTO_WHERE}`
  );
  const [{ count: hasPhoto }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "SavedPlace" WHERE "deletedAt" IS NULL AND "googleData"->>'photoUrl' IS NOT NULL AND "googleData"->>'photoUrl' != 'null'`
  );

  return NextResponse.json({
    needsPhoto: Number(needsPhoto),
    hasPhoto: Number(hasPhoto),
  });
}

export async function POST(req: NextRequest) {
  const { limit = 20 } = await req.json().catch(() => ({}));

  // Find places needing photos via raw SQL, return IDs
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "SavedPlace" WHERE ${NEEDS_PHOTO_WHERE} ORDER BY "createdAt" ASC LIMIT $1`,
    Number(limit)
  );

  if (rows.length === 0) {
    const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "SavedPlace" WHERE ${NEEDS_PHOTO_WHERE}`
    );
    return NextResponse.json({ updated: 0, errors: 0, remaining: Number(count), done: Number(count) === 0 });
  }

  // Fetch full records via Prisma
  const places = await prisma.savedPlace.findMany({
    where: { id: { in: rows.map((r: any) => r.id) } },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      googleData: true,
      placeIntelligenceId: true,
    },
  });

  let updated = 0;
  let errors = 0;
  const errorDetails: Array<{ name: string; error: string }> = [];

  for (const place of places) {
    try {
      const googleResult = await getPlaceById(place.googlePlaceId!);
      if (!googleResult) {
        errors++;
        errorDetails.push({ name: place.name, error: 'not_found_on_google' });
        const existingData = (place.googleData as Record<string, unknown>) || {};
        await prisma.savedPlace.update({
          where: { id: place.id },
          data: {
            googleData: {
              ...existingData,
              _photoBackfillAttempted: true,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        continue;
      }

      const photoUrl = googleResult.photos?.[0]?.name
        ? getPhotoUrl(googleResult.photos[0].name, 800)
        : null;

      if (!photoUrl) {
        errors++;
        errorDetails.push({ name: place.name, error: 'no_photos_available' });
        const existingData = (place.googleData as Record<string, unknown>) || {};
        await prisma.savedPlace.update({
          where: { id: place.id },
          data: {
            googleData: {
              ...existingData,
              _photoBackfillAttempted: true,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        continue;
      }

      // Merge photo + fill in any missing Google fields
      const existingData = (place.googleData as Record<string, unknown>) || {};
      const mergedGoogleData = {
        ...existingData,
        photoUrl,
        address: existingData.address || googleResult.formattedAddress || null,
        rating: existingData.rating || googleResult.rating || null,
        reviewCount: existingData.reviewCount || googleResult.userRatingCount || null,
        lat: existingData.lat || googleResult.location?.latitude || null,
        lng: existingData.lng || googleResult.location?.longitude || null,
        category: existingData.category || googleResult.primaryTypeDisplayName?.text || null,
      };

      await prisma.savedPlace.update({
        where: { id: place.id },
        data: { googleData: mergedGoogleData as unknown as Prisma.InputJsonValue },
      });

      // Also update PlaceIntelligence if linked and missing photo
      if (place.placeIntelligenceId) {
        try {
          const pi = await prisma.placeIntelligence.findUnique({
            where: { id: place.placeIntelligenceId },
            select: { googleData: true },
          });
          const piData = (pi?.googleData as Record<string, unknown>) || {};
          if (!piData.photoUrl) {
            await prisma.placeIntelligence.update({
              where: { id: place.placeIntelligenceId },
              data: {
                googleData: { ...piData, photoUrl } as unknown as Prisma.InputJsonValue,
              },
            });
          }
        } catch { /* non-critical */ }
      }

      updated++;
    } catch (err) {
      errors++;
      errorDetails.push({ name: place.name, error: String(err) });
    }
  }

  const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "SavedPlace" WHERE ${NEEDS_PHOTO_WHERE}`
  );

  return NextResponse.json({
    updated,
    errors,
    remaining: Number(count),
    done: Number(count) === 0,
    ...(errorDetails.length > 0 ? { errorDetails: errorDetails.slice(0, 10) } : {}),
  });
}
