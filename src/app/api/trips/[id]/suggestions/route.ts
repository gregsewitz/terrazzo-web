import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess, logTripActivity } from '@/lib/trip-access';

/**
 * GET /api/trips/[id]/suggestions — List all suggestions for a trip.
 * Accessible by owner or any accepted collaborator.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || !role) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const statusFilter = req.nextUrl.searchParams.get('status'); // optional filter

  const suggestions = await prisma.tripSuggestion.findMany({
    where: {
      tripId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json({ suggestions });
}

/**
 * POST /api/trips/[id]/suggestions — Suggest a place for a slot.
 * Requires "suggester" role (or owner).
 * Body: { placeName, placeType, placeLocation?, placeData?, targetDay, targetSlotId, reason? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);

  if (!user || !role) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role === 'viewer') {
    return Response.json({ error: 'Viewers cannot suggest places' }, { status: 403 });
  }

  const body = await req.json();
  const { placeName, placeType, placeLocation, placeData, targetDay, targetSlotId, reason } = body;

  if (!placeName || !placeType || targetDay == null || !targetSlotId) {
    return Response.json({ error: 'placeName, placeType, targetDay, and targetSlotId are required' }, { status: 400 });
  }

  const suggestion = await prisma.tripSuggestion.create({
    data: {
      tripId,
      userId: user.id,
      placeName,
      placeType,
      placeLocation: placeLocation || null,
      placeData: placeData || undefined,
      targetDay,
      targetSlotId,
      reason: reason || null,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  logTripActivity(
    tripId,
    user.id,
    'suggestion_added',
    `${user.name || user.email} suggested ${placeName} for Day ${targetDay} ${targetSlotId}`,
    { suggestionId: suggestion.id, placeName, targetDay, targetSlotId },
  );

  return Response.json({ suggestion });
}
