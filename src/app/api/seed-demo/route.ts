import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/seed-demo — List users in the DB (for finding the right email).
 */
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    take: 20,
  });
  return Response.json({ users });
}

/**
 * POST /api/seed-demo — Seed all demo data into the authenticated user's database.
 *
 * Accepts optional query param ?email=... to look up the user.
 * This is a one-time utility route — safe to remove after use.
 */
export async function POST(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
      return Response.json({ error: 'Email query param required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // List available users to help debug
      const users = await prisma.user.findMany({
        select: { email: true, name: true },
        take: 10,
      });
      return Response.json({
        error: `No user found with email: ${email}`,
        availableUsers: users,
      }, { status: 404 });
    }

  // Dynamically import demo data
  const { DEMO_ALL_PLACES } = await import('@/data/demoSaved');
  const { ALL_DEMO_TRIPS } = await import('@/data/demoTrips');

  // ═══════════════════════════════════════════
  // 1. Seed SavedPlaces
  // ═══════════════════════════════════════════

  // Delete existing places for a clean seed
  await prisma.savedPlace.deleteMany({ where: { userId: user.id } });

  // Map demo places → DB shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toJson = (v: unknown) => v === null || v === undefined ? undefined : v as any;

  const placeCreateOps = DEMO_ALL_PLACES.map(p =>
    prisma.savedPlace.create({
      data: {
        userId: user.id,
        googlePlaceId: p.google?.placeId || null,
        name: p.name,
        type: p.type,
        location: p.location || null,
        source: toJson(p.source),
        ghostSource: p.ghostSource || null,
        friendAttribution: toJson(p.friendAttribution),
        savedDate: p.savedDate || null,
        rating: toJson(p.rating),
        isShortlisted: p.isShortlisted || false,
        matchScore: p.matchScore || null,
        matchBreakdown: toJson(p.matchBreakdown),
        tasteNote: p.tasteNote || null,
        terrazzoInsight: toJson(p.terrazzoInsight),
        enrichment: toJson(p.enrichment),
        whatToOrder: toJson(p.whatToOrder),
        tips: toJson(p.tips),
        alsoKnownAs: p.alsoKnownAs || null,
        googleData: toJson(p.google),
      },
    })
  );

  // Run in batches of 20 to avoid overwhelming the DB
  const createdPlaces: { id: string; name: string; demoId: string }[] = [];
  for (let i = 0; i < placeCreateOps.length; i += 20) {
    const batch = placeCreateOps.slice(i, i + 20);
    const results = await prisma.$transaction(batch);
    results.forEach((p, j) => {
      createdPlaces.push({
        id: p.id,
        name: p.name,
        demoId: DEMO_ALL_PLACES[i + j].id,
      });
    });
  }

  // Build a mapping from demo IDs to real DB IDs
  const idMap = new Map<string, string>();
  createdPlaces.forEach(p => idMap.set(p.demoId, p.id));

  // ═══════════════════════════════════════════
  // 2. Seed Shortlists (using buildShortlists logic)
  // ═══════════════════════════════════════════

  await prisma.shortlist.deleteMany({ where: { userId: user.id } });

  // Rebuild shortlists from the same logic used in savedStore
  const favoritePlaceIds = DEMO_ALL_PLACES.filter(p => p.isShortlisted).map(p => p.id);

  interface ShortlistDef {
    name: string;
    description: string;
    emoji: string;
    isDefault: boolean;
    isSmartCollection: boolean;
    query?: string;
    filterTags?: string[];
    demoPlaceIds: string[];
  }

  const shortlistDefs: ShortlistDef[] = [
    // Default "Favorites" shortlist
    {
      name: 'Favorites',
      description: 'Your saved favorites',
      emoji: 'heart',
      isDefault: true,
      isSmartCollection: false,
      demoPlaceIds: favoritePlaceIds,
    },
    {
      name: 'Scandi design hotels',
      description: 'The best design-forward stays in Scandinavia',
      emoji: 'hotel',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['sc-1', 'sc-8', 'sc-19'],
    },
    {
      name: 'Mexico City musts',
      description: 'The definitive CDMX hit list',
      emoji: 'restaurant',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['mx-3', 'mx-2', 'mx-11', 'mx-14', 'mx-17', 'mx-9', 'mx-4', 'mx-8', 'mx-1'],
    },
    {
      name: 'Paris neo-bistro crawl',
      description: 'The new wave of Paris dining',
      emoji: 'food',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['pa-8', 'pa-3', 'pa-13', 'pa-16', 'pa-14', 'pa-11'],
    },
    {
      name: 'Best cocktail bars',
      description: 'No-menu, speakeasy, mezcal — the good stuff',
      emoji: 'bar',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['saved-3', 'saved-12', 'sc-7', 'sc-14', 'pa-7', 'pa-19', 'mx-9', 'mx-12'],
    },
    {
      name: 'Everything Lizzie recommended',
      description: 'Lizzie N. has impeccable taste',
      emoji: 'friend',
      isDefault: false,
      isSmartCollection: true,
      query: 'everything Lizzie recommended',
      filterTags: ['person: Lizzie'],
      demoPlaceIds: DEMO_ALL_PLACES
        .filter(p => p.friendAttribution?.name === 'Lizzie N.')
        .map(p => p.id),
    },
    {
      name: 'Sicily road trip',
      description: 'Island hopping from Palermo to Taormina',
      emoji: 'discover',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['si-1', 'si-2', 'si-3', 'si-5', 'si-4', 'si-9', 'si-14', 'si-17', 'si-11', 'si-12', 'si-6'],
    },
    {
      name: 'Museums worth the trip',
      description: 'Art, history, and architecture that deliver',
      emoji: 'museum',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['saved-7', 'saved-11', 'pa-5', 'pa-17', 'mx-4', 'mx-18', 'si-4'],
    },
    {
      name: 'Coffee ritual',
      description: 'Specialty roasters and neighborhood cafés',
      emoji: 'cafe',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['sc-4', 'sc-13', 'pa-4', 'pa-10', 'pa-15', 'pa-18', 'mx-5', 'mx-20', 'si-9'],
    },
    {
      name: 'Neighborhoods to wander',
      description: 'Drop a pin and just walk',
      emoji: 'location',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['sc-5', 'sc-11', 'pa-6', 'mx-8', 'si-5', 'si-12'],
    },
    {
      name: 'Splurge nights',
      description: 'When you want the full experience',
      emoji: 'star',
      isDefault: false,
      isSmartCollection: false,
      demoPlaceIds: ['saved-9', 'sc-2', 'saved-6', 'pa-8', 'mx-3', 'si-3', 'si-1', 'sc-1'],
    },
  ];

  const shortlistCreateOps = shortlistDefs.map(sl =>
    prisma.shortlist.create({
      data: {
        userId: user.id,
        name: sl.name,
        description: sl.description,
        emoji: sl.emoji,
        isDefault: sl.isDefault,
        isSmartCollection: sl.isSmartCollection,
        query: sl.query || null,
        filterTags: sl.filterTags ? sl.filterTags : undefined,
        // Map demo IDs → real DB IDs (skip any that didn't map)
        placeIds: sl.demoPlaceIds
          .map(demoId => idMap.get(demoId))
          .filter(Boolean) as string[],
      },
    })
  );

  const createdShortlists = await prisma.$transaction(shortlistCreateOps);

  // ═══════════════════════════════════════════
  // 3. Seed Trips
  // ═══════════════════════════════════════════

  await prisma.trip.deleteMany({ where: { userId: user.id } });

  const tripCreateOps = ALL_DEMO_TRIPS.map(trip => {
    // Remap place IDs in the days and pool
    const remappedDays = trip.days.map(day => ({
      ...day,
      slots: (day.slots || []).map(slot => ({
        ...slot,
        places: (slot.places || []).map(p => ({
          ...p,
          id: idMap.get(p.id) || p.id,
        })),
        ghostItems: (slot.ghostItems || []).map(p => ({
          ...p,
          id: idMap.get(p.id) || p.id,
        })),
      })),
    }));

    const remappedPool = (trip.pool || []).map(p => ({
      ...p,
      id: idMap.get(p.id) || p.id,
    }));

    return prisma.trip.create({
      data: {
        userId: user.id,
        name: trip.name,
        location: trip.location,
        destinations: trip.destinations ? trip.destinations : undefined,
        startDate: trip.startDate ? new Date(trip.startDate) : null,
        endDate: trip.endDate ? new Date(trip.endDate) : null,
        status: trip.status || 'planning',
        days: remappedDays as unknown as import('@prisma/client').Prisma.InputJsonValue,
        pool: remappedPool as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });
  });

  const createdTrips = await prisma.$transaction(tripCreateOps);

  return Response.json({
    success: true,
    userId: user.id,
    email: user.email,
    places: createdPlaces.length,
    shortlists: createdShortlists.length,
    trips: createdTrips.length,
    summary: {
      places: createdPlaces.map(p => p.name).slice(0, 10).join(', ') + (createdPlaces.length > 10 ? '...' : ''),
      shortlists: createdShortlists.map(s => s.name),
      trips: createdTrips.map(t => t.name),
    },
  });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return Response.json({ error: message, stack }, { status: 500 });
  }
}
