import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { searchPlace, getPlaceById, getPhotoUrl, mapGoogleTypeToPlaceType, priceLevelToString } from '@/lib/places';
import { normalizeSingleVectorScore } from '@/lib/taste-match-vectors';
import { computeTasteScore } from '@/lib/taste-score';
import { resolveExplanationLabels } from '@/lib/resolve-explanation-labels';
import type { User, Prisma } from '@prisma/client';

/**
 * POST /api/places/resolve
 *
 * Resolves a place into a full record for the detail page.
 *
 * Two modes:
 *   A. googlePlaceId provided (pre-resolved at discover generation time):
 *      Direct lookup by ID — faster, no wrong-place risk.
 *   B. name + location only (fallback for older cached feeds):
 *      Text search via Google Places API — may return wrong place.
 *
 * Flow:
 *   1. Look up or search via Google Places API
 *   2. Check if the user already has this place saved (SavedPlace)
 *   3. Ensure PlaceIntelligence exists (triggers pipeline if needed)
 *   4. Return everything needed for the detail page
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const { name, location, googlePlaceId: providedId, lat, lng } = await req.json();

  if (!name && !providedId) {
    return NextResponse.json({ error: 'name or googlePlaceId is required' }, { status: 400 });
  }

  // 1. Get Google Place data — by ID if available, text search as fallback
  let googleResult;
  if (providedId) {
    // Pre-resolved: direct lookup by canonical ID
    googleResult = await getPlaceById(providedId);
  } else {
    // Fallback: text search — use lat/lng as locationBias when available
    // to prevent ambiguous names (e.g. "Hunan") from resolving to wrong entities
    const query = location ? `${name}, ${location}` : name;
    const locationBias = (lat && lng)
      ? { lat: Number(lat), lng: Number(lng), radiusMeters: 2000 }
      : undefined;
    googleResult = await searchPlace(query, locationBias, name);
  }

  if (!googleResult) {
    return NextResponse.json(
      { error: 'Place not found on Google Maps', name, location, googlePlaceId: providedId },
      { status: 404 },
    );
  }

  const googlePlaceId = googleResult.id;
  const resolvedName = googleResult.displayName?.text || name || '';

  // Log if Google returned a different name than what was queried (helps debug mismatches)
  if (name && resolvedName.toLowerCase() !== name.toLowerCase()) {
    console.log(`[resolve] Name mismatch: queried "${name}" → Google returned "${resolvedName}" (id: ${googlePlaceId})`);
  }

  // 2. Check if user already has this place in their library
  // Note: matchExplanation added in v4 migration — Prisma types update on next `prisma generate`
  const savedPlaceSelect = {
    id: true,
    name: true,
    type: true,
    location: true,
    matchScore: true,
    matchBreakdown: true,
    matchExplanation: true as any, // v4: pending prisma generate
    tasteNote: true,
    enrichment: true,
    googleData: true,
    googlePlaceId: true,
    placeIntelligenceId: true,
    deletedAt: true,
  } as const;

  let savedPlace = await prisma.savedPlace.findUnique({
    where: {
      userId_googlePlaceId: { userId: user.id, googlePlaceId },
    },
    select: savedPlaceSelect,
  });

  // 2b. Fallback: if not found by googlePlaceId, check by name (handles email imports
  //     where Google Places resolution failed and googlePlaceId is null)
  if (!savedPlace) {
    savedPlace = await prisma.savedPlace.findFirst({
      where: {
        userId: user.id,
        name: { equals: name, mode: 'insensitive' },
        googlePlaceId: null,
        deletedAt: null,
      },
      select: savedPlaceSelect,
    });

    // Backfill the googlePlaceId on the SavedPlace so future lookups work directly
    if (savedPlace) {
      console.log(`[resolve] Backfilling googlePlaceId for "${savedPlace.name}" (${savedPlace.id})`);
      await prisma.savedPlace.update({
        where: { id: savedPlace.id },
        data: { googlePlaceId, googleData: googleResult as unknown as Prisma.InputJsonValue },
      }).catch((err: unknown) => {
        console.error(`[resolve] Failed to backfill googlePlaceId for ${savedPlace!.id}:`, err);
      });
    }
  }

  // 3. Ensure intelligence exists (creates record + triggers pipeline if needed)
  const resolvedPlaceType = mapGoogleTypeToPlaceType(googleResult.primaryType);
  const intelligenceId = await ensureEnrichment(googlePlaceId, resolvedName, user.id, 'user_import', resolvedPlaceType);

  // 3a. Store canonical googleData on PlaceIntelligence as fallback
  //     The pipeline worker is the primary writer of PI.googleData (via its google_places stage).
  //     This acts as a safety net for cases where the pipeline hasn't run yet or failed.
  if (intelligenceId) {
    const existingIntel = await prisma.placeIntelligence.findUnique({
      where: { id: intelligenceId },
      select: { googleData: true },
    });
    if (!existingIntel?.googleData) {
      const canonicalGoogleData = {
        address: googleResult.formattedAddress || null,
        rating: googleResult.rating || null,
        reviewCount: googleResult.userRatingCount || null,
        priceLevel: priceLevelToString(googleResult.priceLevel),
        hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
        lat: googleResult.location?.latitude || null,
        lng: googleResult.location?.longitude || null,
        category: googleResult.primaryTypeDisplayName?.text || null,
        website: (googleResult as any).websiteUri || null,
        phone: (googleResult as any).internationalPhoneNumber || null,
        placeId: googlePlaceId,
      };
      await prisma.placeIntelligence.update({
        where: { id: intelligenceId },
        data: { googleData: canonicalGoogleData as any },
      }).catch((err: unknown) => {
        console.error(`[resolve] Failed to store googleData on PlaceIntelligence:`, err);
      });
    }
  }

  // 3b. If SavedPlace exists but isn't linked to intelligence, link it now
  if (intelligenceId && savedPlace && !savedPlace.placeIntelligenceId) {
    await prisma.savedPlace.update({
      where: { id: savedPlace.id },
      data: { placeIntelligenceId: intelligenceId },
    }).catch((err: unknown) => {
      console.error(`[resolve] Failed to link intelligence to SavedPlace ${savedPlace.id}:`, err);
    });
  }

  // 4. Fetch intelligence record (status + signals for scoring)
  let intelligenceStatus: string | null = null;
  let computedMatchScore: number | null = null;
  let computedMatchBreakdown: Record<string, number> | null = null;

  if (intelligenceId) {
    const intel = await prisma.placeIntelligence.findUnique({
      where: { id: intelligenceId },
      select: { status: true, signals: true, antiSignals: true },
    });
    intelligenceStatus = intel?.status || null;

    // If SavedPlace doesn't have scores but intelligence is complete, compute them now
    if (intel?.status === 'complete' && !savedPlace?.matchScore) {
      try {
        const signals = (intel.signals as any[]) || [];
        const antiSignals = (intel.antiSignals as any[]) || [];
        const score = await computeTasteScore(user.id, googlePlaceId, signals, antiSignals);

        if (score) {
          computedMatchScore = score.source === 'vector'
            ? await normalizeSingleVectorScore(score.overallScore, user.id)
            : score.overallScore;
          computedMatchBreakdown = score.breakdown;
        }
      } catch (err) {
        console.error(`[resolve] Failed to compute match:`, err);
      }
    }
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
    matchScore: computedMatchScore
      || (savedPlace?.matchScore
        ? await normalizeSingleVectorScore(savedPlace.matchScore, user.id)
        : null),
    matchBreakdown: savedPlace?.matchBreakdown || computedMatchBreakdown || null,
    matchExplanation: resolveExplanationLabels(savedPlace?.matchExplanation as any) || null,
    tasteNote: savedPlace?.tasteNote || null,
    // Intelligence state
    intelligenceId: intelligenceId || null,
    intelligenceStatus: intelligenceStatus || 'unknown',
  });
});
