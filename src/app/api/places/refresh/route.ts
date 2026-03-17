import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import type { User } from '@prisma/client';

/**
 * POST /api/places/refresh
 *
 * Lightweight endpoint for enrichment polling.
 * Accepts an array of place IDs and returns their current DB state,
 * including any intelligence data written by the enrichment pipeline.
 *
 * Used by the collection view to poll for enrichment completion
 * after a Google Maps import.
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const { placeIds } = await req.json() as { placeIds: string[] };

  if (!Array.isArray(placeIds) || placeIds.length === 0) {
    return Response.json({ places: [] });
  }

  // Cap at 50 to prevent abuse
  const ids = placeIds.slice(0, 50);

  const places = await prisma.savedPlace.findMany({
    where: {
      id: { in: ids },
      userId: user.id,
      deletedAt: null,
    },
    include: {
      intelligence: {
        select: {
          status: true,
          description: true,
          googleData: true,
          whatToOrder: true,
          tips: true,
          alsoKnownAs: true,
        },
      },
    },
  });

  // Map to a slim response — only the fields the client needs to patch
  const results = places.map((p: any) => {
    const intel = p.intelligence;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleData = (intel?.googleData || p.googleData) as any;

    return {
      id: p.id,
      type: p.type,
      location: p.location,
      matchScore: p.matchScore,
      tasteNote: p.tasteNote,
      google: googleData ? {
        placeId: googleData.placeId || googleData.id || p.googlePlaceId,
        rating: googleData.rating,
        reviewCount: googleData.reviewCount || googleData.userRatingCount,
        category: googleData.category || googleData.primaryTypeDisplayName?.text || googleData.primaryType,
        priceLevel: googleData.priceLevel,
        hours: googleData.hours || googleData.regularOpeningHours?.weekdayDescriptions,
        photoUrl: googleData.photoUrl,
        address: googleData.address || googleData.formattedAddress,
        website: googleData.website,
        phone: googleData.phone,
        lat: googleData.lat || googleData.location?.latitude,
        lng: googleData.lng || googleData.location?.longitude,
      } : undefined,
      enrichment: p.enrichment || undefined,
      whatToOrder: (intel?.whatToOrder || p.whatToOrder) as string[] | undefined,
      tips: (intel?.tips || p.tips) as string[] | undefined,
      alsoKnownAs: (intel?.alsoKnownAs || p.alsoKnownAs) as string | undefined,
      terrazzoInsight: p.terrazzoInsight || undefined,
      enrichmentStatus: intel?.status || 'unknown',
    };
  });

  return Response.json({ places: results });
});
