import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const updates = await req.json();

  const existing = await prisma.trip.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  const trip = await prisma.trip.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.days !== undefined && { days: updates.days }),
      ...(updates.pool !== undefined && { pool: updates.pool }),
      ...(updates.conversationHistory !== undefined && { conversationHistory: updates.conversationHistory }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.destinations !== undefined && { destinations: updates.destinations }),
      ...(updates.endDate !== undefined && { endDate: new Date(updates.endDate) }),
      ...(updates.startDate !== undefined && { startDate: new Date(updates.startDate) }),
      ...(updates.location !== undefined && { location: updates.location }),
    },
  });

  return Response.json({ trip });
});

/**
 * DELETE /api/trips/[id]
 *
 * Deletes a trip. This only removes slot references — all places
 * stay in the user's library. This is "unplacing," not deleting.
 *
 * Prisma cascades automatically handle:
 *   - Place records (trip-scoped) → deleted
 *   - TripCollaborator records → deleted
 *   - TripSuggestion records → deleted
 *   - TripReaction records → deleted
 *   - SlotNote records → deleted
 *   - TripActivity records → deleted
 *
 * We also deactivate any active share links for this trip.
 */
export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.trip.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Deactivate share links + delete trip in a transaction
  await prisma.$transaction([
    prisma.shareLink.updateMany({
      where: {
        userId: user.id,
        resourceType: 'trip',
        resourceId: id,
        isActive: true,
      },
      data: { isActive: false },
    }),
    prisma.trip.delete({ where: { id } }),
  ]);

  return Response.json({ success: true });
});
