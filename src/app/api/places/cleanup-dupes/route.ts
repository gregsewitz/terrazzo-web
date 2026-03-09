import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchPlace, resolveGooglePlaceType, getPhotoUrl, priceLevelToString } from '@/lib/places';

/**
 * POST /api/places/cleanup-dupes
 *
 * One-off endpoint to:
 * 1. Deduplicate 5 places that each have 5 identical copies
 * 2. Re-resolve Google Place IDs for 3 places with wrong IDs
 *
 * Temporary — delete after use.
 */

// The 5 places that need cleanup (name → search query for correct Place ID)
const PLACES_TO_FIX: Array<{
  name: string;
  searchQuery: string | null; // null = keep existing Place ID (just dedup)
  locationBias: { lat: number; lng: number } | null;
  expectedType: string | null; // expected type after fix
}> = [
  {
    name: 'Hunan',
    searchQuery: 'Hunan restaurant London',
    locationBias: { lat: 51.5074, lng: -0.1278 }, // London
    expectedType: 'restaurant',
  },
  {
    name: 'The Cadogan Arms',
    searchQuery: 'The Cadogan Arms pub London Chelsea',
    locationBias: { lat: 51.4924, lng: -0.1632 }, // Chelsea
    expectedType: 'bar',
  },
  {
    name: '40 Maltby Street',
    searchQuery: '40 Maltby Street wine bar London Bermondsey',
    locationBias: { lat: 51.4988, lng: -0.0779 }, // Bermondsey
    expectedType: 'bar',
  },
  {
    name: 'Mt. Etna Excursion',
    searchQuery: null, // legitimately activity, just dedup
    locationBias: null,
    expectedType: null,
  },
  {
    name: 'Lucha Libre at Arena México',
    searchQuery: null, // legitimately activity, just dedup
    locationBias: null,
    expectedType: null,
  },
];

export async function POST() {
  const results: Array<{
    name: string;
    totalFound: number;
    kept: string;
    softDeleted: number;
    placeIdUpdated: boolean;
    newPlaceId?: string;
    newType?: string;
    error?: string;
  }> = [];

  for (const place of PLACES_TO_FIX) {
    try {
      // Find all copies of this place (active only)
      const dupes = await prisma.savedPlace.findMany({
        where: {
          name: place.name,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' }, // newest first
      });

      if (dupes.length === 0) {
        results.push({
          name: place.name,
          totalFound: 0,
          kept: '',
          softDeleted: 0,
          placeIdUpdated: false,
          error: 'No records found',
        });
        continue;
      }

      // Keep the first (newest updated) record
      const keeper = dupes[0];
      const toDelete = dupes.slice(1);

      // Soft-delete the duplicates
      if (toDelete.length > 0) {
        await prisma.savedPlace.updateMany({
          where: {
            id: { in: toDelete.map(d => d.id) },
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      // Re-resolve Place ID if needed
      let placeIdUpdated = false;
      let newPlaceId: string | undefined;
      let newType: string | undefined;

      if (place.searchQuery && place.locationBias) {
        const googleResult = await searchPlace(
          place.searchQuery,
          { lat: place.locationBias.lat, lng: place.locationBias.lng, radiusMeters: 5000 },
          place.name, // nameHint for better matching
        );

        if (googleResult) {
          const resolvedType = resolveGooglePlaceType(
            googleResult.primaryType,
            googleResult.types,
            place.name,
          );

          // Build updated googleData
          const googleData: Record<string, unknown> = {
            ...(typeof keeper.googleData === 'object' && keeper.googleData !== null ? keeper.googleData : {}),
            category: googleResult.primaryType || googleResult.types?.[0],
            types: googleResult.types,
            primaryType: googleResult.primaryType,
            rating: googleResult.rating,
            userRatingCount: googleResult.userRatingCount,
            priceLevel: googleResult.priceLevel,
            formattedAddress: googleResult.formattedAddress,
            location: googleResult.location,
          };

          // Add photo if available
          if (googleResult.photos?.[0]?.name) {
            googleData.photoUrl = getPhotoUrl(googleResult.photos[0].name, 400);
          }

          await prisma.savedPlace.update({
            where: { id: keeper.id },
            data: {
              googlePlaceId: googleResult.id,
              type: place.expectedType || resolvedType,
              googleData,
              location: googleResult.formattedAddress || keeper.location,
            },
          });

          placeIdUpdated = true;
          newPlaceId = googleResult.id;
          newType = place.expectedType || resolvedType;
        } else {
          results.push({
            name: place.name,
            totalFound: dupes.length,
            kept: keeper.id,
            softDeleted: toDelete.length,
            placeIdUpdated: false,
            error: `Google search returned no results for "${place.searchQuery}"`,
          });
          continue;
        }
      }

      results.push({
        name: place.name,
        totalFound: dupes.length,
        kept: keeper.id,
        softDeleted: toDelete.length,
        placeIdUpdated,
        newPlaceId,
        newType,
      });
    } catch (err) {
      results.push({
        name: place.name,
        totalFound: 0,
        kept: '',
        softDeleted: 0,
        placeIdUpdated: false,
        error: String(err),
      });
    }
  }

  return NextResponse.json({
    summary: {
      totalProcessed: results.length,
      totalSoftDeleted: results.reduce((sum, r) => sum + r.softDeleted, 0),
      totalPlaceIdsFixed: results.filter(r => r.placeIdUpdated).length,
    },
    results,
  });
}
