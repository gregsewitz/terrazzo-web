import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/places/deleted
 *
 * Returns soft-deleted places within the 30-day recovery window.
 * Powers the "Recently Deleted" folder (like iOS Photos).
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const places = await prisma.savedPlace.findMany({
    where: {
      userId: user.id,
      deletedAt: { not: null, gte: cutoff },
    },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      googlePlaceId: true,
      deletedAt: true,
      googleData: true,
    },
  });

  return Response.json({ places });
});

/**
 * POST /api/places/deleted
 *
 * Restore a soft-deleted place back to the library.
 * Body: { placeId: string }
 *
 * Note: This does NOT restore collection memberships or trip slot
 * references — those links were severed on delete. The place returns
 * to the library as "uncollected."
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { placeId } = await req.json();
  if (!placeId) {
    return Response.json({ error: 'placeId is required' }, { status: 400 });
  }

  const place = await prisma.savedPlace.findFirst({
    where: {
      id: placeId,
      userId: user.id,
      deletedAt: { not: null },
    },
  });

  if (!place) {
    return Response.json({ error: 'Deleted place not found' }, { status: 404 });
  }

  const restored = await prisma.savedPlace.update({
    where: { id: placeId },
    data: { deletedAt: null },
  });

  return Response.json({ place: restored });
});
