import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess, logTripActivity } from '@/lib/trip-access';

/**
 * GET /api/trips/[id]/reactions — List all reactions for a trip.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || !role) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const reactions = await prisma.tripReaction.findMany({
    where: { tripId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json({ reactions });
}

/**
 * POST /api/trips/[id]/reactions — React to a placed item.
 * Requires "suggester" role (or owner).
 * Body: { placeKey: string, reaction: "love" | "not_for_me", note?: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);

  if (!user || !role) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role === 'viewer') {
    return Response.json({ error: 'Viewers cannot react' }, { status: 403 });
  }

  const body = await req.json();
  const { placeKey, reaction, note } = body;

  if (!placeKey || !reaction) {
    return Response.json({ error: 'placeKey and reaction are required' }, { status: 400 });
  }
  if (!['love', 'not_for_me'].includes(reaction)) {
    return Response.json({ error: 'Reaction must be love or not_for_me' }, { status: 400 });
  }

  // Upsert: allow changing reaction
  const tripReaction = await prisma.tripReaction.upsert({
    where: {
      tripId_userId_placeKey: { tripId, userId: user.id, placeKey },
    },
    create: {
      tripId,
      userId: user.id,
      placeKey,
      reaction,
      note: note || null,
    },
    update: {
      reaction,
      note: note || null,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const emoji = reaction === 'love' ? '👍' : '👎';
  logTripActivity(
    tripId,
    user.id,
    'reaction_added',
    `${user.name || user.email} reacted ${emoji} to ${placeKey.split('-').pop() || 'a place'}`,
    { placeKey, reaction },
  );

  return Response.json({ reaction: tripReaction });
}
