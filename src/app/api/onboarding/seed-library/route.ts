import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import type { User } from '@prisma/client';

interface SeedLibraryRequest {
  archetypeName: string;
}

interface SeedLibraryResponse {
  savedCount: number;
  collectionId?: string;
}

export const POST = authHandler(async (req: NextRequest, _ctx, user: User): Promise<NextResponse<SeedLibraryResponse>> => {
  try {
    const body = await req.json() as SeedLibraryRequest;
    const { archetypeName } = body;

    if (!archetypeName) {
      return NextResponse.json(
        { error: 'archetypeName is required' } as any,
        { status: 400 }
      );
    }

    // ── Fetch enriched places from PlaceIntelligence ──
    const enrichedPlaces = await prisma.placeIntelligence.findMany({
      where: {
        signals: {
          not: {
            equals: null,
          },
        },
        description: {
          not: null,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
      select: {
        googlePlaceId: true,
        name: true,
        type: true,
        location: true,
        signals: true,
        description: true,
      },
    });

    // If no enriched places available, return early (graceful cold-start)
    if (enrichedPlaces.length === 0) {
      return NextResponse.json<SeedLibraryResponse>({
        savedCount: 0,
      });
    }

    // ── Save each place to the user's library ──
    const savedPlaceIds: string[] = [];

    for (const place of enrichedPlaces) {
      if (!place.googlePlaceId) continue;

      // Check if place already exists in user's library
      const existing = await prisma.savedPlace.findUnique({
        where: {
          userId_googlePlaceId: {
            userId: user.id,
            googlePlaceId: place.googlePlaceId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        savedPlaceIds.push(existing.id);
        continue;
      }

      // Create new saved place with terrazzo_seed source
      try {
        const saved = await prisma.savedPlace.create({
          data: {
            userId: user.id,
            googlePlaceId: place.googlePlaceId,
            name: place.name || 'Unknown',
            type: place.type || 'activity',
            location: place.location || '',
            source: {
              type: 'terrazzo',
              name: 'Terrazzo Picks',
            },
            matchScore: 0,
            savedAt: new Date(),
          },
          select: { id: true },
        });

        savedPlaceIds.push(saved.id);
      } catch (err) {
        // Log but continue — don't fail seeding if one place fails
        console.error('[seed-library] Failed to save place:', place.googlePlaceId, err);
      }
    }

    // ── Create collection with seeded places ──
    let collectionId: string | undefined;

    if (savedPlaceIds.length > 0) {
      try {
        const collection = await prisma.shortlist.create({
          data: {
            userId: user.id,
            name: `Terrazzo Picks for ${archetypeName}`,
            emoji: '✨',
            placeIds: savedPlaceIds,
          },
          select: { id: true },
        });

        collectionId = collection.id;
      } catch (err) {
        // Log but don't fail — we saved places successfully
        console.error('[seed-library] Failed to create collection:', err);
      }
    }

    return NextResponse.json<SeedLibraryResponse>({
      savedCount: savedPlaceIds.length,
      collectionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to seed library';
    console.error('[seed-library] Error:', message);

    return NextResponse.json(
      { error: message } as any,
      { status: 500 }
    );
  }
});
