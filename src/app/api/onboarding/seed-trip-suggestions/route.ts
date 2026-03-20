import { NextRequest, NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-auth-handler';
import { prisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  try {
    const { tripId, destination } = await req.json();

    if (!tripId || !destination) {
      return NextResponse.json(
        { error: 'tripId and destination are required' },
        { status: 400 }
      );
    }

    // Verify trip belongs to user
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: user.id },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Find enriched places near this destination
    const suggestions = await prisma.placeIntelligence.findMany({
      where: {
        propertyName: { contains: destination, mode: 'insensitive' },
        signals: { not: { equals: null } },
        status: 'complete',
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        googlePlaceId: true,
        propertyName: true,
        placeType: true,
        description: true,
        signals: true,
      },
    });

    // If no exact matches, try broader search with first word
    let suggestionsToCreate = suggestions;
    if (suggestionsToCreate.length === 0) {
      const firstWord = destination.split(/[,\s]+/)[0];
      if (firstWord) {
        suggestionsToCreate = await prisma.placeIntelligence.findMany({
          where: {
            propertyName: { contains: firstWord, mode: 'insensitive' },
            signals: { not: { equals: null } },
            status: 'complete',
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            googlePlaceId: true,
            propertyName: true,
            placeType: true,
            description: true,
            signals: true,
          },
        });
      }
    }

    // Create TripSuggestion records
    if (suggestionsToCreate.length > 0) {
      await Promise.all(
        suggestionsToCreate.map((place: typeof suggestions[number]) =>
          prisma.tripSuggestion.create({
            data: {
              tripId,
              userId: user.id,
              googlePlaceId: place.googlePlaceId || undefined,
              placeName: place.propertyName || 'Unknown place',
              placeType: place.placeType || 'activity',
              placeLocation: destination,
              reason: place.description
                ? `${(place.description as string).slice(0, 120)}...`
                : `Recommended for your trip to ${destination}`,
              targetDay: 1,
              targetSlotId: 'lunch',
              status: 'pending',
            },
          }).catch(() => null) // Skip duplicates silently
        )
      );
    }

    return NextResponse.json({
      suggestionsCreated: suggestionsToCreate.length,
      tripId,
    });
  } catch (error) {
    console.error('[seed-trip-suggestions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed suggestions' },
      { status: 500 }
    );
  }
});
