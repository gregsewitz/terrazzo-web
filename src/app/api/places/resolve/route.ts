import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { searchPlace, getPhotoUrl, mapGoogleTypeToPlaceType, priceLevelToString } from '@/lib/places';
import type { User } from '@prisma/client';

/**
 * POST /api/places/resolve
 *
 * Resolves a place name + location into a full place record with a googlePlaceId.
 * Used by the discover feed to make AI-generated place names clickable.
 *
 * Flow:
 *   1. Search Google Places for the name + location
 *   2. Check if the user already has this place saved (SavedPlace)
 *   3. Check if PlaceIntelligence already exists
 *   4. If neither, silently trigger the Inngest enrichment pipeline
 *   5. Return everything needed for the detail page
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const { name, location } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // 1. Search Google Places API — use exact name for best match
  const query = location ? `${name}, ${location}` : name;
  const googleResult = await searchPlace(query);

  if (!googleResult) {
    return NextResponse.json(
      { error: 'Place not found on Google Maps', name, location },
      { status: 404 },
    );
  }

  const googlePlaceId = googleResult.id;
  const resolvedName = googleResult.displayName?.text || name;

  // Log if Google returned a different name than what was queried (helps debug mismatches)
  if (resolvedName.toLowerCase() !== name.toLowerCase()) {
    console.log(`[resolve] Name mismatch: queried "${name}" → Google returned "${resolvedName}" (id: ${googlePlaceId})`);
  }

  // 2. Check if user already has this place in their library
  const savedPlace = await prisma.savedPlace.findUnique({
    where: {
      userId_googlePlaceId: { userId: user.id, googlePlaceId },
    },
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      matchScore: true,
      matchBreakdown: true,
      tasteNote: true,
      enrichment: true,
      googleData: true,
      placeIntelligenceId: true,
      deletedAt: true,
    },
  });

  // 3. Ensure intelligence exists (creates record + triggers pipeline if needed)
  const intelligenceId = await ensureEnrichment(googlePlaceId, resolvedName, user.id);

  // 4. Fetch intelligence status if we have an ID
  let intelligenceStatus: string | null = null;
  if (intelligenceId) {
    const intel = await prisma.placeIntelligence.findUnique({
      where: { id: intelligenceId },
      select: { status: true },
    });
    intelligenceStatus = intel?.status || null;
  }

  // 5. Build Google data payload
  const photoUrl = googleResult.photos?.[0]?.name
    ? getPhotoUrl(googleResult.photos[0].name, 800)
    : null;

  const googleData = {
    address: googleResult.formattedAddress || null,
    rating: googleResult.rating || null,
    reviewCount: googleResult.userRatingCount || null,
    priceLevel: priceLevelToString(googleResult.priceLevel),
    hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
    photoUrl,
    lat: googleResult.location?.latitude || null,
    lng: googleResult.location?.longitude || null,
    category: googleResult.primaryTypeDisplayName?.text || null,
  };

  return NextResponse.json({
    googlePlaceId,
    name: resolvedName,
    queriedName: name, // original name before Google resolution
    location: location || googleResult.formattedAddress || null,
    type: mapGoogleTypeToPlaceType(googleResult.primaryType),
    googleData,
    // Library state
    savedPlaceId: savedPlace?.deletedAt ? null : savedPlace?.id || null,
    isInLibrary: savedPlace ? savedPlace.deletedAt === null : false,
    matchScore: savedPlace?.matchScore || null,
    matchBreakdown: savedPlace?.matchBreakdown || null,
    tasteNote: savedPlace?.tasteNote || null,
    // Intelligence state
    intelligenceId: intelligenceId || null,
    intelligenceStatus: intelligenceStatus || 'unknown',
  });
});
