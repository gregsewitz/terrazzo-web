import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

/**
 * GET /api/places/[id]/deletion-impact
 *
 * Returns the impact summary of deleting a place from the library.
 * Used by the UI to show the confirmation dialog:
 *   "This place is in 3 collections, on Day 2 of Rome trip..."
 */
export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const place = await prisma.savedPlace.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      tripPlaceRefs: {
        select: {
          id: true,
          tripId: true,
          placedIn: true,
          trip: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!place) {
    return Response.json({ error: 'Place not found' }, { status: 404 });
  }

  // Find collections containing this place
  const collections = await prisma.shortlist.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, placeIds: true },
  });

  const memberCollections = collections.filter((c) => {
    const ids = c.placeIds as string[];
    return ids.includes(id);
  });

  // Build trip references with day info
  const tripRefs = place.tripPlaceRefs.map((ref) => {
    const placedIn = ref.placedIn as { day: number; slot: string } | null;
    return {
      tripId: ref.trip.id,
      tripName: ref.trip.name,
      dayNumber: placedIn?.day ?? null,
      slotId: placedIn?.slot ?? null,
    };
  });

  return Response.json({
    placeId: place.id,
    placeName: place.name,
    collectionCount: memberCollections.length,
    collections: memberCollections.map((c) => ({ id: c.id, name: c.name })),
    tripCount: tripRefs.length,
    trips: tripRefs,
  });
});
