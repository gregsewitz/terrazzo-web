import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess, logTripActivity } from '@/lib/trip-access';

/**
 * GET /api/trips/[id]/notes — List all slot notes for a trip.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || !role) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const notes = await prisma.slotNote.findMany({
    where: { tripId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return Response.json({ notes });
}

/**
 * POST /api/trips/[id]/notes — Add a note to a slot.
 * Requires "suggester" role (or owner).
 * Body: { dayNumber: number, slotId: string, content: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);

  if (!user || !role) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role === 'viewer') {
    return Response.json({ error: 'Viewers cannot add notes' }, { status: 403 });
  }

  const body = await req.json();
  const { dayNumber, slotId, content } = body;

  if (dayNumber == null || !slotId || !content) {
    return Response.json({ error: 'dayNumber, slotId, and content are required' }, { status: 400 });
  }

  const note = await prisma.slotNote.create({
    data: {
      tripId,
      userId: user.id,
      dayNumber,
      slotId,
      content,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  logTripActivity(
    tripId,
    user.id,
    'note_added',
    `${user.name || user.email} added a note on Day ${dayNumber} ${slotId}: "${content.slice(0, 50)}"`,
    { noteId: note.id, dayNumber, slotId },
  );

  return Response.json({ note });
}
