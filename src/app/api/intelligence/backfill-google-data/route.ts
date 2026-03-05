/**
 * POST /api/intelligence/backfill-google-data
 *
 * Re-fetches Google Places data for SavedPlaces whose googleData is missing
 * key fields (rating, reviewCount, category). Updates both SavedPlace and
 * PlaceIntelligence with the canonical data.
 *
 * Query params:
 *   ?dryRun=true  — report what would be updated without acting
 *   ?limit=50     — max records to process (default 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';

export async function POST(req: NextRequest) {
  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

    // Find SavedPlaces with googleData missing rating
    const places = await prisma.savedPlace.findMany({
      where: {
        deletedAt: null,
        googlePlaceId: { not: null },
      },
      select: {
        id: true,
        name: true,
        googlePlaceId: true,
        googleData: true,
        placeIntelligenceId: true,
      },
    });

    // Filter to those missing rating in googleData
    const needsBackfill = places.filter(p => {
      const gd = p.googleData as Record<string, unknown> | null;
      return gd && !gd.rating;
    }).slice(0, limit);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: places.length,
        needsBackfill: needsBackfill.length,
        places: needsBackfill.map(p => ({ name: p.name, googlePlaceId: p.googlePlaceId })),
      });
    }

    const updated: { name: string; rating: number | null }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const place of needsBackfill) {
      try {
        // Re-fetch from Google Places API
        const googleResult = await searchPlace(place.name);
        if (!googleResult || googleResult.id !== place.googlePlaceId) {
          // Try direct search with the place name
          errors.push({ name: place.name, error: 'Google result mismatch or not found' });
          continue;
        }

        const canonicalGoogleData = {
          ...(place.googleData as Record<string, unknown>),
          rating: googleResult.rating || null,
          reviewCount: googleResult.userRatingCount || null,
          priceLevel: googleResult.priceLevel || null,
          hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
          category: googleResult.primaryTypeDisplayName?.text || null,
        };

        // Update SavedPlace (all copies for this googlePlaceId)
        await prisma.savedPlace.updateMany({
          where: { googlePlaceId: place.googlePlaceId },
          data: { googleData: canonicalGoogleData as any },
        });

        // Update PlaceIntelligence if linked
        if (place.placeIntelligenceId) {
          await prisma.placeIntelligence.update({
            where: { id: place.placeIntelligenceId },
            data: { googleData: canonicalGoogleData as any },
          });
        }

        updated.push({ name: place.name, rating: googleResult.rating || null });

        // Small delay to avoid hammering Google API
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors.push({
          name: place.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: places.length,
      needed: needsBackfill.length,
      updated: updated.length,
      places: updated,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('[backfill-google-data] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed', details: (error as Error).message },
      { status: 500 },
    );
  }
}
